const logger = require('../../config/logger');
const { PrismaClient } = require('@prisma/client');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { refreshMessage } = require('../utils/giveawayManager');
const {
  buildRaidEmbed, buildMainRows, buildBuyerSelectRows, buildPumperRoleRows,
  pendingSelections, parseItemValue, NOSHOW_THRESHOLD, LOOT_TABLE, RAID_COMPOSITION, ROLE_LABELS,
  getAllPending, clearAllPending, getItemQty,
} = require('../utils/gbManager');
const { refreshMessage: gbRefresh } = require('../commands/gb');
const { notifyRL } = require('../utils/rlNotifier');
const { getWowRoles } = require('../utils/wowRoles');

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

    // ── RL apply button (из канала #для-рл) ───────────────────────────────
    if (interaction.isButton() && interaction.customId === 'rl_apply') {
      return sendRlApplication(interaction);
    }

    // ── RL approve / reject (приходит в ЛС владельцу) ─────────────────────
    if (interaction.isButton() && interaction.customId.startsWith('rl_approve_')) {
      const applicantId = interaction.customId.replace('rl_approve_', '');
      try {
        const guild = client.guilds.cache.get(process.env.DISCORD_GUILD_ID);
        const member = await guild.members.fetch(applicantId).catch(() => null);
        if (!member) {
          return interaction.update({ content: '❌ Участник не найден на сервере.', embeds: [], components: [] });
        }
        const roles = await getWowRoles(guild);
        const verifiedRoleId = roles['verified'];
        if (verifiedRoleId) await member.roles.add(verifiedRoleId);
        await member.send({
          embeds: [{
            color: 0x57f287,
            title: '✅ Ты верифицирован как Рейд-лидер!',
            description: 'Добро пожаловать в команду верифицированных РЛов **Pretwora DS**.\n\nТебе теперь доступны команды для создания и управления голдбид рейдами:',
            fields: [
              { name: '`/gb create`', value: 'Создать анонс голдбид рейда', inline: false },
              { name: '`/gb edit`', value: 'Редактировать анонс рейда (цена, заметки, ник персонажа)', inline: false },
              { name: '`/gb lock`', value: 'Закрыть запись — рейд начинается', inline: false },
              { name: '`/gb rollcall`', value: 'Отправить перекличку всем участникам', inline: false },
              { name: '`/gb complete`', value: 'Завершить рейд и распределить голду между памперами', inline: false },
              { name: '`/gb cancel`', value: 'Отменить рейд', inline: false },
              { name: '`/gb noshow`', value: 'Отметить участника как не явившегося (влияет на чёрный список)', inline: false },
              { name: '`/gb stats`', value: 'Посмотреть статистику пампера', inline: false },
            ],
            footer: { text: 'Pretwora DS · Голдбид платформа' },
          }],
        }).catch(() => {});
        return interaction.update({
          content: `✅ Одобрено. Роль **Верифицирован** выдана <@${applicantId}>.`,
          embeds: [],
          components: [],
        });
      } catch (err) {
        logger.error(`rl_approve failed: ${err.message}`);
        return interaction.update({ content: '❌ Ошибка при выдаче роли.', embeds: [], components: [] });
      }
    }

    if (interaction.isButton() && interaction.customId.startsWith('rl_reject_')) {
      const applicantId = interaction.customId.replace('rl_reject_', '');
      try {
        const guild = client.guilds.cache.get(process.env.DISCORD_GUILD_ID);
        const member = await guild.members.fetch(applicantId).catch(() => null);
        if (member) {
          await member.send({
            embeds: [{
              color: 0xed4245,
              title: '❌ Заявка отклонена',
              description: 'К сожалению, твоя заявка на верификацию РЛ была отклонена.\n\nЕсли считаешь что это ошибка — напиши администратору напрямую.',
              footer: { text: 'Pretwora DS · Голдбид платформа' },
            }],
          }).catch(() => {});
        }
        return interaction.update({
          content: `❌ Заявка <@${applicantId}> отклонена.`,
          embeds: [],
          components: [],
        });
      } catch (err) {
        logger.error(`rl_reject failed: ${err.message}`);
        return interaction.update({ content: '❌ Ошибка.', embeds: [], components: [] });
      }
    }

    // ── GB: пампер открывает меню выбора роли ────────────────────────────
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

        const pumpers = await prisma.goldRaidPumper.findMany({ where: { raidId } });
        const existing = pumpers.find(p => p.userId === interaction.user.id);

        if (existing) {
          const comp = RAID_COMPOSITION[raid.raidType] ?? {};
          const roleName = existing.pumperRole ? (ROLE_LABELS[existing.pumperRole] ?? existing.pumperRole) : 'без роли';
          const statusLine = existing.inQueue
            ? `⏳ Ты **в очереди** на роль ${roleName}.`
            : `⚔️ Ты в составе рейда как ${roleName}.`;

          const slotsLines = Object.entries(comp).map(([role, max]) => {
            const filled = pumpers.filter(p => !p.inQueue && p.pumperRole === role).length;
            const q      = pumpers.filter(p => p.inQueue  && p.pumperRole === role).length;
            const qStr   = q > 0 ? ` _(очередь: ${q})_` : '';
            return `${ROLE_LABELS[role]}: **${filled}/${max}**${qStr}`;
          }).join('\n');

          const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
          return interaction.reply({
            content: `${statusLine}\n\n${slotsLines}`,
            components: [new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`gb_pumper_leave_${raidId}`)
                .setLabel('❌ Отменить мою запись')
                .setStyle(ButtonStyle.Danger),
            )],
            ephemeral: true,
          });
        }

        // Не зарегистрирован — показываем выбор роли
        const rows = buildPumperRoleRows(raidId, raid.raidType, pumpers);
        if (!rows.length) {
          return interaction.reply({ content: '⚠️ Для этого типа рейда состав не настроен.', ephemeral: true });
        }

        const comp = RAID_COMPOSITION[raid.raidType] ?? {};
        const slotsHeader = Object.entries(comp).map(([role, max]) => {
          const filled = pumpers.filter(p => !p.inQueue && p.pumperRole === role).length;
          const q      = pumpers.filter(p => p.inQueue  && p.pumperRole === role).length;
          const qStr   = q > 0 ? ` · очередь: ${q}` : '';
          return `${ROLE_LABELS[role]}: ${filled}/${max}${qStr}`;
        }).join('\n');

        return interaction.reply({
          content: `⚔️ **Выбери свою роль в рейде:**\n\n${slotsHeader}\n\nЕсли места на твою роль кончились — попадёшь в очередь автоматически.`,
          components: rows,
          ephemeral: true,
        });
      } catch (err) {
        logger.error(`gb_pumper_join failed: ${err.message}`);
        return interaction.reply({ content: '❌ Ошибка. Попробуй ещё раз.', ephemeral: true });
      }
    }

    // ── GB: пампер выбирает роль ──────────────────────────────────────────
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('gb_pumper_role_')) {
      const raidId = interaction.customId.replace('gb_pumper_role_', '');
      const role   = interaction.values[0];
      try {
        const raid = await prisma.goldRaid.findUnique({ where: { id: raidId } });
        if (!raid || raid.status !== 'OPEN') {
          return interaction.update({ content: '❌ Запись в рейд закрыта.', components: [] });
        }

        const bl = await prisma.goldRaidBlacklist.findUnique({
          where: { guildId_userId: { guildId: raid.guildId, userId: interaction.user.id } },
        });
        if (bl) {
          return interaction.update({ content: `🚫 Ты в чёрном списке.\nПричина: ${bl.reason ?? 'не указана'}`, components: [] });
        }

        const alreadyIn = await prisma.goldRaidPumper.findUnique({
          where: { raidId_userId: { raidId, userId: interaction.user.id } },
        });
        if (alreadyIn) {
          return interaction.update({ content: '✅ Ты уже записан!', components: [] });
        }

        const comp = RAID_COMPOSITION[raid.raidType] ?? {};
        const max  = comp[role] ?? 0;
        const filledCount = await prisma.goldRaidPumper.count({
          where: { raidId, pumperRole: role, inQueue: false },
        });
        const inQueue = filledCount >= max;

        await prisma.goldRaidPumper.create({
          data: { raidId, userId: interaction.user.id, username: interaction.user.username, pumperRole: role, inQueue },
        });

        if (!inQueue) {
          try {
            const { getWowRoles } = require('../utils/wowRoles');
            const roles = await getWowRoles(interaction.guild);
            const member = await interaction.guild.members.fetch(interaction.user.id);
            if (roles.pumper && !member.roles.cache.has(roles.pumper))
              await member.roles.add(roles.pumper);
          } catch (e) { logger.warn(`wowRoles pumper assign: ${e.message}`); }
        }

        await gbRefresh(client, { ...raid, updatedAt: new Date() }).catch(() => {});
        notifyRL(client, raidId).catch(() => {});

        const roleName = ROLE_LABELS[role] ?? role;
        const resultMsg = inQueue
          ? `⏳ Мест на **${roleName}** нет — ты добавлен в **очередь**. Получишь уведомление, когда место освободится.`
          : `⚔️ Записан в рейд как **${roleName}**! Удачи!`;

        return interaction.update({ content: resultMsg, components: [] });
      } catch (err) {
        logger.error(`gb_pumper_role failed: ${err.message}`);
        return interaction.update({ content: '❌ Ошибка. Попробуй ещё раз.', components: [] });
      }
    }

    // ── GB: пампер отменяет запись ────────────────────────────────────────
    if (interaction.isButton() && interaction.customId.startsWith('gb_pumper_leave_')) {
      const raidId = interaction.customId.replace('gb_pumper_leave_', '');
      try {
        const pumper = await prisma.goldRaidPumper.findUnique({
          where: { raidId_userId: { raidId, userId: interaction.user.id } },
        });
        if (!pumper) {
          return interaction.update({ content: 'ℹ️ Ты не записан как пампер в этот рейд.', components: [] });
        }

        const wasActive = !pumper.inQueue;
        const role = pumper.pumperRole;

        await prisma.goldRaidPumper.delete({
          where: { raidId_userId: { raidId, userId: interaction.user.id } },
        });

        // Если уходит активный участник — продвигаем первого из очереди
        if (wasActive && role) {
          const next = await prisma.goldRaidPumper.findFirst({
            where: { raidId, pumperRole: role, inQueue: true },
            orderBy: { joinedAt: 'asc' },
          });
          if (next) {
            await prisma.goldRaidPumper.update({
              where: { id: next.id },
              data: { inQueue: false },
            });
            try {
              const nextUser = await client.users.fetch(next.userId);
              await nextUser.send(`🎉 Место в рейде освободилось! Ты переведён в состав как **${ROLE_LABELS[role] ?? role}**. Жди перекличку от РЛа.`);
            } catch {}

            // Выдаём роль пампера продвинутому участнику
            try {
              const { getWowRoles } = require('../utils/wowRoles');
              const wowRoles = await getWowRoles(interaction.guild);
              const nextMember = await interaction.guild.members.fetch(next.userId);
              if (wowRoles.pumper && !nextMember.roles.cache.has(wowRoles.pumper))
                await nextMember.roles.add(wowRoles.pumper);
            } catch (e) { logger.warn(`wowRoles pumper promote: ${e.message}`); }
          }
        }

        const raid = await prisma.goldRaid.findUnique({ where: { id: raidId } });
        if (raid) {
          await gbRefresh(client, raid).catch(() => {});
          notifyRL(client, raidId).catch(() => {});
        }

        return interaction.update({ content: '✅ Запись отменена.', components: [] });
      } catch (err) {
        logger.error(`gb_pumper_leave failed: ${err.message}`);
        return interaction.update({ content: '❌ Ошибка. Попробуй ещё раз.', components: [] });
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
        notifyRL(client, raidId).catch(() => {});

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
          if (deleted.count > 0) notifyRL(client, raidId).catch(() => {});
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
        const priceRaw       = interaction.fields.getTextInputValue('edit_price').trim();
        const rlCharacter    = interaction.fields.getTextInputValue('edit_rl_character').trim();
        const notes          = interaction.fields.getTextInputValue('edit_notes').trim();
        const extraText      = interaction.fields.getTextInputValue('edit_extra').trim();

        const data = { updatedAt: new Date() };
        data.slotPrice       = priceRaw ? parseInt(priceRaw) : null;
        data.rlCharacterName = rlCharacter || null;
        data.notes           = notes || null;
        data.extraText       = extraText || null;

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

async function sendRlApplication(interaction) {
  try {
    const guild = interaction.guild;
    const applicant = interaction.user;
    const member = interaction.member;

    const roles = await getWowRoles(guild);

    // Уже верифицирован
    if (roles['verified'] && member.roles.cache.has(roles['verified'])) {
      return interaction.reply({ content: '✅ Ты уже верифицированный РЛ!', ephemeral: true });
    }

    // Нет роли РЛ — значит не заявлял себя как РЛ через онбординг
    if (roles['rl'] && !member.roles.cache.has(roles['rl'])) {
      return interaction.reply({
        ephemeral: true,
        content: '❌ Заявка доступна только для участников с ролью **РЛ**.\n\nЕсли ты рейд-лидер — выбери роль РЛ при входе на сервер (онбординг) или обратись к администратору.',
      });
    }

    const owner = await guild.fetchOwner();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`rl_approve_${applicant.id}`)
        .setLabel('Одобрить')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`rl_reject_${applicant.id}`)
        .setLabel('Отклонить')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Danger),
    );

    await owner.send({
      embeds: [{
        color: 0x5865f2,
        title: '📋 Новая заявка на роль РЛ',
        fields: [
          { name: 'Участник', value: `<@${applicant.id}> (${applicant.username})`, inline: true },
          { name: 'ID', value: applicant.id, inline: true },
          { name: 'На сервере с', value: member.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:D>` : 'неизвестно', inline: true },
        ],
        thumbnail: { url: applicant.displayAvatarURL({ size: 64 }) },
        footer: { text: 'Pretwora DS · Заявки РЛ' },
        timestamp: new Date().toISOString(),
      }],
      components: [row],
    });

    return interaction.reply({
      ephemeral: true,
      embeds: [{
        color: 0x5865f2,
        title: '📋 Заявка отправлена!',
        description: 'Администратор рассмотрит твою заявку и свяжется с тобой в ЛС.\n\nПока ожидаешь — загляни в канал с голдбидами и познакомься с платформой.',
        footer: { text: 'Pretwora DS · Голдбид платформа' },
      }],
    });
  } catch (err) {
    logger.error(`sendRlApplication failed: ${err.message}`);
    return interaction.reply({ content: '❌ Ошибка при отправке заявки. Обратись к администратору напрямую.', ephemeral: true });
  }
}
