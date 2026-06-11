const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Ссылка на веб-панель управления'),

  async execute(interaction) {
    const dashboardUrl = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';

    const embed = new EmbedBuilder()
      .setColor(0x7289DA)
      .setTitle('🖥️ Веб-панель управления')
      .setDescription(`Управляй сервером через браузер:\n\n**[Открыть панель](${dashboardUrl})**`)
      .setFooter({ text: 'Только для администраторов сервера' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
