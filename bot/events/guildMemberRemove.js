const prisma = require('../../config/database');
const logger  = require('../../config/logger');
const { writeAuditLog } = require('../utils/auditLog');

const LOG_CHANNEL_ID = '1514535468610490390'; // #лог-сообщений

module.exports = {
  name: 'guildMemberRemove',
  async execute(member) {
    await writeAuditLog({
      guildId: member.guild.id,
      actorId: member.user.username,
      action: 'member_leave',
      targetId: member.user.id,
      meta: { targetName: member.user.username },
    });
    await prisma.member.update({ where: { id: member.id }, data: { inGuild: false } }).catch(() => {});

    try {
      const logChannel = member.guild.channels.cache.get(LOG_CHANNEL_ID);
      if (logChannel) {
        const joinedAt = member.joinedAt;
        const duration = joinedAt
          ? Math.floor((Date.now() - joinedAt.getTime()) / (1000 * 60 * 60 * 24))
          : null;

        await logChannel.send({
          embeds: [{
            color: 0xED4245,
            author: {
              name: `${member.user.username} покинул сервер`,
              icon_url: member.user.displayAvatarURL({ size: 64 }),
            },
            fields: [
              { name: 'Пользователь', value: `<@${member.id}> (${member.user.id})`, inline: true },
              { name: 'На сервере', value: duration !== null ? `${duration} дн.` : 'неизвестно', inline: true },
            ],
            timestamp: new Date().toISOString(),
          }],
        });
      }
    } catch (err) {
      logger.warn(`Could not send leave log: ${err.message}`);
    }

    logger.info(`Member left: ${member.user.tag}`);
  },
};
