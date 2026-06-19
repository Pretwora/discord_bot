const {
  SlashCommandBuilder, PermissionFlagsBits,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const RoleManager = require('../managers/RoleManager');
const { getWowRoles } = require('../utils/wowRoles');

const ROLES_CHANNEL_ID = '1514399407637004483'; // #роли

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
    )
    .addSubcommand(sub =>
      sub.setName('post-wow')
        .setDescription('Опубликовать выбор WoW-ролей в канале #роли')
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

    if (sub === 'post-wow') {
      await interaction.deferReply({ ephemeral: true });

      const roles = await getWowRoles(interaction.guild);

      const embed = new EmbedBuilder()
        .setTitle('🎮 WoW Роли')
        .setColor(0x00b4d8)
        .setDescription(
          'Нажми кнопку чтобы получить или снять роль.\n\n' +
          `⚔️ **Пампер** — ты водишь/качаешь рейды\n` +
          `🌐 **WowSirus** — ты играешь на сервере Sirus\n\n` +
          `> Роль **Баер** выдаётся автоматически при записи на покупку токена в голдбид рейде.`
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`role_toggle_${roles.pumper}`)
          .setLabel('⚔️ Пампер')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`role_toggle_${roles.wowsirus}`)
          .setLabel('🌐 WowSirus')
          .setStyle(ButtonStyle.Primary),
      );

      const channel = interaction.guild.channels.cache.get(ROLES_CHANNEL_ID);
      if (!channel) {
        return interaction.editReply('❌ Канал #роли не найден. Проверь ROLES_CHANNEL_ID.');
      }

      await channel.send({ embeds: [embed], components: [row] });
      await interaction.editReply('✅ Сообщение опубликовано в #роли.');
    }
  },
};
