const { EmbedBuilder } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const { RAID_TYPES, ROLE_LABELS } = require('./gbManager');
const logger = require('../../config/logger');

const prisma = new PrismaClient();

async function notifyRL(client, raidId) {
  const raid = await prisma.goldRaid.findUnique({ where: { id: raidId } });
  if (!raid) return;

  const pumpers = await prisma.goldRaidPumper.findMany({
    where: { raidId },
    orderBy: { joinedAt: 'asc' },
  });
  const buyers = await prisma.goldRaidBuyer.findMany({
    where: { raidId, status: 'QUEUED' },
    orderBy: { joinedAt: 'asc' },
  });

  const embed = new EmbedBuilder()
    .setTitle(`🔐 Список участников — ${RAID_TYPES[raid.raidType]?.label ?? raid.raidType}`)
    .setColor(0x5865F2)
    .setTimestamp();

  // Памперы (активные + очередь)
  const activePumpers = pumpers.filter(p => !p.inQueue);
  const queuePumpers  = pumpers.filter(p => p.inQueue);
  const pumperLines = activePumpers.length > 0
    ? activePumpers.map(p => {
        const role = p.pumperRole ? ` [${ROLE_LABELS[p.pumperRole] ?? p.pumperRole}]` : '';
        return `• <@${p.userId}> (${p.username})${role}`;
      }).join('\n')
    : '_Нет памперов_';
  embed.addFields({ name: `⚔️ Памперы [${activePumpers.length}]`, value: pumperLines });

  if (queuePumpers.length > 0) {
    const queueLines = queuePumpers.map(p => {
      const role = p.pumperRole ? ` [${ROLE_LABELS[p.pumperRole] ?? p.pumperRole}]` : '';
      return `• <@${p.userId}> (${p.username})${role}`;
    }).join('\n');
    embed.addFields({ name: `⏳ Очередь [${queuePumpers.length}]`, value: queueLines });
  }

  // Баеры — группируем по userId
  if (buyers.length > 0) {
    const byUser = {};
    for (const b of buyers) {
      if (!byUser[b.userId]) byUser[b.userId] = { username: b.username, characterName: b.characterName, count: 0 };
      byUser[b.userId].count++;
    }
    const buyerLines = Object.entries(byUser)
      .map(([uid, data]) => {
        const char = data.characterName ? ` **(${data.characterName})**` : '';
        const n = data.count;
        const suffix = n === 1 ? 'вещь' : n < 5 ? 'вещи' : 'вещей';
        return `• <@${uid}>${char} — ${n} ${suffix}`;
      })
      .join('\n');
    embed.addFields({ name: `💰 Баеры [${Object.keys(byUser).length} чел · ${buyers.length} вещей]`, value: buyerLines });
  } else {
    embed.addFields({ name: '💰 Баеры [0]', value: '_Нет баеров_' });
  }

  embed.setFooter({ text: `Рейд ID: ${raid.id.slice(0, 8)}` });

  try {
    const rlUser = await client.users.fetch(raid.announcedBy);

    // Если уже есть DM-сообщение — редактируем его
    if (raid.rlDmMessageId) {
      try {
        const dmChannel = await rlUser.createDM();
        const existing = await dmChannel.messages.fetch(raid.rlDmMessageId);
        await existing.edit({ embeds: [embed] });
        return;
      } catch {
        // Сообщение удалено — отправим новое
      }
    }

    // Отправляем новое DM
    const dmChannel = await rlUser.createDM();
    const msg = await dmChannel.send({ embeds: [embed] });

    await prisma.goldRaid.update({
      where: { id: raidId },
      data: { rlDmMessageId: msg.id },
    });
  } catch (err) {
    logger.warn(`notifyRL: не удалось отправить DM РЛу ${raid.announcedBy}: ${err.message}`);
  }
}

module.exports = { notifyRL };
