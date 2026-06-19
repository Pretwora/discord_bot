const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder,
} = require('discord.js');
const { LOOT_TABLE: LOOT_TABLE_BASE } = require('../../config/lootTable');
const _ITEM_EMOJIS = (() => { try { return require('../../config/itemEmojis.json'); } catch { return {}; } })();

// Add qty=1 default to every item (qty lives in bot only, not shared config)
const LOOT_TABLE = Object.fromEntries(
  Object.entries(LOOT_TABLE_BASE).map(([k, raid]) => [k, {
    ...raid,
    items: raid.items.map(i => ({ ...i, qty: i.qty ?? 1 })),
  }])
);

const NOSHOW_THRESHOLD = 3;

const RAID_TYPES = {
  KARAZHAN:          { label: 'Каражан',            keys: ['KARAZHAN'] },
  GRUUL:             { label: 'Логово Груула',       keys: ['GRUUL'] },
  MAGTHERIDON:       { label: 'Логово Магтеридона', keys: ['MAGTHERIDON'] },
  GRUUL_MAGTHERIDON: { label: 'Груул + Магтеридон', keys: ['GRUUL', 'MAGTHERIDON'] },
};

function getRaidKeys(raidType) {
  return RAID_TYPES[raidType]?.keys ?? Object.keys(LOOT_TABLE);
}

// ── Pending selections ─────────────────────────────────────────────────────
// Key: `${raidId}:${userId}:${raidKey}_${subtype}`  subtype = all|tok|unq
const pendingSelections = new Map();

function getAllPending(raidId, userId, raidType) {
  const all = [];
  for (const raidKey of getRaidKeys(raidType)) {
    for (const sub of ['all', 'tok', 'unq']) {
      all.push(...(pendingSelections.get(`${raidId}:${userId}:${raidKey}_${sub}`) ?? []));
    }
  }
  return all;
}

function clearAllPending(raidId, userId, raidType) {
  for (const raidKey of getRaidKeys(raidType)) {
    for (const sub of ['all', 'tok', 'unq']) {
      pendingSelections.delete(`${raidId}:${userId}:${raidKey}_${sub}`);
    }
  }
}

// ── Price helpers ──────────────────────────────────────────────────────────
function getItemQty(raidTarget, slot, tokenType) {
  const item = (LOOT_TABLE[raidTarget]?.items ?? [])
    .find(i => i.slot === slot && i.tokenType === tokenType);
  return item?.qty ?? 1;
}

function getItemPrice(goldPrices, raidTarget, slot, tokenType) {
  const key = `${raidTarget}|${slot}|${tokenType}`;
  if (goldPrices && goldPrices[key] != null) return goldPrices[key];
  const item = (LOOT_TABLE[raidTarget]?.items ?? [])
    .find(i => i.slot === slot && i.tokenType === tokenType);
  return item?.defaultPrice ?? 0;
}

function fmtPrice(p) {
  return Number(p).toLocaleString('ru-RU') + ' зл';
}

function parseItemValue(value) {
  const [raidTarget, slot, tokenType] = value.split('|');
  return { raidTarget, slot, tokenType };
}

// ── Embed ──────────────────────────────────────────────────────────────────
const STATUS_LABELS = {
  OPEN:        '🟢 Запись открыта',
  LOCKED:      '🔒 Запись закрыта',
  IN_PROGRESS: '⚔️ Идёт рейд',
  COMPLETED:   '✅ Завершён',
  CANCELLED:   '❌ Отменён',
};

function buildRaidEmbed(raid, pumpers, buyers) {
  const embed = new EmbedBuilder().setTitle('⚔️  ГОЛДБИД РЕЙД').setColor(0x5865F2);

  const dateStr  = raid.scheduledAt ? `📅 <t:${Math.floor(new Date(raid.scheduledAt).getTime() / 1000)}:F>\n` : '';
  const notesStr = raid.notes ? `📝 ${raid.notes}\n` : '';
  const label    = RAID_TYPES[raid.raidType]?.label ?? raid.raidType ?? '';
  const priceStr = raid.slotPrice != null ? `\n> # 💰 ${raid.slotPrice.toLocaleString()} золота за токен\n` : '';
  const extraStr = raid.extraText ? `\n${raid.extraText}\n` : '';
  embed.setDescription(`${priceStr}${dateStr}${notesStr}**Статус:** ${STATUS_LABELS[raid.status] ?? raid.status}\n**Рейд:** ${label}${extraStr}`);

  // Памперы
  if (raid.pumpersEnabled !== false) {
    const lines = pumpers.length > 0
      ? pumpers.map(p => `${p.confirmed ? '✅' : '⬜'} <@${p.userId}>`).join('  ')
      : '_Нет памперов — первым вставай!_';
    embed.addFields({ name: `⚔️ Памперы [${pumpers.length}]`, value: lines });
  }

  for (const raidKey of getRaidKeys(raid.raidType)) {
    const raidData = LOOT_TABLE[raidKey];
    if (!raidData) continue;

    const tokenItems  = raidData.items.filter(i => i.tokenType !== 'UNIQUE');
    const uniqueItems = raidData.items.filter(i => i.tokenType === 'UNIQUE');

    // Group token items by section
    const bySec = {};
    for (const item of tokenItems) {
      if (!bySec[item.section]) bySec[item.section] = [];
      const queued = buyers.filter(b =>
        b.raidTarget === raidKey && b.slot === item.slot &&
        b.tokenType === item.tokenType && b.status === 'QUEUED',
      );
      const ind   = queued.length >= item.qty ? '✅' : `${queued.length}/${item.qty}`;
      const names = queued.length > 0
        ? queued.map(b => b.characterName ? `<@${b.userId}> (${b.characterName})` : `<@${b.userId}>`).join(', ')
        : '—';
      bySec[item.section].push(`**${item.tokenType}** (${ind}): ${names}`);
    }

    const tokenValue = Object.entries(bySec)
      .map(([sec, lines]) => `**${sec}:**\n${lines.join('\n')}`).join('\n\n');
    embed.addFields({ name: `${raidData.emoji} ${raidData.name} (${raidData.format} чел)`, value: tokenValue || '—' });

    // Unique buyers (only show items that have at least 1 buyer)
    const uniqueBuyers = buyers.filter(b =>
      b.raidTarget === raidKey && b.tokenType === 'UNIQUE' && b.status === 'QUEUED',
    );
    if (uniqueBuyers.length > 0) {
      const lines = uniqueItems
        .filter(item => uniqueBuyers.some(b => b.slot === item.slot))
        .map(item => {
          const names = uniqueBuyers
            .filter(b => b.slot === item.slot)
            .map(b => b.characterName ? `<@${b.userId}> (${b.characterName})` : `<@${b.userId}>`).join(', ');
          return `🔸 **${item.label}**: ${names}`;
        });
      if (lines.length) {
        embed.addFields({ name: `🏆 Уники — ${raidData.name}`, value: lines.join('\n') });
      }
    }
  }

  embed.setFooter({ text: `ID: ${raid.id.slice(0, 8)}` }).setTimestamp(raid.createdAt);
  return embed;
}

// ── Main action buttons ────────────────────────────────────────────────────
function buildMainRows(raidId, status, pumpersEnabled = true) {
  const open = status === 'OPEN';
  const btns = [];
  if (pumpersEnabled) {
    btns.push(
      new ButtonBuilder()
        .setCustomId(`gb_pumper_join_${raidId}`)
        .setLabel('⚔️ Я пампер')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!open),
    );
  }
  btns.push(
    new ButtonBuilder()
      .setCustomId(`gb_buyer_menu_${raidId}`)
      .setLabel('💰 Заказать предмет')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!open),
  );
  return [new ActionRowBuilder().addComponents(...btns)];
}

// ── Buyer select rows ──────────────────────────────────────────────────────
// CustomId: `gb_buyer_sel_${raidId}_${raidKey}_${subtype}`
// subtype: 'all' (≤25 items combined), 'tok' (tokens), 'unq' (uniques)
function buildBuyerSelectRows(raidId, raidType = 'GRUUL_MAGTHERIDON', goldPrices = {}) {
  const rows = [];

  for (const raidKey of getRaidKeys(raidType)) {
    const raidData = LOOT_TABLE[raidKey];
    if (!raidData) continue;

    const tokens  = raidData.items.filter(i => i.tokenType !== 'UNIQUE');
    const uniques = raidData.items.filter(i => i.tokenType === 'UNIQUE');

    const makeOpt = (item) => {
      const emojiKey = `${raidKey}|${item.slot}|${item.tokenType}`;
      const emoji = _ITEM_EMOJIS[emojiKey];
      return {
        label: `${item.label} — ${fmtPrice(getItemPrice(goldPrices, raidKey, item.slot, item.tokenType))}`,
        description: `${raidData.name} • ${item.tokenType === 'UNIQUE' ? '🏆 Уникальный' : '🎖️ Токен'}`,
        value: emojiKey,
        ...(emoji ? { emoji: { id: emoji.id, name: emoji.name } } : {}),
      };
    };

    if (tokens.length + uniques.length <= 25) {
      // All fits in one select
      rows.push(new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`gb_buyer_sel_${raidId}_${raidKey}_all`)
          .setPlaceholder(`${raidData.emoji} ${raidData.name} — выбери предметы`)
          .setMinValues(1).setMaxValues(tokens.length + uniques.length)
          .addOptions(raidData.items.map(makeOpt)),
      ));
    } else {
      // Split tokens + uniques
      if (tokens.length) {
        rows.push(new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`gb_buyer_sel_${raidId}_${raidKey}_tok`)
            .setPlaceholder(`${raidData.emoji} ${raidData.name} — токены`)
            .setMinValues(1).setMaxValues(tokens.length)
            .addOptions(tokens.map(makeOpt)),
        ));
      }
      if (uniques.length) {
        rows.push(new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`gb_buyer_sel_${raidId}_${raidKey}_unq`)
            .setPlaceholder(`${raidData.emoji} ${raidData.name} — уникальные предметы`)
            .setMinValues(1).setMaxValues(uniques.length)
            .addOptions(uniques.map(makeOpt)),
        ));
      }
    }
  }

  // Confirm / Cancel
  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`gb_buyer_register_${raidId}`)
      .setLabel('✅ Записаться')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`gb_buyer_leave_${raidId}`)
      .setLabel('❌ Отменить запись')
      .setStyle(ButtonStyle.Danger),
  ));

  return rows;
}

module.exports = {
  LOOT_TABLE, RAID_TYPES, NOSHOW_THRESHOLD,
  pendingSelections, getAllPending, clearAllPending,
  getItemQty, getItemPrice, fmtPrice,
  buildRaidEmbed, buildMainRows, buildBuyerSelectRows, parseItemValue,
  getRaidKeys,
};
