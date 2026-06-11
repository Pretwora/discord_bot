const prisma = require('../../config/database');
const logger = require('../../config/logger');

module.exports = {
  name: 'channelDelete',
  async execute(channel) {
    await prisma.channel.delete({ where: { id: channel.id } }).catch(() => {});
    logger.info(`Channel deleted in Discord: #${channel.name}`);
  },
};
