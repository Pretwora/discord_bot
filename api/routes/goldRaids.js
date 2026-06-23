const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const requireAuth = require('../middleware/auth');
const { writeAuditLog } = require('../../bot/utils/auditLog');
const logger = require('../../config/logger');

const prisma = new PrismaClient();
const GUILD_ID = process.env.DISCORD_GUILD_ID;

function isRLUser(req) { return req.user.isRL === true; }

// GET /api/v1/gold-raids?status=OPEN|ALL&limit=20
router.get('/', requireAuth, async (req, res) => {
  try {
    const { status = 'ALL', limit = '30' } = req.query;
    const where = { guildId: GUILD_ID };
    if (status !== 'ALL') where.status = status;
    if (isRLUser(req)) where.announcedBy = req.user.id;

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

// GET /api/v1/gold-raids/prices — loot table with current prices
router.get('/prices', requireAuth, async (req, res) => {
  if (isRLUser(req)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const { LOOT_TABLE } = require('../../config/lootTable');
    const guild = await prisma.guild.findUnique({ where: { id: GUILD_ID } });
    let goldPrices = {};
    try { goldPrices = JSON.parse(guild?.settings || '{}').goldPrices ?? {}; } catch {}

    const result = Object.entries(LOOT_TABLE).map(([raidKey, raid]) => ({
      raidKey,
      name: raid.name,
      emoji: raid.emoji,
      items: raid.items.map(item => {
        const key = `${raidKey}|${item.slot}|${item.tokenType}`;
        return {
          key,
          slot: item.slot,
          tokenType: item.tokenType,
          label: item.label,
          section: item.section,
          icon: item.icon ?? null,
          defaultPrice: item.defaultPrice,
          price: goldPrices[key] ?? item.defaultPrice,
        };
      }),
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/v1/gold-raids/prices — update price overrides
router.patch('/prices', requireAuth, async (req, res) => {
  if (isRLUser(req)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const { prices } = req.body; // { "GRUUL|GRONN_AXE|UNIQUE": 12000, ... }
    if (!prices || typeof prices !== 'object') {
      return res.status(400).json({ error: 'prices object required' });
    }

    const guild = await prisma.guild.findUnique({ where: { id: GUILD_ID } });
    let settings = {};
    try { settings = JSON.parse(guild?.settings || '{}'); } catch {}

    settings.goldPrices = { ...(settings.goldPrices ?? {}), ...prices };

    await prisma.guild.update({
      where: { id: GUILD_ID },
      data: { settings: JSON.stringify(settings) },
    });

    await writeAuditLog({
      guildId: GUILD_ID,
      actorId: req.user?.username || 'Admin',
      action: 'settings_update',
      meta: { detail: `gold prices updated: ${Object.keys(prices).join(', ')}` },
      source: 'DASHBOARD',
    });

    // Обновляем Discord embed для всех активных рейдов
    const activeRaids = await prisma.goldRaid.findMany({
      where: { guildId: GUILD_ID, status: { in: ['OPEN', 'LOCKED', 'IN_PROGRESS'] }, messageId: { not: null } },
      select: { id: true },
    });
    logger.info(`[prices] saved ${Object.keys(prices).length} price(s), found ${activeRaids.length} active raid(s) to refresh`);
    for (const raid of activeRaids) {
      logger.info(`[prices] emitting goldbid:refresh for raid ${raid.id}`);
      req.io.emit('bot:cmd', { event: 'goldbid:refresh', raidId: raid.id });
    }

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
  if (isRLUser(req)) return res.status(403).json({ error: 'Forbidden' });
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
  if (isRLUser(req)) return res.status(403).json({ error: 'Forbidden' });
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
    if (isRLUser(req) && raid.announcedBy !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    res.json(raid);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/gold-raids — create from dashboard
router.post('/', requireAuth, async (req, res) => {
  try {
    const { notes, scheduledAt, raidType = 'GRUUL_MAGTHERIDON', slotPrice, pumpersEnabled = true, rlCharacterName } = req.body;

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
        pumpersEnabled: Boolean(pumpersEnabled),
        announcedBy: req.user.id,
        notes: notes ?? null,
        rlCharacterName: rlCharacterName ?? null,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      },
    });
    writeAuditLog({ guildId: GUILD_ID, actorId: req.user.id, action: 'GB_CREATE', meta: { raidId: raid.id, source: 'dashboard' } }).catch(() => {});

    // Если указана цена за токен — применить её к настройкам голдбидов для всех token-айтемов нужных рейдов
    if (slotPrice != null) {
      const price = parseInt(slotPrice);
      const { LOOT_TABLE } = require('../../config/lootTable');
      const RAID_TYPE_KEYS = {
        GRUUL_MAGTHERIDON: ['GRUUL', 'MAGTHERIDON'],
        KARAZHAN: ['KARAZHAN'],
        GRUUL: ['GRUUL'],
        MAGTHERIDON: ['MAGTHERIDON'],
      };
      const raidKeys = RAID_TYPE_KEYS[raidType] ?? [];

      const guild = await prisma.guild.findUnique({ where: { id: GUILD_ID } });
      let settings = {};
      try { settings = JSON.parse(guild?.settings || '{}'); } catch {}

      const updatedPrices = { ...(settings.goldPrices ?? {}) };
      for (const raidKey of raidKeys) {
        const raidData = LOOT_TABLE[raidKey];
        if (!raidData) continue;
        for (const item of raidData.items) {
          if (item.tokenType === 'UNIQUE') continue;
          updatedPrices[`${raidKey}|${item.slot}|${item.tokenType}`] = price;
        }
      }

      settings.goldPrices = updatedPrices;
      await prisma.guild.update({ where: { id: GUILD_ID }, data: { settings: JSON.stringify(settings) } });
    }

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
    if (isRLUser(req)) {
      const existing = await prisma.goldRaid.findUnique({ where: { id: req.params.id }, select: { announcedBy: true } });
      if (!existing) return res.status(404).json({ error: 'Рейд не найден' });
      if (existing.announcedBy !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    }

    const { status, notes, totalGold, scheduledAt, slotPrice, extraText, pumpersEnabled, rlCharacterName } = req.body;
    const data = { updatedAt: new Date() };
    if (status) data.status = status;
    if (notes !== undefined) data.notes = notes;
    if (totalGold !== undefined) data.totalGold = totalGold;
    if (scheduledAt !== undefined) data.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
    if (slotPrice !== undefined) data.slotPrice = slotPrice != null ? parseInt(slotPrice) : null;
    if (extraText !== undefined) data.extraText = extraText;
    if (pumpersEnabled !== undefined) data.pumpersEnabled = Boolean(pumpersEnabled);
    if (rlCharacterName !== undefined) data.rlCharacterName = rlCharacterName || null;
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
    if (isRLUser(req)) {
      const existing = await prisma.goldRaid.findUnique({ where: { id: req.params.id }, select: { announcedBy: true } });
      if (!existing) return res.status(404).json({ error: 'Рейд не найден' });
      if (existing.announcedBy !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    }

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
