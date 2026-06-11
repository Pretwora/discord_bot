const prisma = require('../../config/database');
const logger = require('../../config/logger');

class RoleManager {
  constructor(guild) {
    this.guild = guild;
  }

  async create({ name, color = '#000000', permissions = 0n, hoist = false, mentionable = false }) {
    const role = await this.guild.roles.create({
      name,
      color,
      permissions,
      hoist,
      mentionable,
    });

    await prisma.role.create({
      data: {
        id: role.id,
        guildId: this.guild.id,
        name,
        color,
        permissions: permissions.toString(),
        hoist,
        mentionable,
        position: role.position,
      },
    }).catch(err => logger.warn(`Role DB sync failed (Discord role was created): ${err.message}`));

    logger.info(`Role created: @${name} on ${this.guild.name}`);
    return role;
  }

  async delete(roleId) {
    const role = this.guild.roles.cache.get(roleId);
    if (!role) throw new Error(`Role ${roleId} not found`);

    await role.delete();
    await prisma.role.delete({ where: { id: roleId } }).catch(() => {});

    logger.info(`Role deleted: ${roleId}`);
    return true;
  }

  async assign(userId, roleId) {
    const member = await this.guild.members.fetch(userId);
    const role = this.guild.roles.cache.get(roleId);
    if (!role) throw new Error(`Role ${roleId} not found`);

    await member.roles.add(role);
    logger.info(`Role @${role.name} assigned to ${member.user.tag}`);
    return true;
  }

  async remove(userId, roleId) {
    const member = await this.guild.members.fetch(userId);
    const role = this.guild.roles.cache.get(roleId);
    if (!role) throw new Error(`Role ${roleId} not found`);

    await member.roles.remove(role);
    logger.info(`Role @${role.name} removed from ${member.user.tag}`);
    return true;
  }

  async list() {
    return this.guild.roles.cache
      .filter(r => r.name !== '@everyone')
      .map(r => ({
        id: r.id,
        name: r.name,
        color: r.hexColor,
        position: r.position,
        hoist: r.hoist,
        mentionable: r.mentionable,
        memberCount: r.members.size,
      }))
      .sort((a, b) => b.position - a.position);
  }
}

module.exports = RoleManager;
