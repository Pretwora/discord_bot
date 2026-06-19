#!/usr/bin/env node
// Uploads item icons as Discord custom emojis and saves emoji map to config/itemEmojis.json
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const GUILD_ID  = process.env.DISCORD_GUILD_ID;
const BOT_TOKEN = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;
const ICONS     = require('../config/itemIcons.json');

if (!GUILD_ID || !BOT_TOKEN) {
  console.error('Missing DISCORD_GUILD_ID or DISCORD_BOT_TOKEN in .env');
  process.exit(1);
}

function iconToEmojiName(iconUrl) {
  const file = iconUrl.split('/').pop().replace('.png', '').replace(/-/g, '_');
  const name = `gb_${file}`.slice(0, 32);
  // Must match /^[a-zA-Z0-9_]+$/
  return name.replace(/[^a-zA-Z0-9_]/g, '_');
}

async function fetchImageAsBase64(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = await res.arrayBuffer();
  return `data:image/png;base64,${Buffer.from(buf).toString('base64')}`;
}

async function getExistingEmojis() {
  const res = await fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/emojis`, {
    headers: { Authorization: `Bot ${BOT_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Failed to list emojis: ${res.status}`);
  return await res.json();
}

async function createEmoji(name, imageData64) {
  const res = await fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/emojis`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, image: imageData64 }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`${res.status}: ${JSON.stringify(err)}`);
  }
  return await res.json();
}

async function main() {
  // Deduplicate: icon URL → emoji name
  const urlToName = {};
  for (const iconUrl of Object.values(ICONS)) {
    if (!urlToName[iconUrl]) {
      urlToName[iconUrl] = iconToEmojiName(iconUrl);
    }
  }

  console.log(`📋 ${Object.keys(urlToName).length} unique icons to upload`);

  // Load existing emojis to avoid duplicates
  const existing = await getExistingEmojis();
  const existingByName = Object.fromEntries(existing.map(e => [e.name, e]));
  console.log(`🔍 ${existing.length} emojis already on server\n`);

  // Build emoji map: icon URL → Discord emoji string <:name:id>
  const emojiMap = {};
  let uploaded = 0, skipped = 0, failed = 0;

  for (const [iconUrl, emojiName] of Object.entries(urlToName)) {
    if (existingByName[emojiName]) {
      const e = existingByName[emojiName];
      emojiMap[iconUrl] = { id: e.id, name: e.name };
      console.log(`  ⏭️  Skip (exists): ${emojiName}`);
      skipped++;
      continue;
    }

    try {
      await new Promise(r => setTimeout(r, 500));
      console.log(`  ⬆️  Uploading: ${emojiName} ...`);
      const imageData = await fetchImageAsBase64(iconUrl);
      const emoji = await createEmoji(emojiName, imageData);
      emojiMap[iconUrl] = { id: emoji.id, name: emoji.name };
      console.log(`  ✅ Done: <:${emoji.name}:${emoji.id}>`);
      uploaded++;
    } catch (err) {
      console.log(`  ❌ Failed ${emojiName}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n✅ Uploaded: ${uploaded}, ⏭️ Skipped: ${skipped}, ❌ Failed: ${failed}`);

  // Save: item key → {id, name}
  const itemEmojis = {};
  for (const [itemKey, iconUrl] of Object.entries(ICONS)) {
    if (emojiMap[iconUrl]) {
      itemEmojis[itemKey] = emojiMap[iconUrl];
    }
  }

  const outPath = path.join(__dirname, '../config/itemEmojis.json');
  fs.writeFileSync(outPath, JSON.stringify(itemEmojis, null, 2));
  console.log(`\nSaved emoji map to: ${outPath}`);
  console.log(`Items with emoji: ${Object.keys(itemEmojis).length}`);
}

main().catch(console.error);
