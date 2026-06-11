const prisma = require('../../config/database');
const logger = require('../../config/logger');

module.exports = {
  name: 'roleCreate',
  async execute(role) {
    await prisma.role.upsert({
      where: { id: role.id },
      update: { name: role.name, color: role.hexColor, position: role.position },
      create: {
        id: role.id, guildId: role.guild.id, name: role.name,
        color: role.hexColor, permissions: role.permissions.bitfield.toString(),
        hoist: role.hoist, mentionable: role.mentionable, position: role.position,
      },
    }).catch(err => logger.warn(`roleCreate DB: ${err.message}`));
    logger.info(`Role created in Discord: @${role.name}`);
  },
};
