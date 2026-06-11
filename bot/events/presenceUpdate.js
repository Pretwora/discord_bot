const logger = require('../../config/logger');

module.exports = {
  name: 'presenceUpdate',
  async execute(oldPresence, newPresence) {
    if (!newPresence?.userId || !newPresence?.guild) return;
    const socket = newPresence.guild.client._dashSocket;
    if (!socket) return;

    const status = newPresence.status || 'offline'; // online | idle | dnd | offline
    socket.emit('member:status', { userId: newPresence.userId, status });
  },
};
