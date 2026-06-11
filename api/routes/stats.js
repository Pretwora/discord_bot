const router = require('express').Router();
const auth = require('../middleware/auth');
const prisma = require('../../config/database');

router.use(auth);

router.get('/overview', async (req, res) => {
  try {
    const [memberCount, channelCount, roleCount, auditCount] = await Promise.all([
      prisma.member.count({ where: { guildId: process.env.DISCORD_GUILD_ID } }),
      prisma.channel.count({ where: { guildId: process.env.DISCORD_GUILD_ID } }),
      prisma.role.count({ where: { guildId: process.env.DISCORD_GUILD_ID } }),
      prisma.auditLog.count({ where: { guildId: process.env.DISCORD_GUILD_ID } }),
    ]);
    res.json({ memberCount, channelCount, roleCount, auditCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/members/top', async (req, res) => {
  try {
    const top = await prisma.member.findMany({
      where: { guildId: process.env.DISCORD_GUILD_ID },
      orderBy: { messageCount: 'desc' },
      take: 10,
    });
    res.json(top);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Trigger a full re-sync from Discord via bot socket
router.post('/sync', (req, res) => {
  req.io.emit('bot:sync:request');
  res.json({ status: 'queued', message: 'Sync request sent to bot' });
});

module.exports = router;
