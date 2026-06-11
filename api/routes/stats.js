const router = require('express').Router();
const auth = require('../middleware/auth');
const prisma = require('../../config/database');

router.use(auth);

router.get('/overview', async (req, res) => {
  try {
    const guildId = process.env.DISCORD_GUILD_ID;
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const weekAgo = new Date(Date.now() - 7 * 86400000);

    const [memberCount, channelCount, roleCount, joinedToday, xpAgg, activeToday] = await Promise.all([
      prisma.member.count({ where: { guildId } }),
      prisma.channel.count({ where: { guildId } }),
      prisma.role.count({ where: { guildId } }),
      prisma.member.count({ where: { guildId, joinedAt: { gte: todayStart } } }),
      prisma.member.aggregate({ where: { guildId }, _sum: { xp: true, messageCount: true } }),
      prisma.member.count({ where: { guildId, lastActive: { gte: todayStart } } }),
    ]);

    // Daily join counts for last 7 days
    const recentMembers = await prisma.member.findMany({
      where: { guildId, joinedAt: { gte: weekAgo } },
      select: { joinedAt: true },
    });
    const joinsByDay = {};
    for (const m of recentMembers) {
      const day = new Date(m.joinedAt).toISOString().slice(0, 10);
      joinsByDay[day] = (joinsByDay[day] || 0) + 1;
    }

    // Recent join/leave events from audit log
    const recentAudit = await prisma.auditLog.findMany({
      where: { guildId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    res.json({
      memberCount,
      channelCount,
      roleCount,
      joinedToday,
      totalXp: xpAgg._sum.xp || 0,
      totalMessages: xpAgg._sum.messageCount || 0,
      activeToday,
      joinsByDay,
      recentAudit,
    });
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
