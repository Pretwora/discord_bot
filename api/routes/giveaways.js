const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const requireAuth = require('../middleware/auth');

const prisma = new PrismaClient();

// GET /api/v1/giveaways?status=ACTIVE|ENDED|ALL&limit=20
router.get('/', requireAuth, async (req, res) => {
  try {
    const { status = 'ALL', limit = '20' } = req.query;
    const where = { guildId: process.env.DISCORD_GUILD_ID };
    if (status !== 'ALL') where.status = status;

    const giveaways = await prisma.giveaway.findMany({
      where,
      include: {
        _count: { select: { entries: true } },
        winners: true,
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
    });

    res.json(giveaways.map(g => ({
      ...g,
      entryCount: g._count.entries,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/giveaways/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const g = await prisma.giveaway.findUnique({
      where: { id: req.params.id },
      include: {
        entries: { orderBy: { createdAt: 'asc' } },
        winners: true,
        _count: { select: { entries: true } },
      },
    });
    if (!g) return res.status(404).json({ error: 'Not found' });
    res.json({ ...g, entryCount: g._count.entries });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/giveaways — create from dashboard
router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      prize, description, channelId, winnersCount = 1,
      endsAt, requiredRoleId, bonusEntries = false,
    } = req.body;

    if (!prize || !channelId || !endsAt) {
      return res.status(400).json({ error: 'prize, channelId and endsAt are required' });
    }
    if (new Date(endsAt) <= new Date()) {
      return res.status(400).json({ error: 'endsAt must be in the future' });
    }

    const guildId = process.env.DISCORD_GUILD_ID;

    const giveaway = await prisma.giveaway.create({
      data: {
        guildId,
        channelId,
        prize,
        description: description || null,
        winnersCount: parseInt(winnersCount),
        endsAt: new Date(endsAt),
        hostedBy: req.user.id,
        requiredRoleId: requiredRoleId || null,
        bonusEntries,
      },
    });

    // Tell the bot to post the message and schedule end
    req.io?.emit('bot:cmd', { event: 'giveaway:create', giveawayId: giveaway.id });

    res.status(201).json(giveaway);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/giveaways/:id/end
router.post('/:id/end', requireAuth, async (req, res) => {
  try {
    const g = await prisma.giveaway.findUnique({ where: { id: req.params.id } });
    if (!g) return res.status(404).json({ error: 'Not found' });
    if (g.status !== 'ACTIVE') return res.status(400).json({ error: 'Already ended' });

    req.io?.emit('bot:cmd', { event: 'giveaway:end', giveawayId: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/giveaways/:id/reroll
router.post('/:id/reroll', requireAuth, async (req, res) => {
  try {
    const { count = 1 } = req.body;
    const g = await prisma.giveaway.findUnique({ where: { id: req.params.id } });
    if (!g) return res.status(404).json({ error: 'Not found' });
    if (g.status !== 'ENDED') return res.status(400).json({ error: 'Not ended yet' });

    req.io?.emit('bot:cmd', { event: 'giveaway:reroll', giveawayId: req.params.id, count });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/v1/giveaways/:id — cancel
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const g = await prisma.giveaway.findUnique({ where: { id: req.params.id } });
    if (!g) return res.status(404).json({ error: 'Not found' });
    if (g.status !== 'ACTIVE') return res.status(400).json({ error: 'Can only cancel active giveaways' });

    await prisma.giveaway.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED', endedAt: new Date() },
    });

    req.io?.emit('bot:cmd', { event: 'giveaway:cancel', giveawayId: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
