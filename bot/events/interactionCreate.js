const logger = require('../../config/logger');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    // ── Self-role buttons ──────────────────────────────────────────────────
    if (interaction.isButton() && interaction.customId.startsWith('role_toggle_')) {
      const roleId = interaction.customId.replace('role_toggle_', '');
      try {
        const member = interaction.member;
        const role   = interaction.guild.roles.cache.get(roleId);
        if (!role) {
          return interaction.reply({ content: '❌ Роль не найдена.', ephemeral: true });
        }

        if (member.roles.cache.has(roleId)) {
          await member.roles.remove(role);
          await interaction.reply({
            content: `✅ Роль **${role.name}** снята.`,
            ephemeral: true,
          });
        } else {
          await member.roles.add(role);
          await interaction.reply({
            content: `✅ Роль **${role.name}** выдана!`,
            ephemeral: true,
          });
        }
      } catch (err) {
        logger.error(`role_toggle failed: ${err.message}`);
        await interaction.reply({ content: '❌ Не удалось изменить роль. Попробуй позже.', ephemeral: true });
      }
      return;
    }

    // ── Verification button ────────────────────────────────────────────────
    if (interaction.isButton() && interaction.customId === 'verify_accept') {
      const MEMBER_ROLE_ID    = '1514399385851662546'; // 👤 Участник
      const UNTRUSTED_ROLE_ID = '421361784885084172';  // Недоверенный
      try {
        const member = interaction.member;
        const memberRole    = interaction.guild.roles.cache.get(MEMBER_ROLE_ID);
        const untrustedRole = interaction.guild.roles.cache.get(UNTRUSTED_ROLE_ID);

        if (memberRole)    await member.roles.add(memberRole);
        if (untrustedRole) await member.roles.remove(untrustedRole).catch(() => {});

        await interaction.reply({
          content: '✅ Ты верифицирован! Добро пожаловать на сервер.',
          ephemeral: true,
        });
      } catch (err) {
        logger.error(`verify_accept failed: ${err.message}`);
        await interaction.reply({ content: '❌ Ошибка верификации. Обратись к администратору.', ephemeral: true });
      }
      return;
    }

    // ── Slash commands ─────────────────────────────────────────────────────
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction, client);
    } catch (error) {
      logger.error(`Command ${interaction.commandName} failed:`, error);
      const msg = { content: 'Произошла ошибка. Попробуй ещё раз.', ephemeral: true };
      interaction.replied || interaction.deferred
        ? interaction.followUp(msg)
        : interaction.reply(msg);
    }
  },
};
