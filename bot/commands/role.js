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
      sub.setName('post-roles')
        .setDescription('Опубликовать единый выбор ролей в канале #роли')
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

    if (sub === 'post-roles') {
      await interaction.deferReply({ ephemeral: true });

      const channel = interaction.guild.channels.cache.get(ROLES_CHANNEL_ID);
      if (!channel) {
        return interaction.editReply('❌ Канал #роли не найден.');
      }

      const roles = await getWowRoles(interaction.guild);

      const embed = new EmbedBuilder()
        .setTitle('🎭 Выбери свои роли')
        .setColor(0x5865F2)
        .setDescription(
          'Нажми кнопку — роль выдаётся или снимается мгновенно.\n' +
          'Можно взять несколько ролей сразу.\n​'
        )
        .addFields(
          {
            name: '🎮 World of Warcraft',
            value: [
              '⚔️ **Пампер** — ты водишь рейды и качаешь других за голд',
              '💰 **Баер** — выдаётся **автоматически** когда записываешься на голдбид рейд',
              '🌐 **WowSirus** — ты играешь на сервере Sirus',
            ].join('\n'),
          },
        )
        .setFooter({ text: 'Кнопки ниже — нажми чтобы взять роль' });

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

      await channel.send({ embeds: [embed], components: [row] });
      await interaction.editReply('✅ Сообщение опубликовано в #роли. Не забудь удалить старые сообщения в канале.');
    }
  },
};
