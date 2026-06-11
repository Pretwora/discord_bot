const prisma = require('../../config/database');
const logger  = require('../../config/logger');
const { writeAuditLog } = require('../utils/auditLog');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member) {
    await writeAuditLog({
      guildId: member.guild.id,
      actorId: member.user.username,
      action: 'member_leave',
      targetId: member.user.id,
      meta: { targetName: member.user.username },
    });
    await prisma.member.delete({ where: { id: member.id } }).catch(() => {});
    logger.info(`Member left: ${member.user.tag}`);
  },
};
