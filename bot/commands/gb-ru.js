const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const base = require('./gb');

// Identical to /gb but registered as /гб for Russian keyboard users
const data = new SlashCommandBuilder()
  .setName('гб')
  .setDescription('Голдбид рейды')
  .addSubcommand(s => s
    .setName('create')
    .setDescription('Создать анонс голдбид рейда')
    .addStringOption(o => o
      .setName('type')
      .setDescription('Тип рейда')
      .setRequired(true)
      .addChoices(
        { name: 'Груул + Магтеридон (25 чел)', value: 'GRUUL_MAGTHERIDON' },
        { name: 'Каражан (10 чел)',             value: 'KARAZHAN' },
        { name: 'Логово Груула (25 чел)',        value: 'GRUUL' },
        { name: 'Логово Магтеридона (25 чел)',   value: 'MAGTHERIDON' },
      ),
    )
    .addIntegerOption(o => o.setName('price').setDescription('Цена за одну вещь (золото)').setRequired(false).setMinValue(0))
    .addBooleanOption(o => o.setName('pumpers').setDescription('Набор памперов (по умолчанию: да)').setRequired(false))
    .addStringOption(o => o.setName('notes').setDescription('Примечание (дата, время и т.д.)').setRequired(false)),
  )
  .addSubcommand(s => s
    .setName('lock')
    .setDescription('Закрыть запись в рейд')
    .addStringOption(o => o.setName('id').setDescription('ID рейда (если не указан — последний активный)').setRequired(false)),
  )
  .addSubcommand(s => s
    .setName('rollcall')
    .setDescription('Отправить перекличку участникам')
    .addStringOption(o => o.setName('id').setDescription('ID рейда').setRequired(false)),
  )
  .addSubcommand(s => s
    .setName('complete')
    .setDescription('Завершить рейд и распределить голду')
    .addIntegerOption(o => o.setName('gold').setDescription('Суммарная голда со всех баеров').setRequired(true).setMinValue(0))
    .addStringOption(o => o.setName('id').setDescription('ID рейда').setRequired(false)),
  )
  .addSubcommand(s => s
    .setName('cancel')
    .setDescription('Отменить рейд')
    .addStringOption(o => o.setName('id').setDescription('ID рейда').setRequired(false)),
  )
  .addSubcommand(s => s
    .setName('noshow')
    .setDescription('Отметить участника как не явившегося')
    .addUserOption(o => o.setName('user').setDescription('Участник').setRequired(true))
    .addStringOption(o => o.setName('id').setDescription('ID рейда').setRequired(false)),
  )
  .addSubcommand(s => s
    .setName('unblacklist')
    .setDescription('Снять бан с участника')
    .addUserOption(o => o.setName('user').setDescription('Участник').setRequired(true)),
  )
  .addSubcommand(s => s
    .setName('setup')
    .setDescription('Создать канал для голдбид анонсов (только бот и ты пишете, остальные — кнопки)')
    .addChannelOption(o => o
      .setName('channel')
      .setDescription('Существующий канал (если не указан — создаётся новый #голдбиды)')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(false),
    ),
  )
  .addSubcommand(s => s
    .setName('edit')
    .setDescription('Редактировать анонс рейда (открывает форму)')
    .addStringOption(o => o.setName('id').setDescription('ID рейда (если не указан — последний активный)').setRequired(false)),
  )
  .addSubcommand(s => s
    .setName('stats')
    .setDescription('Статистика пампера')
    .addUserOption(o => o.setName('user').setDescription('Участник (по умолч. ты)').setRequired(false)),
  );

module.exports = { data, execute: base.execute };
