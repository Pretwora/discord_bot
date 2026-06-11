const logger = require('../../config/logger');
const { PrismaClient } = require('@prisma/client');
const { refreshMessage } = require('../utils/giveawayManager');

const prisma = new PrismaClient();

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    // ── Giveaway enter button ──────────────────────────────────────────────
    if (interaction.isButton() && interaction.customId.startsWith('giveaway_enter_')) {
      const giveawayId = interaction.customId.replace('giveaway_enter_', '');
      try {
        const giveaway = await prisma.giveaway.findUnique({ where: { id: giveawayId } });

        if (!giveaway || giveaway.status !== 'ACTIVE') {
          return interaction.reply({ content: '❌ Этот розыгрыш уже завершён.', ephemeral: true });
        }
        if (new Date(giveaway.endsAt) <= new Date()) {
          return interaction.reply({ content: '❌ Время розыгрыша истекло.', ephemeral: true });
        }

        // Check required role
        if (giveaway.requiredRoleId) {
          const member = await interaction.guild.members.fetch(interaction.user.id);
          if (!member.roles.cache.has(giveaway.requiredRoleId)) {
            return interaction.reply({
              content: `❌ Для участия нужна роль <@&${giveaway.requiredRoleId}>.`,
              ephemeral: true,
            });
          }
        }

        // Try to register entry (unique constraint prevents duplicate)
        const existing = await prisma.giveawayEntry.findUnique({
          where: { giveawayId_userId: { giveawayId, userId: interaction.user.id } },
        });

        if (existing) {
          return interaction.reply({ content: '✅ Ты уже участвуешь в этом розыгрыше!', ephemeral: true });
        }

        await prisma.giveawayEntry.create({
          data: { giveawayId, userId: interaction.user.id },
        });

        // Update embed count (fire & forget)
        refreshMessage(client, giveaway).catch(() => {});

        return interaction.reply({ content: '🎉 Ты записан! Удачи!', ephemeral: true });
      } catch (err) {
        logger.error(`giveaway_enter failed: ${err.message}`);
        return interaction.reply({ content: '❌ Ошибка. Попробуй ещё раз.', ephemeral: true });
      }
    }

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
