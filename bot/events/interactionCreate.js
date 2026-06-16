const logger = require('../../config/logger');
const { PrismaClient } = require('@prisma/client');
const { refreshMessage } = require('../utils/giveawayManager');
const {
  buildRaidEmbed, buildMainRows, buildBuyerSelectRows,
  pendingSelections, parseItemValue, NOSHOW_THRESHOLD,
} = require('../utils/gbManager');
const { refreshMessage: gbRefresh } = require('../commands/gb');

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

    // ── GB: пампер записывается ───────────────────────────────────────────
    if (interaction.isButton() && interaction.customId.startsWith('gb_pumper_join_')) {
      const raidId = interaction.customId.replace('gb_pumper_join_', '');
      try {
        const raid = await prisma.goldRaid.findUnique({ where: { id: raidId } });
        if (!raid || raid.status !== 'OPEN') {
          return interaction.reply({ content: '❌ Запись в рейд закрыта.', ephemeral: true });
        }

        const bl = await prisma.goldRaidBlacklist.findUnique({
          where: { guildId_userId: { guildId: raid.guildId, userId: interaction.user.id } },
        });
        if (bl) {
          return interaction.reply({ content: `🚫 Ты в чёрном списке.\nПричина: ${bl.reason ?? 'не указана'}`, ephemeral: true });
        }

        const existing = await prisma.goldRaidPumper.findUnique({
          where: { raidId_userId: { raidId, userId: interaction.user.id } },
        });
        if (existing) {
          return interaction.reply({ content: '✅ Ты уже записан как пампер!', ephemeral: true });
        }

        await prisma.goldRaidPumper.create({
          data: { raidId, userId: interaction.user.id, username: interaction.user.username },
        });

        const [pumpers, buyers] = await Promise.all([
          prisma.goldRaidPumper.findMany({ where: { raidId } }),
          prisma.goldRaidBuyer.findMany({ where: { raidId } }),
        ]);
        await gbRefresh(client, { ...raid, updatedAt: new Date() }).catch(() => {});

        return interaction.reply({ content: '⚔️ Ты записан как **пампер**! Удачи в рейде!', ephemeral: true });
      } catch (err) {
        logger.error(`gb_pumper_join failed: ${err.message}`);
        return interaction.reply({ content: '❌ Ошибка. Попробуй ещё раз.', ephemeral: true });
      }
    }

    // ── GB: баер открывает меню выбора ────────────────────────────────────
    if (interaction.isButton() && interaction.customId.startsWith('gb_buyer_menu_')) {
      const raidId = interaction.customId.replace('gb_buyer_menu_', '');
      try {
        const raid = await prisma.goldRaid.findUnique({ where: { id: raidId } });
        if (!raid || raid.status !== 'OPEN') {
          return interaction.reply({ content: '❌ Запись в рейд закрыта.', ephemeral: true });
        }

        const bl = await prisma.goldRaidBlacklist.findUnique({
          where: { guildId_userId: { guildId: raid.guildId, userId: interaction.user.id } },
        });
        if (bl) {
          return interaction.reply({ content: `🚫 Ты в чёрном списке.\nПричина: ${bl.reason ?? 'не указана'}`, ephemeral: true });
        }

        const rows = buildBuyerSelectRows(raidId);
        return interaction.reply({
          content: '💰 **Выбери вещи которые хочешь купить**, затем нажми **✅ Записаться**.\nМожно выбрать несколько.',
          components: rows,
          ephemeral: true,
        });
      } catch (err) {
        logger.error(`gb_buyer_menu failed: ${err.message}`);
        return interaction.reply({ content: '❌ Ошибка. Попробуй ещё раз.', ephemeral: true });
      }
    }

    // ── GB: баер меняет выбор в селекте ──────────────────────────────────
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('gb_buyer_select_')) {
      const raidId = interaction.customId.replace('gb_buyer_select_', '');
      pendingSelections.set(`${raidId}:${interaction.user.id}`, interaction.values);
      return interaction.deferUpdate();
    }

    // ── GB: баер нажимает "Записаться" ────────────────────────────────────
    if (interaction.isButton() && interaction.customId.startsWith('gb_buyer_register_')) {
      const raidId = interaction.customId.replace('gb_buyer_register_', '');
      try {
        const selected = pendingSelections.get(`${raidId}:${interaction.user.id}`);
        if (!selected || selected.length === 0) {
          return interaction.reply({ content: '❌ Сначала выбери вещи из списка выше.', ephemeral: true });
        }

        const raid = await prisma.goldRaid.findUnique({ where: { id: raidId } });
        if (!raid || raid.status !== 'OPEN') {
          return interaction.reply({ content: '❌ Запись в рейд закрыта.', ephemeral: true });
        }

        // Remove duplicates (same item already queued)
        const existing = await prisma.goldRaidBuyer.findMany({
          where: { raidId, userId: interaction.user.id, status: 'QUEUED' },
        });
        const existingKeys = new Set(existing.map(b => `${b.raidTarget}|${b.slot}|${b.tokenType}`));
        const toAdd = selected.filter(v => !existingKeys.has(v));

        if (toAdd.length === 0) {
          pendingSelections.delete(`${raidId}:${interaction.user.id}`);
          return interaction.reply({ content: '✅ Ты уже стоишь в очереди на все выбранные вещи!', ephemeral: true });
        }

        await prisma.goldRaidBuyer.createMany({
          data: toAdd.map(v => {
            const { raidTarget, slot, tokenType } = parseItemValue(v);
            return { raidId, userId: interaction.user.id, username: interaction.user.username, raidTarget, slot, tokenType };
          }),
        });

        pendingSelections.delete(`${raidId}:${interaction.user.id}`);
        await gbRefresh(client, raid).catch(() => {});

        return interaction.reply({
          content: `💰 Записан на **${toAdd.length}** вещ${toAdd.length === 1 ? 'ь' : 'и'}! Увидимся в рейде!`,
          ephemeral: true,
        });
      } catch (err) {
        logger.error(`gb_buyer_register failed: ${err.message}`);
        return interaction.reply({ content: '❌ Ошибка. Попробуй ещё раз.', ephemeral: true });
      }
    }

    // ── GB: баер отменяет запись ──────────────────────────────────────────
    if (interaction.isButton() && interaction.customId.startsWith('gb_buyer_leave_')) {
      const raidId = interaction.customId.replace('gb_buyer_leave_', '');
      try {
        const deleted = await prisma.goldRaidBuyer.deleteMany({
          where: { raidId, userId: interaction.user.id, status: 'QUEUED' },
        });
        pendingSelections.delete(`${raidId}:${interaction.user.id}`);

        const raid = await prisma.goldRaid.findUnique({ where: { id: raidId } });
        if (raid) await gbRefresh(client, raid).catch(() => {});

        return interaction.reply({
          content: deleted.count > 0
            ? `✅ Твоя запись на **${deleted.count}** вещ${deleted.count === 1 ? 'ь' : 'и'} отменена.`
            : 'ℹ️ У тебя не было активных записей в этот рейд.',
          ephemeral: true,
        });
      } catch (err) {
        logger.error(`gb_buyer_leave failed: ${err.message}`);
        return interaction.reply({ content: '❌ Ошибка. Попробуй ещё раз.', ephemeral: true });
      }
    }

    // ── GB: перекличка (подтверждение участия) ────────────────────────────
    if (interaction.isButton() && interaction.customId.startsWith('gb_confirm_')) {
      const raidId = interaction.customId.replace('gb_confirm_', '');
      try {
        const pumper = await prisma.goldRaidPumper.findUnique({
          where: { raidId_userId: { raidId, userId: interaction.user.id } },
        });
        if (!pumper) {
          return interaction.reply({ content: 'ℹ️ Ты не записан как пампер в этот рейд.', ephemeral: true });
        }
        if (pumper.confirmed) {
          return interaction.reply({ content: '✅ Ты уже подтвердил участие!', ephemeral: true });
        }

        await prisma.goldRaidPumper.update({
          where: { raidId_userId: { raidId, userId: interaction.user.id } },
          data: { confirmed: true },
        });

        const raid = await prisma.goldRaid.findUnique({ where: { id: raidId } });
        if (raid) await gbRefresh(client, raid).catch(() => {});

        return interaction.reply({ content: '✅ Участие подтверждено! Ждём начала.', ephemeral: true });
      } catch (err) {
        logger.error(`gb_confirm failed: ${err.message}`);
        return interaction.reply({ content: '❌ Ошибка. Попробуй ещё раз.', ephemeral: true });
      }
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
