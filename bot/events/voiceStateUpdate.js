const prisma = require('../../config/database');
const logger  = require('../../config/logger');
const { syncLevelRoles } = require('../utils/levelRoles');
const { getSettings } = require('../utils/getSettings');

const TEMP_VOICE_HUB_ID = process.env.TEMP_VOICE_HUB_ID;

// userId → intervalId  (tracks who is currently accumulating voice XP)
const voiceTimers = new Map();

function xpForLevel(lvl) {
  return lvl <= 0 ? 0 : (lvl * (lvl + 1)) / 2 * 100;
}
function calcLevel(totalXp) {
  let level = 0;
  while (xpForLevel(level + 1) <= totalXp) level++;
  return level;
}

async function startVoiceXp(member) {
  if (voiceTimers.has(member.id)) return;
  const cfg = await getSettings();
  const intervalMs = cfg.xpVoiceIntervalMin * 60 * 1000;
  const id = setInterval(async () => {
    try {
      const cfg = await getSettings();
      const rec = await prisma.member.findFirst({
        where: { id: member.id, guildId: member.guild.id },
      });
      if (!rec) return;
      const newXp   = rec.xp + cfg.xpVoicePerInterval;
      const oldLevel = rec.level;
      const newLevel = calcLevel(newXp);
      await prisma.member.update({
        where: { id: rec.id },
        data: { xp: newXp, level: newLevel, lastActive: new Date() },
      });
      if (newLevel > oldLevel) {
        await syncLevelRoles(member, newLevel);

        const lvlChannel = member.guild.channels.cache.get(process.env.LEVEL_UP_CHANNEL_ID);
        if (lvlChannel) {
          lvlChannel.send({
            embeds: [{
              color: 0x5865f2,
              description: `🎉 <@${member.id}> достиг **${newLevel} уровня** (в голосовом канале)!`,
              footer: { text: `Всего XP: ${newXp.toLocaleString()}` },
            }],
          }).catch(() => {});
        }
        logger.info(`Voice level up: ${member.user.tag} → level ${newLevel}`);
      }
    } catch (err) {
      logger.error('Voice XP error:', err.message);
    }
  }, intervalMs);
  voiceTimers.set(member.id, id);
}

function stopVoiceXp(userId) {
  const id = voiceTimers.get(userId);
  if (id) {
    clearInterval(id);
    voiceTimers.delete(userId);
  }
}

// Returns true if the channel should grant XP (not AFK, not alone)
function shouldGrantXp(channel) {
  if (!channel) return false;
  if (channel.guild.afkChannelId === channel.id) return false;
  // Only grant XP if at least 2 non-bot members present
  const humans = channel.members.filter(m => !m.user.bot).size;
  return humans >= 2;
}

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState, client) {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    // ── Temp channel logic ──────────────────────────────────────────
    if (newState.channelId === TEMP_VOICE_HUB_ID && TEMP_VOICE_HUB_ID) {
      const channel = await newState.guild.channels.create({
        name: `${newState.member.displayName}'s channel`,
        type: 2,
        parent: newState.channel.parentId,
      });
      await newState.setChannel(channel);
      logger.info(`Temp voice created: ${channel.name}`);
    }

    if (oldState.channel && oldState.channel.members.size === 0) {
      const ch = oldState.channel;
      if (ch.name.includes("'s channel")) {
        await ch.delete().catch(() => {});
        logger.info(`Temp voice deleted: ${ch.name}`);
      }
    }

    // ── Voice XP logic ──────────────────────────────────────────────
    const joinedChannel = !oldState.channelId && newState.channelId;
    const leftChannel   = oldState.channelId && !newState.channelId;
    const movedChannel  = oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId;

    if (joinedChannel) {
      if (shouldGrantXp(newState.channel)) startVoiceXp(member);
    } else if (leftChannel) {
      stopVoiceXp(member.id);
      // Re-check members left behind — stop their XP if now alone
      if (oldState.channel) {
        oldState.channel.members.filter(m => !m.user.bot).forEach(m => {
          if (!shouldGrantXp(oldState.channel)) stopVoiceXp(m.id);
        });
      }
    } else if (movedChannel) {
      stopVoiceXp(member.id);
      if (shouldGrantXp(newState.channel)) startVoiceXp(member);
      // Re-check old channel members
      if (oldState.channel) {
        oldState.channel.members.filter(m => !m.user.bot).forEach(m => {
          if (!shouldGrantXp(oldState.channel)) stopVoiceXp(m.id);
          else if (!voiceTimers.has(m.id)) startVoiceXp(m);
        });
      }
    }
  },
};
