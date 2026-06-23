const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const prisma = require('../../config/database');
const logger  = require('../../config/logger');
const { writeAuditLog } = require('../utils/auditLog');

const WELCOME_CHANNEL_ID  = '1514532866481061941'; // #приветствия
const MEMBER_ROLE_ID      = '1514399385851662546'; // 👤 Участник
const UNTRUSTED_ROLE_ID   = '421361784885084172';  // Недоверенный
const RULES_CHANNEL_ID    = '1514399401211330610'; // #правила

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    // 1. Assign 🚫 Недоверенный until they verify
    try {
      const untrusted = member.guild.roles.cache.get(UNTRUSTED_ROLE_ID);
      if (untrusted) await member.roles.add(untrusted);
    } catch (err) {
      logger.warn(`Could not assign Недоверенный role: ${err.message}`);
    }

    // 2. Send welcome message
    try {
      const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
      if (channel) {
        const memberCount = member.guild.memberCount;
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('welcome_role_pumper')
            .setLabel('Пампер')
            .setEmoji('🛡️')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('welcome_role_buyer')
            .setLabel('Баер')
            .setEmoji('💰')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('welcome_role_rl')
            .setLabel('РЛ')
            .setEmoji('⚔️')
            .setStyle(ButtonStyle.Primary),
        );
        await channel.send({
          content: `${member}`,
          embeds: [{
            color: 0x5865F2,
            title: `👋 Привет, ${member.user.username}! Добро пожаловать на Pretwora DS.`,
            description: `Ты **${memberCount}-й участник** сервера.\n\nЗдесь собирается тусовка игроков — общаемся, играем вместе и организуем **голдбид рейды в WoW**.`,
            fields: [
              {
                name: '📜 Шаг 1 — Прочитай правила',
                value: `Зайди в <#${RULES_CHANNEL_ID}> и нажми «Принимаю» — это откроет доступ ко всем каналам.`,
                inline: false,
              },
              {
                name: '🎭 Шаг 2 — Кто ты?',
                value: '**🛡️ Пампер** — качаешь/дамажишь/танчишь/хилишь за голду в чужих рейдах\n**💰 Баер** — покупаешь шмот у РЛов за голду\n**⚔️ РЛ** — сам организуешь и водишь рейды\n\nНажми кнопку ниже — получишь роль и всю нужную инфу.',
                inline: false,
              },
              {
                name: '⭐ Шаг 3 — Общайся и расти',
                value: 'Зарабатывай XP за сообщения и войс — открывай привилегированные каналы и поднимайся в топе сервера.',
                inline: false,
              },
            ],
            thumbnail: { url: member.user.displayAvatarURL({ size: 128 }) },
            footer: { text: 'Pretwora DS • Рады видеть тебя здесь!' },
            timestamp: new Date().toISOString(),
          }],
          components: [row],
        });
      }
    } catch (err) {
      logger.warn(`Could not send welcome message: ${err.message}`);
    }

    // 3. Save to DB
    const rolesJson = JSON.stringify(
      member.roles.cache
        .filter(r => r.name !== '@everyone')
        .map(r => ({ id: r.id, name: r.name, color: r.hexColor }))
    );
    await prisma.member.upsert({
      where:  { id: member.id },
      update: { username: member.user.username, nickname: member.nickname ?? null, roles: rolesJson, lastActive: new Date(), inGuild: true },
      create: {
        id: member.id, guildId: member.guild.id, username: member.user.username,
        nickname: member.nickname ?? null, roles: rolesJson,
        joinedAt: member.joinedAt ?? new Date(), inGuild: true,
      },
    }).catch(err => logger.error(`guildMemberAdd DB error: ${err.message}`));

    await writeAuditLog({
      guildId: member.guild.id,
      actorId: member.user.username,
      action: 'member_join',
      targetId: member.user.id,
      meta: { targetName: member.user.username },
    });
    logger.info(`Member joined: ${member.user.tag} — welcome sent, role assigned`);
  },
};
