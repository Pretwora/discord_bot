const { ChannelType } = require('discord.js');
const prisma = require('../../config/database');
const logger = require('../../config/logger');

const TYPE_MAP = {
  [ChannelType.GuildVoice]: 'VOICE',
  [ChannelType.GuildStageVoice]: 'VOICE',
  [ChannelType.GuildCategory]: 'CATEGORY',
  [ChannelType.GuildAnnouncement]: 'ANNOUNCEMENT',
};

module.exports = {
  name: 'channelCreate',
  async execute(channel) {
    if (!channel.guildId) return;
    const type = TYPE_MAP[channel.type] ?? 'TEXT';
    await prisma.channel.upsert({
      where: { id: channel.id },
      update: { name: channel.name, type, categoryId: channel.parentId ?? null, position: channel.position },
      create: {
        id: channel.id, guildId: channel.guildId, name: channel.name,
        type, categoryId: channel.parentId ?? null, position: channel.position,
        topic: channel.topic ?? null,
      },
    }).catch(err => logger.warn(`channelCreate DB: ${err.message}`));
    logger.info(`Channel created in Discord: #${channel.name}`);
  },
};
