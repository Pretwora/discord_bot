import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';
import {
  Users, Hash, Shield, ClipboardList,
  UserPlus, UserMinus, ShieldBan, MessageSquare,
  TrendingUp, Activity, RefreshCw, Star
} from 'lucide-react';
import api from '../lib/api';

// Map API action strings to display config
const ACTION_MAP = {
  member_join:    { icon: UserPlus,      color: 'var(--discord-green)',   label: 'joined the server' },
  member_leave:   { icon: UserMinus,     color: 'var(--discord-text-muted)', label: 'left the server' },
  member_ban:     { icon: ShieldBan,     color: 'var(--discord-red)',     label: 'was banned' },
  member_kick:    { icon: UserMinus,     color: 'var(--discord-yellow)',  label: 'was kicked' },
  message_delete: { icon: MessageSquare, color: 'var(--discord-red)',     label: 'message deleted in' },
  default:        { icon: ClipboardList, color: 'var(--discord-blurple)', label: '' },
};

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// Build last-7-days activity from audit logs
function buildActivityData(logs) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
      day: d.toLocaleDateString('en', { weekday: 'short' }),
      date: d.toISOString().slice(0, 10),
      events: 0,
      joins: 0,
    };
  });
  for (const log of logs) {
    const date = new Date(log.createdAt).toISOString().slice(0, 10);
    const entry = days.find(d => d.date === date);
    if (!entry) continue;
    entry.events++;
    if (log.action === 'member_join') entry.joins++;
  }
  return days;
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

function StatCard({ icon: Icon, label, value, color, loading }) {
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
      </div>
    </div>
  );
}

function ErrorBanner({ message, onRetry }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg text-sm" style={{ backgroundColor: 'rgba(242,63,67,0.1)', border: '1px solid rgba(242,63,67,0.3)', color: 'var(--discord-red)' }}>
      <span>{message}</span>
      <button onClick={onRetry} className="flex items-center gap-1.5 hover:underline">
        <RefreshCw size={13} /> Retry
      </button>
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
  });

  const {
    data: logs,
    isLoading: logsLoading,
    isError: logsError,
    refetch: refetchLogs,
  } = useQuery({
    queryKey: ['audit-log', 'overview'],
    queryFn: () => api.get('/api/v1/audit-log?limit=100').then(r => r.data),
  });

  const { data: leaderboard, isLoading: lbLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => api.get('/api/v1/leaderboard?limit=10').then(r => r.data),
    refetchInterval: 30_000,
  });

  const activityData = logs ? buildActivityData(logs) : [];
  const recentEvents = (logs ?? []).slice(0, 5);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Overview</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--discord-text-muted)' }}>Pretwora DS — server statistics</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium" style={{ backgroundColor: 'rgba(35,165,90,0.15)', color: 'var(--discord-green)' }}>
          <Activity size={12} /> Live
        </div>
      </div>

      {statsError && <ErrorBanner message="Failed to load statistics" onRetry={refetchStats} />}
      {logsError  && <ErrorBanner message="Failed to load activity"   onRetry={refetchLogs} />}

      {/* Stats grid */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Users}        label="Total Members"   value={stats?.memberCount}  color="var(--discord-blurple)" loading={statsLoading} />
        <StatCard icon={Hash}         label="Channels"        value={stats?.channelCount} color="#3ba55c"               loading={statsLoading} />
        <StatCard icon={Shield}       label="Roles"           value={stats?.roleCount}    color="var(--discord-yellow)" loading={statsLoading} />
        <StatCard icon={ClipboardList} label="Audit Entries"  value={stats?.auditCount}   color="#eb459e"               loading={statsLoading} />
      </div>

      {/* Chart + events */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Activity chart */}
        <div className="xl:col-span-2 discord-card p-4">
          <div className="flex items-center justify-between mb-4">
            <p className="font-semibold text-white">Activity (last 7 days)</p>
            <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--discord-text-muted)' }}>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--discord-blurple)' }} />
                Events
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--discord-green)' }} />
                Joins
              </span>
            </div>
          </div>
          {logsLoading ? (
            <div className="h-[200px] rounded animate-pulse" style={{ backgroundColor: 'var(--discord-border)' }} />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={activityData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="colorEvents" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5865F2" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#5865F2" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorJoins" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#23a55a" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#23a55a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="day" tick={{ fill: '#96989d', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#96989d', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="events" name="Events" stroke="#5865F2" fill="url(#colorEvents)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="joins"  name="Joins"  stroke="#23a55a" fill="url(#colorJoins)"  strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Recent events */}
        <div className="discord-card p-4 flex flex-col">
          <p className="font-semibold text-white mb-4">Recent Events</p>
          {logsLoading ? (
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
          ) : (
            <div className="space-y-3 flex-1">
              {recentEvents.length === 0 && (
                <p className="text-sm text-center py-8" style={{ color: 'var(--discord-text-muted)' }}>No events yet</p>
              )}
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
                        {' '}{def.label}{targetDisplay ? ` ${targetDisplay}` : ''}
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
            style={{ color: 'var(--discord-blurple)', borderColor: 'var(--discord-blurple)' }}
          >
            View Audit Log →
          </a>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="discord-card p-4">
        <div className="flex items-center justify-between mb-4">
          <p className="font-semibold text-white flex items-center gap-2">
            <Star size={16} style={{ color: 'var(--discord-blurple)' }} /> Top Members by XP
          </p>
          <span className="text-xs" style={{ color: 'var(--discord-text-muted)' }}>Top 10</span>
        </div>
        {lbLoading ? (
          <div className="space-y-2">
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="h-10 rounded animate-pulse" style={{ backgroundColor: 'var(--discord-border)' }} />
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {(leaderboard ?? []).length === 0 && (
              <p className="text-sm text-center py-6" style={{ color: 'var(--discord-text-muted)' }}>
                Нет данных — участники ещё не писали сообщений
              </p>
            )}
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

      {/* Member status bar — static, Discord doesn't expose presence via REST */}
      <div className="discord-card p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold text-white">Member Status</p>
          <TrendingUp size={16} style={{ color: 'var(--discord-text-muted)' }} />
        </div>
        <p className="text-xs mb-3" style={{ color: 'var(--discord-text-muted)' }}>
          Realtime presence requires Discord Gateway — shown via bot socket.
        </p>
        <div className="flex gap-6">
          {[
            { label: 'Online',  value: '—', color: 'var(--discord-green)' },
            { label: 'Idle',    value: '—', color: 'var(--discord-yellow)' },
            { label: 'DND',     value: '—', color: 'var(--discord-red)' },
            { label: 'Offline', value: stats?.memberCount ?? '—', color: 'var(--discord-text-muted)' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-sm font-medium text-white">{statsLoading ? '…' : value}</span>
              <span className="text-xs" style={{ color: 'var(--discord-text-muted)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
