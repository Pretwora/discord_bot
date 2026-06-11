const { SlashCommandBuilder } = require('discord.js');
const prisma = require('../../config/database');

function xpForLevel(lvl) {
  return lvl <= 0 ? 0 : (lvl * (lvl + 1)) / 2 * 100;
}

const LEVEL_ROLES = [
  { level: 3,  name: '🌱 Росток' },
  { level: 7,  name: '⚡ Активный' },
  { level: 12, name: '🔥 Ветеран' },
  { level: 17, name: '💫 Избранный' },
  { level: 20, name: '👑 Легенда' },
];

function nextRole(level) {
  return LEVEL_ROLES.find(r => r.level > level) || null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Посмотреть свой уровень и XP')
    .addUserOption(opt =>
      opt.setName('пользователь')
         .setDescription('Чей ранг посмотреть (по умолчанию — свой)')
         .setRequired(false)
    ),

  async execute(interaction) {
    const target = interaction.options.getUser('пользователь') || interaction.user;

    const member = await prisma.member.findFirst({
      where: { id: target.id, guildId: interaction.guild.id },
    });

    if (!member) {
      return interaction.reply({ content: '❌ Участник не найден в базе.', ephemeral: true });
    }

    // Rank position
    const rank = await prisma.member.count({
      where: {
        guildId: interaction.guild.id,
        OR: [
          { level: { gt: member.level } },
          { level: member.level, xp: { gt: member.xp } },
        ],
      },
    });

    const curFloor  = xpForLevel(member.level);
    const nextFloor = xpForLevel(member.level + 1);
    const progress  = nextFloor > curFloor
      ? Math.round(((member.xp - curFloor) / (nextFloor - curFloor)) * 100)
      : 100;

    const bar = buildBar(progress);
    const next = nextRole(member.level);
    const currentRole = [...LEVEL_ROLES].reverse().find(r => r.level <= member.level);

    const embed = {
      color: 0x5865f2,
      author: {
        name: interaction.guild.members.cache.get(target.id)?.displayName || target.username,
        icon_url: target.displayAvatarURL({ size: 64 }),
      },
      fields: [
        {
          name: '📊 Уровень и XP',
          value: [
            `**Уровень:** ${member.level} ${currentRole ? `· ${currentRole.name}` : ''}`,
            `**XP:** ${member.xp.toLocaleString()} / ${nextFloor.toLocaleString()}`,
            `**Прогресс:** ${bar} ${progress}%`,
          ].join('\n'),
          inline: false,
        },
        {
          name: '🏆 Позиция',
          value: `**#${rank + 1}** на сервере`,
          inline: true,
        },
        {
          name: '💬 Сообщений',
          value: member.messageCount.toLocaleString(),
          inline: true,
        },
        ...(next ? [{
          name: '🎯 Следующая роль',
          value: `${next.name} · ещё **${(xpForLevel(next.level) - member.xp).toLocaleString()} XP** (уровень ${next.level})`,
          inline: false,
        }] : [{
          name: '👑 Максимальный уровень',
          value: 'Ты достиг вершины сервера!',
          inline: false,
        }]),
      ],
      footer: { text: 'Pretwora DS · Система уровней' },
    };

    await interaction.reply({ embeds: [embed] });
  },
};

function buildBar(percent, length = 12) {
  const filled = Math.round((percent / 100) * length);
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}
