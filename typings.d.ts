import { ActivityType, ApplicationCommand, Client, ColorResolvable, Guild, User } from "discord.js";
import { EventEmitter } from "events";
import { Application } from "express";
import { Server } from "http";

export interface VoteTrackerStatsOptions {
    enabled?: boolean;
    leaderboardSize?: number;
    streakWindowHours?: number;
    endpoint?: string;
    authToken?: string;
}

export interface AutoPostOptions {
    interval?: number;
    postOnStart?: boolean;
    startPosting?: boolean;
}

export interface DiscordCommandOptions {
    enabled?: boolean;
    ephemeral?: boolean;
    leaderboardSize?: number;
}

export interface DiscordPresenceOptions {
    enabled?: boolean;
    text?: string;
    status?: "online" | "idle" | "dnd" | "invisible";
    type?: ActivityType;
}

export interface DiscordUiOptions {
    enabled?: boolean;
    accentColor?: ColorResolvable;
    weekendColor?: ColorResolvable;
    title?: string;
    footer?: string;
    bannerUrl?: string;
    supportUrl?: string;
    mentionVoter?: boolean;
    showAvatar?: boolean;
    showStats?: boolean;
    buttons?: boolean;
    commandName?: string;
    commands?: boolean | DiscordCommandOptions;
    presence?: boolean | DiscordPresenceOptions;
}

export interface VoteTrackerOptions {
    port?: number;
    host?: string;
    guildId: string;
    channelId?: string;
    roleId?: string;
    webhook?: string;
    postmode?: "channel" | "webhook";
    color?: ColorResolvable;
    reminder?: boolean;
    reminderDelayHours?: number;
    stats?: VoteTrackerStatsOptions;
    webhookVersion?: "v0" | "v1";
    webhookPath?: string;
    password?: string;
    webhookSecret?: string;
    signatureToleranceSeconds?: number;
    bodyLimit?: string;
    apiToken?: string;
    apiBaseUrl?: string;
    autoPost?: boolean | AutoPostOptions;
    discordUi?: false | DiscordUiOptions;
    app?: Application;
    server?: Server;
    fetch?: (input: string, init?: unknown) => Promise<{
        ok: boolean;
        status: number;
        json(): Promise<unknown>;
    }>;
}

export interface VoteStats {
    totalVotes: number;
    voteEvents: number;
    uniqueVoters: number;
}

export interface UserVoteStats {
    userId: string;
    count: number;
    events: number;
    lastVoteAt: number;
    streak: number;
}

export interface NormalizedVote {
    id?: string;
    user: string;
    bot?: string;
    type: string;
    isWeekend: boolean;
    weight: number;
    createdAt: string | null;
    expiresAt: string | null;
    sourceVersion: "v0" | "v1";
    raw: unknown;
    query?: string | Record<string, string>;
}

export interface TopggVoteStatus {
    created_at: string;
    expires_at: string;
    weight: number;
}

export interface TopggVoteRecord extends TopggVoteStatus {
    user_id: string;
    platform_id: string;
}

export interface TopggVotePage {
    cursor: string;
    data: TopggVoteRecord[];
}

export interface TopggProject {
    id: string;
    name: string;
    platform: "discord" | "roblox";
    type: "bot" | "server" | "game";
    headline: string;
    tags: string[];
    votes: number;
    votes_total: number;
    review_score: number;
    review_count: number;
}

export class TopggApiError extends Error {
    status: number;
    details: unknown;
}

export class VoteTracker extends EventEmitter {
    constructor(client: Client, options?: VoteTrackerOptions);

    readonly app: Application;
    readonly server: Server;

    init(): this;
    stop(): Promise<void>;
    startAutoPoster(): unknown;
    getStats(): VoteStats;
    getUserStats(userId: string): UserVoteStats | null;
    getLeaderboard(limit?: number): UserVoteStats[];
    getProject(): Promise<TopggProject>;
    getVote(userId: string, source?: "discord" | "topgg"): Promise<TopggVoteStatus | null>;
    getVotes(options: { cursor: string } | { startDate: string | Date }): Promise<TopggVotePage>;

    on(event: "ready", listener: (data: { port: number; webhookPath: string }) => void): this;
    on(event: "vote", listener: (data: {
        user: User;
        guild: Guild;
        vote: NormalizedVote;
        stats: UserVoteStats | null;
    }) => void): this;
    on(event: "webhookTest", listener: (data: { payload: unknown; traceId: string | null }) => void): this;
    on(event: "statsPosted", listener: (data: unknown) => void): this;
    on(event: "commandsReady", listener: (data: { command: ApplicationCommand }) => void): this;
    on(event: "error", listener: (error: Error) => void): this;
}

export default VoteTracker;
