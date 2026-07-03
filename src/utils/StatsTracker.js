class StatsTracker {
    constructor(options = {}) {
        this.enabled = options.enabled !== false;
        this.leaderboardSize = Number.isInteger(options.leaderboardSize) ? options.leaderboardSize : 10;
        this.streakWindowMs = (options.streakWindowHours ?? 14) * 60 * 60 * 1000;
        this.totalVotes = 0;
        this.totalVoteEvents = 0;
        this.userStats = new Map();
    }

    recordVote(userId, options = {}) {
        if (!this.enabled) {
            return null;
        }

        const now = Number.isFinite(options.votedAt) ? options.votedAt : Date.now();
        const weight = Number.isInteger(options.weight) && options.weight > 0 ? options.weight : 1;
        const existing = this.userStats.get(userId);
        let streak = 1;

        if (existing?.lastVoteAt && now - existing.lastVoteAt <= this.streakWindowMs) {
            streak = existing.streak + 1;
        }

        const nextStats = {
            userId,
            count: (existing?.count ?? 0) + weight,
            events: (existing?.events ?? 0) + 1,
            lastVoteAt: now,
            streak,
        };

        this.userStats.set(userId, nextStats);
        this.totalVotes += weight;
        this.totalVoteEvents += 1;
        return nextStats;
    }

    getStats() {
        return {
            totalVotes: this.totalVotes,
            voteEvents: this.totalVoteEvents,
            uniqueVoters: this.userStats.size,
        };
    }

    getUserStats(userId) {
        return this.userStats.get(userId) ?? null;
    }

    getLeaderboard(limit = this.leaderboardSize) {
        const size = Number.isInteger(limit)
            ? Math.max(0, Math.min(limit, 100))
            : this.leaderboardSize;
        return [...this.userStats.values()]
            .sort((a, b) => b.count - a.count)
            .slice(0, size);
    }
}

module.exports = StatsTracker;
