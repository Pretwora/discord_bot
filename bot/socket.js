const { io } = require('socket.io-client');
const logger = require('../config/logger');
const RoleManager   = require('./managers/RoleManager');
const ChannelManager = require('./managers/ChannelManager');
const MemberManager  = require('./managers/MemberManager');

module.exports = function connectDashboardSocket(client) {
  const API_URL = process.env.VITE_API_URL || 'http://localhost:3001';
  const GUILD_ID = process.env.DISCORD_GUILD_ID;

  const socket = io(API_URL, { reconnectionDelay: 3000, reconnectionAttempts: Infinity });

  // Store socket on client so presenceUpdate event can access it
  client._dashSocket = socket;

  socket.on('connect', () => {
    logger.info(`Bot socket connected to API (${socket.id})`);
    // Push initial presence snapshot on (re)connect
    const guild = client.guilds.cache.get(GUILD_ID);
    if (guild) {
      const presences = {};
      guild.presences.cache.forEach((p, id) => { presences[id] = p.status || 'offline'; });
      socket.emit('member:status:bulk', presences);
    }
  });
  socket.on('disconnect', reason => logger.warn(`Bot socket disconnected: ${reason}`));
  socket.on('connect_error', err => logger.error(`Bot socket error: ${err.message}`));

  function guild() {
    const g = client.guilds.cache.get(GUILD_ID);
    if (!g) throw new Error(`Guild ${GUILD_ID} not in cache`);
    return g;
  }

  // ── Manual re-sync ────────────────────────────────────────────────
  socket.on('bot:sync:request', async () => {
    try {
      if (typeof client._syncGuild === 'function') {
        await client._syncGuild();
        socket.emit('bot:ack', { event: 'bot:sync:request', status: 'ok' });
      } else {
        socket.emit('bot:ack', { event: 'bot:sync:request', status: 'error', message: 'syncGuild not ready' });
      }
    } catch (err) {
      logger.error(`bot:sync:request failed: ${err.message}`);
      socket.emit('bot:ack', { event: 'bot:sync:request', status: 'error', message: err.message });
    }
  });

  // ── Roles ──────────────────────────────────────────────────────────
  socket.on('bot:role:create', async ({ name, color, hoist, mentionable }) => {
    try {
      await new RoleManager(guild()).create({ name, color, hoist, mentionable });
      socket.emit('bot:ack', { event: 'bot:role:create', status: 'ok', name });
    } catch (err) {
      logger.error(`bot:role:create failed: ${err.message}`);
      socket.emit('bot:ack', { event: 'bot:role:create', status: 'error', message: err.message });
    }
  });

  socket.on('bot:role:assign', async ({ roleId, userId }) => {
    try {
      await new RoleManager(guild()).assign(userId, roleId);
      socket.emit('bot:ack', { event: 'bot:role:assign', status: 'ok' });
    } catch (err) {
      logger.error(`bot:role:assign failed: ${err.message}`);
      socket.emit('bot:ack', { event: 'bot:role:assign', status: 'error', message: err.message });
    }
  });

  socket.on('bot:role:delete', async ({ roleId }) => {
    try {
      await new RoleManager(guild()).delete(roleId);
      socket.emit('bot:ack', { event: 'bot:role:delete', status: 'ok', roleId });
    } catch (err) {
      logger.error(`bot:role:delete failed: ${err.message}`);
      socket.emit('bot:ack', { event: 'bot:role:delete', status: 'error', message: err.message });
    }
  });

  socket.on('bot:role:remove', async ({ roleId, userId }) => {
    try {
      await new RoleManager(guild()).remove(userId, roleId);
      socket.emit('bot:ack', { event: 'bot:role:remove', status: 'ok' });
    } catch (err) {
      logger.error(`bot:role:remove failed: ${err.message}`);
      socket.emit('bot:ack', { event: 'bot:role:remove', status: 'error', message: err.message });
    }
  });

  // ── Channels ───────────────────────────────────────────────────────
  socket.on('bot:channel:create', async ({ name, type, categoryId, topic, slowmode }) => {
    try {
      await new ChannelManager(guild()).create({ name, type, categoryId, topic, slowmode });
      socket.emit('bot:ack', { event: 'bot:channel:create', status: 'ok', name });
    } catch (err) {
      logger.error(`bot:channel:create failed: ${err.message}`);
      socket.emit('bot:ack', { event: 'bot:channel:create', status: 'error', message: err.message });
    }
  });

  socket.on('bot:channel:delete', async ({ channelId }) => {
    try {
      await new ChannelManager(guild()).delete(channelId);
      socket.emit('bot:ack', { event: 'bot:channel:delete', status: 'ok', channelId });
    } catch (err) {
      logger.error(`bot:channel:delete failed: ${err.message}`);
      socket.emit('bot:ack', { event: 'bot:channel:delete', status: 'error', message: err.message });
    }
  });

  // ── Members ────────────────────────────────────────────────────────
  socket.on('bot:member:kick', async ({ userId, reason }) => {
    try {
      await new MemberManager(guild()).kick(userId, reason);
      socket.emit('bot:ack', { event: 'bot:member:kick', status: 'ok', userId });
    } catch (err) {
      logger.error(`bot:member:kick failed: ${err.message}`);
      socket.emit('bot:ack', { event: 'bot:member:kick', status: 'error', message: err.message });
    }
  });

  socket.on('bot:member:ban', async ({ userId, reason }) => {
    try {
      await new MemberManager(guild()).ban(userId, { reason });
      socket.emit('bot:ack', { event: 'bot:member:ban', status: 'ok', userId });
    } catch (err) {
      logger.error(`bot:member:ban failed: ${err.message}`);
      socket.emit('bot:ack', { event: 'bot:member:ban', status: 'error', message: err.message });
    }
  });

  return socket;
};
