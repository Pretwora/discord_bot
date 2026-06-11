const router = require('express').Router();
const auth = require('../middleware/auth');
const prisma = require('../../config/database');
const { writeAuditLog } = require('../../bot/utils/auditLog');

router.use(auth);

router.get('/', async (req, res) => {
  const { limit = 50 } = req.query;
  try {
    const { presenceMap } = require('../socket/events');
    const members = await prisma.member.findMany({
      where: { guildId: process.env.DISCORD_GUILD_ID, inGuild: true },
      take: Number(limit),
      orderBy: { lastActive: 'desc' },
    });
    const memberIds = members.map(m => m.id);
    const warnings = await prisma.warning.groupBy({
      by: ['memberId'],
      where: { memberId: { in: memberIds }, guildId: process.env.DISCORD_GUILD_ID },
      _count: { id: true },
    });
    const warnMap = Object.fromEntries(warnings.map(w => [w.memberId, w._count.id]));

    const withStatus = members.map(m => ({
      ...m,
      onlineStatus: presenceMap.get(m.id) || 'offline',
      warnCount: warnMap[m.id] || 0,
    }));
    res.json(withStatus);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/kick', async (req, res) => {
  const target = await prisma.member.findUnique({ where: { id: req.params.id } }).catch(() => null);
  req.io.emit('bot:member:kick', { userId: req.params.id, reason: req.body.reason });
  await writeAuditLog({
    guildId: process.env.DISCORD_GUILD_ID,
    actorId: req.user?.username || 'Admin',
    action: 'member_kick',
    targetId: req.params.id,
    meta: { targetName: target?.username || req.params.id, reason: req.body.reason },
    source: 'DASHBOARD',
  });
  res.json({ status: 'queued' });
});

router.post('/:id/ban', async (req, res) => {
  const target = await prisma.member.findUnique({ where: { id: req.params.id } }).catch(() => null);
  req.io.emit('bot:member:ban', { userId: req.params.id, reason: req.body.reason });
  await writeAuditLog({
    guildId: process.env.DISCORD_GUILD_ID,
    actorId: req.user?.username || 'Admin',
    action: 'member_ban',
    targetId: req.params.id,
    meta: { targetName: target?.username || req.params.id, reason: req.body.reason },
    source: 'DASHBOARD',
  });
  res.json({ status: 'queued' });
});

module.exports = router;
