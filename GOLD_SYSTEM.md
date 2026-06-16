# Система внутреннего золота — Pretwora DS

## Общая схема

```
[Игрок в WoW] → [Почта банкиру] → [Аддон читает почту] → [SavedVariables файл]
      ↑                                                              ↓
[Discord баланс]  ←←←←←←←←←←←←←←←←←←←←←←←  [Companion App на ПК]
      ↓
[Лотерея / Голдбид / Будущие фичи]
```

---

## Шаг 0 — Привязка персонажа к Discord аккаунту

### Проблема
Аддон видит что пришло золото от персонажа `Fexler`. Но бот не знает какой Discord аккаунт
это. Нужна регистрация.

### Решение — команда `/привязать` в Discord

Игрок один раз пишет в Discord:
```
/привязать Имяперсонажа x3
```

Бот сохраняет в БД:
```
discord_id: 267506627484057600
character_name: "Fexler"
realm: "x3"
verified: false
```

**Но как проверить что это реально его персонаж а не чужой?**

Верификация через уникальный код:
1. Бот генерирует короткий код, например `DS-4829`
2. Бот отвечает: *"Отправь любое письмо банкиру `Казначей` с темой `DS-4829` — после этого
   персонаж будет привязан"*
3. Аддон на банкире видит входящее письмо с темой `DS-4829` от `Fexler`
4. Companion App отправляет на наш сервер: `{ code: "DS-4829", character: "Fexler" }`
5. Бот находит в БД кому выдан этот код → привязывает `Fexler` к Discord аккаунту
6. `verified: true`

После этого любое золото от `Fexler` → автоматически идёт на баланс владельца аккаунта.

### Что хранится в БД

```sql
-- Таблица привязок
characters (
  id            -- autoincrement
  discord_id    -- Discord user ID
  character_name -- "Fexler"
  realm         -- "x3", "x1", "x5"
  verified      -- true/false
  verify_code   -- "DS-4829" (удаляется после верификации)
  created_at
)

-- Таблица баланса
gold_balance (
  discord_id    -- Discord user ID (уникальный)
  amount        -- сколько золота на балансе (в медных = gold*10000 + silver*100 + copper)
  total_deposited -- всего внесено за всё время
  updated_at
)

-- Таблица транзакций (история)
gold_transactions (
  id
  discord_id
  type          -- "deposit" / "lottery_ticket" / "goldbid" / "withdrawal" / "win"
  amount        -- в медных, положительное или отрицательное
  description   -- "Депозит от Fexler (x3)" / "Билет лотереи #1042" / ...
  created_at
)
```

---

## Шаг 1 — WoW Аддон

### Что делает аддон

Аддон запускается на ПК где залогинен персонаж-банкир. Он:
1. При входе в игру (и при `/reload`) — сканирует входящую почту
2. Для каждого письма с золотом — записывает в SavedVariables
3. Для писем с темой `DS-XXXX` — записывает как запрос верификации

### Структура аддона

```
WoW/Interface/AddOns/PretworaBank/
  PretworaBank.toc     -- метаданные аддона
  PretworaBank.lua     -- основная логика
```

**PretworaBank.toc**
```
## Interface: 30300
## Title: PretworaBank
## Notes: Банк Pretwora DS — синхронизация с Discord
## SavedVariables: PretworaBankDB

PretworaBank.lua
```

**PretworaBank.lua**
```lua
-- Инициализация базы данных аддона
PretworaBankDB = PretworaBankDB or {
    transactions = {},
    verifications = {},
    lastScan = 0,
    exported = {}  -- ID уже отправленных транзакций чтобы не дублировать
}

local ADDON_NAME = "PretworaBank"
local BANKER_NAME = "Казначей"  -- имя персонажа-банкира

local frame = CreateFrame("Frame")
frame:RegisterEvent("PLAYER_LOGIN")
frame:RegisterEvent("MAIL_INBOX_UPDATE")

frame:SetScript("OnEvent", function(self, event)
    if event == "PLAYER_LOGIN" or event == "MAIL_INBOX_UPDATE" then
        -- Сканировать только если мы на банкире
        if UnitName("player") ~= BANKER_NAME then return end
        C_Timer.After(2, ScanMail)  -- небольшая задержка для загрузки почты
    end
end)

function ScanMail()
    local numItems = GetInboxNumItems()
    
    for i = 1, numItems do
        local _, _, sender, subject, money, _, _, _, _, _, _, _, _, _ = GetInboxHeaderInfo(i)
        
        if not sender then goto continue end
        
        local timestamp = time()
        local txId = sender .. "_" .. timestamp .. "_" .. (money or 0)
        
        -- Пропустить уже обработанные
        if PretworaBankDB.exported[txId] then goto continue end
        
        -- Верификационное письмо (тема начинается с DS-)
        if subject and subject:match("^DS%-%d+$") then
            local entry = {
                type = "verification",
                code = subject,           -- "DS-4829"
                character = sender,
                realm = GetRealmName(),
                timestamp = timestamp,
                id = txId
            }
            table.insert(PretworaBankDB.verifications, entry)
            PretworaBankDB.exported[txId] = true
            
        -- Письмо с золотом (money > 0)
        elseif money and money > 0 then
            local entry = {
                type = "deposit",
                character = sender,       -- "Fexler"
                realm = GetRealmName(),   -- "Neverest" (x3)
                amount = money,           -- в медных: 1 золото = 10000
                subject = subject or "",
                timestamp = timestamp,
                id = txId
            }
            table.insert(PretworaBankDB.transactions, entry)
            PretworaBankDB.exported[txId] = true
        end
        
        ::continue::
    end
    
    PretworaBankDB.lastScan = time()
    DEFAULT_CHAT_FRAME:AddMessage("|cff00ff00[PretworaBank]|r Сканирование завершено. Записей: " .. #PretworaBankDB.transactions)
end

-- Slash-команда для ручного сканирования
SLASH_PRETWORABANK1 = "/bank"
SlashCmdList["PRETWORABANK"] = function(msg)
    ScanMail()
    DEFAULT_CHAT_FRAME:AddMessage("|cff00ff00[PretworaBank]|r Запущено сканирование почты...")
end
```

### Где хранятся данные аддона

WoW автоматически сохраняет SavedVariables при выходе из игры или `/reload`:
```
WoW/WTF/Account/ТВОЙ_АККАУНТ/SavedVariables/PretworaBank.lua
```

Это обычный текстовый Lua-файл. Companion App будет читать именно его.

---

## Шаг 2 — Companion App (Windows приложение)

### Что это такое

**Это НЕ сложное десктопное приложение.** Это простой Node.js скрипт (~150 строк) который:
- Запускается в фоне (в трее или просто в свёрнутом терминале)
- Следит за одним файлом `PretworaBank.lua`
- При изменении файла — читает новые записи и отправляет на наш API
- Работает только когда ты включил ПК и запустил его

### Почему Node.js а не exe

- Не нужно компилировать
- Ты уже знаешь Node.js (это тот же стек что и бот)
- Запускается как `node companion.js` или через bat-файл двойным кликом
- Если захочешь — можно упаковать в `.exe` через `pkg` одной командой

### Структура

```
pretwora-companion/
  companion.js       -- основной скрипт
  config.json        -- путь к WoW, API ключ
  start.bat          -- запуск двойным кликом на Windows
  package.json
```

**config.json**
```json
{
  "wowPath": "C:\\Program Files (x86)\\World of Warcraft\\_retail_",
  "savedVarsPath": "WTF\\Account\\ТВО_АККАУНТ\\SavedVariables\\PretworaBank.lua",
  "apiUrl": "https://api-production-9acc.up.railway.app",
  "apiKey": "секретный_ключ_который_знает_только_companion"
}
```

**companion.js**
```javascript
const fs = require('fs');
const path = require('path');
const https = require('https');

const config = require('./config.json');
const SAVED_VARS_PATH = path.join(config.wowPath, config.savedVarsPath);
const SENT_IDS_PATH = path.join(__dirname, 'sent_ids.json');

// Загружаем ID уже отправленных транзакций (чтобы не дублировать при перезапуске)
let sentIds = new Set();
try {
  sentIds = new Set(JSON.parse(fs.readFileSync(SENT_IDS_PATH, 'utf8')));
} catch {}

function saveSentIds() {
  fs.writeFileSync(SENT_IDS_PATH, JSON.stringify([...sentIds]));
}

// Парсит Lua SavedVariables файл (простой regex, не нужен полный Lua парсер)
function parseLuaFile(content) {
  const transactions = [];
  const verifications = [];

  // Ищем блоки транзакций
  const txMatches = content.matchAll(/\{[^}]*type = "deposit"[^}]*\}/gs);
  for (const match of txMatches) {
    const block = match[0];
    const extract = (key) => {
      const m = block.match(new RegExp(`${key} = "([^"]+)"`));
      return m ? m[1] : null;
    };
    const extractNum = (key) => {
      const m = block.match(new RegExp(`${key} = (\\d+)`));
      return m ? parseInt(m[1]) : null;
    };
    transactions.push({
      id: extract('id'),
      character: extract('character'),
      realm: extract('realm'),
      amount: extractNum('amount'),
      subject: extract('subject'),
      timestamp: extractNum('timestamp'),
    });
  }

  // Ищем блоки верификации
  const verMatches = content.matchAll(/\{[^}]*type = "verification"[^}]*\}/gs);
  for (const match of verMatches) {
    const block = match[0];
    const extract = (key) => {
      const m = block.match(new RegExp(`${key} = "([^"]+)"`));
      return m ? m[1] : null;
    };
    verifications.push({
      id: extract('id'),
      code: extract('code'),
      character: extract('character'),
      realm: extract('realm'),
    });
  }

  return { transactions, verifications };
}

// Отправляет данные на наш API
async function sendToApi(endpoint, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const url = new URL(config.apiUrl + endpoint);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'X-Companion-Key': config.apiKey,
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function processFile() {
  if (!fs.existsSync(SAVED_VARS_PATH)) {
    console.log('[!] Файл SavedVariables не найден:', SAVED_VARS_PATH);
    return;
  }

  const content = fs.readFileSync(SAVED_VARS_PATH, 'utf8');
  const { transactions, verifications } = parseLuaFile(content);

  // Обрабатываем верификации
  for (const ver of verifications) {
    if (!ver.id || sentIds.has(ver.id)) continue;
    try {
      const res = await sendToApi('/api/gold/verify', ver);
      if (res.status === 200) {
        sentIds.add(ver.id);
        console.log(`[✓] Верификация: ${ver.character} → код ${ver.code}`);
      }
    } catch (e) {
      console.error('[!] Ошибка верификации:', e.message);
    }
  }

  // Обрабатываем транзакции
  for (const tx of transactions) {
    if (!tx.id || sentIds.has(tx.id)) continue;
    try {
      const res = await sendToApi('/api/gold/deposit', tx);
      if (res.status === 200) {
        sentIds.add(tx.id);
        const gold = Math.floor(tx.amount / 10000);
        console.log(`[✓] Депозит: ${tx.character} → ${gold}g`);
      }
    } catch (e) {
      console.error('[!] Ошибка депозита:', e.message);
    }
  }

  saveSentIds();
}

// Запуск: сразу обрабатываем файл, потом следим за изменениями
console.log('[PretworaBank Companion] Запущен. Слежу за:', SAVED_VARS_PATH);
processFile();

fs.watch(SAVED_VARS_PATH, (eventType) => {
  if (eventType === 'change') {
    console.log('[~] Файл изменился, обрабатываю...');
    setTimeout(processFile, 1000); // небольшая задержка чтобы WoW закончил запись
  }
});
```

**start.bat** (двойной клик → запустилось в фоне)
```bat
@echo off
echo PretworaBank Companion запускается...
node companion.js
pause
```

### Когда запускать

- Запускаешь companion перед тем как логинишься на банкира
- Заходишь в игру, открываешь почту (или пишешь `/bank`)
- WoW сохраняет SavedVariables при `/reload` или выходе
- Companion видит изменение файла → отправляет данные → ждёт следующего раза

**Не нужно держать онлайн 24/7.** Достаточно раз в день зайти на банкира на 2-3 минуты.

---

## Шаг 3 — API эндпоинты (на нашем сервере)

Два новых маршрута в `api/`:

### POST `/api/gold/verify`
Принимает верификационный запрос от companion:
```json
{
  "code": "DS-4829",
  "character": "Fexler",
  "realm": "x3"
}
```
Логика:
1. Находит в БД запись с `verify_code = "DS-4829"`
2. Убеждается что `character` совпадает с тем что написал игрок при `/привязать`
3. Помечает `verified = true`, удаляет код
4. Отправляет игроку личное сообщение в Discord: *"✅ Персонаж Fexler (x3) привязан!"*

### POST `/api/gold/deposit`
Принимает транзакцию:
```json
{
  "character": "Fexler",
  "realm": "x3",
  "amount": 500000,
  "timestamp": 1760081575,
  "id": "Fexler_1760081575_500000"
}
```
Логика:
1. Находит `characters` где `character_name = "Fexler"` и `realm = "x3"` и `verified = true`
2. Получает `discord_id` владельца
3. Добавляет к `gold_balance.amount`
4. Записывает в `gold_transactions`
5. Отправляет DM в Discord: *"💰 Получено 50g от Fexler (x3). Баланс: 50g 0s 0c"*

### Безопасность
Оба эндпоинта проверяют заголовок `X-Companion-Key` — секретный ключ известный только companion.
Без него запрос отклоняется. Ключ хранится в `.env` на Railway.

---

## Шаг 4 — Discord команды и баланс

Золото зачислено на баланс. Игрок сам решает что с ним делать.

### `/баланс`
Показывает текущий баланс и историю последних транзакций:
```
💰 Твой баланс: 150g 30s 0c
━━━━━━━━━━━━━━━━━━━━━
📥 +50g  Депозит от Fexler (x3)       сегодня 14:32
📥 +100g Депозит от Fexler (x3)       вчера 20:15
━━━━━━━━━━━━━━━━━━━━━
Персонажи: Fexler (x3) ✅
```

### `/привязать <имя> <реалм>`
Начинает процесс привязки персонажа. Бот выдаёт код верификации.

### `/отвязать <имя>`
Удаляет привязку персонажа.

### Будущие команды (когда будет готово)
- `/лотерея купить <кол-во билетов>` — покупает билеты лотереи из баланса
- `/голдбид взнос <сумма>` — регистрирует участие в голдбид рейде

---

## Шаг 5 — Лотерея (Discord)

### Механика

**Создание лотереи** (только модераторы):
- `/лотерея создать` — открывает приём билетов
- Стоимость билета задаётся в настройках (например 10g)
- Бот постит embed в специальный канал с кнопкой "🎟 Купить билет"

**Покупка билета:**
1. Игрок нажимает кнопку или пишет `/лотерея купить`
2. Бот списывает золото с баланса
3. Выдаёт билет с уникальным ID (например `#1042`)
4. Записывает в БД: `{ ticket_id: 1042, discord_id: ..., lottery_id: ... }`

**Розыгрыш (автоматически в воскресенье 20:00):**
1. Берёт все билеты текущей лотереи
2. Считает общий банк = кол-во билетов × цена
3. Вычитает комиссию (например 5%)
4. Случайный выбор 3 победителей: 60% / 30% / 10%
5. Начисляет золото на баланс победителей
6. Постит результаты в канал с упоминанием победителей

### Таблицы в БД

```sql
lotteries (
  id
  status          -- "open" / "closed" / "finished"
  ticket_price    -- в медных
  commission_pct  -- процент комиссии (5)
  created_at
  ends_at         -- когда розыгрыш
)

lottery_tickets (
  id              -- уникальный номер билета #1042
  lottery_id
  discord_id
  purchased_at
)

lottery_results (
  id
  lottery_id
  place           -- 1, 2, 3
  discord_id
  ticket_id
  prize_amount    -- в медных
)
```

---

## Итоговый порядок действий для запуска

### Разовая настройка (делается один раз):
1. Установить аддон `PretworaBank` на ПК с банкиром
2. Задеплоить новые API эндпоинты на Railway
3. Настроить `companion/config.json` с путями к WoW и API ключом
4. Объявить игрокам имя персонажа-банкира

### Ежедневная процедура (2-3 минуты):
1. Запустить `start.bat` (companion)
2. Зайти в WoW на банкира
3. Открыть почту (аддон автоматически сканирует)
4. Написать `/reload` чтобы WoW сохранил SavedVariables
5. Companion видит изменение → отправляет данные → всё готово
6. Выйти из игры

### Для игроков (один раз):
1. Написать в Discord `/привязать Имяперсонажа x3`
2. Получить код `DS-XXXX`
3. Отправить любое письмо банкиру с темой `DS-XXXX`
4. Дождаться следующего сбора почты банкиром (макс. 1 день)
5. Получить подтверждение в Discord DM

---

## Технический стек

| Компонент | Технология |
|---|---|
| WoW аддон | Lua (WoW API) |
| Companion App | Node.js (без фреймворков) |
| API эндпоинты | Express.js (уже есть) |
| БД | PostgreSQL + Prisma (уже есть) |
| Discord команды | discord.js (уже есть) |
| Деплой | Railway (уже есть) |

Новый код только: аддон (Lua) + companion (~150 строк JS) + 2 API маршрута + Discord команды.
