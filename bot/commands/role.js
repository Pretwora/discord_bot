const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const RoleManager = require('../managers/RoleManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Управление ролями')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(sub =>
      sub.setName('assign')
        .setDescription('Выдать роль участнику')
        .addUserOption(opt => opt.setName('user').setDescription('Участник').setRequired(true))
        .addRoleOption(opt => opt.setName('role').setDescription('Роль').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Снять роль с участника')
        .addUserOption(opt => opt.setName('user').setDescription('Участник').setRequired(true))
        .addRoleOption(opt => opt.setName('role').setDescription('Роль').setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const manager = new RoleManager(interaction.guild);

    if (sub === 'assign') {
      const user = interaction.options.getUser('user');
      const role = interaction.options.getRole('role');
      await manager.assign(user.id, role.id);
      await interaction.reply({ content: `✅ Роль ${role} выдана ${user}`, ephemeral: true });
    }

    if (sub === 'remove') {
      const user = interaction.options.getUser('user');
      const role = interaction.options.getRole('role');
      await manager.remove(user.id, role.id);
      await interaction.reply({ content: `✅ Роль ${role} снята с ${user}`, ephemeral: true });
    }
  },
};
