const { EmbedBuilder } = require("discord.js");


module.exports = class PostHandler {
    constructor(client, guild, user, role, webhook, channel, postmode, embedcolor, vote = {}, stats = null, discordUi = null) {
        this.client = client;
        this.guild = guild;
        this.user = user;
        this.role = role;
        this.webhook = webhook;
        this.channel = channel;
        this.postmode = postmode;
        this.embedcolor = embedcolor;
        this.vote = vote;
        this.stats = stats;
        this.discordUi = discordUi;
    }

    async handlePost() {
        if (!this.client?.user) {
            console.error("VoteTracker: Discord client is not ready yet.");
            return;
        }

        const message = this.discordUi
            ? this.discordUi.buildVoteMessage({
                client: this.client,
                user: this.user,
                vote: this.vote,
                stats: this.stats,
            })
            : {
                embeds: [
                    new EmbedBuilder()
                        .setColor(this.embedcolor)
                        .setDescription(`${this.user} just voted for **${this.client.user.username}**!`)
                        .setTimestamp(),
                ],
            };

        if (this.postmode === "channel") {
            if (this.channel) {
                await this.channel.send(message);

            } else {
                console.error("Invalid vote log channel.");
                return;
            }
        } else if (this.postmode === "webhook") {
            if (this.webhook) {
                await this.webhook.edit({
                    name: `${this.client.user.username} • Vote Tracker`,
                    avatar: this.client.user.displayAvatarURL(),
                });
                await this.webhook.send({ ...message, withComponents: true });
            } else {
                console.error("Invalid webhook URL.");
                return;
            }
        } else {
            console.log('Please provide a valid post mode.');
        }

        if (this.role) {
            try {
                const member = await this.guild.members.fetch(this.user.id);
                await member.roles.add(this.role);
            } catch (error) {
                console.error(`Error adding role to member: ${error.message}`);
                return;
            }
        }
    }
}
