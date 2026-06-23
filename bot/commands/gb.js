const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const { buildRaidEmbed, buildMainRows } = require('../utils/gbManager');
const { writeAuditLog } = require('../utils/auditLog');
const { getWowRoles } = require('../utils/wowRoles');

const ADMIN_ONLY_SUBS = ['setup', 'unblacklist'];

const prisma = new PrismaClient();

async function getGbChannelId(guildId) {
  const guild = await prisma.guild.findUnique({ where: { id: guildId } });
  if (!guild) return null;
  try {
    const settings = JSON.parse(guild.settings || '{}');
    return settings.gbChannelId ?? null;
  } catch { return null; }
}

async function saveGbChannelId(guildId, channelId) {
  const guild = await prisma.guild.findUnique({ where: { id: guildId } });
  if (!guild) throw new Error(`Гильдия ${guildId} не найдена в БД — сначала выполни sync в дашборде.`);
  const settings = JSON.parse(guild.settings || '{}');
  settings.gbChannelId = channelId;
  await prisma.guild.update({ where: { id: guildId }, data: { settings: JSON.stringify(settings) } });
}

async function getActiveRaid(guildId, id = null) {
  if (id) return prisma.goldRaid.findFirst({ where: { id, guildId } });
  return prisma.goldRaid.findFirst({
    where: { guildId, status: { in: ['OPEN', 'LOCKED', 'IN_PROGRESS'] } },
    orderBy: { createdAt: 'desc' },
  });
}

async function refreshMessage(client, raid) {
  if (!raid.channelId || !raid.messageId) return;
  try {
    const channel = await client.channels.fetch(raid.channelId);
    const msg = await channel.messages.fetch(raid.messageId);
    const pumpers = await prisma.goldRaidPumper.findMany({ where: { raidId: raid.id } });
    const buyers = await prisma.goldRaidBuyer.findMany({ where: { raidId: raid.id } });
    await msg.edit({
      embeds: [buildRaidEmbed(raid, pumpers, buyers)],
      components: buildMainRows(raid.id, raid.status, raid.pumpersEnabled !== false),
    });
  } catch {}
}

module.exports = {
  refreshMessage,
  data: new SlashCommandBuilder()
    .setName('gb')
    .setDescription('Голдбид рейды')
    .addSubcommand(s => s
      .setName('create')
      .setDescription('Создать анонс голдбид рейда')
      .addStringOption(o => o
        .setName('type')
        .setDescription('Тип рейда')
        .setRequired(true)
        .addChoices(
          { name: 'Груул + Магтеридон (25 чел)', value: 'GRUUL_MAGTHERIDON' },
          { name: 'Каражан (10 чел)',             value: 'KARAZHAN' },
          { name: 'Логово Груула (25 чел)',        value: 'GRUUL' },
          { name: 'Логово Магтеридона (25 чел)',   value: 'MAGTHERIDON' },
        ),
      )
      .addIntegerOption(o => o.setName('price').setDescription('Цена за одну вещь (золото)').setRequired(false).setMinValue(0))
      .addBooleanOption(o => o.setName('pumpers').setDescription('Набор памперов (по умолчанию: да)').setRequired(false))
      .addStringOption(o => o.setName('notes').setDescription('Примечание (дата, время и т.д.)').setRequired(false))
      .addStringOption(o => o.setName('rl_character').setDescription('Ник персонажа РЛа в игре (например: Fexler)').setRequired(false)),
    )
    .addSubcommand(s => s
      .setName('lock')
      .setDescription('Закрыть запись в рейд')
      .addStringOption(o => o.setName('id').setDescription('ID рейда (если не указан — последний активный)').setRequired(false)),
    )
    .addSubcommand(s => s
      .setName('rollcall')
      .setDescription('Отправить перекличку участникам')
      .addStringOption(o => o.setName('id').setDescription('ID рейда').setRequired(false)),
    )
    .addSubcommand(s => s
      .setName('complete')
      .setDescription('Завершить рейд и распределить голду')
      .addIntegerOption(o => o.setName('gold').setDescription('Суммарная голда со всех баеров').setRequired(true).setMinValue(0))
      .addStringOption(o => o.setName('id').setDescription('ID рейда').setRequired(false)),
    )
    .addSubcommand(s => s
      .setName('cancel')
      .setDescription('Отменить рейд')
      .addStringOption(o => o.setName('id').setDescription('ID рейда').setRequired(false)),
    )
    .addSubcommand(s => s
      .setName('noshow')
      .setDescription('Отметить участника как не явившегося')
      .addUserOption(o => o.setName('user').setDescription('Участник').setRequired(true))
      .addStringOption(o => o.setName('id').setDescription('ID рейда').setRequired(false)),
    )
    .addSubcommand(s => s
      .setName('unblacklist')
      .setDescription('Снять бан с участника')
      .addUserOption(o => o.setName('user').setDescription('Участник').setRequired(true)),
    )
    .addSubcommand(s => s
      .setName('setup')
      .setDescription('Создать канал для голдбид анонсов (только бот и ты пишете, остальные — кнопки)')
      .addChannelOption(o => o
        .setName('channel')
        .setDescription('Существующий канал (если не указан — создаётся новый #голдбиды)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false),
      ),
    )
    .addSubcommand(s => s
      .setName('edit')
      .setDescription('Редактировать анонс рейда (открывает форму)')
      .addStringOption(o => o.setName('id').setDescription('ID рейда (если не указан — последний активный)').setRequired(false)),
    )
    .addSubcommand(s => s
      .setName('stats')
      .setDescription('Статистика пампера')
      .addUserOption(o => o.setName('user').setDescription('Участник (по умолч. ты)').setRequired(false)),
    ),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const isAdminSub = ADMIN_ONLY_SUBS.includes(sub);
    const isPublicSub = sub === 'stats';
    const isAdmin = interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild);

    if (!isPublicSub) {
      if (isAdminSub && !isAdmin) {
        return interaction.reply({ content: '❌ Нужны права администратора.', ephemeral: true });
      }
      if (!isAdminSub && !isAdmin) {
        const roles = await getWowRoles(interaction.guild);
        const verifiedRoleId = roles['verified'];
        if (!verifiedRoleId || !interaction.member.roles.cache.has(verifiedRoleId)) {
          return interaction.reply({
            ephemeral: true,
            embeds: [{
              color: 0xed4245,
              title: '🔒 Доступ закрыт',
              description: 'Команды голдбида доступны только **верифицированным РЛам**.\n\nЕсли ты рейд-лидер — зайди в канал <#для-рл> и подай заявку на верификацию.',
              footer: { text: 'Pretwora DS · Голдбид платформа' },
            }],
          });
        }
      }
    }

    // ── setup ──────────────────────────────────────────────────────────────────
    if (sub === 'setup') {
      await interaction.deferReply({ ephemeral: true });
      try {

      const existing = interaction.options.getChannel('channel');
      let gbChannel;

      if (existing) {
        gbChannel = existing;
      } else {
        gbChannel = await interaction.guild.channels.create({
          name: 'голдбиды',
          type: ChannelType.GuildText,
          topic: '⚔️ Голдбид рейды — запись через кнопки ниже',
        });
      }

      const UNTRUSTED_ROLE_ID = '421361784885084172'; // Недоверенный — новые участники до верификации

      // Set permissions: @everyone читает + кнопки, не пишет. Бот — всё.
      await gbChannel.permissionOverwrites.set([
        {
          id: interaction.guild.roles.everyone.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
          deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.SendMessagesInThreads, PermissionFlagsBits.AddReactions],
        },
        {
          // Новые участники (до верификации) тоже могут видеть канал и жать кнопки
          id: UNTRUSTED_ROLE_ID,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
          deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.SendMessagesInThreads, PermissionFlagsBits.AddReactions],
        },
        {
          id: client.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.ManageMessages,
          ],
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },
      ]);

      await saveGbChannelId(guildId, gbChannel.id);

      await interaction.editReply({
        content: [
          `✅ Канал для голдбидов настроен: <#${gbChannel.id}>`,
          ``,
          `**Права:**`,
          `• @everyone — только читать и нажимать кнопки`,
          `• Ты — можешь писать`,
          `• Бот — может писать`,
          ``,
          `Теперь \`/gb create\` будет автоматически постить анонсы туда.`,
        ].join('\n'),
      });

        writeAuditLog({ guildId, actorId: interaction.user.id, action: 'GB_SETUP', meta: { channelId: gbChannel.id } }).catch(() => {});
      } catch (err) {
        await interaction.editReply({ content: `❌ Ошибка: ${err.message}` });
      }
    }

    // ── create ─────────────────────────────────────────────────────────────────
    else if (sub === 'create') {
      const raidType        = interaction.options.getString('type');
      const slotPrice       = interaction.options.getInteger('price') ?? null;
      const pumpersEnabled  = interaction.options.getBoolean('pumpers') ?? true;
      const notes           = interaction.options.getString('notes') ?? null;
      const rlCharacterName = interaction.options.getString('rl_character') ?? null;

      // Определяем канал для анонса
      const gbChannelId = await getGbChannelId(guildId);
      let targetChannel;
      if (gbChannelId) {
        targetChannel = await client.channels.fetch(gbChannelId).catch(() => null);
      }
      if (!targetChannel) {
        targetChannel = interaction.channel;
      }

      await interaction.deferReply({ ephemeral: true });

      const raid = await prisma.goldRaid.create({
        data: {
          guildId,
          status: 'OPEN',
          raidType,
          slotPrice,
          pumpersEnabled,
          announcedBy: interaction.user.id,
          channelId: targetChannel.id,
          notes,
          rlCharacterName,
        },
      });

      const embed = buildRaidEmbed(raid, [], []);
      const rows = buildMainRows(raid.id, 'OPEN', raid.pumpersEnabled !== false);

      const msg = await targetChannel.send({ embeds: [embed], components: rows });

      await prisma.goldRaid.update({
        where: { id: raid.id },
        data: { messageId: msg.id },
      });

      const channelMention = targetChannel.id !== interaction.channelId
        ? ` → <#${targetChannel.id}>`
        : '';
      await interaction.editReply({ content: `✅ Анонс рейда опубликован!${channelMention}` });

      writeAuditLog({ guildId, actorId: interaction.user.id, action: 'GB_CREATE', meta: { raidId: raid.id } }).catch(() => {});
    }

    // ── lock ───────────────────────────────────────────────────────────────────
    else if (sub === 'lock') {
      const raid = await getActiveRaid(guildId, interaction.options.getString('id'));
      if (!raid) return interaction.reply({ content: '❌ Активный рейд не найден.', ephemeral: true });

      const updated = await prisma.goldRaid.update({
        where: { id: raid.id },
        data: { status: 'LOCKED', updatedAt: new Date() },
      });
      await refreshMessage(client, updated);
      await interaction.reply({ content: `🔒 Запись в рейд \`${raid.id.slice(0, 8)}\` закрыта.`, ephemeral: true });
    }

    // ── rollcall ───────────────────────────────────────────────────────────────
    else if (sub === 'rollcall') {
      const raid = await getActiveRaid(guildId, interaction.options.getString('id'));
      if (!raid) return interaction.reply({ content: '❌ Активный рейд не найден.', ephemeral: true });

      const updated = await prisma.goldRaid.update({
        where: { id: raid.id },
        data: { status: 'IN_PROGRESS', updatedAt: new Date() },
      });

      const pumpers = await prisma.goldRaidPumper.findMany({ where: { raidId: raid.id } });
      const buyers = await prisma.goldRaidBuyer.findMany({
        where: { raidId: raid.id, status: 'QUEUED' },
      });

      const mentions = [
        ...new Set([
          ...pumpers.map(p => `<@${p.userId}>`),
          ...buyers.map(b => `<@${b.userId}>`),
        ]),
      ].join(' ');

      const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`gb_confirm_${raid.id}`)
          .setLabel('✅ Я онлайн')
          .setStyle(ButtonStyle.Success),
      );

      await interaction.reply({
        content: `**⚔️ ПЕРЕКЛИЧКА!** Рейд начинается — подтвердите участие!\n${mentions}`,
        components: [confirmRow],
      });

      await refreshMessage(client, updated);
    }

    // ── complete ───────────────────────────────────────────────────────────────
    else if (sub === 'complete') {
      const raid = await getActiveRaid(guildId, interaction.options.getString('id'));
      if (!raid) return interaction.reply({ content: '❌ Активный рейд не найден.', ephemeral: true });

      const totalGold = interaction.options.getInteger('gold');

      await interaction.deferReply({ ephemeral: true });

      const pumpers = await prisma.goldRaidPumper.findMany({
        where: { raidId: raid.id, noShow: false },
      });
      const buyers = await prisma.goldRaidBuyer.findMany({
        where: { raidId: raid.id, status: 'QUEUED' },
      });

      const share = pumpers.length > 0 ? Math.floor(totalGold / pumpers.length) : 0;

      // Update pumper earnedGold
      if (pumpers.length > 0) {
        await prisma.goldRaidPumper.updateMany({
          where: { raidId: raid.id, noShow: false },
          data: { earnedGold: share },
        });
      }

      // Update stats for pumpers
      for (const p of pumpers) {
        await prisma.goldRaidUserStats.upsert({
          where: { guildId_userId: { guildId, userId: p.userId } },
          create: { guildId, userId: p.userId, username: p.username, pumperRaids: 1, pumperGold: share },
          update: { username: p.username, pumperRaids: { increment: 1 }, pumperGold: { increment: share } },
        });
      }

      // Update stats for buyers (mark as won, count unique buyers)
      const buyerIds = [...new Set(buyers.map(b => b.userId))];
      for (const uid of buyerIds) {
        const userBuyers = buyers.filter(b => b.userId === uid);
        await prisma.goldRaidUserStats.upsert({
          where: { guildId_userId: { guildId, userId: uid } },
          create: { guildId, userId: uid, username: userBuyers[0].username, buyerRaids: 1, itemsWon: userBuyers.length },
          update: { username: userBuyers[0].username, buyerRaids: { increment: 1 }, itemsWon: { increment: userBuyers.length } },
        });
      }

      const updated = await prisma.goldRaid.update({
        where: { id: raid.id },
        data: { status: 'COMPLETED', completedAt: new Date(), totalGold, updatedAt: new Date() },
      });

      await refreshMessage(client, updated);

      const lines = pumpers.map(p => `<@${p.userId}>: **${share.toLocaleString()}g**`).join('\n');
      await interaction.editReply({
        content: [
          `✅ Рейд \`${raid.id.slice(0, 8)}\` завершён!`,
          `💰 Общая голда: **${totalGold.toLocaleString()}g**`,
          `⚔️ Памперов: **${pumpers.length}** → по **${share.toLocaleString()}g** каждому`,
          pumpers.length > 0 ? `\n${lines}` : '',
        ].filter(Boolean).join('\n'),
      });

      writeAuditLog({ guildId, actorId: interaction.user.id, action: 'GB_COMPLETE', meta: { raidId: raid.id, totalGold } }).catch(() => {});
    }

    // ── cancel ─────────────────────────────────────────────────────────────────
    else if (sub === 'cancel') {
      const raid = await getActiveRaid(guildId, interaction.options.getString('id'));
      if (!raid) return interaction.reply({ content: '❌ Активный рейд не найден.', ephemeral: true });

      const updated = await prisma.goldRaid.update({
        where: { id: raid.id },
        data: { status: 'CANCELLED', updatedAt: new Date() },
      });
      await refreshMessage(client, updated);
      await interaction.reply({ content: `❌ Рейд \`${raid.id.slice(0, 8)}\` отменён.`, ephemeral: true });
    }

    // ── noshow ─────────────────────────────────────────────────────────────────
    else if (sub === 'noshow') {
      const target = interaction.options.getUser('user');
      const raid = await getActiveRaid(guildId, interaction.options.getString('id'));
      if (!raid) return interaction.reply({ content: '❌ Рейд не найден.', ephemeral: true });

      await prisma.goldRaidPumper.updateMany({
        where: { raidId: raid.id, userId: target.id },
        data: { noShow: true },
      });
      await prisma.goldRaidBuyer.updateMany({
        where: { raidId: raid.id, userId: target.id },
        data: { noShow: true, status: 'CANCELLED' },
      });

      const stats = await prisma.goldRaidUserStats.upsert({
        where: { guildId_userId: { guildId, userId: target.id } },
        create: { guildId, userId: target.id, username: target.username, noShowCount: 1 },
        update: { username: target.username, noShowCount: { increment: 1 } },
      });

      let extra = '';
      if (stats.noShowCount >= 3) {
        await prisma.goldRaidBlacklist.upsert({
          where: { guildId_userId: { guildId, userId: target.id } },
          create: {
            guildId, userId: target.id, username: target.username,
            reason: `Авто-бан: ${stats.noShowCount} пропуска`, noShows: stats.noShowCount,
            addedBy: interaction.user.id,
          },
          update: {
            username: target.username, noShows: stats.noShowCount,
            reason: `Авто-бан: ${stats.noShowCount} пропуска`,
          },
        });
        extra = `\n🚫 **Автоматически заблокирован** (${stats.noShowCount} пропуска подряд)`;
      }

      await interaction.reply({
        content: `⚠️ <@${target.id}> отмечен как не явившийся (пропусков: ${stats.noShowCount}).${extra}`,
        ephemeral: true,
      });
    }

    // ── unblacklist ────────────────────────────────────────────────────────────
    else if (sub === 'unblacklist') {
      const target = interaction.options.getUser('user');
      const deleted = await prisma.goldRaidBlacklist.deleteMany({
        where: { guildId, userId: target.id },
      });
      if (deleted.count === 0) {
        return interaction.reply({ content: `ℹ️ <@${target.id}> не в чёрном списке.`, ephemeral: true });
      }
      await interaction.reply({ content: `✅ <@${target.id}> удалён из чёрного списка.`, ephemeral: true });
    }

    // ── edit ───────────────────────────────────────────────────────────────────
    else if (sub === 'edit') {
      const raid = await getActiveRaid(guildId, interaction.options.getString('id'));
      if (!raid) return interaction.reply({ content: '❌ Активный рейд не найден.', ephemeral: true });

      const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
      const modal = new ModalBuilder()
        .setCustomId(`gb_edit_modal_${raid.id}`)
        .setTitle('Редактировать анонс рейда');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('edit_price')
            .setLabel('Цена за токен (золото)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('5000')
            .setValue(raid.slotPrice != null ? String(raid.slotPrice) : '')
            .setRequired(false),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('edit_rl_character')
            .setLabel('Ник персонажа РЛа в игре')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Например: Fexler')
            .setValue(raid.rlCharacterName ?? '')
            .setRequired(false),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('edit_notes')
            .setLabel('Заметка (дата, время и т.д.)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Пятница 20:00, сбор в голосовом...')
            .setValue(raid.notes ?? '')
            .setRequired(false),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('edit_extra')
            .setLabel('Произвольный текст в embed')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Любой текст который появится в анонсе...')
            .setValue(raid.extraText ?? '')
            .setRequired(false),
        ),
      );

      return interaction.showModal(modal);
    }

    // ── stats ──────────────────────────────────────────────────────────────────
    else if (sub === 'stats') {
      const target = interaction.options.getUser('user') ?? interaction.user;
      const stats = await prisma.goldRaidUserStats.findUnique({
        where: { guildId_userId: { guildId, userId: target.id } },
      });

      if (!stats) {
        return interaction.reply({
          content: `ℹ️ У <@${target.id}> пока нет статистики голдбид рейдов.`,
          ephemeral: true,
        });
      }

      const { EmbedBuilder } = require('discord.js');
      const embed = new EmbedBuilder()
        .setTitle(`📊 Статистика: ${target.username}`)
        .setColor(0x5865F2)
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          { name: '⚔️ Рейдов как пампер', value: String(stats.pumperRaids), inline: true },
          { name: '💰 Заработано голды', value: `${stats.pumperGold.toLocaleString()}g`, inline: true },
          { name: '🛒 Рейдов как баер', value: String(stats.buyerRaids), inline: true },
          { name: '🏆 Куплено вещей', value: String(stats.itemsWon), inline: true },
          { name: '⚠️ Пропусков', value: String(stats.noShowCount), inline: true },
        );

      await interaction.reply({ embeds: [embed] });
    }
  },
};
