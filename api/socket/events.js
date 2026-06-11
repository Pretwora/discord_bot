const logger = require('../../config/logger');

// In-memory presence map shared across routes
const presenceMap = new Map(); // userId → status

function registerSocketEvents(io) {
  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    // Bot confirms an action → forward to all dashboard clients
    socket.on('bot:ack', (data) => {
      logger.info(`bot:ack received: ${data.event} → ${data.status}`);
      io.emit('bot:ack', data);
    });

    // Bot sends single presence update
    socket.on('member:status', ({ userId, status }) => {
      presenceMap.set(userId, status);
      io.emit('member:status', { userId, status });
    });

    // Bot sends bulk presence snapshot on connect
    socket.on('member:status:bulk', (data) => {
      Object.entries(data).forEach(([userId, status]) => presenceMap.set(userId, status));
      io.emit('member:status:bulk', data);
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });

  io.broadcastGuildEvent = (event, data) => {
    io.emit(event, { ...data, timestamp: new Date().toISOString() });
  };
}

module.exports = registerSocketEvents;
module.exports.presenceMap = presenceMap;
