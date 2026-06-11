const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const ChannelManager = require('../managers/ChannelManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('channel')
    .setDescription('Управление каналами')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Создать новый канал')
        .addStringOption(opt => opt.setName('name').setDescription('Название').setRequired(true))
        .addStringOption(opt => opt.setName('type').setDescription('Тип').addChoices(
          { name: 'Текстовый', value: 'TEXT' },
          { name: 'Голосовой', value: 'VOICE' }
        ))
    )
    .addSubcommand(sub =>
      sub.setName('delete')
        .setDescription('Удалить канал')
        .addChannelOption(opt => opt.setName('channel').setDescription('Канал').setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const manager = new ChannelManager(interaction.guild);

    if (sub === 'create') {
      await interaction.deferReply({ ephemeral: true });
      const name = interaction.options.getString('name');
      const type = interaction.options.getString('type') || 'TEXT';
      const channel = await manager.create({ name, type });
      await interaction.editReply(`✅ Канал ${channel} создан!`);
    }

    if (sub === 'delete') {
      await interaction.deferReply({ ephemeral: true });
      const channel = interaction.options.getChannel('channel');
      await manager.delete(channel.id);
      await interaction.editReply(`✅ Канал **#${channel.name}** удалён.`);
    }
  },
};
