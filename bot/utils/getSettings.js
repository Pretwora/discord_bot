const prisma = require('../../config/database');

let cache = null;
let cacheAt = 0;
const TTL = 60_000; // reload every minute

async function getSettings() {
  if (cache && Date.now() - cacheAt < TTL) return cache;
  const guild = await prisma.guild.findUnique({ where: { id: process.env.DISCORD_GUILD_ID } });
  let s = {};
  try { s = JSON.parse(guild?.settings || '{}'); } catch {}
  cache = {
    xpPerMessageMin:    s.xpPerMessageMin    ?? 10,
    xpPerMessageMax:    s.xpPerMessageMax    ?? 20,
    xpCooldownSec:      s.xpCooldownSec      ?? 60,
    xpVoicePerInterval: s.xpVoicePerInterval ?? 10,
    xpVoiceIntervalMin: s.xpVoiceIntervalMin ?? 5,
    xpVoiceMinMembers:  s.xpVoiceMinMembers  ?? 2,
  };
  cacheAt = Date.now();
  return cache;
}

module.exports = { getSettings };
