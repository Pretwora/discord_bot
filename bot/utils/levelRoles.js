const logger = require('../../config/logger');

// Level → role ID thresholds (ascending)
const LEVEL_ROLES = [
  { level: 3,  id: process.env.ROLE_РОСТОК },
  { level: 7,  id: process.env.ROLE_АКТИВНЫЙ },
  { level: 12, id: process.env.ROLE_ВЕТЕРАН },
  { level: 17, id: process.env.ROLE_ИЗБРАННЫЙ },
  { level: 20, id: process.env.ROLE_ЛЕГЕНДА },
];

// Assign all earned roles, remove unearned ones
async function syncLevelRoles(guildMember, level) {
  for (const { level: threshold, id } of LEVEL_ROLES) {
    if (!id) continue;
    try {
      if (level >= threshold) {
        if (!guildMember.roles.cache.has(id)) {
          await guildMember.roles.add(id);
          logger.info(`Assigned level role ${id} to ${guildMember.user.tag}`);
        }
      } else {
        if (guildMember.roles.cache.has(id)) {
          await guildMember.roles.remove(id);
        }
      }
    } catch (err) {
      logger.error(`Level role sync error (${id}): ${err.message}`);
    }
  }
}

module.exports = { syncLevelRoles, LEVEL_ROLES };
