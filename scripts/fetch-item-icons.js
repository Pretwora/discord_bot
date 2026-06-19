#!/usr/bin/env node
// Fetches item icons from Sirus API and updates itemIcons.json
const { LOOT_TABLE } = require('../config/lootTable');
const fs = require('fs');
const path = require('path');

const REALM = 'x5';
const SIRUS_SEARCH = `https://sirus.su/api/base/search/${REALM}/quick`;

// Token suffixes: ПРШ=героя, ВЖД=воителя, ОРМЧ=заступника
// Actual in-game Russian TBC token names from Sirus
const TOKEN_SEARCH_NAMES = {
  // Karazhan
  'KARAZHAN|GLOVES|ПРШ':  'Перчатки павшего героя',
  'KARAZHAN|GLOVES|ВЖД':  'Перчатки павшего воителя',
  'KARAZHAN|GLOVES|ОРМЧ': 'Перчатки павшего заступника',
  'KARAZHAN|HEAD|ПРШ':    'Шлем павшего героя',
  'KARAZHAN|HEAD|ВЖД':    'Шлем павшего воителя',
  'KARAZHAN|HEAD|ОРМЧ':   'Шлем павшего заступника',
  // Gruul
  'GRUUL|SHOULDERS|ПРШ':  'Наплечье павшего героя',
  'GRUUL|SHOULDERS|ВЖД':  'Наплечье павшего воителя',
  'GRUUL|SHOULDERS|ОРМЧ': 'Наплечье павшего заступника',
  'GRUUL|LEGS|ПРШ':       'Поножи павшего героя',
  'GRUUL|LEGS|ВЖД':       'Поножи павшего воителя',
  'GRUUL|LEGS|ОРМЧ':      'Поножи павшего заступника',
  // Magtheridon
  'MAGTHERIDON|CHEST|ПРШ':  'Нагрудный доспех павшего героя',
  'MAGTHERIDON|CHEST|ВЖД':  'Нагрудный доспех павшего воителя',
  'MAGTHERIDON|CHEST|ОРМЧ': 'Нагрудный доспех павшего заступника',
};

async function searchItem(name, retries = 4) {
  const url = `${SIRUS_SEARCH}?search=${encodeURIComponent(name)}`;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 2000 * attempt));
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (res.status === 429) {
        console.log(`    ⏳ Rate limited, retry ${attempt + 1}/${retries}...`);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const items = data.filter(d => d.type === 'item');
      const exact = items.find(d => d.data.name === name);
      return exact || items[0] || null;
    } catch (err) {
      if (attempt === retries) throw err;
    }
  }
  return null;
}

async function main() {
  const icons = {};
  let found = 0, missing = 0;

  for (const [raidKey, raid] of Object.entries(LOOT_TABLE)) {
    console.log(`\n=== ${raid.name} ===`);
    for (const item of raid.items) {
      const lootKey = `${raidKey}|${item.slot}|${item.tokenType}`;

      const searchName = item.tokenType === 'UNIQUE'
        ? item.label
        : TOKEN_SEARCH_NAMES[lootKey];

      if (!searchName) {
        console.log(`  ⚠️  No search name for ${lootKey}`);
        missing++;
        continue;
      }

      try {
        await new Promise(r => setTimeout(r, 700));
        const result = await searchItem(searchName);
        if (result) {
          icons[lootKey] = result.data.icon;
          const match = result.data.name === searchName ? '✅' : '🔶';
          console.log(`  ${match} ${item.label} → ${result.data.name}`);
          console.log(`      ${result.data.icon}`);
          found++;
        } else {
          console.log(`  ❌ Not found: "${searchName}"`);
          missing++;
        }
      } catch (err) {
        console.log(`  ❌ Error for "${searchName}": ${err.message}`);
        missing++;
      }
    }
  }

  console.log(`\n✅ Found: ${found}, ❌ Missing: ${missing}`);

  const outPath = path.join(__dirname, '../config/itemIcons.json');
  fs.writeFileSync(outPath, JSON.stringify(icons, null, 2));
  console.log(`Saved to: ${outPath}`);
}

main().catch(console.error);
