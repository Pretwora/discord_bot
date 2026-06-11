const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const schedule = require('node-schedule');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// activeJobs: giveawayId -> node-schedule job
const activeJobs = new Map();

// ─── Embed builder ───────────────────────────────────────────────────────────

function buildEmbed(giveaway, entryCount = 0) {
  const ended = giveaway.status !== 'ACTIVE';
  const timeLeft = ended
    ? null
    : Math.max(0, Math.floor((new Date(giveaway.endsAt) - Date.now()) / 1000));

  const embed = new EmbedBuilder()
    .setColor(ended ? 0x5c5c8a : 0x7c3aed)
    .setTitle(`🎉 ${giveaway.prize}`)
    .setFooter({ text: ended ? 'Розыгрыш завершён' : `Участников: ${entryCount}` });

  if (giveaway.description) embed.setDescription(giveaway.description);

  embed.addFields(
    { name: '🏆 Победителей', value: `${giveaway.winnersCount}`, inline: true },
    {
      name: ended ? '⏱️ Завершился' : '⏱️ Конец',
      value: `<t:${Math.floor(new Date(giveaway.endsAt).getTime() / 1000)}:R>`,
      inline: true,
    },
    { name: '👤 Организатор', value: `<@${giveaway.hostedBy}>`, inline: true },
  );

  if (giveaway.requiredRoleId) {
    embed.addFields({ name: '🔒 Только для', value: `<@&${giveaway.requiredRoleId}>`, inline: true });
  }

  return embed;
}

function buildRow(giveawayId, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`giveaway_enter_${giveawayId}`)
      .setLabel('🎉 Участвовать')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
  );
}

// ─── Post giveaway message ────────────────────────────────────────────────────

async function postGiveaway(client, giveaway) {
  const guild = await client.guilds.fetch(giveaway.guildId).catch(() => null);
  if (!guild) return null;

  const channel = await guild.channels.fetch(giveaway.channelId).catch(() => null);
  if (!channel) return null;

  const msg = await channel.send({
    embeds: [buildEmbed(giveaway, 0)],
    components: [buildRow(giveaway.id)],
  });

  await prisma.giveaway.update({
    where: { id: giveaway.id },
    data: { messageId: msg.id },
  });

  return msg;
}

// ─── Update embed with current entry count ───────────────────────────────────

async function refreshMessage(client, giveaway) {
  if (!giveaway.messageId) return;
  try {
    const guild = await client.guilds.fetch(giveaway.guildId);
    const channel = await guild.channels.fetch(giveaway.channelId);
    const msg = await channel.messages.fetch(giveaway.messageId);
    const count = await prisma.giveawayEntry.count({ where: { giveawayId: giveaway.id } });
    await msg.edit({ embeds: [buildEmbed(giveaway, count)], components: [buildRow(giveaway.id)] });
  } catch {}
}

// ─── Pick winners (supports tickets for bonus entries in future) ──────────────

async function pickWinners(giveaway) {
  const entries = await prisma.giveawayEntry.findMany({ where: { giveawayId: giveaway.id } });
  if (!entries.length) return [];

  // Expand entries by tickets (future: higher-level users get more tickets)
  const pool = entries.flatMap(e => Array(e.tickets).fill(e.userId));

  const winners = [];
  const picked = new Set();
  const needed = Math.min(giveaway.winnersCount, entries.length);

  while (winners.length < needed) {
    const idx = Math.floor(Math.random() * pool.length);
    const uid = pool[idx];
    if (!picked.has(uid)) {
      picked.add(uid);
      winners.push(uid);
    }
  }
  return winners;
}

// ─── End giveaway ────────────────────────────────────────────────────────────

async function endGiveaway(client, giveawayId) {
  const giveaway = await prisma.giveaway.findUnique({ where: { id: giveawayId } });
  if (!giveaway || giveaway.status !== 'ACTIVE') return;

  const winners = await pickWinners(giveaway);

  await prisma.$transaction([
    prisma.giveaway.update({
      where: { id: giveawayId },
      data: { status: 'ENDED', endedAt: new Date() },
    }),
    ...(winners.length
      ? [prisma.giveawayWinner.createMany({
          data: winners.map(userId => ({ giveawayId, userId })),
        })]
      : []),
  ]);

  // Cancel scheduled job
  activeJobs.get(giveawayId)?.cancel();
  activeJobs.delete(giveawayId);

  const updated = { ...giveaway, status: 'ENDED', endedAt: new Date() };

  try {
    const guild = await client.guilds.fetch(giveaway.guildId);
    const channel = await guild.channels.fetch(giveaway.channelId);

    // Update original message
    if (giveaway.messageId) {
      const msg = await channel.messages.fetch(giveaway.messageId).catch(() => null);
      const entryCount = await prisma.giveawayEntry.count({ where: { giveawayId } });
      if (msg) await msg.edit({ embeds: [buildEmbed(updated, entryCount)], components: [buildRow(giveawayId, true)] });
    }

    // Announce winners
    if (winners.length) {
      const mentions = winners.map(id => `<@${id}>`).join(', ');
      await channel.send({
        content: `🎊 Поздравляем победител${winners.length > 1 ? 'ей' : 'я'}: ${mentions}!\n**Приз:** ${giveaway.prize}`,
      });
    } else {
      await channel.send({ content: `😔 Розыгрыш **${giveaway.prize}** завершён — никто не участвовал.` });
    }
  } catch {}

  return winners;
}

// ─── Schedule end ─────────────────────────────────────────────────────────────

function scheduleEnd(client, giveaway) {
  const endsAt = new Date(giveaway.endsAt);
  if (endsAt <= new Date()) {
    // Already overdue — end immediately
    setImmediate(() => endGiveaway(client, giveaway.id));
    return;
  }
  const job = schedule.scheduleJob(endsAt, () => endGiveaway(client, giveaway.id));
  activeJobs.set(giveaway.id, job);
}

// ─── Restore active giveaways on bot start ────────────────────────────────────

async function restoreGiveaways(client) {
  const active = await prisma.giveaway.findMany({ where: { status: 'ACTIVE' } });
  for (const g of active) scheduleEnd(client, g);
  if (active.length) console.log(`[Giveaway] Restored ${active.length} active giveaway(s)`);
}

// ─── Reroll ───────────────────────────────────────────────────────────────────

async function rerollGiveaway(client, giveawayId, count = 1) {
  const giveaway = await prisma.giveaway.findUnique({
    where: { id: giveawayId },
    include: { winners: true },
  });
  if (!giveaway || giveaway.status !== 'ENDED') return null;

  const prevWinnerIds = new Set(giveaway.winners.map(w => w.userId));
  const entries = await prisma.giveawayEntry.findMany({
    where: { giveawayId, userId: { notIn: [...prevWinnerIds] } },
  });
  if (!entries.length) return null;

  const pool = entries.flatMap(e => Array(e.tickets).fill(e.userId));
  const newWinners = [];
  const picked = new Set();

  while (newWinners.length < Math.min(count, entries.length)) {
    const uid = pool[Math.floor(Math.random() * pool.length)];
    if (!picked.has(uid)) { picked.add(uid); newWinners.push(uid); }
  }

  try {
    const guild = await client.guilds.fetch(giveaway.guildId);
    const channel = await guild.channels.fetch(giveaway.channelId);
    const mentions = newWinners.map(id => `<@${id}>`).join(', ');
    await channel.send({ content: `🔄 Перебросок! Новые победители: ${mentions} (**${giveaway.prize}**)` });
  } catch {}

  return newWinners;
}

module.exports = {
  buildEmbed,
  buildRow,
  postGiveaway,
  refreshMessage,
  endGiveaway,
  scheduleEnd,
  restoreGiveaways,
  rerollGiveaway,
  prisma,
};
