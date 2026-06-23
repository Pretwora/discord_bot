const router = require('express').Router();
const jwt = require('jsonwebtoken');
const axios = require('axios');

const DISCORD_API = 'https://discord.com/api/v10';
const BOT_HEADERS = () => ({ Authorization: `Bot ${process.env.DISCORD_TOKEN}` });
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const ADMIN_ROLE_NAMES = (process.env.ADMIN_ROLE_NAME || 'Управление')
  .split(',').map(r => r.trim().toLowerCase()).filter(Boolean);
const RL_ROLE_NAME = 'верифицирован';

// Step 1 — redirect to Discord OAuth2
router.get('/discord', (_req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: `${process.env.ALLOWED_ORIGIN}/auth/callback`,
    response_type: 'code',
    scope: 'identify guilds',
  });
  res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
});

// Step 2 — handle callback, exchange code, check access, issue JWT
router.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'No code provided' });

  try {
    // Exchange code for Discord access token
    const tokenRes = await axios.post(`${DISCORD_API}/oauth2/token`,
      new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${process.env.ALLOWED_ORIGIN}/auth/callback`,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    // Get user info
    const userRes = await axios.get(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${tokenRes.data.access_token}` },
    });
    const user = userRes.data;

    // ── Access check ────────────────────────────────────────────────
    // Fetch guild info (owner) and member info in parallel via bot token
    const [guildRes, memberRes] = await Promise.all([
      axios.get(`${DISCORD_API}/guilds/${GUILD_ID}`, { headers: BOT_HEADERS() }),
      axios.get(`${DISCORD_API}/guilds/${GUILD_ID}/members/${user.id}`, { headers: BOT_HEADERS() })
        .catch(() => null), // user might not be in the guild
    ]);

    const guild = guildRes.data;
    const member = memberRes?.data;

    if (!member) {
      return res.status(403).json({ error: 'access_denied', reason: 'not_member' });
    }

    // Owner always gets in
    const isOwner = guild.owner_id === user.id;

    let hasAdminAccess = false;
    let hasRLAccess = false;

    if (!isOwner) {
      const rolesRes = await axios.get(`${DISCORD_API}/guilds/${GUILD_ID}/roles`, { headers: BOT_HEADERS() });
      const adminRoles = rolesRes.data.filter(r => ADMIN_ROLE_NAMES.includes(r.name.toLowerCase()));
      hasAdminAccess = adminRoles.some(r => member.roles.includes(r.id));

      const rlRoles = rolesRes.data.filter(r => r.name.toLowerCase() === RL_ROLE_NAME);
      hasRLAccess = rlRoles.some(r => member.roles.includes(r.id));

      if (!hasAdminAccess && !hasRLAccess) {
        return res.status(403).json({ error: 'access_denied', reason: 'no_permission' });
      }
    }
    // ────────────────────────────────────────────────────────────────

    const isRL = !isOwner && !hasAdminAccess && hasRLAccess;

    // Issue JWT
    const jwtToken = jwt.sign(
      { id: user.id, username: user.username, avatar: user.avatar, isOwner, isRL },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      token: jwtToken,
      user: { id: user.id, username: user.username, avatar: user.avatar, isOwner, isRL },
    });
  } catch (err) {
    const status = err.response?.status;
    if (status === 403 || status === 404) {
      return res.status(403).json({ error: 'access_denied', reason: 'api_error' });
    }
    res.status(500).json({ error: 'Auth failed', detail: err.message });
  }
});

module.exports = router;
