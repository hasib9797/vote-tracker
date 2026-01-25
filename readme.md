
<p align="center">
  <a href="https://www.npmjs.com/package/vote-tracker">
    <img src="https://img.shields.io/npm/v/vote-tracker?style=flat-square" alt="npm"/>
  </a>
  <img src="https://img.shields.io/github/stars/hasib9797/vote-tracker?style=flat-square" alt="GitHub Stars"/>
  <img src="https://img.shields.io/github/issues-raw/hasib9797/vote-tracker?style=flat-square" alt="GitHub issues"/>
  <img src="https://img.shields.io/npm/l/vote-tracker?style=flat-square" alt="NPM"/>
</p>

<p align="center">
  <a href="https://nodei.co/npm/vote-tracker/">
    <img src="https://nodei.co/npm/vote-tracker.png?downloads=true&downloadRank=true&stars=true" alt="vote-tracker NPM Package"/>
    </a>
</p>

## Table of contents

- [Installation](#installation)
- [About](#about)
- [Basic Usage](#usage)
- [Examples](#example)
- [TopGG-Dashboard](#topgg-dashboard)
- [Api](#api)

# Vote Tracker

Vote Tracker is an npm package designed to track votes on Discord bots from top.gg and log them to a specified Discord channel.


## About

- Support TypeScript
- 100% Customizable
- Easy to setup

## Installation

You can install the package via npm:


```
npm install vote-tracker
````

## Usage



To use the package, follow these steps:

**Common Js**

```javascript
const { Client, GatewayIntentBits } = require('discord.js');
const VoteTracker = require('vote-tracker');

// Create a Discord.js client
const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
})

// Initialize VoteTracker with client instance and options
const voteTracker = new VoteTracker(client, {
    guildId: 'YOUR_GUILD_ID',
    roleId: 'YOUR_ROLE_ID', // Optional: specify role id
    channelId: 'YOUR_VOTE_LOG_CHANNEL_ID',
    webhook: 'YOUR_WEBHOOK_URL',
    postmode: 'channel', // Which post mode do you want? This means how you want to post your logs, using embed or webhook. Its default value is channel.
    password: 'YOUR_TOPGG_AUTH_TOKEN',
    color: '#333333', // Optional, specify embed color
    port: '3000', // Optional, specify port number
    reminder: true, // Do you want to enable reminders? This means if you want to remind a user to vote again after 12 hours, set it to true. Otherwise, set it to false. Its default value is true.
    reminderDelayHours: 12, // Optional, how many hours before sending a reminder.
    stats: {
        enabled: true,
        endpoint: '/stats', // Optional: expose an HTTP endpoint for vote stats.
        authToken: 'YOUR_STATS_TOKEN', // Optional: protect the stats endpoints.
        leaderboardSize: 10,
        streakWindowHours: 14
    }
});

client.on('ready', () => {
    console.log(`${client.user.username} is now online`);
    voteTracker.init()
});

client.login('YOUR_DISCORD_BOT_TOKEN');
```

**Typescript**
```javascript
import { Client, GatewayIntentBits } from 'discord.js';
import { VoteTracker, VoteTrackerOptions } from 'vote-tracker';

// Create a Discord.js client instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Define options for the VoteTracker
const options: VoteTrackerOptions = {
    guildId: 'YOUR_GUILD_ID',
    roleId: 'YOUR_ROLE_ID', // Optional: specify role id
    channelId: 'YOUR_VOTE_LOG_CHANNEL_ID',
    webhook: 'YOUR_WEBHOOK_URL',
    postmode: 'channel', // Which post mode do you want? This means how you want to post your logs, using embed or webhook. Its default value is channel.
    password: 'YOUR_TOPGG_AUTH_TOKEN',
    color: '#333333', // Optional, specify embed color
    port: '3000', // Optional, specify port number
    reminder: true, // Do you want to enable reminders? This means if you want to remind a user to vote again after 12 hours, set it to true. Otherwise, set it to false. Its default value is true.
    reminderDelayHours: 12, // Optional, how many hours before sending a reminder.
    stats: {
        enabled: true,
        endpoint: '/stats', // Optional: expose an HTTP endpoint for vote stats.
        authToken: 'YOUR_STATS_TOKEN', // Optional: protect the stats endpoints.
        leaderboardSize: 10,
        streakWindowHours: 14
    }
};

// Create an instance of VoteTracker
const voteTracker = new VoteTracker(client, options);

client.on('ready', () => {
    console.log(`${client.user?.username} is now online`);
    voteTracker.init();
});

client.login('YOUR_DISCORD_BOT_TOKEN');
```

## Topgg Dashboard
With this example, your webhook dashboard should look like this:

![top.gg Dashboard](https://imgur.com/jMmA2GW.png)

## API

### `VoteTracker`

#### Constructor

- `new VoteTracker(client[, options])`: Creates a new instance of VoteTracker.

  - `client`: Required. The Discord.js client instance.
  - `options`: Optional. An object containing additional configuration options.
    - `guildId`: The ID of your guild.
    - `roleId`: Optional. The ID of the role to assign to users upon voting.
    - `channelId`: The ID of the channel where vote logs will be sent.
    - `webhook`: The webhook url where vote logs will be sent.
    - `postmode`: Which post mode do you want? This means how you want to post your logs, using embed or webhook.
    - `password`: Your top.gg authentication token.
    - `color`: Optional. The color of the embeds. Defaults to '#333333'.
    - `port`: Optional. The port number. Defaults to '3000'.
    - `reminder`: Do you want to enable reminders? This means if you want to remind a user to vote again after 12 hours, set it to true. Otherwise, set it to false. Its default value is true.
    - `reminderDelayHours`: Optional. How many hours before sending a reminder. Defaults to 12.
    - `stats`: Optional. Vote stats configuration.
        - `enabled`: Enable in-memory vote stats.
        - `endpoint`: Optional. Expose vote stats at this HTTP endpoint (ex: `/stats`).
        - `authToken`: Optional. Protect the stats endpoints with `Authorization: Bearer <token>`.
        - `leaderboardSize`: Optional. Default leaderboard size. Defaults to 10.
        - `streakWindowHours`: Optional. Hours window to keep streaks alive. Defaults to 14.

#### Stats endpoints

When `stats.endpoint` is set, VoteTracker exposes:

- `GET /stats` -> Overall totals.
- `GET /stats/leaderboard?limit=10` -> Top voters.
- `GET /stats/users/:id` -> Per-user stats.

If you set `stats.authToken`, include `Authorization: Bearer YOUR_STATS_TOKEN`.

#### Events

VoteTracker extends `EventEmitter` and emits:

- `vote`: `{ user, guild, vote, stats }`
- `error`: `Error`


### Example

**Common Js**
```javascript
const VoteTracker = require('vote-tracker');

// Initialize VoteTracker with client instance and options
const voteTracker = new VoteTracker(client, {
    guildId: 'YOUR_GUILD_ID',
    roleId: 'YOUR_ROLE_ID', // Optional: specify role id
    channelId: 'YOUR_VOTE_LOG_CHANNEL_ID',
    webhook: 'YOUR_WEBHOOK_URL',
    postmode: 'channel', // Which post mode do you want? This means how you want to post your logs, using embed or webhook. Its default value is channel.
    password: 'YOUR_TOPGG_AUTH_TOKEN',
    color: '#333333', // Optional, specify embed color
    port: '3000', // Optional, specify port number
    reminder: true, // Do you want to enable reminders? This means if you want to remind a user to vote again after 12 hours, set it to true. Otherwise, set it to false. Its default value is true.
    reminderDelayHours: 12, // Optional, how many hours before sending a reminder.
    stats: {
        enabled: true,
        endpoint: '/stats', // Optional: expose an HTTP endpoint for vote stats.
        authToken: 'YOUR_STATS_TOKEN', // Optional: protect the stats endpoints.
        leaderboardSize: 10,
        streakWindowHours: 14
    }

});


// start the VoteTracker instance
voteTracker.init()
```

**Typescript**
```javascript
import { VoteTracker, VoteTrackerOptions } from 'vote-tracker';

const options: VoteTrackerOptions = {
    guildId: 'YOUR_GUILD_ID',
    roleId: 'YOUR_ROLE_ID', // Optional: specify role id
    channelId: 'YOUR_VOTE_LOG_CHANNEL_ID',
    webhook: 'YOUR_WEBHOOK_URL',
    postmode: 'channel', // Which post mode do you want? This means how you want to post your logs, using embed or webhook. Its default value is channel.
    password: 'YOUR_TOPGG_AUTH_TOKEN',
    color: '#333333', // Optional, specify embed color
    port: '3000', // Optional, specify port number
    reminder: true, // Do you want to enable reminders? This means if you want to remind a user to vote again after 12 hours, set it to true. Otherwise, set it to false. Its default value is true.
    reminderDelayHours: 12, // Optional, how many hours before sending a reminder.
    stats: {
        enabled: true,
        endpoint: '/stats', // Optional: expose an HTTP endpoint for vote stats.
        authToken: 'YOUR_STATS_TOKEN', // Optional: protect the stats endpoints.
        leaderboardSize: 10,
        streakWindowHours: 14
    }
};

// Create an instance of VoteTracker
const voteTracker = new VoteTracker(client, options);

// start the VoteTracker instance
voteTracker.init()
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
