const router  = require('express').Router();
const auth    = require('../middleware/auth');
const prisma  = require('../../config/database');
const Groq    = require('groq-sdk');

router.use(auth);

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = 'llama-3.1-8b-instant';

const DISCORD_API = 'https://discord.com/api/v10';
const botHeaders  = () => ({ Authorization: `Bot ${process.env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' });

async function discordReq(method, path, body) {
  const axios = require('axios');
  const r = await axios({ method, url: DISCORD_API + path, headers: botHeaders(), data: body });
  return r.data;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getServerState() {
  const GUILD_ID = process.env.DISCORD_GUILD_ID;
  const [roles, channels, members] = await Promise.all([
    prisma.role.findMany({ where: { guildId: GUILD_ID }, orderBy: { position: 'desc' } }),
    prisma.channel.findMany({ where: { guildId: GUILD_ID }, orderBy: { position: 'asc' } }),
    prisma.member.findMany({ where: { guildId: GUILD_ID }, take: 50, orderBy: { messageCount: 'desc' } }),
  ]);
  return { roles, channels, members };
}

// OpenAI-style tool definitions
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'list_server_state',
      description: 'Get current list of roles, channels, and members from the database',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_channel',
      description: 'Create a new channel in the Discord server',
      parameters: {
        type: 'object',
        properties: {
          name:       { type: 'string',  description: 'Channel name (lowercase, hyphens OK)' },
          type:       { type: 'string',  enum: ['GUILD_TEXT', 'GUILD_VOICE', 'GUILD_CATEGORY'], description: 'Channel type' },
          categoryId: { type: 'string',  description: 'Parent category channel ID (optional)' },
          topic:      { type: 'string',  description: 'Channel topic (optional)' },
        },
        required: ['name', 'type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_channel',
      description: 'Delete a channel from the Discord server',
      parameters: {
        type: 'object',
        properties: {
          channelId: { type: 'string', description: 'Discord channel ID to delete' },
          name:      { type: 'string', description: 'Channel name (for display)' },
        },
        required: ['channelId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_role',
      description: 'Create a new role in the Discord server',
      parameters: {
        type: 'object',
        properties: {
          name:        { type: 'string',  description: 'Role name' },
          color:       { type: 'string',  description: 'Hex color like #FF5733 (optional)' },
          hoist:       { type: 'boolean', description: 'Show role separately in member list' },
          mentionable: { type: 'boolean', description: 'Allow @mention' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_role',
      description: 'Delete a role from the Discord server',
      parameters: {
        type: 'object',
        properties: {
          roleId: { type: 'string', description: 'Discord role ID to delete' },
          name:   { type: 'string', description: 'Role name (for display)' },
        },
        required: ['roleId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'rename_channel',
      description: 'Rename an existing channel',
      parameters: {
        type: 'object',
        properties: {
          channelId: { type: 'string', description: 'Discord channel ID' },
          newName:   { type: 'string', description: 'New channel name' },
        },
        required: ['channelId', 'newName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_plan',
      description: 'When the request is destructive or involves many operations (bulk deletes, full restructure), present a plan and wait for user confirmation BEFORE executing anything.',
      parameters: {
        type: 'object',
        properties: {
          title:   { type: 'string', description: 'Short plan title' },
          summary: { type: 'string', description: 'Brief explanation of what will happen' },
          steps:   { type: 'array', items: { type: 'string' }, description: 'List of action steps in plain language' },
          warning: { type: 'string', description: 'Risk or irreversibility warning (optional)' },
        },
        required: ['title', 'summary', 'steps'],
      },
    },
  },
];

function hexToInt(hex) {
  if (!hex) return 0;
  return parseInt(hex.replace('#', ''), 16);
}

const CHANNEL_TYPE_MAP = { GUILD_TEXT: 0, GUILD_VOICE: 2, GUILD_CATEGORY: 4 };

async function executeTool(name, input) {
  const GUILD_ID = process.env.DISCORD_GUILD_ID;

  if (name === 'list_server_state') {
    const state = await getServerState();
    return JSON.stringify({
      roles:    state.roles.map(r => ({ id: r.id, name: r.name, color: r.color })),
      channels: state.channels.map(c => ({ id: c.id, name: c.name, type: c.type, categoryId: c.categoryId })),
      members:  state.members.map(m => ({ id: m.id, username: m.username, messageCount: m.messageCount })),
    });
  }

  if (name === 'create_channel') {
    await sleep(300);
    const body = { name: input.name, type: CHANNEL_TYPE_MAP[input.type] ?? 0 };
    if (input.categoryId) body.parent_id = input.categoryId;
    if (input.topic)      body.topic = input.topic;
    const ch = await discordReq('POST', `/guilds/${GUILD_ID}/channels`, body);
    await prisma.channel.upsert({
      where:  { id: ch.id },
      update: { name: ch.name, type: input.type, categoryId: ch.parent_id || null },
      create: { id: ch.id, guildId: GUILD_ID, name: ch.name, type: input.type, categoryId: ch.parent_id || null, position: ch.position || 0 },
    }).catch(() => {});
    return JSON.stringify({ ok: true, id: ch.id, name: ch.name });
  }

  if (name === 'delete_channel') {
    await sleep(300);
    await discordReq('DELETE', `/channels/${input.channelId}`);
    await prisma.channel.delete({ where: { id: input.channelId } }).catch(() => {});
    return JSON.stringify({ ok: true });
  }

  if (name === 'create_role') {
    await sleep(300);
    const role = await discordReq('POST', `/guilds/${GUILD_ID}/roles`, {
      name: input.name, color: hexToInt(input.color), hoist: !!input.hoist, mentionable: !!input.mentionable,
    });
    await prisma.role.upsert({
      where:  { id: role.id },
      update: { name: role.name, color: input.color || '#96989d' },
      create: { id: role.id, guildId: GUILD_ID, name: role.name, color: input.color || '#96989d', position: role.position || 0 },
    }).catch(() => {});
    return JSON.stringify({ ok: true, id: role.id, name: role.name });
  }

  if (name === 'delete_role') {
    await sleep(300);
    await discordReq('DELETE', `/guilds/${GUILD_ID}/roles/${input.roleId}`);
    await prisma.role.delete({ where: { id: input.roleId } }).catch(() => {});
    return JSON.stringify({ ok: true });
  }

  if (name === 'rename_channel') {
    await sleep(300);
    const ch = await discordReq('PATCH', `/channels/${input.channelId}`, { name: input.newName });
    await prisma.channel.update({ where: { id: input.channelId }, data: { name: ch.name } }).catch(() => {});
    return JSON.stringify({ ok: true, name: ch.name });
  }

  return JSON.stringify({ error: 'Unknown tool' });
}

// POST /api/v1/ai/chat  (SSE)
router.post('/chat', async (req, res) => {
  const { message, history = [], apiMessages: incomingApiMessages, planConfirmed = false } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  function send(type, payload) {
    res.write(`data: ${JSON.stringify({ type, ...payload })}\n\n`);
  }

  try {
    const state = await getServerState();

    const confirmedNote = planConfirmed
      ? '\n\nCRITICAL: The user has ALREADY confirmed the plan. DO NOT call propose_plan again. Execute all steps immediately using the tools.'
      : '';

    const systemPrompt = `You are a Discord server admin assistant for "Pretwora DS". Use tools to manage it.
Stats: ${state.roles.length} roles, ${state.channels.length} channels, ${state.members.length} members.
Rules: simple ops→execute directly. Bulk/destructive→propose_plan ONCE then stop. After confirm→execute, never propose_plan again. Reply in user's language.${confirmedNote}`;

    // Use full API messages if provided (preserves tool_calls context), else build from simple history
    const messages = incomingApiMessages
      ? [...incomingApiMessages, { role: 'user', content: message }]
      : [...history.map(h => ({ role: h.role, content: h.content })), { role: 'user', content: message }];

    let continueLoop = true;

    while (continueLoop) {
      const response = await groq.chat.completions.create({
        model: MODEL,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        tools: TOOLS,
        tool_choice: 'auto',
        max_tokens: 4096,
      });

      const msg = response.choices[0].message;
      const finishReason = response.choices[0].finish_reason;

      if (msg.content) {
        send('text', { text: msg.content });
      }

      if (finishReason === 'tool_calls' && msg.tool_calls?.length) {
        messages.push({ role: 'assistant', content: msg.content || null, tool_calls: msg.tool_calls });

        const toolResults = [];

        for (const tc of msg.tool_calls) {
          const name  = tc.function.name;
          let   input = {};
          try { input = JSON.parse(tc.function.arguments); } catch {}

          send('tool_start', { toolName: name, input });

          // propose_plan — send to client and stop loop
          if (name === 'propose_plan') {
            toolResults.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ status: 'plan_presented' }) });
            send('plan', { plan: input });
            send('tool_end', { toolName: name, ok: true });
            messages.push(...toolResults);
            continueLoop = false;
            break;
          }

          try {
            const result = await executeTool(name, input);
            toolResults.push({ role: 'tool', tool_call_id: tc.id, content: result });
            send('tool_end', { toolName: name, ok: true });
          } catch (err) {
            toolResults.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ error: err.message }) });
            send('tool_end', { toolName: name, ok: false, error: err.message });
          }
        }

        if (continueLoop) {
          messages.push(...toolResults);
        }
      } else {
        continueLoop = false;
      }
    }

    // Send full messages so frontend can pass them back for proper tool_calls context
    send('done', { invalidate: true, apiMessages: messages });
  } catch (err) {
    send('error', { message: err.message });
  } finally {
    res.end();
  }
});

module.exports = router;
