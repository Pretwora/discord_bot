const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } = require('discord.js');

const CHANNEL_NAME = 'для-рл';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rl-setup')
    .setDescription('Создать канал #для-рл и опубликовать там информацию для рейд-лидеров')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    // Найти или создать канал #для-рл
    let channel = interaction.guild.channels.cache.find(
      c => c.name === CHANNEL_NAME && c.type === ChannelType.GuildText,
    );

    if (!channel) {
      channel = await interaction.guild.channels.create({
        name: CHANNEL_NAME,
        type: ChannelType.GuildText,
        topic: 'Информация для рейд-лидеров — верификация, рейтинг, голдбид платформа',
        reason: 'rl-setup command',
      });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('rl_apply')
        .setLabel('Хочу стать верифицированным РЛом')
        .setEmoji('⚔️')
        .setStyle(ButtonStyle.Primary),
    );

    await channel.send({
      embeds: [{
        color: 0x5865f2,
        title: '⚔️ Для Рейд-лидеров — Pretwora DS',
        description: 'Ты водишь голдбид рейды на **Sirus.su**?\n\nPretwora DS — платформа где **баеры сами находят тебя**. Никакого спама в чате. Никакого ручного сбора очередей.',
        fields: [
          {
            name: '📢 Поток баеров без усилий',
            value: 'Баеры регистрируются на платформе и ищут рейды здесь. Верифицированный РЛ — первый в их списке.',
            inline: false,
          },
          {
            name: '🏆 Публичный рейтинг РЛов',
            value: 'Рейды, золото, надёжность — всё видно. Твоя репутация работает на тебя 24/7.',
            inline: false,
          },
          {
            name: '🚫 Защита от ноу-шоу',
            value: 'Бот автоматически ведёт чёрный список. Те кто подвёл один раз — больше не запишутся.',
            inline: false,
          },
          {
            name: '🤖 Автоматизация рейда',
            value: 'Очередь баеров, слоты памперов, уведомления — всё через Discord. Ты только водишь рейд.',
            inline: false,
          },
          {
            name: '💸 Стоимость',
            value: '**Бесплатно.** Платят только баеры за шмот — тебе это ничего не стоит.',
            inline: false,
          },
        ],
        footer: { text: 'Pretwora DS · Голдбид платформа для Sirus.su' },
        timestamp: new Date().toISOString(),
      }],
      components: [row],
    });

    await interaction.editReply({ content: `✅ Готово! Канал <#${channel.id}> создан и embed опубликован.` });
  },
};
