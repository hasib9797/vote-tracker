const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    SlashCommandBuilder,
} = require("discord.js");

const MEDALS = ["🥇", "🥈", "🥉"];

class DiscordUI {
    constructor(options = {}) {
        this.options = {
            accentColor: options.accentColor || "#5865F2",
            weekendColor: options.weekendColor || "#F0B232",
            title: options.title || "A new supporter appeared!",
            footer: options.footer || "Powered by Top.gg • Thank you for supporting us",
            bannerUrl: options.bannerUrl || null,
            supportUrl: options.supportUrl || null,
            mentionVoter: options.mentionVoter ?? false,
            showAvatar: options.showAvatar ?? true,
            showStats: options.showStats ?? true,
            buttons: options.buttons !== false,
            commandName: options.commandName || "vote",
        };
    }

    buildVoteMessage({ client, user, vote, stats }) {
        const botName = client.user?.username || "the bot";
        const voteUrl = this.voteUrl(client);
        const profileUrl = this.profileUrl(client);
        const weighted = vote.weight > 1;
        const nextVote = vote.expiresAt
            ? `<t:${Math.floor(Date.parse(vote.expiresAt) / 1000)}:R>`
            : "in about 12 hours";

        const embed = new EmbedBuilder()
            .setColor(weighted ? this.options.weekendColor : this.options.accentColor)
            .setAuthor({
                name: weighted ? "TOP.GG WEEKEND BOOST" : "TOP.GG VOTE RECEIVED",
                iconURL: client.user?.displayAvatarURL?.(),
                url: profileUrl,
            })
            .setTitle(weighted ? "✨ Double vote activated!" : this.options.title)
            .setDescription(
                `### Thank you, ${user}!\n`
                + `Your support helps **${botName}** grow and unlock even more features for the community.`
            )
            .addFields(
                {
                    name: "Vote power",
                    value: weighted ? `\`${vote.weight}x\` Weekend boost` : "`1x` Standard vote",
                    inline: true,
                },
                {
                    name: "Vote again",
                    value: nextVote,
                    inline: true,
                }
            )
            .setFooter({
                text: this.options.footer,
                iconURL: client.user?.displayAvatarURL?.(),
            })
            .setTimestamp(vote.createdAt ? new Date(vote.createdAt) : new Date());

        if (this.options.showStats && stats) {
            embed.addFields(
                {
                    name: "Your support",
                    value: `\`${stats.count}\` vote point${stats.count === 1 ? "" : "s"}`,
                    inline: true,
                },
                {
                    name: "Current streak",
                    value: `🔥 \`${stats.streak}\``,
                    inline: true,
                }
            );
        }
        if (this.options.showAvatar) {
            embed.setThumbnail(user.displayAvatarURL({ size: 256 }));
        }
        if (this.options.bannerUrl) {
            embed.setImage(this.options.bannerUrl);
        }

        return {
            content: this.options.mentionVoter ? `${user} voted for **${botName}**!` : undefined,
            embeds: [embed],
            components: this.options.buttons ? [this.buildButtons(client)] : [],
            allowedMentions: { parse: [] },
        };
    }

    buildVoteDashboard({ client, user, stats, activeVote }) {
        const active = activeVote && Date.parse(activeVote.expires_at) > Date.now();
        const nextVote = active
            ? `<t:${Math.floor(Date.parse(activeVote.expires_at) / 1000)}:R>`
            : "You can vote now!";
        const embed = new EmbedBuilder()
            .setColor(active ? "#57F287" : this.options.accentColor)
            .setAuthor({
                name: `${client.user?.username || "Bot"} • Vote Center`,
                iconURL: client.user?.displayAvatarURL?.(),
            })
            .setTitle(active ? "✅ Your vote is active" : "💜 Ready to support us?")
            .setDescription(
                active
                    ? `Thanks, ${user}! Your latest vote is active and counted.`
                    : `${user}, one click makes a real difference. Vote on Top.gg and earn your supporter rewards!`
            )
            .addFields(
                { name: "Eligibility", value: nextVote, inline: true },
                { name: "Total support", value: `\`${stats?.count ?? 0}\` points`, inline: true },
                { name: "Best momentum", value: `🔥 \`${stats?.streak ?? 0}\` streak`, inline: true }
            )
            .setThumbnail(user.displayAvatarURL({ size: 256 }))
            .setFooter({ text: this.options.footer })
            .setTimestamp();

        return {
            embeds: [embed],
            components: [this.buildButtons(client)],
            allowedMentions: { parse: [] },
        };
    }

    buildLeaderboard({ client, leaderboard }) {
        const rows = leaderboard.length
            ? leaderboard.map((entry, index) => {
                const place = MEDALS[index] || `\`#${index + 1}\``;
                return `${place} <@${entry.userId}> — **${entry.count}** points • 🔥 ${entry.streak}`;
            }).join("\n")
            : "No votes have been recorded since the tracker started.";

        const embed = new EmbedBuilder()
            .setColor(this.options.weekendColor)
            .setAuthor({
                name: `${client.user?.username || "Bot"} • Community Rankings`,
                iconURL: client.user?.displayAvatarURL?.(),
            })
            .setTitle("🏆 Top supporters")
            .setDescription(rows)
            .setFooter({ text: "Rankings update instantly when a vote arrives" })
            .setTimestamp();

        return {
            embeds: [embed],
            components: [this.buildButtons(client)],
            allowedMentions: { parse: [] },
        };
    }

    buildButtons(client) {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel("Vote on Top.gg")
                .setEmoji("💜")
                .setStyle(ButtonStyle.Link)
                .setURL(this.voteUrl(client)),
            new ButtonBuilder()
                .setLabel("View bot profile")
                .setEmoji("🚀")
                .setStyle(ButtonStyle.Link)
                .setURL(this.profileUrl(client))
        );

        if (this.options.supportUrl) {
            row.addComponents(
                new ButtonBuilder()
                    .setLabel("Support server")
                    .setEmoji("💬")
                    .setStyle(ButtonStyle.Link)
                    .setURL(this.options.supportUrl)
            );
        }
        return row;
    }

    buildCommand() {
        return new SlashCommandBuilder()
            .setName(this.options.commandName)
            .setDescription("Open the professional Top.gg vote center")
            .addSubcommand((command) => command
                .setName("dashboard")
                .setDescription("View your vote status, streak, and voting link"))
            .addSubcommand((command) => command
                .setName("leaderboard")
                .setDescription("View the server's top supporters"))
            .addSubcommand((command) => command
                .setName("stats")
                .setDescription("View vote statistics for a server member")
                .addUserOption((option) => option
                    .setName("user")
                    .setDescription("Member whose vote stats you want to view")));
    }

    voteUrl(client) {
        return `https://top.gg/bot/${client.user?.id}/vote`;
    }

    profileUrl(client) {
        return `https://top.gg/bot/${client.user?.id}`;
    }
}

module.exports = DiscordUI;
