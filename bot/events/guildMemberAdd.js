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
        await channel.send({
          content: `${member}`,
          embeds: [{
            color: 0x5865F2,
            title: `Привет, ${member.user.username}! Добро пожаловать на Pretwora DS.`,
            description: `Ты **${memberCount}-й участник** сервера.`,
            fields: [
              {
                name: '📜 Прочитай правила',
                value: `Загляни в <#${RULES_CHANNEL_ID}> и нажми «Принимаю» — это откроет доступ ко всем каналам.`,
                inline: false,
              },
              {
                name: '⭐ Зарабатывай XP',
                value: 'Общайся и сиди в войсе — получай уровни и открывай привилегии.',
                inline: false,
              },
              {
                name: '🎭 Выбери роли',
                value: 'Загляни в <#1514399407637004483> и выбери роли по интересам.',
                inline: false,
              },
            ],
            thumbnail: { url: member.user.displayAvatarURL({ size: 128 }) },
            footer: { text: 'Pretwora DS • Рады видеть тебя здесь!' },
            timestamp: new Date().toISOString(),
          }],
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
