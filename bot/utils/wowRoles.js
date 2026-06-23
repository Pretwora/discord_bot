const logger = require('../../config/logger');

const ROLE_DEFS = [
  { key: 'pumper',   name: 'Пампер',   color: 0xff6b35, hoist: true  },
  { key: 'buyer',    name: 'Баер',     color: 0xffd700, hoist: false },
  { key: 'wowsirus', name: 'WowSirus', color: 0x00b4d8, hoist: false },
  { key: 'rl',       name: 'РЛ',       color: 0x5865f2, hoist: true  },
];

// guildId → { pumper: roleId, buyer: roleId, wowsirus: roleId }
const cache = new Map();

async function getWowRoles(guild) {
  if (cache.has(guild.id)) return cache.get(guild.id);

  await guild.roles.fetch();
  const result = {};

  for (const { key, name, color, hoist } of ROLE_DEFS) {
    let role = guild.roles.cache.find(r => r.name === name);
    if (!role) {
      role = await guild.roles.create({ name, color, hoist, reason: 'WoW roles auto-setup' });
      logger.info(`[wowRoles] Created role "${name}" (${role.id})`);
    } else {
      if (role.hoist !== hoist) {
        await role.setHoist(hoist, 'WoW roles hoist sync');
        logger.info(`[wowRoles] Updated hoist for "${name}" → ${hoist}`);
      } else {
        logger.info(`[wowRoles] Found role "${name}" (${role.id})`);
      }
    }
    result[key] = role.id;
  }

  cache.set(guild.id, result);
  return result;
}

function invalidateWowRoleCache(guildId) {
  cache.delete(guildId);
}

module.exports = { getWowRoles, invalidateWowRoleCache };
