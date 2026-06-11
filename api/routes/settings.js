const router = require('express').Router();
const auth   = require('../middleware/auth');
const prisma = require('../../config/database');
const { writeAuditLog } = require('../../bot/utils/auditLog');

router.use(auth);

const GUILD_ID = () => process.env.DISCORD_GUILD_ID;

router.get('/', async (req, res) => {
  try {
    const guild = await prisma.guild.findUnique({ where: { id: GUILD_ID() } });
    if (!guild) return res.status(404).json({ error: 'Guild not found' });
    let settings = {};
    try { settings = JSON.parse(guild.settings || '{}'); } catch {}
    res.json({ prefix: guild.prefix, ...settings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/', async (req, res) => {
  const { prefix, ...rest } = req.body;
  try {
    const guild = await prisma.guild.findUnique({ where: { id: GUILD_ID() } });
    let existing = {};
    try { existing = JSON.parse(guild?.settings || '{}'); } catch {}

    const merged = { ...existing, ...rest };

    await prisma.guild.update({
      where: { id: GUILD_ID() },
      data: {
        ...(prefix !== undefined ? { prefix } : {}),
        settings: JSON.stringify(merged),
      },
    });
    await writeAuditLog({
      guildId: GUILD_ID(),
      actorId: req.user?.username || 'Admin',
      action: 'settings_update',
      meta: { detail: Object.keys(req.body).join(', ') },
      source: 'DASHBOARD',
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
