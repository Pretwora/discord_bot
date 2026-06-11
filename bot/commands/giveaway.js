const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const {
  postGiveaway, endGiveaway, rerollGiveaway, scheduleEnd, buildEmbed,
} = require('../utils/giveawayManager');

const prisma = new PrismaClient();

// Parse duration string: "10m", "2h", "1d" → ms
function parseDuration(str) {
  const units = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  const m = str.match(/^(\d+)([smhd])$/i);
  if (!m) return null;
  return parseInt(m[1]) * (units[m[2].toLowerCase()] || 0);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Управление розыгрышами')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('start')
        .setDescription('Начать розыгрыш')
        .addStringOption(o => o.setName('prize').setDescription('Что разыгрывается').setRequired(true))
        .addStringOption(o => o.setName('duration').setDescription('Длительность: 10m, 2h, 1d').setRequired(true))
        .addChannelOption(o => o.setName('channel').setDescription('Канал для розыгрыша').addChannelTypes(ChannelType.GuildText).setRequired(false))
        .addIntegerOption(o => o.setName('winners').setDescription('Количество победителей (по умолч. 1)').setMinValue(1).setMaxValue(20).setRequired(false))
        .addStringOption(o => o.setName('description').setDescription('Подробное описание приза').setRequired(false))
        .addRoleOption(o => o.setName('required_role').setDescription('Требуемая роль для участия').setRequired(false)),
    )
    .addSubcommand(sub =>
      sub.setName('end')
        .setDescription('Досрочно завершить розыгрыш')
        .addStringOption(o => o.setName('id').setDescription('ID розыгрыша').setRequired(true)),
    )
    .addSubcommand(sub =>
      sub.setName('reroll')
        .setDescription('Перебросить победителя')
        .addStringOption(o => o.setName('id').setDescription('ID розыгрыша').setRequired(true))
        .addIntegerOption(o => o.setName('count').setDescription('Сколько новых победителей').setMinValue(1).setMaxValue(5).setRequired(false)),
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('Список активных розыгрышей'),
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    // ── start ──────────────────────────────────────────────────────────────────
    if (sub === 'start') {
      const prize = interaction.options.getString('prize');
      const durationStr = interaction.options.getString('duration');
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      const winnersCount = interaction.options.getInteger('winners') ?? 1;
      const description = interaction.options.getString('description') ?? null;
      const requiredRole = interaction.options.getRole('required_role') ?? null;

      const ms = parseDuration(durationStr);
      if (!ms || ms < 10000) {
        return interaction.reply({ content: '❌ Неверный формат длительности. Примеры: `10m`, `2h`, `1d`', ephemeral: true });
      }
      if (ms > 30 * 86400000) {
        return interaction.reply({ content: '❌ Максимальная длительность — 30 дней', ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true });

      // Ensure guild exists in DB
      await prisma.guild.upsert({
        where: { id: interaction.guildId },
        update: { name: interaction.guild.name, ownerId: interaction.guild.ownerId },
        create: { id: interaction.guildId, name: interaction.guild.name, ownerId: interaction.guild.ownerId },
      });

      const giveaway = await prisma.giveaway.create({
        data: {
          guildId: interaction.guildId,
          channelId: channel.id,
          prize,
          description,
          winnersCount,
          endsAt: new Date(Date.now() + ms),
          hostedBy: interaction.user.id,
          requiredRoleId: requiredRole?.id ?? null,
        },
      });

      const msg = await postGiveaway(interaction.client, giveaway);
      if (!msg) {
        return interaction.editReply('❌ Не удалось отправить сообщение в канал.');
      }
      scheduleEnd(interaction.client, giveaway);

      return interaction.editReply(
        `✅ Розыгрыш **${prize}** запущен в <#${channel.id}>!\nID: \`${giveaway.id}\``,
      );
    }

    // ── end ────────────────────────────────────────────────────────────────────
    if (sub === 'end') {
      const id = interaction.options.getString('id');
      await interaction.deferReply({ ephemeral: true });

      const giveaway = await prisma.giveaway.findUnique({ where: { id } });
      if (!giveaway || giveaway.guildId !== interaction.guildId) {
        return interaction.editReply('❌ Розыгрыш не найден.');
      }
      if (giveaway.status !== 'ACTIVE') {
        return interaction.editReply('❌ Розыгрыш уже завершён или отменён.');
      }

      const winners = await endGiveaway(interaction.client, id);
      const text = winners?.length
        ? `✅ Завершён. Победители: ${winners.map(id => `<@${id}>`).join(', ')}`
        : '✅ Завершён. Победителей не оказалось.';
      return interaction.editReply(text);
    }

    // ── reroll ─────────────────────────────────────────────────────────────────
    if (sub === 'reroll') {
      const id = interaction.options.getString('id');
      const count = interaction.options.getInteger('count') ?? 1;
      await interaction.deferReply({ ephemeral: true });

      const newWinners = await rerollGiveaway(interaction.client, id, count);
      if (!newWinners) return interaction.editReply('❌ Нельзя перебросить: розыгрыш не найден, не завершён или нет новых участников.');
      return interaction.editReply(`✅ Переброс! Новые победители: ${newWinners.map(id => `<@${id}>`).join(', ')}`);
    }

    // ── list ───────────────────────────────────────────────────────────────────
    if (sub === 'list') {
      const active = await prisma.giveaway.findMany({
        where: { guildId: interaction.guildId, status: 'ACTIVE' },
        include: { _count: { select: { entries: true } } },
        orderBy: { endsAt: 'asc' },
      });

      if (!active.length) {
        return interaction.reply({ content: '📋 Активных розыгрышей нет.', ephemeral: true });
      }

      const lines = active.map(g =>
        `• **${g.prize}** — ${g._count.entries} участников, конец <t:${Math.floor(new Date(g.endsAt).getTime() / 1000)}:R> · \`${g.id}\``,
      );
      return interaction.reply({ content: `🎉 **Активные розыгрыши:**\n${lines.join('\n')}`, ephemeral: true });
    }
  },
};
