const router  = require('express').Router();
const auth    = require('../middleware/auth');
const prisma  = require('../../config/database');
const axios   = require('axios');
const { writeAuditLog } = require('../../bot/utils/auditLog');

router.use(auth);

const DISCORD_API = 'https://discord.com/api/v10';
const botHeaders  = () => ({ Authorization: `Bot ${process.env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' });

// Warn thresholds: count → { action, duration minutes (0 = permanent) }
const WARN_ACTIONS = {
  2: { action: 'mute', minutes: 30,       label: 'Мут 30 минут' },
  3: { action: 'mute', minutes: 180,      label: 'Мут 3 часа' },
  4: { action: 'mute', minutes: 1440,     label: 'Мут 24 часа' },
  5: { action: 'ban',  minutes: 0,        label: 'Бан' },
};

// GET /warnings/:memberId
router.get('/:memberId', async (req, res) => {
  try {
    const warnings = await prisma.warning.findMany({
      where: { memberId: req.params.memberId, guildId: process.env.DISCORD_GUILD_ID },
      orderBy: { createdAt: 'desc' },
    });
    res.json(warnings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /warnings/:memberId — issue warning
router.post('/:memberId', async (req, res) => {
  const { reason = 'Нарушение правил' } = req.body;
  const GUILD_ID = process.env.DISCORD_GUILD_ID;
  const moderator = req.user?.username || 'Admin';

  try {
    const warning = await prisma.warning.create({
      data: { memberId: req.params.memberId, guildId: GUILD_ID, reason, moderator },
    });

    const count = await prisma.warning.count({
      where: { memberId: req.params.memberId, guildId: GUILD_ID },
    });

    const rule = WARN_ACTIONS[count];
    let action = null;

    if (rule) {
      if (rule.action === 'ban') {
        await axios.put(
          `${DISCORD_API}/guilds/${GUILD_ID}/bans/${req.params.memberId}`,
          { delete_message_days: 0, reason: `Авто-бан: ${count} предупреждений` },
          { headers: botHeaders() }
        ).catch(() => {});
        action = 'ban';
      } else if (rule.action === 'mute') {
        const until = new Date(Date.now() + rule.minutes * 60 * 1000).toISOString();
        await axios.patch(
          `${DISCORD_API}/guilds/${GUILD_ID}/members/${req.params.memberId}`,
          { communication_disabled_until: until },
          { headers: botHeaders() }
        ).catch(() => {});
        action = { type: 'mute', label: rule.label };
      }
    }

    await writeAuditLog({
      guildId: GUILD_ID,
      actorId: moderator,
      action: action === 'ban' ? 'member_ban' : action?.type === 'mute' ? 'member_timeout' : 'member_warn',
      targetId: req.params.memberId,
      meta: { reason, count, punishment: action?.label || null },
      source: 'DASHBOARD',
    });

    res.json({ warning, count, action });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function removePunishments(memberId, count) {
  const GUILD_ID = process.env.DISCORD_GUILD_ID;
  // If new count has no mute rule — remove Discord timeout
  const hasActiveMute = WARN_ACTIONS[count]?.action === 'mute';
  if (!hasActiveMute) {
    await axios.patch(
      `${DISCORD_API}/guilds/${GUILD_ID}/members/${memberId}`,
      { communication_disabled_until: null },
      { headers: botHeaders() }
    ).catch(() => {});
  }
}

// DELETE /warnings/:memberId/:warningId — remove one warning
router.delete('/:memberId/:warningId', async (req, res) => {
  const GUILD_ID = process.env.DISCORD_GUILD_ID;
  try {
    await prisma.warning.delete({ where: { id: Number(req.params.warningId) } });
    const count = await prisma.warning.count({
      where: { memberId: req.params.memberId, guildId: GUILD_ID },
    });
    await removePunishments(req.params.memberId, count);
    res.json({ status: 'ok', count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /warnings/:memberId — clear all warnings
router.delete('/:memberId', async (req, res) => {
  try {
    await prisma.warning.deleteMany({
      where: { memberId: req.params.memberId, guildId: process.env.DISCORD_GUILD_ID },
    });
    await removePunishments(req.params.memberId, 0);
    res.json({ status: 'ok', count: 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
