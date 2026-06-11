# Discord Bot Project — контекст для Claude Code

## Что это
Discord бот с веб-панелью администратора для сервера Pretwora DS.

## Текущий статус
- Бот запущен и онлайн на сервере
- Slash-команды зарегистрированы (/stats, /panel, /channel, /role)
- Dashboard запущен на localhost:3000 но страницы — заглушки без UI
- Tailwind CSS подключён и работает

## Что нужно сделать сейчас
Сделать красивый UI для всех страниц dashboard в стиле Discord (тёмная тема, цвет #5865F2):
1. dashboard/src/components/Layout.jsx — сайдбар с навигацией
2. dashboard/src/pages/Overview.jsx — статистика, график, события
3. dashboard/src/pages/Channels.jsx — список каналов, создание/удаление
4. dashboard/src/pages/Roles.jsx — роли, выдача участникам
5. dashboard/src/pages/Members.jsx — список участников, модерация
6. dashboard/src/pages/AuditLog.jsx — лог действий
7. dashboard/src/pages/Settings.jsx — настройки

## Стек
- React 18 + Vite + Tailwind CSS
- Recharts для графиков
- Lucide React для иконок
- Socket.io client для realtime
- Axios для API запросов

## Структура проекта
См. файл README.md в корне проекта