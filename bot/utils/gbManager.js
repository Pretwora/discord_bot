const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder,
} = require('discord.js');

const LOOT_TABLE = {
  GRUUL: {
    name: 'Логово Груула',
    emoji: '🐉',
    format: 25,
    drops: [
      { slot: 'LEGS',      label: 'Штаны',  qty: 1 },
      { slot: 'SHOULDERS', label: 'Плечи',  qty: 1 },
    ],
  },
  MAGTHERIDON: {
    name: 'Логово Магтеридона',
    emoji: '🔥',
    format: 25,
    drops: [
      { slot: 'CHEST', label: 'Нагрудник', qty: 1 },
    ],
  },
  KARAZHAN: {
    name: 'Каражан',
    emoji: '🏰',
    format: 10,
    drops: [
      { slot: 'GLOVES', label: 'Перчатки', qty: 1 },
      { slot: 'HEAD',   label: 'Голова',   qty: 1 },
    ],
  },
};

const TOKEN_TYPES = ['ПРШ', 'ЛХМД', 'ВЖД'];
const NOSHOW_THRESHOLD = 3;

// Temp storage for buyer item selection before confirmation
const pendingSelections = new Map(); // `${raidId}:${userId}` → string[]

const STATUS_LABELS = {
  OPEN:        '🟢 Запись открыта',
  LOCKED:      '🔒 Запись закрыта',
  IN_PROGRESS: '⚔️ Идёт рейд',
  COMPLETED:   '✅ Завершён',
  CANCELLED:   '❌ Отменён',
};

function buildRaidEmbed(raid, pumpers, buyers) {
  const embed = new EmbedBuilder()
    .setTitle('⚔️  ГОЛДБИД РЕЙД')
    .setColor(0x5865F2);

  const dateStr = raid.scheduledAt
    ? `📅 <t:${Math.floor(new Date(raid.scheduledAt).getTime() / 1000)}:F>\n`
    : '';
  const notesStr = raid.notes ? `📝 ${raid.notes}\n` : '';
  embed.setDescription(`${dateStr}${notesStr}**Статус:** ${STATUS_LABELS[raid.status] ?? raid.status}`);

  // Pumpers list
  const pumperLines = pumpers.length > 0
    ? pumpers.map(p => `${p.confirmed ? '✅' : '⬜'} <@${p.userId}>`).join('  ')
    : '_Нет памперов — первым вставай!_';
  embed.addFields({ name: `⚔️ Памперы [${pumpers.length}]`, value: pumperLines });

  // Buyer queues per raid
  for (const [raidKey, raidData] of Object.entries(LOOT_TABLE)) {
    const lines = [];
    for (const drop of raidData.drops) {
      const tokenLines = TOKEN_TYPES.map(token => {
        const queued = buyers.filter(b =>
          b.raidTarget === raidKey &&
          b.slot === drop.slot &&
          b.tokenType === token &&
          b.status === 'QUEUED'
        );
        const full = queued.length >= drop.qty;
        const indicator = full ? '✅' : `${queued.length}/${drop.qty}`;
        const names = queued.length > 0
          ? queued.map(b => b.characterName ? `<@${b.userId}> (${b.characterName})` : `<@${b.userId}>`).join(', ')
          : '—';
        return `**${token}** (${indicator}): ${names}`;
      });
      lines.push(`**${drop.label}:**\n${tokenLines.join('\n')}`);
    }
    embed.addFields({
      name: `${raidData.emoji} ${raidData.name} (${raidData.format} чел)`,
      value: lines.join('\n\n') || '—',
    });
  }

  embed.setFooter({ text: `ID: ${raid.id.slice(0, 8)}` })
    .setTimestamp(raid.createdAt);

  return embed;
}

function buildMainRows(raidId, status) {
  const open = status === 'OPEN';
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`gb_pumper_join_${raidId}`)
        .setLabel('⚔️ Я пампер')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!open),
      new ButtonBuilder()
        .setCustomId(`gb_buyer_menu_${raidId}`)
        .setLabel('💰 Заказать шмот')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!open),
    ),
  ];
}

function buildBuyerSelectRows(raidId) {
  const options = [];
  for (const [raidKey, raidData] of Object.entries(LOOT_TABLE)) {
    for (const drop of raidData.drops) {
      for (const token of TOKEN_TYPES) {
        options.push({
          label: `${raidData.emoji} ${drop.label} — ${token}`,
          description: raidData.name,
          value: `${raidKey}|${drop.slot}|${token}`,
        });
      }
    }
  }

  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`gb_buyer_select_${raidId}`)
        .setPlaceholder('Выбери вещи которые хочешь купить...')
        .setMinValues(1)
        .setMaxValues(options.length)
        .addOptions(options),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`gb_buyer_register_${raidId}`)
        .setLabel('✅ Записаться')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`gb_buyer_leave_${raidId}`)
        .setLabel('❌ Отменить запись')
        .setStyle(ButtonStyle.Danger),
    ),
  ];
}

function parseItemValue(value) {
  const [raidTarget, slot, tokenType] = value.split('|');
  return { raidTarget, slot, tokenType };
}

module.exports = {
  LOOT_TABLE, TOKEN_TYPES, NOSHOW_THRESHOLD, pendingSelections,
  buildRaidEmbed, buildMainRows, buildBuyerSelectRows, parseItemValue,
};
