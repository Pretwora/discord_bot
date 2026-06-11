require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');
const prisma = require('../config/database');

const GUILD_ID = process.env.DISCORD_GUILD_ID;
const BASE     = 'https://discord.com/api/v10';
const headers  = { Authorization: `Bot ${process.env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' };

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function api(method, path, data) {
  await sleep(400); // rate limit buffer
  const r = await axios({ method, url: BASE + path, headers, data });
  return r.data;
}

// ── Roles ──────────────────────────────────────────────────────────────────
const ROLES = [
  { name: '👑 Владелец',     color: '#FFD700', hoist: true,  mentionable: false },
  { name: '💎 Элита',        color: '#E040FB', hoist: true,  mentionable: true  },
  { name: '🛡️ Администратор',color: '#F44336', hoist: true,  mentionable: true  },
  { name: '⚔️ Модератор',    color: '#FF9800', hoist: true,  mentionable: true  },
  { name: '🌟 Преданный',    color: '#2196F3', hoist: false, mentionable: false },
  { name: '🎮 Геймер',       color: '#4CAF50', hoist: false, mentionable: false },
  { name: '🎵 Меломан',      color: '#00BCD4', hoist: false, mentionable: false },
  { name: '👤 Участник',     color: '#9E9E9E', hoist: false, mentionable: false },
  { name: '🤖 Бот',          color: '#607D8B', hoist: false, mentionable: false },
  { name: '🚫 Тень',         color: '#37474F', hoist: false, mentionable: false },
];

// ── Channels (grouped by category) ────────────────────────────────────────
// type: 0=text, 2=voice, 4=category
const STRUCTURE = [
  {
    category: '📋 ИНФОРМАЦИЯ',
    channels: [
      { name: 'правила',        type: 0, topic: '📜 Правила сервера — прочти перед общением' },
      { name: 'анонсы',         type: 0, topic: '📣 Важные новости и обновления сервера' },
      { name: 'роли',           type: 0, topic: '🎭 Информация о ролях и как их получить' },
    ],
  },
  {
    category: '💬 ОБЩЕНИЕ',
    channels: [
      { name: 'общий',          type: 0, topic: '💬 Основной чат для общения' },
      { name: 'флуд',           type: 0, topic: '🌊 Здесь можно флудить сколько угодно' },
      { name: 'мемы',           type: 0, topic: '😂 Мемы, приколы, смешные картинки' },
      { name: 'медиа',          type: 0, topic: '🖼️ Фото, видео, арты — делись контентом' },
    ],
  },
  {
    category: '🎮 ИГРЫ',
    channels: [
      { name: 'игровой-чат',        type: 0, topic: '🎮 Обсуждение игр' },
      { name: 'поиск-тиммейтов',    type: 0, topic: '🤝 Ищешь пати? Пиши сюда' },
      { name: 'достижения',         type: 0, topic: '🏆 Хвастайся своими победами' },
    ],
  },
  {
    category: '🎵 МУЗЫКА',
    channels: [
      { name: 'музыкальный',    type: 0, topic: '🎵 Запросы для музыкального бота' },
      { name: 'плейлисты',      type: 0, topic: '📀 Делись своими плейлистами' },
    ],
  },
  {
    category: '💎 VIP ЭЛИТА',
    channels: [
      { name: 'vip-чат',        type: 0, topic: '✨ Закрытый чат для Элиты' },
      { name: 'vip-планы',      type: 0, topic: '🗓️ Обсуждение планов и идей' },
    ],
  },
  {
    category: '🔊 ГОЛОСОВЫЕ',
    channels: [
      { name: '🎮 Игровая #1',  type: 2 },
      { name: '🎮 Игровая #2',  type: 2 },
      { name: '💬 Общалка',     type: 2 },
      { name: '🎵 Музыкальная', type: 2 },
      { name: '🔇 AFK',         type: 2 },
    ],
  },
  {
    category: '⚙️ АДМИНИСТРАЦИЯ',
    channels: [
      { name: 'мод-лог',        type: 0, topic: '📋 Лог действий модерации' },
      { name: 'бот-команды',    type: 0, topic: '🤖 Сюда пиши команды ботам' },
    ],
  },
];

async function run() {
  console.log('🚀 Начинаем настройку сервера...\n');

  // 1. Create roles
  console.log('🎭 Создаём роли...');
  const roleMap = {};
  for (const r of ROLES) {
    const color = parseInt(r.color.replace('#', ''), 16);
    const role = await api('POST', `/guilds/${GUILD_ID}/roles`, {
      name: r.name, color, hoist: r.hoist, mentionable: r.mentionable,
    });
    roleMap[r.name] = role.id;
    await prisma.role.upsert({
      where:  { id: role.id },
      update: { name: role.name, color: r.color },
      create: { id: role.id, guildId: GUILD_ID, name: role.name, color: r.color, position: role.position || 0 },
    }).catch(() => {});
    console.log(`  ✅ ${r.name}`);
  }

  // 2. Create categories + channels
  console.log('\n📁 Создаём категории и каналы...');
  for (const group of STRUCTURE) {
    const cat = await api('POST', `/guilds/${GUILD_ID}/channels`, {
      name: group.category, type: 4,
    });
    await prisma.channel.upsert({
      where:  { id: cat.id },
      update: { name: cat.name, type: 'CATEGORY' },
      create: { id: cat.id, guildId: GUILD_ID, name: cat.name, type: 'CATEGORY', position: cat.position || 0 },
    }).catch(() => {});
    console.log(`\n  📂 ${group.category}`);

    for (const ch of group.channels) {
      const body = { name: ch.name, type: ch.type, parent_id: cat.id };
      if (ch.topic) body.topic = ch.topic;
      const channel = await api('POST', `/guilds/${GUILD_ID}/channels`, body);
      const chType = ch.type === 2 ? 'GUILD_VOICE' : 'GUILD_TEXT';
      await prisma.channel.upsert({
        where:  { id: channel.id },
        update: { name: channel.name, type: chType, categoryId: cat.id },
        create: { id: channel.id, guildId: GUILD_ID, name: channel.name, type: chType, categoryId: cat.id, position: channel.position || 0 },
      }).catch(() => {});
      const icon = ch.type === 2 ? '🔊' : '#';
      console.log(`    ${icon} ${ch.name}`);
    }
  }

  console.log('\n✨ Сервер настроен! Итого:');
  console.log(`   Ролей создано: ${ROLES.length}`);
  const totalChannels = STRUCTURE.reduce((s, g) => s + g.channels.length, 0);
  console.log(`   Категорий: ${STRUCTURE.length}`);
  console.log(`   Каналов: ${totalChannels}`);
  console.log('\n💡 Не забудь:');
  console.log('   1. Настроить права доступа для 💎 VIP ЭЛИТА (только роль 💎 Элита)');
  console.log('   2. Выдать себе роль 👑 Владелец');
  console.log('   3. Выдать другу роль 💎 Элита для VIP доступа');

  await prisma.$disconnect();
}

run().catch(err => {
  console.error('❌ Ошибка:', err.response?.data || err.message);
  process.exit(1);
});
