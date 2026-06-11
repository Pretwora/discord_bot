const { ChannelType } = require('discord.js');
const schedule = require('node-schedule');
const prisma = require('../../config/database');
const logger = require('../../config/logger');
const { restoreGiveaways } = require('../utils/giveawayManager');
const { sendWeeklyReport } = require('../utils/weeklyReport');

function channelTypeStr(type) {
  if (type === ChannelType.GuildVoice || type === ChannelType.GuildStageVoice) return 'VOICE';
  if (type === ChannelType.GuildCategory) return 'CATEGORY';
  if (type === ChannelType.GuildAnnouncement) return 'ANNOUNCEMENT';
  return 'TEXT';
}

async function syncGuild(guild) {
  // 1. Guild
  await prisma.guild.upsert({
    where: { id: guild.id },
    update: { name: guild.name, ownerId: guild.ownerId },
    create: { id: guild.id, name: guild.name, ownerId: guild.ownerId },
  });
  logger.info(`[sync] Guild: ${guild.name}`);

  // 2. Roles
  const roles = guild.roles.cache.values();
  for (const role of roles) {
    await prisma.role.upsert({
      where: { id: role.id },
      update: { name: role.name, color: role.hexColor, position: role.position, hoist: role.hoist, mentionable: role.mentionable },
      create: {
        id: role.id, guildId: guild.id, name: role.name,
        color: role.hexColor, permissions: role.permissions.bitfield.toString(),
        hoist: role.hoist, mentionable: role.mentionable, position: role.position,
      },
    }).catch(e => logger.warn(`[sync] role ${role.name}: ${e.message}`));
  }
  logger.info(`[sync] Roles: ${guild.roles.cache.size}`);

  // 3. Channels
  const channels = guild.channels.cache.values();
  for (const ch of channels) {
    if (![ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildCategory,
          ChannelType.GuildAnnouncement, ChannelType.GuildStageVoice, ChannelType.GuildForum].includes(ch.type)) continue;
    await prisma.channel.upsert({
      where: { id: ch.id },
      update: { name: ch.name, type: channelTypeStr(ch.type), categoryId: ch.parentId ?? null, position: ch.position, topic: ch.topic ?? null },
      create: {
        id: ch.id, guildId: guild.id, name: ch.name,
        type: channelTypeStr(ch.type), categoryId: ch.parentId ?? null,
        position: ch.position, topic: ch.topic ?? null,
      },
    }).catch(e => logger.warn(`[sync] channel ${ch.name}: ${e.message}`));
  }
  logger.info(`[sync] Channels: ${guild.channels.cache.size}`);

  // 4. Members (fetch all — requires GuildMembers intent)
  const members = await guild.members.fetch().catch(() => guild.members.cache);
  let memberCount = 0;
  for (const member of members.values()) {
    if (member.user.bot) continue;
    const rolesJson = JSON.stringify(
      member.roles.cache
        .filter(r => r.name !== '@everyone')
        .map(r => ({ id: r.id, name: r.name, color: r.hexColor }))
    );
    await prisma.member.upsert({
      where: { id: member.id },
      update: { username: member.user.username, nickname: member.nickname ?? null, roles: rolesJson, lastActive: new Date() },
      create: {
        id: member.id, guildId: guild.id, username: member.user.username,
        nickname: member.nickname ?? null, roles: rolesJson,
        joinedAt: member.joinedAt ?? new Date(),
      },
    }).catch(e => logger.warn(`[sync] member ${member.user.username}: ${e.message}`));
    memberCount++;
  }
  logger.info(`[sync] Members: ${memberCount}`);
}

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    logger.info(`Bot online as ${client.user.tag}`);
    client.user.setActivity('your server', { type: 3 });

    const guild = client.guilds.cache.get(process.env.DISCORD_GUILD_ID);
    if (!guild) { logger.warn(`Guild ${process.env.DISCORD_GUILD_ID} not in cache`); return; }

    try {
      await syncGuild(guild);
      logger.info('[sync] Full sync complete');
    } catch (err) {
      logger.error(`[sync] Failed: ${err.message}`);
    }

    // Export syncGuild so socket.js can trigger manual re-sync
    client._syncGuild = () => syncGuild(guild);

    // Restore giveaway schedulers that were active before restart
    await restoreGiveaways(client);

    // Schedule weekly report — runs every Sunday at 19:00 server time
    // Settings override: weeklyReportEnabled + weeklyReportChannelId
    schedule.scheduleJob('0 19 * * 0', async () => {
      try {
        const dbGuild = await prisma.guild.findUnique({ where: { id: process.env.DISCORD_GUILD_ID } });
        let settings = {};
        try { settings = JSON.parse(dbGuild?.settings || '{}'); } catch {}

        if (settings.weeklyReportEnabled === false) return;

        const channelId = settings.weeklyReportChannelId || process.env.LEVEL_UP_CHANNEL_ID;
        const sent = await sendWeeklyReport(client, channelId);
        if (sent) logger.info('[WeeklyReport] Sent successfully');
        else logger.warn('[WeeklyReport] Failed to send — check channelId');
      } catch (err) {
        logger.error(`[WeeklyReport] Error: ${err.message}`);
      }
    });

    logger.info('[WeeklyReport] Scheduled for Sundays at 19:00');
  },
};
