const { writeAuditLog } = require('../utils/auditLog');
const logger = require('../../config/logger');

const LOG_CHANNEL_ID = '1514535468610490390'; // #лог-сообщений

module.exports = {
  name: 'messageDelete',
  async execute(message) {
    if (!message.guild || message.author?.bot) return;

    const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);
    if (!logChannel) return;

    const author  = message.author;
    const content = message.content || '_[вложение или эмбед]_';
    const channel = message.channel;

    await logChannel.send({
      embeds: [{
        color: 0xed4245,
        title: '🗑️ Сообщение удалено',
        fields: [
          {
            name: 'Автор',
            value: author ? `<@${author.id}> (${author.username})` : '_Неизвестен_',
            inline: true,
          },
          {
            name: 'Канал',
            value: `<#${channel.id}>`,
            inline: true,
          },
          {
            name: 'Содержимое',
            value: content.length > 1024 ? content.slice(0, 1021) + '...' : content,
            inline: false,
          },
        ],
        footer: { text: `ID сообщения: ${message.id}` },
        timestamp: new Date().toISOString(),
      }],
    }).catch(() => {});

    if (author) {
      await writeAuditLog({
        guildId: message.guild.id,
        actorId: author.username,
        action: 'message_delete',
        targetId: channel.id,
        meta: { targetName: `#${channel.name}`, content: content.slice(0, 200) },
      });
    }

    logger.info(`Message deleted: ${author?.tag} in #${channel.name}`);
  },
};
