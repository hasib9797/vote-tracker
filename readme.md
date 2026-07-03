# Vote Tracker

[![npm](https://img.shields.io/npm/v/vote-tracker?style=flat-square)](https://www.npmjs.com/package/vote-tracker)
[![license](https://img.shields.io/npm/l/vote-tracker?style=flat-square)](LICENSE)
[![Discord.js](https://img.shields.io/badge/discord.js-14.26.4-5865F2?style=flat-square)](https://discord.js.org/)

A professional Top.gg vote system for Discord.js bots. Receive signed vote events, reward members, send polished Discord cards, expose leaderboards, query the Top.gg API, and automatically post bot statistics.

## Contents

- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Quick start with Top.gg v1](#quick-start-with-topgg-v1)
- [Top.gg dashboard setup](#topgg-dashboard-setup)
- [Discord interface](#discord-interface)
- [Vote rewards and reminders](#vote-rewards-and-reminders)
- [Vote statistics](#vote-statistics)
- [Top.gg v1 API methods](#topgg-v1-api-methods)
- [Automatic bot-stat posting](#automatic-bot-stat-posting)
- [Legacy v0 webhooks](#legacy-v0-webhooks)
- [Configuration reference](#configuration-reference)
- [Events](#events)
- [Public methods](#public-methods)
- [TypeScript](#typescript)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Features

### Current Top.gg support

- Top.gg v1 `vote.create` and `webhook.test` events
- HMAC SHA-256 verification over the untouched request body
- Constant-time signature comparison
- Configurable replay-protection window
- Nested v1 payload normalization
- Legacy v0 Authorization-header webhooks through `@top-gg/sdk`
- Automatic selection between v1 and v0 when `webhookVersion` is omitted
- Duplicate v1 delivery protection using the Top.gg vote ID
- Weekend and multiplier vote weights
- Exact `created_at` and `expires_at` handling
- Immediate webhook acknowledgement followed by background Discord processing

### Professional Discord interface

- Branded vote cards using Discord embeds
- Special gold weekend-boost presentation
- Voter avatar, vote power, streak, support points, and next-vote timestamp
- Native **Vote on Top.gg** and **View bot profile** buttons
- Optional **Support server** button
- Optional banner image, custom colors, title, and footer
- Safe mention defaults that prevent unexpected notification pings
- Channel or Discord webhook delivery
- Optional voter mention
- Optional `/vote` command center
- Ephemeral command responses by default
- Optional dynamic Discord presence with live vote totals

### Rewards and community features

- Optional voter role assignment
- Automatic role removal when the vote expires
- Vote-again direct-message reminders
- Exact v1 reminder timing from Top.gg
- Configurable legacy reminder delay
- Weighted per-user totals
- Vote streak tracking
- Local leaderboard
- Overall and per-user HTTP statistics
- Optional Bearer protection for statistics routes

### API and operations

- Fetch the authenticated Top.gg project
- Check a Discord or Top.gg user's active vote
- Read cursor-paginated vote history
- Automatically post Discord server and shard counts
- Health endpoint
- Custom Express application support
- Custom HTTP server support
- Configurable host, port, webhook route, and JSON body limit
- Graceful shutdown
- CommonJS and TypeScript declarations

## Requirements

- Node.js 18.18.2 or newer
- Discord.js 14
- A Discord bot with the `Guilds` intent
- The `GuildMembers` intent when assigning or removing voter roles
- A public HTTPS URL that Top.gg can reach

## Installation

```sh
npm install vote-tracker
```

Secrets should be stored in environment variables:

```env
DISCORD_TOKEN=your-discord-bot-token
TOPGG_WEBHOOK_SECRET=whs_your_webhook_secret
TOPGG_API_TOKEN=your_topgg_api_token
STATS_TOKEN=a_private_token_for_stats_routes
```

## Quick start with Top.gg v1

```js
const { Client, GatewayIntentBits } = require("discord.js");
const VoteTracker = require("vote-tracker");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
});

const tracker = new VoteTracker(client, {
  guildId: "YOUR_GUILD_ID",
  channelId: "YOUR_VOTE_LOG_CHANNEL_ID",
  roleId: "OPTIONAL_VOTER_ROLE_ID",

  webhookVersion: "v1",
  webhookSecret: process.env.TOPGG_WEBHOOK_SECRET,
  webhookPath: "/dblwebhook",
  port: 3000,

  apiToken: process.env.TOPGG_API_TOKEN,
  reminder: true,

  stats: {
    enabled: true,
    endpoint: "/stats",
    authToken: process.env.STATS_TOKEN,
    leaderboardSize: 10,
    streakWindowHours: 14,
  },

  discordUi: {
    accentColor: "#5865F2",
    weekendColor: "#F0B232",
    title: "A new supporter appeared!",
    footer: "Powered by Top.gg - Thank you for supporting us",
    supportUrl: "https://discord.gg/your-server",

    commands: {
      enabled: true,
      ephemeral: true,
      leaderboardSize: 10,
    },

    presence: {
      enabled: true,
      text: "{votes} votes from {voters} supporters - /vote",
      status: "online",
    },
  },
});

tracker.on("ready", ({ port, webhookPath }) => {
  console.log(`Vote webhook ready on port ${port}${webhookPath}`);
});

tracker.on("vote", ({ user, vote, stats }) => {
  console.log(`${user.username}'s vote counted ${vote.weight}x`, stats);
});

tracker.on("webhookTest", ({ traceId }) => {
  console.log("Verified Top.gg test event:", traceId);
});

tracker.on("commandsReady", ({ command }) => {
  console.log(`Registered /${command.name}`);
});

tracker.on("statsPosted", () => {
  console.log("Posted bot statistics to Top.gg");
});

tracker.on("error", console.error);

client.once("ready", () => {
  tracker.init();
});

client.login(process.env.DISCORD_TOKEN);
```

## Top.gg dashboard setup

1. Open the project dashboard on Top.gg.
2. Open **Webhooks**.
3. Add `https://your-domain.example/dblwebhook`.
4. Subscribe to `vote.create` and `webhook.test`.
5. Copy the generated secret beginning with `whs_`.
6. Store it as `TOPGG_WEBHOOK_SECRET`.
7. Send a test event from the dashboard.
8. Listen for `webhookTest` to confirm the signed request arrived.

The URL path must match `webhookPath`. The server must be accessible over public HTTPS; `localhost` cannot be called by Top.gg.

## Discord interface

### Vote cards

Every accepted vote produces a Discord message containing:

- The voter and their avatar
- Standard or weekend-boost vote power
- Weighted lifetime support recorded by this process
- The current streak
- A Discord relative timestamp for the next eligible vote
- Direct links to vote and view the bot on Top.gg
- An optional support-server link

The interface is enabled by default. Disable it with:

```js
discordUi: false
```

### Branding

```js
discordUi: {
  accentColor: "#5865F2",
  weekendColor: "#F0B232",
  title: "Thanks for voting!",
  footer: "Your Community - Powered by Top.gg",
  bannerUrl: "https://example.com/banner.png",
  supportUrl: "https://discord.gg/example",
  mentionVoter: false,
  showAvatar: true,
  showStats: true,
  buttons: true
}
```

`mentionVoter: false` still displays the voter inside the embed. Vote messages use `allowedMentions` so embed text does not accidentally notify members.

### Channel mode

Channel mode sends the vote card through the bot:

```js
postmode: "channel",
channelId: "VOTE_LOG_CHANNEL_ID"
```

### Webhook mode

Webhook mode sends the same card and link buttons through a Discord webhook:

```js
postmode: "webhook",
webhook: "https://discord.com/api/webhooks/..."
```

The webhook name and avatar are updated to match the bot's vote tracker branding.

### Slash-command vote center

Slash commands are opt-in:

```js
discordUi: {
  commandName: "vote",
  commands: true
}
```

Or configure them:

```js
discordUi: {
  commands: {
    enabled: true,
    ephemeral: true,
    leaderboardSize: 10
  }
}
```

The package registers one guild command:

- `/vote dashboard` displays the caller's vote eligibility, points, streak, and voting link.
- `/vote leaderboard` displays the highest local weighted vote totals.
- `/vote stats [user]` displays a selected member's vote dashboard.

When `apiToken` is configured, dashboard and member-stat responses also check the current vote through the Top.gg v1 API. Commands require the `applications.commands` scope, which is normally included when a Discord bot is invited.

### Dynamic presence

```js
discordUi: {
  presence: {
    enabled: true,
    text: "{votes} votes from {voters} supporters - /vote",
    status: "online"
  }
}
```

Available placeholders:

| Placeholder | Value |
| --- | --- |
| `{votes}` | Weighted vote total |
| `{voters}` | Unique local voter count |

The presence updates at startup and after each processed vote. A Discord.js `ActivityType` may be passed with `type`.

## Vote rewards and reminders

### Voter role

Set `roleId` to assign a guild role when a vote is processed:

```js
roleId: "VOTER_ROLE_ID"
```

The bot must have **Manage Roles**, and its highest role must be above the voter role. The role is removed when the reminder timer expires, whether or not direct-message reminders are enabled.

### Vote reminders

```js
reminder: true
```

For v1 events, the timer uses the exact Top.gg `expires_at` value. For v0 events, it uses `reminderDelayHours`, which defaults to 12 hours.

At expiry:

1. The package attempts to send the voter a direct-message reminder when `reminder` is enabled.
2. The configured voter role is removed.

Users may block direct messages; failures are logged without crashing the tracker.

## Vote statistics

Statistics are kept in memory. They reset whenever the Node.js process restarts.

### Weighted totals

Top.gg's `weight` is respected:

- A standard vote adds `1` to `totalVotes` and the user's `count`.
- A double weekend vote adds `2`.
- `voteEvents` and the user's `events` always count deliveries, not vote weight.

### Streaks

A vote continues a streak when it arrives inside `stats.streakWindowHours`, which defaults to 14 hours.

### HTTP endpoints

```js
stats: {
  enabled: true,
  endpoint: "/stats",
  authToken: process.env.STATS_TOKEN,
  leaderboardSize: 10,
  streakWindowHours: 14
}
```

The following routes are registered:

| Route | Response |
| --- | --- |
| `GET /stats` | Overall totals and unique voter count |
| `GET /stats/leaderboard?limit=10` | Top voters; limit is capped at 100 |
| `GET /stats/users/:id` | One user's local statistics |

When `authToken` is configured:

```http
Authorization: Bearer YOUR_STATS_TOKEN
```

Overall response:

```json
{
  "totalVotes": 42,
  "voteEvents": 37,
  "uniqueVoters": 21
}
```

User response:

```json
{
  "userId": "123456789012345678",
  "count": 5,
  "events": 4,
  "lastVoteAt": 1783072800000,
  "streak": 3
}
```

### Health endpoint

`GET /health` is always available:

```json
{
  "status": "ok",
  "webhookVersion": "v1",
  "uptime": 120.5
}
```

## Top.gg v1 API methods

Set `apiToken` to enable the Bearer-authenticated API client:

```js
apiToken: process.env.TOPGG_API_TOKEN
```

### Fetch the project

```js
const project = await tracker.getProject();
console.log(project.name, project.votes, project.votes_total);
```

### Check a vote

Discord user ID:

```js
const vote = await tracker.getVote("DISCORD_USER_ID");
```

Top.gg user ID:

```js
const vote = await tracker.getVote("TOPGG_USER_ID", "topgg");
```

`getVote()` returns `null` when the user has no active vote.

### Read vote history

The first request requires a date no more than one year in the past:

```js
const page = await tracker.getVotes({
  startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
});
```

Use the returned cursor for the next page:

```js
const nextPage = await tracker.getVotes({
  cursor: page.cursor,
});
```

Failed API requests throw `TopggApiError` with:

- `message`: Top.gg's human-readable error
- `status`: HTTP status
- `details`: parsed problem response

## Automatic bot-stat posting

Enable server and shard count posting:

```js
apiToken: process.env.TOPGG_API_TOKEN,
autoPost: true
```

Or configure the current `topgg-autoposter` package:

```js
autoPost: {
  interval: 30 * 60 * 1000,
  postOnStart: true,
  startPosting: true
}
```

Top.gg requires an interval of at least 15 minutes. Successful posts emit `statsPosted`; failures emit `error`.

## Legacy v0 webhooks

Existing v0 integrations remain supported:

```js
const tracker = new VoteTracker(client, {
  guildId: "YOUR_GUILD_ID",
  channelId: "YOUR_CHANNEL_ID",
  webhookVersion: "v0",
  password: process.env.TOPGG_LEGACY_WEBHOOK_PASSWORD
});
```

For legacy webhooks, `password` must match the Authorization value configured in the Top.gg dashboard.

When `webhookVersion` is omitted:

- `webhookSecret` selects v1.
- A `password` beginning with `whs_` selects v1.
- Any other `password` selects v0.

## Configuration reference

### Main options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `guildId` | `string` | required | Discord guild that receives rewards and commands |
| `channelId` | `string` | none | Vote-log channel |
| `roleId` | `string` | none | Temporary voter role |
| `postmode` | `"channel" \| "webhook"` | `"channel"` | Vote-card delivery mode |
| `webhook` | `string` | none | Discord webhook URL for webhook post mode |
| `color` | `ColorResolvable` | `#333333` | Legacy color and Discord UI accent fallback |
| `port` | `number` | `3000` | HTTP port; use `0` to select a free port |
| `host` | `string` | system default | HTTP listen address |
| `reminder` | `boolean` | `true` | Send a vote-again DM |
| `reminderDelayHours` | `number` | `12` | Legacy v0 reminder delay |
| `app` | Express `Application` | new app | Existing Express app |
| `server` | HTTP `Server` | new server | Existing HTTP server |

### Webhook options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `webhookVersion` | `"v0" \| "v1"` | auto | Top.gg webhook generation |
| `webhookSecret` | `string` | none | v1 `whs_...` signing secret |
| `password` | `string` | none | Legacy v0 Authorization secret; accepted as a v1 fallback |
| `webhookPath` | `string` | `/dblwebhook` | Incoming Top.gg route |
| `signatureToleranceSeconds` | `number` | `300` | Maximum accepted v1 signature age; `Infinity` disables the age check |
| `bodyLimit` | `string` | `100kb` | Express request-body limit |

### API and auto-post options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `apiToken` | `string` | none | Top.gg API token |
| `apiBaseUrl` | `string` | `https://top.gg/api/v1` | API base URL, mainly for testing or proxies |
| `fetch` | `function` | global `fetch` | Custom fetch-compatible implementation |
| `autoPost` | `boolean \| object` | `false` | Server/shard count auto-poster |

### Statistics options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `stats.enabled` | `boolean` | `true` | Collect local statistics |
| `stats.leaderboardSize` | `number` | `10` | Default leaderboard size |
| `stats.streakWindowHours` | `number` | `14` | Maximum gap that continues a streak |
| `stats.endpoint` | `string` | none | Enables statistics HTTP routes |
| `stats.authToken` | `string` | none | Protects statistics routes with Bearer authentication |

### Discord UI options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `discordUi.enabled` | `boolean` | `true` | Enable professional Discord cards |
| `discordUi.accentColor` | `ColorResolvable` | `#5865F2` | Standard card color |
| `discordUi.weekendColor` | `ColorResolvable` | `#F0B232` | Multiplier card color |
| `discordUi.title` | `string` | package title | Vote-card title |
| `discordUi.footer` | `string` | package footer | Card footer |
| `discordUi.bannerUrl` | `string` | none | Vote-card image |
| `discordUi.supportUrl` | `string` | none | Optional support-server button |
| `discordUi.mentionVoter` | `boolean` | `false` | Add voter mention content without generating a ping |
| `discordUi.showAvatar` | `boolean` | `true` | Show voter thumbnail |
| `discordUi.showStats` | `boolean` | `true` | Show points and streak |
| `discordUi.buttons` | `boolean` | `true` | Show link buttons |
| `discordUi.commandName` | `string` | `vote` | Slash-command name |
| `discordUi.commands` | `boolean \| object` | `false` | Enable and configure slash commands |
| `discordUi.presence` | `boolean \| object` | `false` | Enable and configure live presence |

## Events

### `ready`

The HTTP server is listening:

```js
tracker.on("ready", ({ port, webhookPath }) => {});
```

### `vote`

A verified vote was normalized, its user was fetched, and statistics were recorded:

```js
tracker.on("vote", ({ user, guild, vote, stats }) => {});
```

Normalized vote fields:

```js
{
  id,
  user,
  bot,
  type,
  isWeekend,
  weight,
  createdAt,
  expiresAt,
  sourceVersion,
  raw
}
```

### `webhookTest`

A signed Top.gg v1 test event was accepted:

```js
tracker.on("webhookTest", ({ payload, traceId }) => {});
```

### `commandsReady`

The optional guild slash command was registered:

```js
tracker.on("commandsReady", ({ command }) => {});
```

### `statsPosted`

The auto-poster successfully submitted server statistics:

```js
tracker.on("statsPosted", (data) => {});
```

### `error`

Discord processing, command registration, Top.gg API, or auto-poster work failed:

```js
tracker.on("error", (error) => {
  console.error(error);
});
```

Without an `error` listener, Vote Tracker logs operational errors to the console.

## Public methods

| Method | Result |
| --- | --- |
| `init()` | Registers routes/features, starts auto-posting, and listens; returns the tracker |
| `stop()` | Stops auto-posting and reminders, removes the interaction listener, and closes the HTTP server |
| `getStats()` | Returns overall in-memory statistics |
| `getUserStats(userId)` | Returns one user's statistics or `null` |
| `getLeaderboard(limit?)` | Returns ranked local user statistics |
| `getProject()` | Fetches the authenticated Top.gg project |
| `getVote(userId, source?)` | Returns active vote information or `null` |
| `getVotes({ startDate })` | Fetches the first vote-history page |
| `getVotes({ cursor })` | Fetches the next vote-history page |
| `startAutoPoster()` | Starts or returns the configured Top.gg auto-poster |

Graceful shutdown:

```js
async function shutdown() {
  await tracker.stop();
  client.destroy();
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
```

## TypeScript

The package includes declarations for options, events, normalized votes, statistics, and Top.gg API responses.

```ts
import { Client, GatewayIntentBits } from "discord.js";
import VoteTracker, {
  TopggApiError,
  VoteTrackerOptions,
} from "vote-tracker";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

const options: VoteTrackerOptions = {
  guildId: process.env.GUILD_ID!,
  webhookVersion: "v1",
  webhookSecret: process.env.TOPGG_WEBHOOK_SECRET!,
};

const tracker = new VoteTracker(client, options);

try {
  await tracker.getProject();
} catch (error) {
  if (error instanceof TopggApiError) {
    console.error(error.status, error.details);
  }
}
```

## Security

- V1 signatures are verified before JSON parsing.
- The signed value is `{timestamp}.{rawBody}`.
- HMAC SHA-256 signatures use constant-time comparison.
- Requests outside the configured timestamp tolerance are rejected.
- Duplicate v1 vote IDs are ignored during their in-memory retention window.
- Statistics routes can require Bearer authentication.
- Discord output disables automatic mention parsing.
- Tokens and secrets should never be committed.
- Production deployments should use HTTPS and a reverse proxy with appropriate request limits.

Security vulnerabilities should not be posted publicly. Follow [SECURITY.md](SECURITY.md) for responsible reporting.

## Troubleshooting

### Top.gg returns an invalid signature response

- Confirm that `webhookSecret` is the v1 secret beginning with `whs_`.
- Do not use the API token as the webhook secret.
- Ensure a proxy is not rewriting the request body.
- Check that the server clock is synchronized.

### No vote card appears

- Confirm the bot can view and send messages in `channelId`.
- Confirm `postmode` matches the configured channel or Discord webhook.
- Add an `error` listener.
- Check that the Discord client is ready before calling `init()`.

### The voter role is not assigned

- Enable the `GuildMembers` intent.
- Grant **Manage Roles**.
- Move the bot role above the voter role.
- Confirm `roleId` belongs to `guildId`.

### Slash commands do not appear

- Enable `discordUi.commands`.
- Ensure the bot was invited with `applications.commands`.
- Confirm the configured `guildId` is correct.
- Listen for `commandsReady` and `error`.

### The Top.gg API methods throw immediately

`getProject()`, `getVote()`, and `getVotes()` require `apiToken`.

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) for:

- Development setup
- Bug and feature proposal workflow
- Code and test expectations
- Pull-request requirements
- Security reporting

Use the repository's GitHub issue forms for bugs and feature requests.

## License

Vote Tracker is released under the [MIT License](LICENSE).
