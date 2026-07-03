const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { EventEmitter, once } = require("node:events");
const { test } = require("node:test");
const VoteTracker = require("../src");
const StatsTracker = require("../src/utils/StatsTracker");
const { TopggApi } = require("../src/utils/TopggApi");
const { verifyV1Webhook } = require("../src/utils/WebhookVerifier");

function sign(body, secret, timestamp = Math.floor(Date.now() / 1000)) {
    const signature = crypto
        .createHmac("sha256", secret)
        .update(`${timestamp}.${body}`)
        .digest("hex");
    return `t=${timestamp},v1=${signature}`;
}

test("verifies current top.gg v1 signatures and rejects stale requests", () => {
    const secret = "whs_test";
    const body = Buffer.from('{"type":"webhook.test"}');
    const now = Date.now();
    const timestamp = Math.floor(now / 1000);

    assert.equal(verifyV1Webhook(body, sign(body, secret, timestamp), secret, 300, now), true);
    assert.equal(verifyV1Webhook(body, sign(body, "wrong", timestamp), secret, 300, now), false);
    assert.equal(verifyV1Webhook(body, sign(body, secret, timestamp - 301), secret, 300, now), false);
});

test("counts weighted votes while tracking individual webhook events", () => {
    const stats = new StatsTracker();
    stats.recordVote("user-1", { weight: 2, votedAt: 1000 });
    stats.recordVote("user-1", { weight: 1, votedAt: 2000 });

    assert.deepEqual(stats.getStats(), {
        totalVotes: 3,
        voteEvents: 2,
        uniqueVoters: 1,
    });
    assert.deepEqual(stats.getUserStats("user-1"), {
        userId: "user-1",
        count: 3,
        events: 2,
        lastVoteAt: 2000,
        streak: 2,
    });
});

test("queries the top.gg v1 API with Bearer authentication", async () => {
    const calls = [];
    const api = new TopggApi("token", {
        fetch: async (url, options) => {
            calls.push({ url, options });
            return {
                ok: true,
                status: 200,
                json: async () => ({ created_at: "now", expires_at: "later", weight: 1 }),
            };
        },
    });

    const vote = await api.getVote("123", "discord");
    assert.equal(vote.weight, 1);
    assert.equal(calls[0].url, "https://top.gg/api/v1/projects/@me/votes/123?source=discord");
    assert.equal(calls[0].options.headers.Authorization, "Bearer token");
});

test("accepts, normalizes, and deduplicates signed v1 vote events", async (t) => {
    const sent = [];
    const channel = { send: async (message) => sent.push(message) };
    const guild = {
        roles: { cache: new Map(), fetch: async () => null },
        channels: { cache: new Map([["channel", channel]]), fetch: async () => channel },
        members: { fetch: async () => ({ roles: { add: async () => {}, remove: async () => {} } }) },
    };
    const user = {
        id: "user",
        username: "Voter",
        displayAvatarURL: () => "https://example.com/user.png",
    };
    const client = {
        user: {
            id: "bot",
            username: "Bot",
            displayAvatarURL: () => "https://example.com/bot.png",
        },
        guilds: { fetch: async () => guild },
        users: { fetch: async () => user },
    };
    const secret = "whs_integration";
    const tracker = new VoteTracker(client, {
        port: 0,
        guildId: "guild",
        channelId: "channel",
        webhookVersion: "v1",
        webhookSecret: secret,
        reminder: false,
    });
    t.after(() => tracker.stop());

    tracker.init();
    await once(tracker, "ready");
    const { port } = tracker.server.address();
    const payload = JSON.stringify({
        type: "vote.create",
        data: {
            id: "vote-1",
            weight: 2,
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 43_200_000).toISOString(),
            project: { platform_id: "bot" },
            user: { platform_id: "user" },
        },
    });
    const headers = {
        "content-type": "application/json",
        "x-topgg-signature": sign(payload, secret),
    };

    const voteEvent = once(tracker, "vote");
    const response = await fetch(`http://127.0.0.1:${port}/dblwebhook`, {
        method: "POST",
        headers,
        body: payload,
    });
    assert.equal(response.status, 204);
    const [{ vote, stats }] = await voteEvent;
    assert.equal(vote.sourceVersion, "v1");
    assert.equal(vote.user, "user");
    assert.equal(vote.weight, 2);
    assert.equal(stats.count, 2);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].embeds[0].data.title, "✨ Double vote activated!");
    assert.equal(sent[0].components.length, 1);
    assert.equal(sent[0].components[0].components.length, 2);

    const duplicate = await fetch(`http://127.0.0.1:${port}/dblwebhook`, {
        method: "POST",
        headers,
        body: payload,
    });
    assert.equal(duplicate.status, 204);
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(tracker.getStats().voteEvents, 1);
});

test("registers and serves the opt-in Discord vote command", async (t) => {
    const client = new EventEmitter();
    let registeredCommand;
    let presence;
    const guild = {
        commands: {
            create: async (command) => {
                registeredCommand = command.toJSON();
                return { id: "command-id", name: registeredCommand.name };
            },
        },
    };
    client.user = {
        id: "bot",
        username: "Bot",
        displayAvatarURL: () => "https://example.com/bot.png",
        setPresence: (nextPresence) => {
            presence = nextPresence;
        },
    };
    client.guilds = { fetch: async () => guild };
    client.users = { fetch: async () => null };

    const tracker = new VoteTracker(client, {
        port: 0,
        guildId: "guild",
        webhookVersion: "v1",
        webhookSecret: "whs_commands",
        discordUi: {
            commandName: "support",
            commands: true,
            presence: { enabled: true, text: "{votes} votes • /support" },
        },
    });
    t.after(() => tracker.stop());

    const commandsReady = once(tracker, "commandsReady");
    tracker.init();
    await commandsReady;

    assert.equal(registeredCommand.name, "support");
    assert.deepEqual(
        registeredCommand.options.map((option) => option.name),
        ["dashboard", "leaderboard", "stats"]
    );
    assert.equal(presence.activities[0].name, "0 votes • /support");

    let deferred;
    let response;
    const replied = new Promise((resolve) => {
        client.emit("interactionCreate", {
            isChatInputCommand: () => true,
            commandName: "support",
            guildId: "guild",
            user: {
                id: "user",
                toString: () => "<@user>",
                displayAvatarURL: () => "https://example.com/user.png",
            },
            options: {
                getSubcommand: () => "dashboard",
                getUser: () => null,
            },
            deferReply: async (options) => {
                deferred = options;
            },
            editReply: async (message) => {
                response = message;
                resolve();
            },
        });
    });
    await replied;

    assert.ok(deferred.flags);
    assert.equal(response.embeds[0].data.title, "💜 Ready to support us?");
    assert.equal(response.components.length, 1);
});
