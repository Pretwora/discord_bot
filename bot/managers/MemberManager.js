const prisma = require('../../config/database');
const logger = require('../../config/logger');

class MemberManager {
  constructor(guild) {
    this.guild = guild;
  }

  async list({ limit = 50, after } = {}) {
    const members = await this.guild.members.list({ limit, after });
    return members.map(m => ({
      id: m.id,
      username: m.user.tag,
      nickname: m.nickname,
      avatar: m.user.displayAvatarURL(),
      roles: m.roles.cache.filter(r => r.name !== '@everyone').map(r => ({ id: r.id, name: r.name, color: r.hexColor })),
      joinedAt: m.joinedAt,
      status: m.presence?.status || 'offline',
    }));
  }

  async kick(userId, reason = 'Kicked via dashboard') {
    const member = await this.guild.members.fetch(userId);
    await member.kick(reason);
    logger.info(`Member kicked: ${member.user.tag} — ${reason}`);
    return true;
  }

  async ban(userId, { reason = 'Banned via dashboard', deleteMessageDays = 0 } = {}) {
    await this.guild.members.ban(userId, { reason, deleteMessageSeconds: deleteMessageDays * 86400 });
    logger.info(`Member banned: ${userId} — ${reason}`);
    return true;
  }

  async setNickname(userId, nickname) {
    const member = await this.guild.members.fetch(userId);
    await member.setNickname(nickname);
    return true;
  }
}

module.exports = MemberManager;
