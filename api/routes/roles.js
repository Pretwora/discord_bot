const router = require('express').Router();
const auth   = require('../middleware/auth');
const prisma = require('../../config/database');
const axios  = require('axios');
const { writeAuditLog } = require('../../bot/utils/auditLog');

router.use(auth);

const DISCORD_API = 'https://discord.com/api/v10';
const botHeaders  = () => ({ Authorization: `Bot ${process.env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' });

router.get('/', async (req, res) => {
  try {
    const roles = await prisma.role.findMany({
      where: { guildId: process.env.DISCORD_GUILD_ID },
      orderBy: { position: 'desc' },
    });
    res.json(roles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { name, color, hoist, mentionable } = req.body;
  const GUILD_ID = process.env.DISCORD_GUILD_ID;
  try {
    const colorInt = color ? parseInt(color.replace('#', ''), 16) : 0;
    const { data: role } = await axios.post(`${DISCORD_API}/guilds/${GUILD_ID}/roles`, { name, color: colorInt, hoist: !!hoist, mentionable: !!mentionable }, { headers: botHeaders() });
    await prisma.role.upsert({
      where:  { id: role.id },
      update: { name: role.name, color: color || '#96989d' },
      create: { id: role.id, guildId: GUILD_ID, name: role.name, color: color || '#96989d', position: role.position || 0 },
    }).catch(() => {});
    await writeAuditLog({ guildId: GUILD_ID, actorId: req.user?.username || 'Admin', action: 'role_create', targetId: role.id, meta: { targetName: role.name }, source: 'DASHBOARD' });
    res.json(role);
  } catch (err) {
    const status = err.response?.status || 500;
    res.status(status).json({ error: err.response?.data?.message || err.message });
  }
});

router.post('/:id/assign', async (req, res) => {
  const { userId } = req.body;
  const GUILD_ID = process.env.DISCORD_GUILD_ID;
  try {
    await axios.put(`${DISCORD_API}/guilds/${GUILD_ID}/members/${userId}/roles/${req.params.id}`, {}, { headers: botHeaders() });
    const [role, member] = await Promise.all([
      prisma.role.findUnique({ where: { id: req.params.id } }).catch(() => null),
      prisma.member.findUnique({ where: { id: userId } }).catch(() => null),
    ]);
    await writeAuditLog({ guildId: GUILD_ID, actorId: req.user?.username || 'Admin', action: 'role_assign', targetId: userId, meta: { targetName: member?.username || userId, roleName: role?.name || req.params.id }, source: 'DASHBOARD' });
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: err.response?.data?.message || err.message });
  }
});

router.delete('/:id/assign/:userId', async (req, res) => {
  const GUILD_ID = process.env.DISCORD_GUILD_ID;
  try {
    await axios.delete(`${DISCORD_API}/guilds/${GUILD_ID}/members/${req.params.userId}/roles/${req.params.id}`, { headers: botHeaders() });
    const [role, member] = await Promise.all([
      prisma.role.findUnique({ where: { id: req.params.id } }).catch(() => null),
      prisma.member.findUnique({ where: { id: req.params.userId } }).catch(() => null),
    ]);
    await writeAuditLog({ guildId: GUILD_ID, actorId: req.user?.username || 'Admin', action: 'role_unassign', targetId: req.params.userId, meta: { targetName: member?.username || req.params.userId, roleName: role?.name || req.params.id }, source: 'DASHBOARD' });
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: err.response?.data?.message || err.message });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const GUILD_ID = process.env.DISCORD_GUILD_ID;
  try {
    const role = await prisma.role.findUnique({ where: { id } }).catch(() => null);
    await axios.delete(`${DISCORD_API}/guilds/${GUILD_ID}/roles/${id}`, { headers: botHeaders() });
    await prisma.role.delete({ where: { id } }).catch(() => {});
    await writeAuditLog({ guildId: GUILD_ID, actorId: req.user?.username || 'Admin', action: 'role_delete', targetId: id, meta: { targetName: role?.name || id }, source: 'DASHBOARD' });
    res.json({ status: 'ok' });
  } catch (err) {
    const status = err.response?.status || 500;
    res.status(status).json({ error: err.response?.data?.message || err.message });
  }
});

module.exports = router;
