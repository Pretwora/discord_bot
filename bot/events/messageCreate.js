const prisma = require('../../config/database');
const logger  = require('../../config/logger');
const { syncLevelRoles } = require('../utils/levelRoles');
const { getSettings } = require('../utils/getSettings');

const xpCooldown = new Map();

function xpForLevel(level) {
  return level <= 0 ? 0 : (level * (level + 1)) / 2 * 100;
}
function calcLevel(totalXp) {
  let level = 0;
  while (xpForLevel(level + 1) <= totalXp) level++;
  return level;
}

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot || !message.guild) return;

    const cfg = await getSettings();
    const now = Date.now();
    const last = xpCooldown.get(message.author.id) || 0;
    if (now - last < cfg.xpCooldownSec * 1000) return;
    xpCooldown.set(message.author.id, now);

    const gain = Math.floor(Math.random() * (cfg.xpPerMessageMax - cfg.xpPerMessageMin + 1)) + cfg.xpPerMessageMin;

    try {
      const member = await prisma.member.findFirst({
        where: { id: message.author.id, guildId: message.guild.id },
      });
      if (!member) return;

      const newXp    = member.xp + gain;
      const oldLevel = member.level;
      const newLevel = calcLevel(newXp);

      await prisma.member.update({
        where: { id: member.id },
        data: { xp: newXp, level: newLevel, messageCount: { increment: 1 }, lastActive: new Date() },
      });

      if (newLevel > oldLevel) {
        await syncLevelRoles(message.member, newLevel);

        const lvlChannel = message.guild.channels.cache.get(process.env.LEVEL_UP_CHANNEL_ID);
        const target = lvlChannel || message.channel;
        target.send({
          embeds: [{
            color: 0x5865f2,
            description: `🎉 <@${message.author.id}> достиг **${newLevel} уровня**!`,
            footer: { text: `Всего XP: ${newXp.toLocaleString()}` },
          }],
        }).catch(() => {});
        logger.info(`Level up: ${message.author.tag} → level ${newLevel}`);
      }
    } catch (err) {
      logger.error('messageCreate XP error:', err.message);
    }
  },
};
