const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Статистика сервера'),

  async execute(interaction) {
    const guild = interaction.guild;
    await guild.members.fetch();

    const online = guild.members.cache.filter(m => m.presence?.status !== 'offline').size;

    const embed = new EmbedBuilder()
      .setColor(0x7289DA)
      .setTitle(`📊 ${guild.name}`)
      .setThumbnail(guild.iconURL())
      .addFields(
        { name: '👥 Участников', value: `${guild.memberCount}`, inline: true },
        { name: '🟢 Онлайн', value: `${online}`, inline: true },
        { name: '💬 Каналов', value: `${guild.channels.cache.size}`, inline: true },
        { name: '🏷️ Ролей', value: `${guild.roles.cache.size}`, inline: true },
        { name: '🚀 Бустов', value: `${guild.premiumSubscriptionCount || 0}`, inline: true },
        { name: '📅 Создан', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
      )
      .setFooter({ text: 'Discord Bot Dashboard' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
