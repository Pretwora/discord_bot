const router = require('express').Router();
const auth = require('../middleware/auth');
const prisma = require('../../config/database');

router.use(auth);

router.get('/', async (req, res) => {
  const { limit = 50, action } = req.query;
  try {
    const logs = await prisma.auditLog.findMany({
      where: {
        guildId: process.env.DISCORD_GUILD_ID,
        ...(action ? { action } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
