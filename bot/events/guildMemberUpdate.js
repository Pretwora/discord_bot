const prisma = require('../../config/database');
const logger = require('../../config/logger');

module.exports = {
  name: 'guildMemberUpdate',
  async execute(oldMember, newMember) {
    const rolesJson = JSON.stringify(
      newMember.roles.cache
        .filter(r => r.name !== '@everyone')
        .map(r => ({ id: r.id, name: r.name, color: r.hexColor }))
    );
    await prisma.member.update({
      where: { id: newMember.id },
      data: { nickname: newMember.nickname ?? null, roles: rolesJson },
    }).catch(() => {}); // ignore if member not in DB yet
  },
};
