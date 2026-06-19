import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Bot, Shield, Star, Save, Hash,
  CheckCircle, AlertTriangle, RefreshCw, Sliders, BarChart2, ChevronDown, Sword
} from 'lucide-react';
import api from '../lib/api';

const TABS = [
  { id: 'general',    icon: Sliders,   label: 'Основные'    },
  { id: 'xp',         icon: Star,      label: 'XP и уровни' },
  { id: 'moderation', icon: Shield,    label: 'Модерация'   },
  { id: 'reports',    icon: BarChart2, label: 'Отчёты'      },
  { id: 'bot',        icon: Bot,       label: 'Бот'         },
  { id: 'goldbid',    icon: Sword,     label: 'Голдбид'     },
];

function ToggleSwitch({ checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors"
      style={{ backgroundColor: checked ? 'var(--discord-blurple)' : 'var(--discord-border)' }}
    >
      <div
        className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform"
        style={{ transform: checked ? 'translateX(20px)' : 'translateX(0)' }}
      />
    </button>
  );
}

function SettingRow({ label, description, children }) {
  return (
    <div className="flex items-start justify-between gap-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="flex-1">
        <p className="text-sm font-medium text-white">{label}</p>
        {description && <p className="text-xs mt-0.5" style={{ color: 'var(--discord-text-muted)' }}>{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function SectionHeader({ children }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider mb-2 mt-6 first:mt-0" style={{ color: 'var(--discord-text-muted)' }}>
      {children}
    </p>
  );
}

const DEFAULTS = {
  prefix: '!',
  welcomeChannelId: '',
  levelUpChannelId: '',
  xpPerMessageMin: 10,
  xpPerMessageMax: 20,
  xpCooldownSec: 60,
  xpVoicePerInterval: 10,
  xpVoiceIntervalMin: 5,
  xpVoiceMinMembers: 2,
  antiSpam: false,
  maxMentions: 5,
  maxLinks: 3,
  warnAction: 'warn',
  weeklyReportEnabled: true,
  weeklyReportChannelId: '',
  botActivity: 'Pretwora DS',
  botActivityType: 'WATCHING',
  botStatus: 'online',
};

function GoldBidTab() {
  const { data: raids = [], isLoading, refetch } = useQuery({
    queryKey: ['gold-prices'],
    queryFn: () => api.get('/api/v1/gold-raids/prices').then(r => r.data),
  });

  const [localPrices, setLocalPrices] = useState({});
  const [saved, setSaved] = useState(false);
  const [changed, setChanged] = useState(false);

  const mutation = useMutation({
    mutationFn: (prices) => api.patch('/api/v1/gold-raids/prices', { prices }),
    onSuccess: () => {
      setSaved(true);
      setChanged(false);
      setTimeout(() => setSaved(false), 2500);
      refetch();
    },
  });

  const handleChange = (key, val) => {
    const num = parseInt(val, 10);
    setLocalPrices(p => ({ ...p, [key]: isNaN(num) ? 0 : num }));
    setChanged(true);
  };

  const getPrice = (item) => {
    if (localPrices[item.key] !== undefined) return localPrices[item.key];
    return item.price;
  };

  const handleSave = () => {
    mutation.mutate(localPrices);
  };

  if (isLoading) return (
    <div className="space-y-3">
      {Array(8).fill(0).map((_, i) => (
        <div key={i} className="h-10 rounded animate-pulse" style={{ backgroundColor: 'var(--discord-border)' }} />
      ))}
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-medium text-white">Цены на предметы</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--discord-text-muted)' }}>
            Отображаются баерам при выборе предметов в рейде
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={mutation.isPending || !changed}
          className="discord-btn flex items-center gap-2 text-sm"
          style={{
            backgroundColor: saved ? 'var(--discord-green)' : changed ? 'var(--discord-blurple)' : 'var(--discord-border)',
            color: 'white',
            opacity: !changed && !saved ? 0.5 : 1,
          }}
        >
          {mutation.isPending ? <RefreshCw size={14} className="animate-spin" /> : saved ? <CheckCircle size={14} /> : <Save size={14} />}
          {saved ? 'Сохранено!' : 'Сохранить цены'}
        </button>
      </div>

      {raids.map(raid => (
        <div key={raid.raidKey} className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--discord-text-muted)' }}>
            {raid.emoji} {raid.name}
          </p>

          {/* Group items by section */}
          {Object.entries(
            raid.items.reduce((acc, item) => {
              if (!acc[item.section]) acc[item.section] = [];
              acc[item.section].push(item);
              return acc;
            }, {})
          ).map(([section, items]) => (
            <div key={section} className="mb-3">
              <p className="text-xs mb-1 px-1" style={{ color: 'var(--discord-text-muted)' }}>{section}</p>
              {items.map(item => (
                <div
                  key={item.key}
                  className="flex items-center justify-between px-3 py-2 rounded"
                  style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                >
                  <span className="text-sm text-white">{item.label}</span>
                  <div className="flex items-center gap-2">
                    {getPrice(item) !== item.defaultPrice && (
                      <span className="text-xs" style={{ color: 'var(--discord-text-muted)' }}>
                        (было {item.defaultPrice.toLocaleString('ru-RU')})
                      </span>
                    )}
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={getPrice(item)}
                      onChange={e => handleChange(item.key, e.target.value)}
                      className="discord-input text-right font-mono"
                      style={{ width: 120 }}
                    />
                    <span className="text-xs w-4" style={{ color: 'var(--discord-text-muted)' }}>зл</span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function ReportsTab({ form, set }) {
  const { data: channels = [] } = useQuery({
    queryKey: ['channels'],
    queryFn: () => api.get('/api/v1/channels').then(r => r.data),
  });

  const textChannels = channels.filter(c => c.type === 'TEXT' || c.type === 'text' || c.type === 'ANNOUNCEMENT');

  return (
    <div>
      <SectionHeader>Еженедельный отчёт</SectionHeader>

      <SettingRow label="Включить отчёт" description="Каждое воскресенье в 19:00 бот публикует сводку недели">
        <ToggleSwitch checked={!!form.weeklyReportEnabled} onChange={v => set('weeklyReportEnabled')(v)} />
      </SettingRow>

      <SettingRow label="Канал для отчёта" description="Куда публиковать еженедельную статистику">
        <div className="relative">
          <select
            className="discord-input appearance-none pr-7"
            style={{ width: 220 }}
            value={form.weeklyReportChannelId || ''}
            onChange={e => set('weeklyReportChannelId')(e)}
          >
            <option value="">Не выбран</option>
            {textChannels.map(c => (
              <option key={c.id} value={c.id}>#{c.name}</option>
            ))}
          </select>
          <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--discord-text-muted)' }} />
        </div>
      </SettingRow>

      <div className="mt-6 p-4 rounded-lg space-y-2" style={{ backgroundColor: 'rgba(88,101,242,0.08)', border: '1px solid rgba(88,101,242,0.2)' }}>
        <p className="text-sm font-medium text-white">Что входит в отчёт</p>
        <ul className="text-xs space-y-1" style={{ color: 'var(--discord-text-muted)' }}>
          <li>🏆 Топ-3 участников по XP</li>
          <li>👋 Новые участники за неделю</li>
          <li>📈 Общая статистика сервера</li>
          <li>🎁 Завершённые розыгрыши</li>
        </ul>
        <p className="text-xs mt-2" style={{ color: 'var(--discord-text-muted)' }}>
          Для немедленного запуска используй <code className="px-1 py-0.5 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>/weeklyreport</code> в Discord.
        </p>
      </div>
    </div>
  );
}

export default function Settings() {
  const [tab, setTab] = useState('general');
  const [form, setForm] = useState(DEFAULTS);
  const [savedOk, setSavedOk] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get('/api/v1/settings').then(r => r.data),
  });

  useEffect(() => {
    if (data) setForm(prev => ({ ...prev, ...data }));
  }, [data]);

  const mutation = useMutation({
    mutationFn: (payload) => api.patch('/api/v1/settings', payload),
    onSuccess: () => {
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2500);
      refetch();
    },
  });

  const set = (key) => (e) => {
    const val = e?.target ? (e.target.type === 'number' ? +e.target.value : e.target.value) : e;
    setForm(p => ({ ...p, [key]: val }));
  };

  const handleSave = () => mutation.mutate(form);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        {Array(6).fill(0).map((_, i) => (
          <div key={i} className="h-12 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--discord-border)' }} />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Настройки</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--discord-text-muted)' }}>
            Управление ботом и сервером
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={mutation.isPending}
          className="discord-btn flex items-center gap-2 transition-all"
          style={savedOk ? { backgroundColor: 'var(--discord-green)', color: 'white' } : { backgroundColor: 'var(--discord-blurple)', color: 'white' }}
        >
          {mutation.isPending ? <RefreshCw size={16} className="animate-spin" /> : savedOk ? <CheckCircle size={16} /> : <Save size={16} />}
          {savedOk ? 'Сохранено!' : 'Сохранить'}
        </button>
      </div>

      {mutation.isError && (
        <div className="flex items-center gap-2 p-3 rounded-lg text-sm" style={{ backgroundColor: 'rgba(242,63,67,0.1)', color: 'var(--discord-red)', border: '1px solid rgba(242,63,67,0.2)' }}>
          <AlertTriangle size={15} /> Ошибка сохранения: {mutation.error?.response?.data?.error || mutation.error?.message}
        </div>
      )}

      <div className="flex gap-6">
        <aside className="flex-shrink-0 w-44 space-y-0.5">
          {TABS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left"
              style={{
                backgroundColor: tab === id ? 'rgba(88,101,242,0.2)' : 'transparent',
                color: tab === id ? 'white' : 'var(--discord-text-muted)',
              }}
            >
              <Icon size={16} style={{ color: tab === id ? 'var(--discord-blurple)' : undefined }} />
              {label}
            </button>
          ))}
        </aside>

        <div className="flex-1 discord-card p-6 min-w-0">

          {tab === 'general' && (
            <div>
              <SectionHeader>Сервер</SectionHeader>
              <SettingRow label="Префикс команд" description="Используется для текстовых команд бота">
                <input
                  className="discord-input text-center font-mono"
                  style={{ width: 80 }}
                  maxLength={5}
                  value={form.prefix}
                  onChange={set('prefix')}
                />
              </SettingRow>

              <SectionHeader>Каналы</SectionHeader>
              <SettingRow label="Канал приветствий" description="ID канала куда бот отправляет приветственные сообщения">
                <div className="flex items-center gap-2">
                  <Hash size={14} style={{ color: 'var(--discord-text-muted)' }} />
                  <input className="discord-input font-mono text-xs" style={{ width: 200 }} placeholder="ID канала" value={form.welcomeChannelId} onChange={set('welcomeChannelId')} />
                </div>
              </SettingRow>
              <SettingRow label="Канал повышений" description="Куда отправляются поздравления с новым уровнем">
                <div className="flex items-center gap-2">
                  <Hash size={14} style={{ color: 'var(--discord-text-muted)' }} />
                  <input className="discord-input font-mono text-xs" style={{ width: 200 }} placeholder="ID канала" value={form.levelUpChannelId} onChange={set('levelUpChannelId')} />
                </div>
              </SettingRow>
            </div>
          )}

          {tab === 'xp' && (
            <div>
              <SectionHeader>XP за сообщения</SectionHeader>
              <SettingRow label="Минимум XP за сообщение" description="Минимальное количество XP за одно сообщение">
                <input className="discord-input text-center" style={{ width: 80 }} type="number" min={1} max={100} value={form.xpPerMessageMin} onChange={set('xpPerMessageMin')} />
              </SettingRow>
              <SettingRow label="Максимум XP за сообщение">
                <input className="discord-input text-center" style={{ width: 80 }} type="number" min={1} max={100} value={form.xpPerMessageMax} onChange={set('xpPerMessageMax')} />
              </SettingRow>
              <SettingRow label="Кулдаун (секунды)" description="Задержка между начислениями XP за сообщения">
                <input className="discord-input text-center" style={{ width: 80 }} type="number" min={10} max={600} value={form.xpCooldownSec} onChange={set('xpCooldownSec')} />
              </SettingRow>

              <SectionHeader>XP за голосовые каналы</SectionHeader>
              <SettingRow label="XP за интервал" description="Сколько XP начисляется каждый интервал в войсе">
                <input className="discord-input text-center" style={{ width: 80 }} type="number" min={1} max={50} value={form.xpVoicePerInterval} onChange={set('xpVoicePerInterval')} />
              </SettingRow>
              <SettingRow label="Интервал (минуты)" description="Как часто начисляется XP в голосовом канале">
                <input className="discord-input text-center" style={{ width: 80 }} type="number" min={1} max={60} value={form.xpVoiceIntervalMin} onChange={set('xpVoiceIntervalMin')} />
              </SettingRow>
              <SettingRow label="Минимум участников в войсе" description="XP не начисляется если в канале меньше N человек">
                <input className="discord-input text-center" style={{ width: 80 }} type="number" min={1} max={10} value={form.xpVoiceMinMembers} onChange={set('xpVoiceMinMembers')} />
              </SettingRow>

              <div className="mt-4 p-3 rounded-lg text-xs" style={{ backgroundColor: 'rgba(88,101,242,0.1)', color: 'var(--discord-text-muted)', border: '1px solid rgba(88,101,242,0.2)' }}>
                ⚠️ Изменения XP вступят в силу после перезапуска бота
              </div>
            </div>
          )}

          {tab === 'moderation' && (
            <div>
              <SectionHeader>Автомодерация</SectionHeader>
              <SettingRow label="Антиспам" description="Автоматически удалять повторяющиеся сообщения">
                <ToggleSwitch checked={form.antiSpam} onChange={set('antiSpam')} />
              </SettingRow>
              <SettingRow label="Макс. упоминаний в сообщении" description="Сообщение удаляется если превышен лимит">
                <input className="discord-input text-center" style={{ width: 80 }} type="number" min={1} max={20} value={form.maxMentions} onChange={set('maxMentions')} />
              </SettingRow>
              <SettingRow label="Макс. ссылок в сообщении">
                <input className="discord-input text-center" style={{ width: 80 }} type="number" min={1} max={10} value={form.maxLinks} onChange={set('maxLinks')} />
              </SettingRow>

              <SectionHeader>Система предупреждений</SectionHeader>
              <div className="py-3 text-sm" style={{ color: 'var(--discord-text-muted)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <p className="text-white font-medium mb-2">Текущие пороги</p>
                {[
                  ['1 варн', 'Только предупреждение'],
                  ['2 варна', 'Мут 30 минут'],
                  ['3 варна', 'Мут 3 часа'],
                  ['4 варна', 'Мут 24 часа'],
                  ['5 варнов', 'Бан'],
                ].map(([n, action]) => (
                  <div key={n} className="flex items-center justify-between py-1">
                    <span>{n}</span>
                    <span className="font-medium" style={{ color: n.includes('5') ? 'var(--discord-red)' : n.includes('1') ? 'var(--discord-green)' : 'var(--discord-yellow)' }}>{action}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'reports' && (
            <ReportsTab form={form} set={set} />
          )}

          {tab === 'goldbid' && (
            <GoldBidTab />
          )}

          {tab === 'bot' && (
            <div>
              <SectionHeader>Активность</SectionHeader>
              <SettingRow label="Статус бота">
                <select className="discord-input" style={{ width: 140 }} value={form.botStatus} onChange={set('botStatus')}>
                  {[['online','В сети'], ['idle','Не активен'], ['dnd','Не беспокоить'], ['invisible','Невидимый']].map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </SettingRow>
              <SettingRow label="Тип активности">
                <select className="discord-input" style={{ width: 160 }} value={form.botActivityType} onChange={set('botActivityType')}>
                  {[['PLAYING','Играет в'], ['WATCHING','Смотрит'], ['LISTENING','Слушает'], ['COMPETING','Участвует в']].map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </SettingRow>
              <SettingRow label="Текст активности" description="Отображается под именем бота">
                <input className="discord-input" style={{ width: 220 }} value={form.botActivity} onChange={set('botActivity')} />
              </SettingRow>

              <SectionHeader>Информация</SectionHeader>
              <div className="py-3 space-y-2 text-sm" style={{ color: 'var(--discord-text-muted)' }}>
                <div className="flex justify-between"><span>Библиотека</span><span className="text-white">discord.js v14</span></div>
                <div className="flex justify-between"><span>API</span><span className="text-white">Express + Socket.io</span></div>
                <div className="flex justify-between"><span>База данных</span><span className="text-white">SQLite + Prisma</span></div>
                <div className="flex justify-between"><span>AI</span><span className="text-white">Groq (llama-3.1-8b)</span></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
