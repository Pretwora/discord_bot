const { EmbedBuilder } = require('discord.js');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function xpForLevel(n) {
  return n * (n + 1) / 2 * 100;
}

function progressBar(current, max, len = 10) {
  const filled = Math.round((current / Math.max(max, 1)) * len);
  return '█'.repeat(filled) + '░'.repeat(len - filled);
}

function medal(pos) {
  return ['🥇', '🥈', '🥉'][pos] ?? `${pos + 1}.`;
}

async function buildWeeklyReport(guild, options = {}) {
  const guildId = guild.id;
  const now = new Date();
  const weekAgo = new Date(now - 7 * 24 * 3600 * 1000);

  // ── Collect data ────────────────────────────────────────────────────────────

  const [topMembers, newMembers, totalMembers, endedGiveaways] = await Promise.all([
    // Top 5 by XP
    prisma.member.findMany({
      where: { guildId },
      orderBy: [{ level: 'desc' }, { xp: 'desc' }],
      take: 5,
    }),

    // New this week
    prisma.member.findMany({
      where: { guildId, joinedAt: { gte: weekAgo } },
      orderBy: { joinedAt: 'asc' },
    }),

    // Total count
    prisma.member.count({ where: { guildId } }),

    // Giveaways ended this week
    prisma.giveaway.findMany({
      where: {
        guildId,
        status: 'ENDED',
        endedAt: { gte: weekAgo },
      },
      include: { winners: true },
      orderBy: { endedAt: 'desc' },
      take: 3,
    }),
  ]);

  // Most active (by messageCount, top 1 for "activity king" field)
  const activityKing = topMembers[0] ?? null;

  // ── Date range label ────────────────────────────────────────────────────────
  const fmt = d => d.toLocaleDateString('ru', { day: 'numeric', month: 'long' });
  const rangeStr = `${fmt(weekAgo)} — ${fmt(now)}`;

  // ── Build embed ─────────────────────────────────────────────────────────────
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`📊 Итоги недели · ${rangeStr}`)
    .setTimestamp()
    .setFooter({ text: `${guild.name} · Еженедельный отчёт` });

  if (guild.iconURL()) embed.setThumbnail(guild.iconURL({ dynamic: true }));

  // ── Top 3 ───────────────────────────────────────────────────────────────────
  if (topMembers.length) {
    const lines = topMembers.slice(0, 3).map((m, i) => {
      const xpNeeded = xpForLevel(m.level + 1);
      const bar = progressBar(m.xp - xpForLevel(m.level), xpNeeded - xpForLevel(m.level), 8);
      return `${medal(i)} **${m.username}** — Lvl ${m.level} \`${bar}\` ${m.xp.toLocaleString()} XP`;
    });
    embed.addFields({ name: '🏆 Топ активных участников', value: lines.join('\n'), inline: false });
  }

  // ── New members ─────────────────────────────────────────────────────────────
  if (newMembers.length) {
    const names = newMembers.slice(0, 8).map(m => `\`${m.username}\``).join(', ');
    const extra = newMembers.length > 8 ? ` и ещё ${newMembers.length - 8}` : '';
    embed.addFields({
      name: `👋 Новые участники (${newMembers.length})`,
      value: names + extra,
      inline: false,
    });
  } else {
    embed.addFields({ name: '👋 Новые участники', value: 'На этой неделе никто не присоединился', inline: false });
  }

  // ── Server stats ─────────────────────────────────────────────────────────────
  const totalMessages = topMembers.reduce((s, m) => s + m.messageCount, 0);
  embed.addFields(
    { name: '👥 Всего участников', value: `${totalMembers}`, inline: true },
    { name: '💬 Сообщений (топ-5)', value: `${totalMessages.toLocaleString()}`, inline: true },
    { name: '📈 Новых за неделю', value: `+${newMembers.length}`, inline: true },
  );

  // ── Giveaways ────────────────────────────────────────────────────────────────
  if (endedGiveaways.length) {
    const lines = endedGiveaways.map(g => {
      const wStr = g.winners.length
        ? g.winners.slice(0, 3).map(w => `<@${w.userId}>`).join(', ')
        : '—';
      return `🎉 **${g.prize}** → ${wStr}`;
    });
    embed.addFields({ name: '🎁 Розыгрыши недели', value: lines.join('\n'), inline: false });
  }

  // ── Motivational footer quote ────────────────────────────────────────────────
  const quotes = [
    'Новая неделя — новые возможности. Вперёд! 🚀',
    'Активность — ключ к легенде. Продолжайте! ⚡',
    'Каждое сообщение приближает к следующему уровню. 🎯',
    'Лучший сервер строят лучшие участники. 💎',
  ];
  embed.setDescription(`*${quotes[Math.floor(Math.random() * quotes.length)]}*`);

  return embed;
}

async function sendWeeklyReport(client, channelId) {
  if (!channelId) return false;

  const guild = client.guilds.cache.get(process.env.DISCORD_GUILD_ID);
  if (!guild) return false;

  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel) return false;

  const embed = await buildWeeklyReport(guild);
  await channel.send({ embeds: [embed] });
  return true;
}

module.exports = { buildWeeklyReport, sendWeeklyReport };
