const prisma = require('../../config/database');
const logger  = require('../../config/logger');
const { syncLevelRoles } = require('../utils/levelRoles');
const { getSettings } = require('../utils/getSettings');

const TEMP_VOICE_HUB_ID = process.env.TEMP_VOICE_HUB_ID;

// userId → intervalId
const voiceTimers = new Map();

function xpForLevel(lvl) {
  return lvl <= 0 ? 0 : (lvl * (lvl + 1)) / 2 * 100;
}
function calcLevel(totalXp) {
  let level = 0;
  while (xpForLevel(level + 1) <= totalXp) level++;
  return level;
}

// Returns true if member is eligible for voice XP (not deafened/suppressed)
function memberEligible(guildMember) {
  const vs = guildMember.voice;
  return vs && !vs.serverDeaf && !vs.selfDeaf;
}

// Returns true if channel should grant XP
async function shouldGrantXp(channel) {
  if (!channel) return false;
  if (channel.guild.afkChannelId === channel.id) return false;
  const cfg = await getSettings();
  const minMembers = cfg.xpVoiceMinMembers ?? 2;
  const humans = channel.members.filter(m => !m.user.bot && memberEligible(m)).size;
  return humans >= minMembers;
}

async function startVoiceXp(member) {
  if (voiceTimers.has(member.id)) return;
  const cfg = await getSettings();
  const intervalMs = cfg.xpVoiceIntervalMin * 60 * 1000;
  const id = setInterval(async () => {
    try {
      // Stop if member left voice or is now deafened
      const current = member.guild.members.cache.get(member.id);
      if (!current?.voice?.channelId) { stopVoiceXp(member.id); return; }
      if (!memberEligible(current)) return;

      // Stop if channel no longer qualifies
      const channel = current.voice.channel;
      if (!await shouldGrantXp(channel)) return;

      const cfg = await getSettings();
      const rec = await prisma.member.findFirst({
        where: { id: member.id, guildId: member.guild.id },
      });
      if (!rec) return;

      const newXp    = rec.xp + cfg.xpVoicePerInterval;
      const oldLevel = rec.level;
      const newLevel = calcLevel(newXp);

      await prisma.member.update({
        where: { id: rec.id },
        data: { xp: newXp, level: newLevel, lastActive: new Date() },
      });

      if (newLevel > oldLevel) {
        await syncLevelRoles(current, newLevel);
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
  logger.info(`[voice] Started XP timer for ${member.user.tag}`);
}

function stopVoiceXp(userId) {
  const id = voiceTimers.get(userId);
  if (id) {
    clearInterval(id);
    voiceTimers.delete(userId);
  }
}

// Called from ready.js to restore timers for members already in voice on startup
async function startVoiceXpForMember(member, channel) {
  if (!memberEligible(member)) return;
  if (!await shouldGrantXp(channel)) return;
  startVoiceXp(member);
}

module.exports = {
  startVoiceXpForMember,
  name: 'voiceStateUpdate',
  async execute(oldState, newState) {
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
    // Deafen/undeafen without changing channel
    const stateChanged  = !joinedChannel && !leftChannel && !movedChannel;

    if (joinedChannel) {
      if (await shouldGrantXp(newState.channel)) {
        startVoiceXp(member);
        // Wake up existing members who were waiting for a second person
        newState.channel.members
          .filter(m => !m.user.bot && m.id !== member.id && memberEligible(m))
          .forEach(m => { if (!voiceTimers.has(m.id)) startVoiceXp(m); });
      }
    } else if (leftChannel) {
      stopVoiceXp(member.id);
      // Stop XP for members left alone
      if (oldState.channel) {
        if (!await shouldGrantXp(oldState.channel)) {
          oldState.channel.members
            .filter(m => !m.user.bot)
            .forEach(m => stopVoiceXp(m.id));
        }
      }
    } else if (movedChannel) {
      stopVoiceXp(member.id);
      if (await shouldGrantXp(newState.channel)) startVoiceXp(member);
      // Re-check old channel
      if (oldState.channel) {
        if (!await shouldGrantXp(oldState.channel)) {
          oldState.channel.members.filter(m => !m.user.bot).forEach(m => stopVoiceXp(m.id));
        } else {
          oldState.channel.members
            .filter(m => !m.user.bot && memberEligible(m))
            .forEach(m => { if (!voiceTimers.has(m.id)) startVoiceXp(m); });
        }
      }
    } else if (stateChanged) {
      // Handle deafen/undeafen: stop or restart XP accordingly
      if (!memberEligible(member)) {
        stopVoiceXp(member.id);
      } else if (!voiceTimers.has(member.id) && await shouldGrantXp(newState.channel)) {
        startVoiceXp(member);
      }
    }
  },
};
