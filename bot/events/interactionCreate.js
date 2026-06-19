const logger = require('../../config/logger');
const { PrismaClient } = require('@prisma/client');
const { refreshMessage } = require('../utils/giveawayManager');
const {
  buildRaidEmbed, buildMainRows, buildBuyerSelectRows,
  pendingSelections, parseItemValue, NOSHOW_THRESHOLD, LOOT_TABLE,
  getAllPending, clearAllPending, getItemQty,
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

        // Выдаём роль Пампер
        try {
          const { getWowRoles } = require('../utils/wowRoles');
          const roles = await getWowRoles(interaction.guild);
          const member = await interaction.guild.members.fetch(interaction.user.id);
          if (roles.pumper && !member.roles.cache.has(roles.pumper))
            await member.roles.add(roles.pumper);
        } catch (e) { logger.warn(`wowRoles pumper assign: ${e.message}`); }

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

        // Загружаем цены из настроек сервера
        let goldPrices = {};
        try {
          const dbGuild = await prisma.guild.findUnique({ where: { id: raid.guildId } });
          goldPrices = JSON.parse(dbGuild?.settings || '{}').goldPrices ?? {};
        } catch {}

        const rows = buildBuyerSelectRows(raidId, raid.raidType, goldPrices);
        return interaction.reply({
          content: '💰 **Выбери предметы** которые хочешь купить, затем нажми **✅ Записаться**.\nМожно выбрать несколько из каждого списка.',
          components: rows,
          ephemeral: true,
        });
      } catch (err) {
        logger.error(`gb_buyer_menu failed: ${err.message}`);
        return interaction.reply({ content: '❌ Ошибка. Попробуй ещё раз.', ephemeral: true });
      }
    }

    // ── GB: баер меняет выбор в любом из селектов ────────────────────────
    // customId: gb_buyer_sel_${raidId}_${raidKey}_${subtype}
    // raidId — UUID (содержит дефисы, не подчёркивания), поэтому split('_')[3]
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('gb_buyer_sel_')) {
      const parts = interaction.customId.split('_');
      // parts: ['gb','buyer','sel', raidId, raidKey, subtype]
      const raidId  = parts[3];
      const raidKey = parts[4];
      const subtype = parts[5];
      pendingSelections.set(`${raidId}:${interaction.user.id}:${raidKey}_${subtype}`, interaction.values);
      return interaction.deferUpdate();
    }

    // ── GB: баер нажимает "Записаться" → показываем Modal с ником ──────────
    if (interaction.isButton() && interaction.customId.startsWith('gb_buyer_register_')) {
      const raidId = interaction.customId.replace('gb_buyer_register_', '');
      const raid = await prisma.goldRaid.findUnique({ where: { id: raidId } }).catch(() => null);
      const selected = raid ? getAllPending(raidId, interaction.user.id, raid.raidType) : [];
      if (!selected || selected.length === 0) {
        return interaction.reply({ content: '❌ Сначала выбери предметы из списков выше.', ephemeral: true });
      }

      const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
      const modal = new ModalBuilder()
        .setCustomId(`gb_buyer_modal_${raidId}`)
        .setTitle('Запись в голдбид рейд');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('character_name')
            .setLabel('Ник персонажа в игре')
            .setPlaceholder('Например: Fexler')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(50)
            .setRequired(true),
        ),
      );

      return interaction.showModal(modal);
    }

    // ── GB: баер сабмитит Modal → создаём записи с проверкой вместимости ──
    if (interaction.isModalSubmit() && interaction.customId.startsWith('gb_buyer_modal_')) {
      const raidId = interaction.customId.replace('gb_buyer_modal_', '');
      try {
        const characterName = interaction.fields.getTextInputValue('character_name').trim();

        const raid = await prisma.goldRaid.findUnique({ where: { id: raidId } });
        if (!raid || raid.status !== 'OPEN') {
          return interaction.reply({ content: '❌ Запись в рейд закрыта.', ephemeral: true });
        }

        const selected = getAllPending(raidId, interaction.user.id, raid.raidType);
        if (!selected || selected.length === 0) {
          return interaction.reply({ content: '❌ Сессия истекла — открой меню записи заново.', ephemeral: true });
        }

        // Фильтруем: убираем уже заказанные этим юзером
        const myExisting = await prisma.goldRaidBuyer.findMany({
          where: { raidId, userId: interaction.user.id, status: 'QUEUED' },
        });
        const myKeys = new Set(myExisting.map(b => `${b.raidTarget}|${b.slot}|${b.tokenType}`));
        const toAdd = selected.filter(v => !myKeys.has(v));

        // Проверяем вместимость каждого слота
        const fullItems = [];
        const finalAdd = [];
        for (const v of toAdd) {
          const { raidTarget, slot, tokenType } = parseItemValue(v);
          const qty = getItemQty(raidTarget, slot, tokenType);
          const count = await prisma.goldRaidBuyer.count({
            where: { raidId, raidTarget, slot, tokenType, status: 'QUEUED' },
          });
          if (count >= qty) {
            fullItems.push(v);
          } else {
            finalAdd.push({ raidTarget, slot, tokenType });
          }
        }

        if (finalAdd.length === 0) {
          clearAllPending(raidId, interaction.user.id, raid.raidType);
          const fullMsg = fullItems.length > 0 ? ' Все выбранные предметы уже заняты.' : ' Ты уже стоишь в очереди на все эти предметы.';
          return interaction.reply({ content: `ℹ️${fullMsg}`, ephemeral: true });
        }

        await prisma.goldRaidBuyer.createMany({
          data: finalAdd.map(({ raidTarget, slot, tokenType }) => ({
            raidId,
            userId: interaction.user.id,
            username: interaction.user.username,
            characterName,
            raidTarget,
            slot,
            tokenType,
          })),
        });

        clearAllPending(raidId, interaction.user.id, raid.raidType);

        // Выдаём роль Баер
        try {
          const { getWowRoles } = require('../utils/wowRoles');
          const roles = await getWowRoles(interaction.guild);
          const member = await interaction.guild.members.fetch(interaction.user.id);
          if (roles.buyer && !member.roles.cache.has(roles.buyer))
            await member.roles.add(roles.buyer);
        } catch (e) { logger.warn(`wowRoles buyer assign: ${e.message}`); }

        await gbRefresh(client, raid).catch(() => {});

        let msg = `💰 Записан на **${finalAdd.length}** вещ${finalAdd.length === 1 ? 'ь' : 'и'}! Персонаж: **${characterName}**`;
        if (fullItems.length > 0) msg += `\n⚠️ ${fullItems.length} слот(а) уже заполнены — туда не попал.`;
        return interaction.reply({ content: msg, ephemeral: true });
      } catch (err) {
        logger.error(`gb_buyer_modal failed: ${err.message}`);
        return interaction.reply({ content: '❌ Ошибка. Попробуй ещё раз.', ephemeral: true });
      }
    }

    // ── GB: баер отменяет запись ──────────────────────────────────────────
    if (interaction.isButton() && interaction.customId.startsWith('gb_buyer_leave_')) {
      const raidId = interaction.customId.replace('gb_buyer_leave_', '');
      try {
        const raid = await prisma.goldRaid.findUnique({ where: { id: raidId } });
        const deleted = await prisma.goldRaidBuyer.deleteMany({
          where: { raidId, userId: interaction.user.id, status: 'QUEUED' },
        });
        if (raid) {
          clearAllPending(raidId, interaction.user.id, raid.raidType);
          await gbRefresh(client, raid).catch(() => {});
        }

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

    // ── GB: edit modal submit ─────────────────────────────────────────────
    if (interaction.isModalSubmit() && interaction.customId.startsWith('gb_edit_modal_')) {
      const raidId = interaction.customId.replace('gb_edit_modal_', '');
      try {
        const priceRaw = interaction.fields.getTextInputValue('edit_price').trim();
        const notes    = interaction.fields.getTextInputValue('edit_notes').trim();
        const extraText = interaction.fields.getTextInputValue('edit_extra').trim();

        const data = { updatedAt: new Date() };
        data.slotPrice = priceRaw ? parseInt(priceRaw) : null;
        data.notes     = notes || null;
        data.extraText = extraText || null;

        const updated = await prisma.goldRaid.update({ where: { id: raidId }, data });
        await gbRefresh(client, updated).catch(() => {});

        return interaction.reply({ content: '✅ Анонс обновлён!', ephemeral: true });
      } catch (err) {
        logger.error(`gb_edit_modal failed: ${err.message}`);
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
