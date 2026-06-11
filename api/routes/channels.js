const router = require('express').Router();
const auth   = require('../middleware/auth');
const prisma = require('../../config/database');
const axios  = require('axios');
const { writeAuditLog } = require('../../bot/utils/auditLog');

const DISCORD_API = 'https://discord.com/api/v10';
const botHeaders  = () => ({ Authorization: `Bot ${process.env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' });

router.use(auth);

// GET /channels — list all channels from DB
router.get('/', async (req, res) => {
  try {
    const channels = await prisma.channel.findMany({
      where: { guildId: process.env.DISCORD_GUILD_ID },
      orderBy: { position: 'asc' },
    });
    res.json(channels);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const CHANNEL_TYPE_MAP = { TEXT: 0, VOICE: 2, CATEGORY: 4, ANNOUNCEMENT: 5 };

// POST /channels — create channel directly via Discord REST API
router.post('/', async (req, res) => {
  const { name, type, categoryId, topic, slowmode } = req.body;
  const GUILD_ID = process.env.DISCORD_GUILD_ID;
  try {
    const body = { name, type: CHANNEL_TYPE_MAP[type] ?? 0 };
    if (categoryId) body.parent_id = categoryId;
    if (topic)      body.topic = topic;
    if (slowmode)   body.rate_limit_per_user = slowmode;
    const { data: ch } = await axios.post(`${DISCORD_API}/guilds/${GUILD_ID}/channels`, body, { headers: botHeaders() });
    await prisma.channel.upsert({
      where:  { id: ch.id },
      update: { name: ch.name, type, categoryId: ch.parent_id || null },
      create: { id: ch.id, guildId: GUILD_ID, name: ch.name, type, categoryId: ch.parent_id || null, position: ch.position || 0 },
    }).catch(() => {});
    await writeAuditLog({ guildId: GUILD_ID, actorId: req.user?.username || 'Admin', action: 'channel_create', targetId: ch.id, meta: { targetName: ch.name, type }, source: 'DASHBOARD' });
    res.json(ch);
  } catch (err) {
    const status = err.response?.status || 500;
    res.status(status).json({ error: err.response?.data?.message || err.message });
  }
});

// DELETE /channels/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const ch = await prisma.channel.findUnique({ where: { id } }).catch(() => null);
    await axios.delete(`${DISCORD_API}/channels/${id}`, { headers: botHeaders() });
    await prisma.channel.delete({ where: { id } }).catch(() => {});
    await writeAuditLog({ guildId: process.env.DISCORD_GUILD_ID, actorId: req.user?.username || 'Admin', action: 'channel_delete', targetId: id, meta: { targetName: ch?.name || id }, source: 'DASHBOARD' });
    res.json({ status: 'ok' });
  } catch (err) {
    const status = err.response?.status || 500;
    res.status(status).json({ error: err.response?.data?.message || err.message });
  }
});

module.exports = router;
