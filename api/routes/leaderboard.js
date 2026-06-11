const router = require('express').Router();
const auth   = require('../middleware/auth');
const prisma = require('../../config/database');

router.use(auth);

// GET /leaderboard?limit=10
router.get('/', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  try {
    const members = await prisma.member.findMany({
      where: { guildId: process.env.DISCORD_GUILD_ID },
      orderBy: [{ level: 'desc' }, { xp: 'desc' }],
      take: limit,
      select: { id: true, username: true, nickname: true, xp: true, level: true, messageCount: true },
    });
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
