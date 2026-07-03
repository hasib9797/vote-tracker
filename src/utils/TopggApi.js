class TopggApiError extends Error {
    constructor(message, status, details) {
        super(message);
        this.name = "TopggApiError";
        this.status = status;
        this.details = details;
    }
}

class TopggApi {
    constructor(token, options = {}) {
        if (!token) {
            throw new Error("VoteTracker: A top.gg apiToken is required.");
        }

        if (typeof (options.fetch || globalThis.fetch) !== "function") {
            throw new Error("VoteTracker: Top.gg API access requires Node.js 18 or a fetch implementation.");
        }

        this.token = token.replace(/^Bearer\s+/i, "");
        this.baseUrl = (options.baseUrl || "https://top.gg/api/v1").replace(/\/+$/, "");
        this.fetch = options.fetch || globalThis.fetch;
    }

    async request(path, options = {}) {
        const response = await this.fetch(`${this.baseUrl}${path}`, {
            ...options,
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${this.token}`,
                ...options.headers,
            },
        });

        if (response.status === 204) {
            return null;
        }

        const body = await response.json().catch(() => null);
        if (!response.ok) {
            const message = body?.detail || body?.title || `Top.gg API request failed with status ${response.status}.`;
            throw new TopggApiError(message, response.status, body);
        }

        return body;
    }

    getProject() {
        return this.request("/projects/@me");
    }

    async getVote(userId, source = "discord") {
        if (!userId) {
            throw new TypeError("VoteTracker: userId is required.");
        }
        if (!["discord", "topgg"].includes(source)) {
            throw new TypeError("VoteTracker: source must be either 'discord' or 'topgg'.");
        }

        try {
            return await this.request(
                `/projects/@me/votes/${encodeURIComponent(userId)}?source=${encodeURIComponent(source)}`
            );
        } catch (error) {
            if (error instanceof TopggApiError && error.status === 404) {
                return null;
            }
            throw error;
        }
    }

    getVotes(options = {}) {
        if (!options.cursor && !options.startDate) {
            throw new TypeError("VoteTracker: getVotes requires cursor or startDate.");
        }

        const params = new URLSearchParams();
        if (options.cursor) {
            params.set("cursor", options.cursor);
        } else {
            const startDate = options.startDate instanceof Date
                ? options.startDate.toISOString()
                : options.startDate;
            params.set("startDate", startDate);
        }

        return this.request(`/projects/@me/votes?${params}`);
    }
}

module.exports = { TopggApi, TopggApiError };
