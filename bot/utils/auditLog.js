const prisma = require('../../config/database');

async function writeAuditLog({ guildId, actorId, action, targetId = null, meta = {}, source = 'BOT' }) {
  try {
    await prisma.auditLog.create({
      data: {
        guildId,
        actorId,
        action,
        targetId,
        meta: JSON.stringify(meta),
        source,
      },
    });
  } catch {}
}

module.exports = { writeAuditLog };
