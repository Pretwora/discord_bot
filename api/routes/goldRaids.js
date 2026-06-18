const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const requireAuth = require('../middleware/auth');
const { writeAuditLog } = require('../../bot/utils/auditLog');

const prisma = new PrismaClient();
const GUILD_ID = process.env.DISCORD_GUILD_ID;

// GET /api/v1/gold-raids?status=OPEN|ALL&limit=20
router.get('/', requireAuth, async (req, res) => {
  try {
    const { status = 'ALL', limit = '30' } = req.query;
    const where = { guildId: GUILD_ID };
    if (status !== 'ALL') where.status = status;

    const raids = await prisma.goldRaid.findMany({
      where,
      include: {
        _count: { select: { pumpers: true, buyers: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
    });

    res.json(raids.map(r => ({ ...r, pumperCount: r._count.pumpers, buyerCount: r._count.buyers })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/gold-raids/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const raid = await prisma.goldRaid.findUnique({
      where: { id: req.params.id },
      include: {
        pumpers: { orderBy: { joinedAt: 'asc' } },
        buyers:  { orderBy: { joinedAt: 'asc' } },
      },
    });
    if (!raid) return res.status(404).json({ error: 'Рейд не найден' });
    res.json(raid);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/gold-raids — create from dashboard
router.post('/', requireAuth, async (req, res) => {
  try {
    const { notes, scheduledAt, raidType = 'GRUUL_MAGTHERIDON', slotPrice } = req.body;

    // Убеждаемся что запись Guild существует (foreign key)
    await prisma.guild.upsert({
      where: { id: GUILD_ID },
      create: { id: GUILD_ID, name: 'Pretwora DS', ownerId: req.user.id },
      update: {},
    });

    const raid = await prisma.goldRaid.create({
      data: {
        guildId: GUILD_ID,
        status: 'OPEN',
        raidType,
        slotPrice: slotPrice != null ? parseInt(slotPrice) : null,
        announcedBy: req.user.id,
        notes: notes ?? null,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      },
    });
    writeAuditLog({ guildId: GUILD_ID, actorId: req.user.id, action: 'GB_CREATE', meta: { raidId: raid.id, source: 'dashboard' } }).catch(() => {});

    // Просим бота запостить анонс в Discord
    req.io.emit('bot:cmd', { event: 'goldbid:create', raidId: raid.id });

    res.status(201).json(raid);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/v1/gold-raids/:id — update status / notes / gold
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { status, notes, totalGold, scheduledAt, slotPrice } = req.body;
    const data = { updatedAt: new Date() };
    if (status) data.status = status;
    if (notes !== undefined) data.notes = notes;
    if (totalGold !== undefined) data.totalGold = totalGold;
    if (scheduledAt !== undefined) data.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
    if (slotPrice !== undefined) data.slotPrice = slotPrice != null ? parseInt(slotPrice) : null;
    if (status === 'COMPLETED') data.completedAt = new Date();

    const raid = await prisma.goldRaid.update({ where: { id: req.params.id }, data });
    req.io.emit('bot:cmd', { event: 'goldbid:refresh', raidId: raid.id });
    writeAuditLog({ guildId: GUILD_ID, actorId: req.user.id, action: 'GB_UPDATE', meta: { raidId: raid.id, status } }).catch(() => {});
    res.json(raid);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/v1/gold-raids/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const raid = await prisma.goldRaid.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED', updatedAt: new Date() },
    });
    req.io.emit('bot:cmd', { event: 'goldbid:refresh', raidId: raid.id });
    writeAuditLog({ guildId: GUILD_ID, actorId: req.user.id, action: 'GB_CANCEL', meta: { raidId: req.params.id } }).catch(() => {});
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/gold-raids/stats/leaderboard
router.get('/stats/leaderboard', requireAuth, async (req, res) => {
  try {
    const stats = await prisma.goldRaidUserStats.findMany({
      where: { guildId: GUILD_ID },
      orderBy: { pumperGold: 'desc' },
      take: 20,
    });
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/gold-raids/blacklist/all
router.get('/blacklist/all', requireAuth, async (req, res) => {
  try {
    const list = await prisma.goldRaidBlacklist.findMany({
      where: { guildId: GUILD_ID },
      orderBy: { createdAt: 'desc' },
    });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/v1/gold-raids/blacklist/:userId
router.delete('/blacklist/:userId', requireAuth, async (req, res) => {
  try {
    await prisma.goldRaidBlacklist.deleteMany({
      where: { guildId: GUILD_ID, userId: req.params.userId },
    });
    writeAuditLog({ guildId: GUILD_ID, actorId: req.user.id, action: 'GB_UNBLACKLIST', meta: { userId: req.params.userId } }).catch(() => {});
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/v1/gold-raids/:id/buyer/:buyerId — update buyer status
router.patch('/:id/buyer/:buyerId', requireAuth, async (req, res) => {
  try {
    const { status, goldAmount, noShow } = req.body;
    const data = {};
    if (status) data.status = status;
    if (goldAmount !== undefined) data.goldAmount = goldAmount;
    if (noShow !== undefined) data.noShow = noShow;
    const buyer = await prisma.goldRaidBuyer.update({ where: { id: req.params.buyerId }, data });
    res.json(buyer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
