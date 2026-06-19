// Shared loot table — used by both bot and API
const _ITEM_ICONS = (() => {
  try { return require('./itemIcons.json'); } catch { return {}; }
})();

const LOOT_TABLE_RAW = {
  KARAZHAN: {
    name: 'Каражан', emoji: '🏰', format: 10,
    items: [
      { slot: 'GLOVES',      tokenType: 'ПРШ',    label: 'ПРШ перчатки',                        section: 'Перчатки',       defaultPrice: 80000 },
      { slot: 'GLOVES',      tokenType: 'ВЖД',    label: 'ВЖД перчатки',                        section: 'Перчатки',       defaultPrice: 80000 },
      { slot: 'GLOVES',      tokenType: 'ОРМЧ',   label: 'ОРМЧ перчатки',                       section: 'Перчатки',       defaultPrice: 80000 },
      { slot: 'HEAD',        tokenType: 'ПРШ',    label: 'ПРШ голова',                          section: 'Голова',         defaultPrice: 80000 },
      { slot: 'HEAD',        tokenType: 'ВЖД',    label: 'ВЖД голова',                          section: 'Голова',         defaultPrice: 80000 },
      { slot: 'HEAD',        tokenType: 'ОРМЧ',   label: 'ОРМЧ голова',                         section: 'Голова',         defaultPrice: 80000 },
      { slot: 'NIGHTDOOM',   tokenType: 'UNIQUE', label: 'Убийство Ночной Погибели',            section: 'Уникальный',     defaultPrice: 10000 },
    ],
  },
  GRUUL: {
    name: 'Логово Груула', emoji: '🐉', format: 25,
    items: [
      { slot: 'SHOULDERS',        tokenType: 'ПРШ',    label: 'ПРШ плечи (Короли)',                  section: 'Плечи',             defaultPrice: 100000 },
      { slot: 'SHOULDERS',        tokenType: 'ВЖД',    label: 'ВЖД плечи (Короли)',                  section: 'Плечи',             defaultPrice: 100000 },
      { slot: 'SHOULDERS',        tokenType: 'ОРМЧ',   label: 'ОРМЧ плечи (Короли)',                 section: 'Плечи',             defaultPrice: 100000 },
      { slot: 'LEGS',             tokenType: 'ПРШ',    label: 'ПРШ ноги (Груул)',                    section: 'Ноги',              defaultPrice: 100000 },
      { slot: 'LEGS',             tokenType: 'ВЖД',    label: 'ВЖД ноги (Груул)',                    section: 'Ноги',              defaultPrice: 100000 },
      { slot: 'LEGS',             tokenType: 'ОРМЧ',   label: 'ОРМЧ ноги (Груул)',                   section: 'Ноги',              defaultPrice: 100000 },
      { slot: 'HAMMER_NAARU',     tokenType: 'UNIQUE', label: 'Молот наару',                         section: 'Уники — Короли',    defaultPrice: 15000 },
      { slot: 'BLADE_DESTROYER',  tokenType: 'UNIQUE', label: 'Гравированное лезвие уничтожителя',   section: 'Уники — Короли',    defaultPrice: 7500  },
      { slot: 'MAULGAR_HELM',     tokenType: 'UNIQUE', label: 'Боевой шлем Молгара',                 section: 'Уники — Короли',    defaultPrice: 5000  },
      { slot: 'SHADOW_MASK',      tokenType: 'UNIQUE', label: 'Пагубная маска Теней',                section: 'Уники — Короли',    defaultPrice: 5000  },
      { slot: 'OGRE_CLOAK',       tokenType: 'UNIQUE', label: 'Воинский плащ огров-магов',           section: 'Уники — Короли',    defaultPrice: 5000  },
      { slot: 'STONEGRIP_BRACERS',tokenType: 'UNIQUE', label: 'Поручи Камнегоров',                   section: 'Уники — Короли',    defaultPrice: 5000  },
      { slot: 'DIVINE_BELT',      tokenType: 'UNIQUE', label: 'Пояс божественного вдохновения',      section: 'Уники — Короли',    defaultPrice: 5000  },
      { slot: 'GRONN_AXE',        tokenType: 'UNIQUE', label: 'Топор лордов Гронна',                 section: 'Уники — Груул',     defaultPrice: 15000 },
      { slot: 'BLOOD_BLADE',      tokenType: 'UNIQUE', label: 'Магический клинок Кровавой утробы',   section: 'Уники — Груул',     defaultPrice: 15000 },
      { slot: 'DISBELIEF',        tokenType: 'UNIQUE', label: 'Сюрикен Неверия',                     section: 'Уники — Груул',     defaultPrice: 5000  },
      { slot: 'ALDORI_SHIELD',    tokenType: 'UNIQUE', label: 'Наследная защита Алдори',             section: 'Уники — Груул',     defaultPrice: 5000  },
      { slot: 'CHOGALL_COLLAR',   tokenType: 'UNIQUE', label: "Воротник Чо'галла",                   section: 'Уники — Груул',     defaultPrice: 5000  },
      { slot: 'NATURE_HELM',      tokenType: 'UNIQUE', label: 'Клобук дыхания природы',              section: 'Уники — Груул',     defaultPrice: 5000  },
      { slot: 'GRUUL_TEETH',      tokenType: 'UNIQUE', label: 'Зубы Груула',                         section: 'Уники — Груул',     defaultPrice: 5000  },
      { slot: 'DRAGON_GLOVES',    tokenType: 'UNIQUE', label: 'Рукавицы истребления драконов',       section: 'Уники — Груул',     defaultPrice: 5000  },
      { slot: 'WAR_GLOVES',       tokenType: 'UNIQUE', label: 'Рукавицы военного совершенства',      section: 'Уники — Груул',     defaultPrice: 5000  },
      { slot: 'GRONN_BELT',       tokenType: 'UNIQUE', label: 'Прошитый Гронном ремень',             section: 'Уники — Груул',     defaultPrice: 5000  },
      { slot: 'WINDCUTTER_BOOTS', tokenType: 'UNIQUE', label: 'Сапоги Ветрорезов',                   section: 'Уники — Груул',     defaultPrice: 5000  },
      { slot: 'GRUUL_EYE',        tokenType: 'UNIQUE', label: 'Глаз Груула',                         section: 'Уники — Груул',     defaultPrice: 5000  },
      { slot: 'DRAGONSPINE',      tokenType: 'UNIQUE', label: 'Трофей из драконьего хребта',         section: 'Уники — Груул',     defaultPrice: 5000  },
      { slot: 'RAPTOR_AXE',       tokenType: 'UNIQUE', label: 'Топор с перьями раптора',             section: 'Уники — Груул',     defaultPrice: 7500  },
    ],
  },
  MAGTHERIDON: {
    name: 'Логово Магтеридона', emoji: '🔥', format: 25,
    items: [
      { slot: 'CHEST',             tokenType: 'ПРШ',    label: 'ПРШ нагрудник',                      section: 'Нагрудник',   defaultPrice: 100000 },
      { slot: 'CHEST',             tokenType: 'ВЖД',    label: 'ВЖД нагрудник',                      section: 'Нагрудник',   defaultPrice: 100000 },
      { slot: 'CHEST',             tokenType: 'ОРМЧ',   label: 'ОРМЧ нагрудник',                     section: 'Нагрудник',   defaultPrice: 100000 },
      { slot: 'CRYSTAL_STAFF',     tokenType: 'UNIQUE', label: 'Вибрирующий посох Хрустального сердца', section: 'Уники',    defaultPrice: 15000 },
      { slot: 'ABYSS_GLAIVE',      tokenType: 'UNIQUE', label: 'Глефа бездны',                       section: 'Уники',       defaultPrice: 10000 },
      { slot: 'EREDAR_WAND',       tokenType: 'UNIQUE', label: 'Уничтожающий жезл Эредара',          section: 'Уники',       defaultPrice: 5000  },
      { slot: 'KARABOR_TALISMAN',  tokenType: 'UNIQUE', label: 'Кaраборский талисман',               section: 'Уники',       defaultPrice: 5000  },
      { slot: 'AEGIS',             tokenType: 'UNIQUE', label: 'Эгида охранника',                    section: 'Уники',       defaultPrice: 5000  },
      { slot: 'THUNDER_HELM',      tokenType: 'UNIQUE', label: 'Громовой великий шлем',              section: 'Уники',       defaultPrice: 5000  },
      { slot: 'ABYSS_CLOAK',       tokenType: 'UNIQUE', label: 'Плащ Покорителя Бездны',            section: 'Уники',       defaultPrice: 5000  },
      { slot: 'SOUL_EATER_BINDS',  tokenType: 'UNIQUE', label: 'Повязки пожирателя душ',            section: 'Уники',       defaultPrice: 5000  },
      { slot: 'FORKED_TONGUE',     tokenType: 'UNIQUE', label: 'Перчатки Лживого языка',            section: 'Уники',       defaultPrice: 5000  },
      { slot: 'NIGHTMARE_BELT',    tokenType: 'UNIQUE', label: 'Ремень Кошмарной Бездны',           section: 'Уники',       defaultPrice: 5000  },
      { slot: 'VOID_BELT',         tokenType: 'UNIQUE', label: 'Ремень алчущей пучины',             section: 'Уники',       defaultPrice: 5000  },
      { slot: 'MAGTH_EYE',         tokenType: 'UNIQUE', label: 'Глаз Маггтеридона',                 section: 'Уники',       defaultPrice: 10000 },
      { slot: 'MAGTH_HEAD',        tokenType: 'UNIQUE', label: 'Голова Маггтеридона',               section: 'Уники',       defaultPrice: 10000 },
      { slot: 'CORRUPTED_OPPRESSOR',tokenType:'UNIQUE', label: 'Оскверненный угнетатель',           section: 'Уники',       defaultPrice: 15000 },
    ],
  },
};

// Merge icons into items
const LOOT_TABLE = Object.fromEntries(
  Object.entries(LOOT_TABLE_RAW).map(([raidKey, raid]) => [raidKey, {
    ...raid,
    items: raid.items.map(item => ({
      ...item,
      icon: _ITEM_ICONS[`${raidKey}|${item.slot}|${item.tokenType}`] ?? null,
    })),
  }])
);

module.exports = { LOOT_TABLE };
