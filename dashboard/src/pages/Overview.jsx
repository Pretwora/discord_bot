import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';
import {
  Users, Hash, Shield, UserPlus, UserMinus, ShieldBan,
  MessageSquare, TrendingUp, Activity, RefreshCw, Star,
  Zap, ClipboardList, ShieldCheck, ShieldOff, Gift, Settings
} from 'lucide-react';
import api from '../lib/api';

const ACTION_MAP = {
  member_join:     { icon: UserPlus,    color: 'var(--discord-green)',      label: 'вступил на сервер' },
  member_leave:    { icon: UserMinus,   color: 'var(--discord-text-muted)', label: 'покинул сервер' },
  member_ban:      { icon: ShieldBan,   color: 'var(--discord-red)',        label: 'был забанен' },
  member_kick:     { icon: UserMinus,   color: 'var(--discord-yellow)',     label: 'был кикнут' },
  member_warn:     { icon: ShieldBan,   color: '#f97316',                   label: 'получил варн' },
  member_timeout:  { icon: ShieldBan,   color: 'var(--discord-yellow)',     label: 'получил мут' },
  message_delete:  { icon: MessageSquare, color: 'var(--discord-red)',      label: 'удалено сообщение в' },
  channel_create:  { icon: Hash,        color: 'var(--discord-green)',      label: 'создал канал' },
  channel_delete:  { icon: Hash,        color: 'var(--discord-red)',        label: 'удалил канал' },
  role_create:     { icon: Shield,      color: 'var(--discord-green)',      label: 'создал роль' },
  role_assign:     { icon: ShieldCheck, color: 'var(--discord-green)',      label: 'выдал роль участнику' },
  role_unassign:   { icon: ShieldOff,   color: 'var(--discord-yellow)',     label: 'снял роль у участника' },
  giveaway_create: { icon: Gift,        color: 'var(--discord-green)',      label: 'создал розыгрыш' },
  giveaway_end:    { icon: Gift,        color: 'var(--discord-yellow)',     label: 'завершил розыгрыш' },
  giveaway_cancel: { icon: Gift,        color: 'var(--discord-red)',        label: 'отменил розыгрыш' },
  settings_update: { icon: Settings,    color: 'var(--discord-blurple)',    label: 'обновил настройки' },
  default:         { icon: ClipboardList, color: 'var(--discord-blurple)', label: '' },
};

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return `${diff}с назад`;
  if (diff < 3600) return `${Math.floor(diff / 60)}м назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}ч назад`;
  return `${Math.floor(diff / 86400)}д назад`;
}

function buildActivityData(joinsByDay) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const date = d.toISOString().slice(0, 10);
    return {
      day: d.toLocaleDateString('ru', { weekday: 'short' }),
      date,
      joins: joinsByDay?.[date] || 0,
    };
  });
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'var(--discord-darkest)', border: '1px solid var(--discord-border)' }}>
      <p className="font-medium text-white mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

function StatCard({ icon: Icon, label, value, sub, color, loading }) {
  return (
    <div className="discord-card p-4 flex items-start gap-4">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}20` }}>
        <Icon size={20} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium mb-1" style={{ color: 'var(--discord-text-muted)' }}>{label}</p>
        {loading
          ? <div className="h-8 w-20 rounded animate-pulse" style={{ backgroundColor: 'var(--discord-border)' }} />
          : <p className="text-2xl font-bold text-white">{(value ?? 0).toLocaleString()}</p>
        }
        {!loading && sub != null && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--discord-text-muted)' }}>{sub}</p>
        )}
      </div>
    </div>
  );
}

export default function Overview() {
  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['stats'],
    queryFn: () => api.get('/api/v1/stats/overview').then(r => r.data),
    refetchInterval: 30_000,
  });

  const { data: leaderboard, isLoading: lbLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => api.get('/api/v1/leaderboard?limit=10').then(r => r.data),
    refetchInterval: 30_000,
  });

  const activityData = buildActivityData(stats?.joinsByDay);
  const recentEvents = stats?.recentAudit ?? [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Overview</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--discord-text-muted)' }}>Pretwora DS — статистика сервера</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium" style={{ backgroundColor: 'rgba(35,165,90,0.15)', color: 'var(--discord-green)' }}>
            <Activity size={12} /> Live
          </div>
          <button onClick={refetchStats} className="discord-btn discord-btn-ghost flex items-center gap-2 text-xs py-1.5">
            <RefreshCw size={13} /> Обновить
          </button>
        </div>
      </div>

      {statsError && (
        <div className="flex items-center justify-between p-3 rounded-lg text-sm" style={{ backgroundColor: 'rgba(242,63,67,0.1)', border: '1px solid rgba(242,63,67,0.3)', color: 'var(--discord-red)' }}>
          <span>Не удалось загрузить статистику</span>
          <button onClick={refetchStats} className="flex items-center gap-1.5 hover:underline"><RefreshCw size={13} /> Retry</button>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Users}   label="Участников"      value={stats?.memberCount}  sub={`${stats?.activeToday ?? 0} активных сегодня`} color="var(--discord-blurple)" loading={statsLoading} />
        <StatCard icon={UserPlus} label="Вступило сегодня" value={stats?.joinedToday}  color="var(--discord-green)"  loading={statsLoading} />
        <StatCard icon={Zap}     label="Всего XP"         value={stats?.totalXp}      sub={`${(stats?.totalMessages ?? 0).toLocaleString()} сообщений`} color="var(--discord-yellow)" loading={statsLoading} />
        <StatCard icon={Hash}    label="Каналов"          value={stats?.channelCount} sub={`${stats?.roleCount ?? 0} ролей`} color="#3ba55c" loading={statsLoading} />
      </div>

      {/* Chart + events */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Activity chart */}
        <div className="xl:col-span-2 discord-card p-4">
          <div className="flex items-center justify-between mb-4">
            <p className="font-semibold text-white">Новые участники (последние 7 дней)</p>
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--discord-text-muted)' }}>
              <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--discord-green)' }} />
              Вступления
            </div>
          </div>
          {statsLoading ? (
            <div className="h-[200px] rounded animate-pulse" style={{ backgroundColor: 'var(--discord-border)' }} />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={activityData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="colorJoins" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#23a55a" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#23a55a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="day" tick={{ fill: '#96989d', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#96989d', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="joins" name="Вступлений" stroke="#23a55a" fill="url(#colorJoins)" strokeWidth={2} dot={{ fill: '#23a55a', r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Recent events */}
        <div className="discord-card p-4 flex flex-col">
          <p className="font-semibold text-white mb-4">Последние события</p>
          {statsLoading ? (
            <div className="space-y-3">
              {Array(5).fill(0).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full animate-pulse flex-shrink-0" style={{ backgroundColor: 'var(--discord-border)' }} />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 rounded animate-pulse" style={{ backgroundColor: 'var(--discord-border)' }} />
                    <div className="h-2.5 w-16 rounded animate-pulse" style={{ backgroundColor: 'var(--discord-border)' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : recentEvents.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center" style={{ color: 'var(--discord-text-muted)' }}>
              <ClipboardList size={28} className="mb-2 opacity-30" />
              <p className="text-sm text-center">События появятся<br/>по мере активности</p>
            </div>
          ) : (
            <div className="space-y-3 flex-1 overflow-y-auto">
              {recentEvents.map(log => {
                const def = ACTION_MAP[log.action] ?? ACTION_MAP.default;
                const Icon = def.icon;
                let meta = {};
                try { meta = JSON.parse(log.meta || '{}'); } catch {}
                const targetDisplay = meta.targetName ?? log.targetId ?? '';
                return (
                  <div key={log.id} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: `${def.color}20` }}>
                      <Icon size={14} style={{ color: def.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white leading-tight">
                        <span className="font-medium">{log.actorId}</span>
                        {' '}<span style={{ color: 'var(--discord-text-muted)' }}>{def.label}</span>
                        {targetDisplay ? <span className="font-medium"> {targetDisplay}</span> : ''}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--discord-text-muted)' }}>{timeAgo(log.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <a
            href="/audit-log"
            className="discord-btn discord-btn-ghost block text-center mt-4 text-xs"
            style={{ color: 'var(--discord-blurple)', borderColor: 'rgba(88,101,242,0.4)' }}
          >
            Полный аудитлог →
          </a>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="discord-card p-4">
        <div className="flex items-center justify-between mb-4">
          <p className="font-semibold text-white flex items-center gap-2">
            <Star size={16} style={{ color: 'var(--discord-blurple)' }} /> Топ по XP
          </p>
          <span className="text-xs" style={{ color: 'var(--discord-text-muted)' }}>Топ 10</span>
        </div>
        {lbLoading ? (
          <div className="space-y-2">
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="h-10 rounded animate-pulse" style={{ backgroundColor: 'var(--discord-border)' }} />
            ))}
          </div>
        ) : (leaderboard ?? []).length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: 'var(--discord-text-muted)' }}>
            Нет данных — участники ещё не писали сообщений
          </p>
        ) : (
          <div className="space-y-1">
            {(leaderboard ?? []).map((m, i) => {
              const xpForNext = ((m.level + 1) * (m.level + 2)) / 2 * 100;
              const xpForCur  = (m.level * (m.level + 1)) / 2 * 100;
              const progress  = xpForNext > xpForCur ? Math.round(((m.xp - xpForCur) / (xpForNext - xpForCur)) * 100) : 100;
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
              return (
                <div key={m.id} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ backgroundColor: i < 3 ? 'rgba(88,101,242,0.07)' : 'transparent' }}>
                  <span className="w-8 text-center text-sm font-bold" style={{ color: i < 3 ? 'var(--discord-blurple)' : 'var(--discord-text-muted)' }}>{medal}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-white truncate">{m.nickname || m.username}</span>
                      <span className="text-xs font-semibold ml-2 flex-shrink-0" style={{ color: 'var(--discord-blurple)' }}>
                        Lvl {m.level} · {m.xp.toLocaleString()} XP
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--discord-border)' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: 'var(--discord-blurple)' }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Member Status */}
      <div className="discord-card p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold text-white">Активность сервера</p>
          <TrendingUp size={16} style={{ color: 'var(--discord-text-muted)' }} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Участников', value: stats?.memberCount, color: 'var(--discord-blurple)' },
            { label: 'Активных сегодня', value: stats?.activeToday, color: 'var(--discord-green)' },
            { label: 'Вступило сегодня', value: stats?.joinedToday, color: '#23a55a' },
            { label: 'Сообщений всего', value: stats?.totalMessages, color: 'var(--discord-yellow)' },
          ].map(({ label, value, color }) => (
            <div key={label} className="p-3 rounded-lg text-center" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid var(--discord-border)' }}>
              <p className="text-xl font-bold text-white">{statsLoading ? '…' : (value ?? 0).toLocaleString()}</p>
              <p className="text-xs mt-0.5" style={{ color }}>{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
