const { ChannelType, PermissionFlagsBits } = require('discord.js');
const prisma = require('../../config/database');
const logger = require('../../config/logger');

class ChannelManager {
  constructor(guild) {
    this.guild = guild;
  }

  async create({ name, type = 'TEXT', categoryId, topic, slowmode = 0, allowedRoles = [] }) {
    const channelType = type === 'VOICE' ? ChannelType.GuildVoice : ChannelType.GuildText;

    const permissionOverwrites = allowedRoles.length
      ? [
          { id: this.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          ...allowedRoles.map(roleId => ({
            id: roleId,
            allow: [PermissionFlagsBits.ViewChannel],
          })),
        ]
      : [];

    const channel = await this.guild.channels.create({
      name,
      type: channelType,
      parent: categoryId || null,
      topic: topic || null,
      rateLimitPerUser: slowmode,
      permissionOverwrites,
    });

    await prisma.channel.create({
      data: {
        id: channel.id,
        guildId: this.guild.id,
        name: channel.name,
        type,
        categoryId: categoryId || null,
        topic: topic || null,
        slowmode,
      },
    }).catch(err => logger.warn(`Channel DB sync failed (Discord channel was created): ${err.message}`));

    logger.info(`Channel created: #${name} (${type}) on ${this.guild.name}`);
    return channel;
  }

  async delete(channelId, reason = 'Deleted via dashboard') {
    const channel = this.guild.channels.cache.get(channelId);
    if (!channel) throw new Error(`Channel ${channelId} not found`);

    await channel.delete(reason);
    await prisma.channel.delete({ where: { id: channelId } }).catch(() => {});

    logger.info(`Channel deleted: ${channelId}`);
    return true;
  }

  async edit(channelId, { name, topic, slowmode }) {
    const channel = this.guild.channels.cache.get(channelId);
    if (!channel) throw new Error(`Channel ${channelId} not found`);

    await channel.edit({ name, topic, rateLimitPerUser: slowmode });
    await prisma.channel.update({
      where: { id: channelId },
      data: { name, topic, slowmode },
    });

    return channel;
  }

  async list() {
    return this.guild.channels.cache
      .filter(ch => [ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildCategory].includes(ch.type))
      .map(ch => ({
        id: ch.id,
        name: ch.name,
        type: ch.type,
        parentId: ch.parentId,
        position: ch.position,
      }))
      .sort((a, b) => a.position - b.position);
  }
}

module.exports = ChannelManager;
