const express = require("express");
const { ActivityType, MessageFlags, WebhookClient } = require("discord.js");
const { Webhook } = require("@top-gg/sdk");
const { AutoPoster } = require("topgg-autoposter");
const http = require("http");
const { EventEmitter } = require("events");
const PostHandler = require("./utils/PostHandler");
const VoteReminder = require("./utils/ReminderHandler");
const StatsTracker = require("./utils/StatsTracker");
const DiscordUI = require("./utils/DiscordUI");
const { TopggApi, TopggApiError } = require("./utils/TopggApi");
const { verifyV1Webhook } = require("./utils/WebhookVerifier");

class VoteTracker extends EventEmitter {
    constructor(client, options = {}) {
        super();
        if (!client) {
            throw new TypeError("VoteTracker: A Discord client is required.");
        }

        this.client = client;
        this.port = options.port ?? 3000;
        this.host = options.host;
        this.channelId = options.channelId;
        this.topggAuth = options.password;
        this.webhookSecret = options.webhookSecret;
        this.webhookVersion = options.webhookVersion
            || (this.webhookSecret || this.topggAuth?.startsWith("whs_") ? "v1" : "v0");
        this.webhookPath = normalizePath(options.webhookPath || "/dblwebhook");
        this.signatureToleranceSeconds = options.signatureToleranceSeconds ?? 300;
        this.bodyLimit = options.bodyLimit || "100kb";
        this.embedcolor = options.color || "#333333";
        this.guildid = options.guildId;
        this.roleid = options.roleId;
        this.app = options.app || express();
        this.server = options.server || http.createServer(this.app);
        this.webhookUrl = options.webhook;
        this.postmode = options.postmode || "channel";
        this.reminder = options.reminder ?? true;
        this.reminderDelayMs = (options.reminderDelayHours ?? 12) * 60 * 60 * 1000;
        this.stats = new StatsTracker(options.stats);
        this.statsEndpoint = options.stats?.endpoint || null;
        this.statsAuthToken = options.stats?.authToken || null;
        this.apiToken = options.apiToken || null;
        this.topggApi = this.apiToken
            ? new TopggApi(this.apiToken, {
                baseUrl: options.apiBaseUrl,
                fetch: options.fetch,
            })
            : null;
        this.autoPost = options.autoPost ?? false;
        this.autoPostOptions = typeof options.autoPost === "object" ? options.autoPost : {};
        this.autoPoster = null;
        const discordUiOptions = options.discordUi === false ? { enabled: false } : (options.discordUi || {});
        this.discordUi = discordUiOptions.enabled === false
            ? null
            : new DiscordUI({
                ...discordUiOptions,
                accentColor: discordUiOptions.accentColor || options.color,
            });
        this.discordCommands = normalizeFeatureOptions(discordUiOptions.commands);
        this.discordPresence = normalizeFeatureOptions(discordUiOptions.presence);
        this.interactionHandler = (interaction) => {
            this.handleInteraction(interaction).catch((error) => this.emitTrackerError(error));
        };
        this.discordFeaturesReady = false;
        this.routesReady = false;
        this.started = false;
        this.recentVoteIds = new Map();
        this.reminderTimers = new Set();
    }

    setupRoutes() {
        if (this.routesReady) {
            return;
        }
        if (!this.guildid) {
            throw new Error("VoteTracker: Missing guildId.");
        }
        if (!["v0", "v1"].includes(this.webhookVersion)) {
            throw new Error("VoteTracker: webhookVersion must be either 'v0' or 'v1'.");
        }

        if (this.webhookVersion === "v1") {
            const secret = this.webhookSecret || this.topggAuth;
            if (!secret) {
                throw new Error("VoteTracker: Missing top.gg v1 webhookSecret.");
            }

            this.app.post(
                this.webhookPath,
                express.raw({ type: "application/json", limit: this.bodyLimit }),
                (req, res) => this.handleV1Webhook(req, res, secret)
            );
        } else {
            if (!this.topggAuth) {
                throw new Error("VoteTracker: Missing legacy top.gg webhook password.");
            }
            const topggWebhook = new Webhook(this.topggAuth);
            this.app.post(
                this.webhookPath,
                topggWebhook.listener((vote) => this.handleVote(normalizeVote(vote, "v0")))
            );
        }

        this.app.use(express.json({ limit: this.bodyLimit }));
        this.app.get("/health", (req, res) => {
            res.json({
                status: "ok",
                webhookVersion: this.webhookVersion,
                uptime: process.uptime(),
            });
        });

        this.setupStatsRoutes();
        this.routesReady = true;
    }

    handleV1Webhook(req, res, secret) {
        if (!verifyV1Webhook(
            req.body,
            req.get("x-topgg-signature"),
            secret,
            this.signatureToleranceSeconds
        )) {
            res.status(401).json({ error: "Invalid top.gg webhook signature" });
            return;
        }

        let payload;
        try {
            payload = JSON.parse(req.body.toString("utf8"));
        } catch {
            res.status(400).json({ error: "Invalid JSON body" });
            return;
        }

        if (payload.type === "webhook.test") {
            this.emit("webhookTest", {
                payload,
                traceId: req.get("x-topgg-trace") || null,
            });
            res.sendStatus(204);
            return;
        }
        if (payload.type !== "vote.create" || !payload.data?.user?.platform_id) {
            res.status(422).json({ error: "Unsupported top.gg webhook event" });
            return;
        }
        if (this.isDuplicateVote(payload.data.id, payload.data.expires_at)) {
            res.sendStatus(204);
            return;
        }

        const vote = normalizeVote(payload, "v1");
        res.sendStatus(204);
        setImmediate(() => {
            this.handleVote(vote).catch(() => {});
        });
    }

    isDuplicateVote(voteId, expiresAt) {
        if (!voteId) {
            return false;
        }

        const now = Date.now();
        for (const [id, expiry] of this.recentVoteIds) {
            if (expiry <= now) {
                this.recentVoteIds.delete(id);
            }
        }
        if (this.recentVoteIds.has(voteId)) {
            return true;
        }

        const parsedExpiry = Date.parse(expiresAt);
        this.recentVoteIds.set(
            voteId,
            Number.isFinite(parsedExpiry) ? parsedExpiry + 60_000 : now + 24 * 60 * 60 * 1000
        );
        return false;
    }

    async handleVote(vote) {
        try {
            const guild = await this.client.guilds.fetch(this.guildid).catch(() => null);
            if (!guild) {
                throw new Error(`VoteTracker: Invalid guild id ${this.guildid}.`);
            }

            const role = this.roleid
                ? guild.roles.cache.get(this.roleid) || await guild.roles.fetch(this.roleid).catch(() => null)
                : null;
            if (this.roleid && !role) {
                console.warn(`VoteTracker: Role not found for id ${this.roleid}.`);
            }

            const channel = this.channelId
                ? guild.channels.cache.get(this.channelId) || await guild.channels.fetch(this.channelId).catch(() => null)
                : null;
            if (this.channelId && !channel) {
                console.warn(`VoteTracker: Channel not found for id ${this.channelId}.`);
            }

            const webhook = this.webhookUrl && this.postmode === "webhook"
                ? new WebhookClient({ url: this.webhookUrl })
                : null;
            const user = await this.client.users.fetch(vote.user).catch(() => null);
            if (!user) {
                throw new Error(`VoteTracker: Unable to fetch user ${vote.user}.`);
            }

            const stats = this.stats.recordVote(user.id, {
                weight: vote.weight,
                votedAt: vote.createdAt ? Date.parse(vote.createdAt) : undefined,
            });
            this.emit("vote", { user, guild, vote, stats });

            const postHandler = new PostHandler(
                this.client,
                guild,
                user,
                role,
                webhook,
                channel,
                this.postmode,
                this.embedcolor,
                vote,
                stats,
                this.discordUi
            );
            await postHandler.handlePost();
            this.updatePresence();

            const expiresAt = vote.expiresAt ? Date.parse(vote.expiresAt) : NaN;
            const reminderDelayMs = Number.isFinite(expiresAt)
                ? Math.max(0, expiresAt - Date.now())
                : this.reminderDelayMs;
            const reminder = new VoteReminder(
                user,
                this.client,
                guild,
                role,
                this.reminder,
                this.embedcolor,
                reminderDelayMs
            );
            const timer = await reminder.setReminder();
            if (timer) {
                this.reminderTimers.add(timer);
                const forgetTimer = setTimeout(() => this.reminderTimers.delete(timer), reminderDelayMs + 1_000);
                forgetTimer.unref?.();
            }
        } catch (error) {
            console.error(`VoteTracker: Error handling vote webhook: ${error.message}`);
            this.emitTrackerError(error);
            throw error;
        }
    }

    setupStatsRoutes() {
        if (!this.statsEndpoint || !this.stats.enabled) {
            return;
        }

        const endpoint = normalizePath(this.statsEndpoint);
        const authorize = (req, res, next) => {
            if (this.statsAuthToken && req.headers.authorization !== `Bearer ${this.statsAuthToken}`) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }
            next();
        };

        this.app.get(endpoint, authorize, (req, res) => res.json(this.stats.getStats()));
        this.app.get(`${endpoint}/leaderboard`, authorize, (req, res) => {
            res.json(this.stats.getLeaderboard(Number.parseInt(req.query.limit, 10)));
        });
        this.app.get(`${endpoint}/users/:id`, authorize, (req, res) => {
            const stats = this.stats.getUserStats(req.params.id);
            if (!stats) {
                res.status(404).json({ error: "User not found" });
                return;
            }
            res.json(stats);
        });
    }

    init() {
        if (this.started) {
            return this;
        }
        this.setupRoutes();
        this.startAutoPoster();
        this.setupDiscordFeatures().catch((error) => this.emitTrackerError(error));
        this.server.listen(this.port, this.host, () => {
            const address = this.server.address();
            const port = typeof address === "object" && address ? address.port : this.port;
            console.log(`Vote tracker listening on port ${port}`);
            this.emit("ready", { port, webhookPath: this.webhookPath });
        });
        this.started = true;
        return this;
    }

    startAutoPoster() {
        if (!this.autoPost || this.autoPoster) {
            return this.autoPoster;
        }
        if (!this.apiToken) {
            throw new Error("VoteTracker: autoPost requires a top.gg apiToken.");
        }

        this.autoPoster = AutoPoster(this.apiToken, this.client, this.autoPostOptions);
        this.autoPoster.on("posted", (data) => this.emit("statsPosted", data));
        this.autoPoster.on("error", (error) => this.emitTrackerError(error));
        return this.autoPoster;
    }

    async setupDiscordFeatures() {
        if (this.discordFeaturesReady || !this.discordUi) {
            return;
        }
        this.updatePresence();

        if (this.discordCommands.enabled) {
            if (typeof this.client.on !== "function") {
                throw new Error("VoteTracker: Discord commands require a Discord.js Client.");
            }

            this.client.on("interactionCreate", this.interactionHandler);
            const guild = await this.client.guilds.fetch(this.guildid);
            const command = await guild.commands.create(this.discordUi.buildCommand());
            this.emit("commandsReady", { command });
        }
        this.discordFeaturesReady = true;
    }

    async handleInteraction(interaction) {
        if (
            !this.discordUi
            || !this.discordCommands.enabled
            || !interaction.isChatInputCommand?.()
            || interaction.commandName !== this.discordUi.options.commandName
            || interaction.guildId !== this.guildid
        ) {
            return;
        }

        const replyOptions = this.discordCommands.ephemeral === false
            ? {}
            : { flags: MessageFlags.Ephemeral };
        await interaction.deferReply(replyOptions);

        const subcommand = interaction.options.getSubcommand();
        if (subcommand === "leaderboard") {
            await interaction.editReply(this.discordUi.buildLeaderboard({
                client: this.client,
                leaderboard: this.getLeaderboard(this.discordCommands.leaderboardSize || 10),
            }));
            return;
        }

        const user = subcommand === "stats"
            ? interaction.options.getUser("user") || interaction.user
            : interaction.user;
        let activeVote = null;
        if (this.topggApi) {
            try {
                activeVote = await this.getVote(user.id);
            } catch (error) {
                this.emitTrackerError(error);
            }
        }

        await interaction.editReply(this.discordUi.buildVoteDashboard({
            client: this.client,
            user,
            stats: this.getUserStats(user.id),
            activeVote,
        }));
    }

    updatePresence() {
        if (!this.discordPresence.enabled || !this.client.user?.setPresence) {
            return;
        }

        const stats = this.getStats();
        const template = this.discordPresence.text || "{votes} votes • /vote";
        const name = template
            .replaceAll("{votes}", String(stats.totalVotes))
            .replaceAll("{voters}", String(stats.uniqueVoters));
        this.client.user.setPresence({
            activities: [{
                name,
                type: this.discordPresence.type ?? ActivityType.Watching,
            }],
            status: this.discordPresence.status || "online",
        });
    }

    async stop() {
        this.autoPoster?.stop();
        this.autoPoster = null;
        if (this.discordCommands.enabled) {
            this.client.off?.("interactionCreate", this.interactionHandler);
        }
        this.discordFeaturesReady = false;
        for (const timer of this.reminderTimers) {
            clearTimeout(timer);
        }
        this.reminderTimers.clear();

        if (!this.server.listening) {
            this.started = false;
            return;
        }
        await new Promise((resolve, reject) => {
            this.server.close((error) => error ? reject(error) : resolve());
        });
        this.started = false;
    }

    emitTrackerError(error) {
        if (this.listenerCount("error") > 0) {
            this.emit("error", error);
        } else {
            console.error(`VoteTracker: ${error.message}`);
        }
    }

    getStats() {
        return this.stats.getStats();
    }

    getUserStats(userId) {
        return this.stats.getUserStats(userId);
    }

    getLeaderboard(limit) {
        return this.stats.getLeaderboard(limit);
    }

    getProject() {
        return this.requireApi().getProject();
    }

    getVote(userId, source) {
        return this.requireApi().getVote(userId, source);
    }

    getVotes(options) {
        return this.requireApi().getVotes(options);
    }

    requireApi() {
        if (!this.topggApi) {
            throw new Error("VoteTracker: This method requires a top.gg apiToken.");
        }
        return this.topggApi;
    }
}

function normalizePath(path) {
    return path.startsWith("/") ? path : `/${path}`;
}

function normalizeFeatureOptions(value) {
    if (value === true) {
        return { enabled: true };
    }
    if (!value || value === false) {
        return { enabled: false };
    }
    return { enabled: value.enabled ?? true, ...value };
}

function normalizeVote(payload, version) {
    if (version === "v1") {
        const data = payload.data;
        return {
            id: data.id,
            user: data.user.platform_id,
            bot: data.project.platform_id,
            type: "upvote",
            isWeekend: data.weight > 1,
            weight: data.weight || 1,
            createdAt: data.created_at,
            expiresAt: data.expires_at,
            sourceVersion: "v1",
            raw: payload,
        };
    }

    return {
        ...payload,
        weight: payload.isWeekend ? 2 : 1,
        createdAt: null,
        expiresAt: null,
        sourceVersion: "v0",
        raw: payload,
    };
}

module.exports = VoteTracker;
module.exports.default = VoteTracker;
module.exports.VoteTracker = VoteTracker;
module.exports.TopggApiError = TopggApiError;
module.exports.normalizeVote = normalizeVote;
