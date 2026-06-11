const { SlashCommandBuilder } = require('discord.js');
const prisma = require('../../config/database');

function xpForLevel(lvl) {
  return lvl <= 0 ? 0 : (lvl * (lvl + 1)) / 2 * 100;
}

const MEDALS = ['🥇', '🥈', '🥉'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('top')
    .setDescription('Топ участников сервера по уровню и XP')
    .addIntegerOption(opt =>
      opt.setName('количество')
         .setDescription('Сколько участников показать (по умолчанию 10)')
         .setMinValue(3)
         .setMaxValue(20)
         .setRequired(false)
    ),

  async execute(interaction) {
    const limit = interaction.options.getInteger('количество') || 10;

    const members = await prisma.member.findMany({
      where: { guildId: interaction.guild.id },
      orderBy: [{ level: 'desc' }, { xp: 'desc' }],
      take: limit,
      select: { id: true, username: true, nickname: true, xp: true, level: true },
    });

    if (!members.length) {
      return interaction.reply({ content: 'Нет данных.', ephemeral: true });
    }

    const rows = members.map((m, i) => {
      const medal  = MEDALS[i] ?? `**${i + 1}.**`;
      const name   = m.nickname || m.username;
      const next   = xpForLevel(m.level + 1);
      const cur    = xpForLevel(m.level);
      const pct    = next > cur ? Math.round(((m.xp - cur) / (next - cur)) * 100) : 100;
      const bar    = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
      return `${medal} **${name}** · Lvl ${m.level} · ${m.xp.toLocaleString()} XP\n${bar} ${pct}%`;
    });

    await interaction.reply({
      embeds: [{
        color: 0x5865f2,
        title: `🏆 Топ ${limit} участников`,
        description: rows.join('\n\n'),
        footer: { text: 'Pretwora DS · Система уровней' },
        timestamp: new Date().toISOString(),
      }],
    });
  },
};
