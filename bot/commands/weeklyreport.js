const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { sendWeeklyReport } = require('../utils/weeklyReport');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('weeklyreport')
    .setDescription('Отправить еженедельный отчёт прямо сейчас')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(o =>
      o.setName('channel')
        .setDescription('Канал (по умолч. из настроек)')
        .setRequired(false),
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    let channelId = interaction.options.getChannel('channel')?.id;

    if (!channelId) {
      const dbGuild = await prisma.guild.findUnique({ where: { id: interaction.guildId } });
      let settings = {};
      try { settings = JSON.parse(dbGuild?.settings || '{}'); } catch {}
      channelId = settings.weeklyReportChannelId || process.env.LEVEL_UP_CHANNEL_ID;
    }

    const sent = await sendWeeklyReport(interaction.client, channelId);

    if (sent) {
      await interaction.editReply(`✅ Отчёт отправлен в <#${channelId}>!`);
    } else {
      await interaction.editReply('❌ Не удалось отправить. Проверь настройки канала.');
    }
  },
};
