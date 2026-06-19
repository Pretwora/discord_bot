/**
 * Updates the Discord server Welcome Screen.
 * Run once: node scripts/update-welcome-screen.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');

const GUILD_ID = process.env.DISCORD_GUILD_ID;
const BASE     = 'https://discord.com/api/v10';
const headers  = {
  Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
  'Content-Type': 'application/json',
};

// Channel IDs
const CHANNELS = {
  rules:    '1514399401211330610', // #правила
  roles:    '1514399407637004483', // #роли
  announce: '1514399404193484940', // #анонсы
  general:  null,                  // #общий — если знаешь ID, вставь сюда
};

async function run() {
  console.log('🔄 Обновляем Welcome Screen...\n');

  const body = {
    enabled: true,
    description:
      'Тусовка игроков и голдбид рейды WoW. Прими правила → выбери роль в #роли → записывайся на рейды!',
    welcome_channels: [
      {
        channel_id: CHANNELS.rules,
        description: 'Прочитай и прими правила сервера',
        emoji_name: '📜',
      },
      {
        channel_id: CHANNELS.roles,
        description: 'Выбери себе роль: Пампер / WowSirus',
        emoji_name: '🎭',
      },
      {
        channel_id: CHANNELS.announce,
        description: 'Анонсы голдбид рейдов и новости',
        emoji_name: '⚔️',
      },
    ].filter(c => c.channel_id), // убираем null-каналы
  };

  try {
    const res = await axios.patch(
      `${BASE}/guilds/${GUILD_ID}/welcome-screen`,
      body,
      { headers },
    );
    console.log('✅ Welcome Screen обновлён!\n');
    console.log('Описание:', res.data.description);
    console.log('Каналы:');
    res.data.welcome_channels?.forEach(c =>
      console.log(`  ${c.emoji_name} #${c.channel_id} — ${c.description}`),
    );
  } catch (err) {
    const data = err.response?.data;
    console.error('❌ Ошибка:', data || err.message);
    if (err.response?.status === 403) {
      console.error('\n💡 Убедись что у бота есть право MANAGE_GUILD и сервер включён в Community mode.');
    }
  }
}

run();
