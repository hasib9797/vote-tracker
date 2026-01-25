declare module 'vote-tracker' {
    import { Client } from 'discord.js';
    import { EventEmitter } from 'events';

    export interface VoteTrackerStatsOptions {
        enabled?: boolean;
        leaderboardSize?: number;
        streakWindowHours?: number;
        endpoint?: string;
        authToken?: string;
    }

    export interface VoteTrackerOptions {
        port?: number;
        channelId: string;
        password: string;
        color?: string;
        guildId: string;
        roleId?: string;
        webhook: string;
        postmode: 'channel' | 'webhook';
        reminder: boolean;
        reminderDelayHours?: number;
        stats?: VoteTrackerStatsOptions;
    }

    export class VoteTracker extends EventEmitter {
        constructor(client: Client, options?: VoteTrackerOptions);
        init(): void;
        getStats(): {
            totalVotes: number;
            uniqueVoters: number;
        };
        getUserStats(userId: string): {
            userId: string;
            count: number;
            lastVoteAt: number;
            streak: number;
        } | null;
        getLeaderboard(limit?: number): Array<{
            userId: string;
            count: number;
            lastVoteAt: number;
            streak: number;
        }>;
    }
}
