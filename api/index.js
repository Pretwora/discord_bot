require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createServer } = require('http');
const { Server } = require('socket.io');
const logger = require('../config/logger');

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: process.env.ALLOWED_ORIGIN, credentials: true },
});

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGIN, credentials: true }));
app.use(express.json());

// Attach io to request for use in routes
app.use((req, _res, next) => { req.io = io; next(); });

// Routes
app.use('/api/v1/auth',    require('./routes/auth'));
app.use('/api/v1/channels', require('./routes/channels'));
app.use('/api/v1/roles',    require('./routes/roles'));
app.use('/api/v1/members',  require('./routes/members'));
app.use('/api/v1/stats',    require('./routes/stats'));
app.use('/api/v1/audit-log', require('./routes/auditLog'));
app.use('/api/v1/ai',       require('./routes/ai'));
app.use('/api/v1/warnings',     require('./routes/warnings'));
app.use('/api/v1/leaderboard',  require('./routes/leaderboard'));
app.use('/api/v1/settings',     require('./routes/settings'));

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// Socket.io connection
require('./socket/events')(io);

const PORT = process.env.PORT || process.env.API_PORT || 3001;
httpServer.listen(PORT, () => logger.info(`API server running on port ${PORT}`));

module.exports = { app, io };
