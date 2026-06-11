require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');

const BASE    = 'https://discord.com/api/v10';
const headers = { Authorization: `Bot ${process.env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' };
const sleep   = ms => new Promise(r => setTimeout(r, ms));

// ── IDs ────────────────────────────────────────────────────────────────────
const R = {
  everyone:  '267345114395967488',
  owner:     '1514399355933823068',
  elite:     '1514399358219714655',
  admin:     '1514399361742934168',
  moder:     '1514399373797228544',
  bot:       '1514399389295313130',
  shadow:    '1514399393774829719',
};

const C = {
  // Categories
  info_cat:   '1514399397088329910',
  admin_cat:  '1514399477903917107',
  // Channels
  rules:      '1514399401211330610',
  announces:  '1514399404193484940',
  roles_ch:   '1514399407637004483',
  mod_log:    '1514399481263820870',
  bot_cmds:   '1514399484057223278',
};

// ── Permission bits ────────────────────────────────────────────────────────
const P = {
  VIEW:        1024n,
  SEND:        2048n,
  REACT:         64n,
  MANAGE_MSG:  8192n,
  CONNECT:  1048576n,
  SPEAK:    2097152n,
};

function allow(bits) { return String(bits.reduce((a, b) => a | b, 0n)); }
function deny(bits)  { return String(bits.reduce((a, b) => a | b, 0n)); }

async function setPerms(channelId, channelName, overwrites) {
  for (const ow of overwrites) {
    await sleep(350);
    await axios.put(`${BASE}/channels/${channelId}/permissions/${ow.id}`, {
      id:    ow.id,
      type:  0, // 0 = role
      allow: ow.allow || '0',
      deny:  ow.deny  || '0',
    }, { headers }).catch(e => console.error(`  ❌ ${channelName}:`, e.response?.data?.message));
  }
  console.log(`  ✅ ${channelName}`);
}

async function run() {
  console.log('🔐 Настраиваем права доступа...\n');

  // 1. ⚙️ АДМИНИСТРАЦИЯ — только Модер+
  console.log('⚙️ Категория АДМИНИСТРАЦИЯ:');
  const adminAccess = [
    { id: R.everyone, deny:  deny([P.VIEW]) },
    { id: R.moder,    allow: allow([P.VIEW, P.SEND, P.REACT]) },
    { id: R.admin,    allow: allow([P.VIEW, P.SEND, P.REACT, P.MANAGE_MSG]) },
    { id: R.owner,    allow: allow([P.VIEW, P.SEND, P.REACT, P.MANAGE_MSG]) },
    { id: R.bot,      allow: allow([P.VIEW, P.SEND]) },
  ];
  await setPerms(C.admin_cat,  '⚙️ АДМИНИСТРАЦИЯ (категория)', adminAccess);
  await setPerms(C.mod_log,    '#мод-лог',   adminAccess);
  await setPerms(C.bot_cmds,   '#бот-команды', adminAccess);

  // 2. #правила, #анонсы, #роли — только чтение для всех, писать может Модер+
  console.log('\n📋 Каналы только для чтения:');
  const readOnly = [
    { id: R.everyone, deny:  deny([P.SEND]) },
    { id: R.moder,    allow: allow([P.SEND, P.MANAGE_MSG]) },
    { id: R.admin,    allow: allow([P.SEND, P.MANAGE_MSG]) },
    { id: R.owner,    allow: allow([P.SEND, P.MANAGE_MSG]) },
  ];
  await setPerms(C.rules,     '#правила', readOnly);
  await setPerms(C.announces, '#анонсы',  readOnly);
  await setPerms(C.roles_ch,  '#роли',    readOnly);

  // 3. 🚫 Тень — нигде не может писать и заходить в голосовые
  console.log('\n🚫 Роль Тень (мут везде):');
  // Применяем на уровне сервера через роль — делаем через update role permissions
  // Запрещаем на каждой категории
  const shadowChannels = [
    ['1514399397088329910', '📋 ИНФОРМАЦИЯ'],
    ['1514399410493063268', '💬 ОБЩЕНИЕ'],
    ['1514399425731104880', '🎮 ИГРЫ'],
    ['1514399438808809493', '🎵 МУЗЫКА'],
    ['1514399457674788976', '🔊 ГОЛОСОВЫЕ'],
  ];
  const shadowPerms = [{ id: R.shadow, deny: deny([P.SEND, P.REACT, P.CONNECT, P.SPEAK]) }];
  for (const [id, name] of shadowChannels) {
    await setPerms(id, name, shadowPerms);
  }

  // 4. 👤 Участник — базовый доступ к публичным каналам (убедимся что @everyone может всё)
  // (Discord по умолчанию даёт VIEW+SEND @everyone, ничего дополнительно не нужно)

  console.log('\n✨ Права настроены!\n');
  console.log('Итог:');
  console.log('  ⚙️  Администрация — только Модератор+');
  console.log('  📋  #правила, #анонсы, #роли — только чтение для всех');
  console.log('  🚫  Роль Тень — заблокирован чат и голосовые во всех каналах');
  console.log('  💎  VIP зона — уже настроена (только Элита)');
}

run().catch(e => console.error('❌', e.response?.data || e.message));
