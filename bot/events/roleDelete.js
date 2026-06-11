const prisma = require('../../config/database');
const logger = require('../../config/logger');

module.exports = {
  name: 'roleDelete',
  async execute(role) {
    await prisma.role.delete({ where: { id: role.id } }).catch(() => {});
    logger.info(`Role deleted in Discord: @${role.name}`);
  },
};
