# Discord Bot + Web Dashboard

Admin bot for Discord with a browser-based control panel.

## Quick start

### 1. Install dependencies
```bash
npm install
cd dashboard && npm install && cd ..
```

### 2. Configure environment
```bash
cp .env.example .env
# Fill in DISCORD_TOKEN, DISCORD_CLIENT_ID, etc.
```

### 3. Initialize database
```bash
npm run db:migrate
npm run db:generate
```

### 4. Register slash commands (once)
```bash
node scripts/deploy-commands.js
```

### 5. Run in development
```bash
npm run dev:bot   # terminal 1 — Discord bot
npm run dev:api   # terminal 2 — REST API + WebSocket
cd dashboard && npm run dev  # terminal 3 — React dashboard
```

### 6. Deploy to VPS (Docker)
```bash
docker compose up -d
```

## Project structure
```
discord-bot/
├── bot/            Discord bot (discord.js v14)
│   ├── commands/   Slash commands
│   ├── events/     Discord event handlers
│   └── managers/   Channel, Role, Member managers
├── api/            Express REST API + Socket.io
│   ├── routes/     API endpoints
│   ├── middleware/ Auth, rate limiter
│   └── socket/     Realtime events
├── dashboard/      React + Vite web panel
│   └── src/
│       ├── pages/      Overview, Channels, Roles, Members…
│       ├── components/ Layout, UI components
│       ├── hooks/      useSocket
│       └── lib/        api.js (axios instance)
├── db/             Prisma schema + migrations
├── config/         logger.js, database.js
└── scripts/        deploy-commands.js
```
