const express = require("express");
const { WebhookClient } = require("discord.js");
const { Webhook } = require("@top-gg/sdk");
const http = require("http");
const { EventEmitter } = require("events");
const PostHandler = require("./utils/PostHandler");
const VoteReminder = require("./utils/ReminderHandler");
const StatsTracker = require("./utils/StatsTracker");

module.exports = class VoteTracker extends EventEmitter {
    constructor(client, options = {}) {
        super();
        this.client = client;
        this.port = options.port || 3000;
        this.channelId = options.channelId;
        this.topggAuth = options.password;
        this.embedcolor = options.color || "#333333";
        this.guildid = options.guildId;
        this.roleid = options.roleId;
        this.app = express();
        this.server = http.createServer(this.app);
        this.webhookUrl = options.webhook;
        this.postmode = options.postmode || "channel";
        this.reminder = options.reminder ?? true;
        this.reminderDelayMs = (options.reminderDelayHours ?? 12) * 60 * 60 * 1000;
        this.stats = new StatsTracker(options.stats);
        this.statsEndpoint = options.stats?.endpoint || null;
        this.statsAuthToken = options.stats?.authToken || null;
    }

    setupRoutes() {
        if (!this.topggAuth) {
            throw new Error("VoteTracker: Missing top.gg auth token.");
        }

        if (!this.guildid) {
            throw new Error("VoteTracker: Missing guildId.");
        }

        const topggWebhook = new Webhook(this.topggAuth);

        this.app.use(express.json());

        this.app.post("/dblwebhook", topggWebhook.listener(async (vote) => {
            try {
                const guild = await this.client.guilds.fetch(this.guildid).catch(() => null);
                if (!guild) {
                    console.error(`Invalid Guild Id: ${this.guildid}`);
                    this.emit("error", new Error("VoteTracker: Invalid guild id."));
                    return;
                }

                const role = this.roleid ? guild.roles.cache.get(this.roleid) : null;
                if (this.roleid && !role) {
                    console.warn(`VoteTracker: Role not found for id ${this.roleid}.`);
                }

                const channel = this.channelId ? guild.channels.cache.get(this.channelId) : null;
                if (this.channelId && !channel) {
                    console.warn(`VoteTracker: Channel not found for id ${this.channelId}.`);
                }

                const webhook = this.webhookUrl && this.postmode === "webhook"
                    ? new WebhookClient({ url: this.webhookUrl })
                    : null;

                const user = await this.client.users.fetch(vote.user).catch(() => null);
                if (!user) {
                    console.error(`VoteTracker: Unable to fetch user ${vote.user}.`);
                    this.emit("error", new Error("VoteTracker: Unable to fetch user."));
                    return;
                }

                this.stats.recordVote(user.id);
                this.emit("vote", { user, guild, vote, stats: this.stats.getUserStats(user.id) });

                const postHandler = new PostHandler(
                    this.client,
                    guild,
                    user,
                    role,
                    webhook,
                    channel,
                    this.postmode,
                    this.embedcolor
                );
                const reminder = new VoteReminder(
                    user,
                    this.client,
                    guild,
                    role,
                    this.reminder,
                    this.embedcolor,
                    this.reminderDelayMs
                );

                await postHandler.handlePost();
                await reminder.setReminder();
            } catch (error) {
                console.error(`VoteTracker: Error handling vote webhook: ${error.message}`);
                this.emit("error", error);
            }
        }));

        this.app.get("/health", (req, res) => {
            res.json({ status: "ok" });
        });

        if (this.statsEndpoint && this.stats.enabled) {
            const endpoint = this.statsEndpoint.startsWith("/") ? this.statsEndpoint : `/${this.statsEndpoint}`;
            this.app.get(endpoint, (req, res) => {
                if (this.statsAuthToken) {
                    const header = req.headers.authorization;
                    if (header !== `Bearer ${this.statsAuthToken}`) {
                        res.status(401).json({ error: "Unauthorized" });
                        return;
                    }
                }

                res.json(this.stats.getStats());
            });

            this.app.get(`${endpoint}/leaderboard`, (req, res) => {
                if (this.statsAuthToken) {
                    const header = req.headers.authorization;
                    if (header !== `Bearer ${this.statsAuthToken}`) {
                        res.status(401).json({ error: "Unauthorized" });
                        return;
                    }
                }

                const limit = Number.parseInt(req.query.limit, 10);
                res.json(this.stats.getLeaderboard(limit));
            });

            this.app.get(`${endpoint}/users/:id`, (req, res) => {
                if (this.statsAuthToken) {
                    const header = req.headers.authorization;
                    if (header !== `Bearer ${this.statsAuthToken}`) {
                        res.status(401).json({ error: "Unauthorized" });
                        return;
                    }
                }

                const stats = this.stats.getUserStats(req.params.id);
                if (!stats) {
                    res.status(404).json({ error: "User not found" });
                    return;
                }

                res.json(stats);
            });
        }

        this.server.listen(this.port, () => {
            console.log(`Vote tracker listening on port ${this.port}`);
        });
    }

    init() {
        this.setupRoutes();
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
}
