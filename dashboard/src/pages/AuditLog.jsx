import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  UserPlus, UserMinus, ShieldBan, MessageSquare,
  Hash, Shield, Settings, Clock, ChevronDown, Search,
  ClipboardList, RefreshCw, AlertTriangle, Gift, ShieldCheck, ShieldOff
} from 'lucide-react';
import api from '../lib/api';

const ACTION_TYPES = {
  member_join:      { icon: UserPlus,      color: 'var(--discord-green)',        label: 'Вход на сервер' },
  member_leave:     { icon: UserMinus,     color: 'var(--discord-text-muted)',   label: 'Покинул сервер' },
  member_ban:       { icon: ShieldBan,     color: 'var(--discord-red)',          label: 'Бан' },
  member_kick:      { icon: UserMinus,     color: 'var(--discord-yellow)',       label: 'Кик' },
  member_timeout:   { icon: Clock,         color: 'var(--discord-yellow)',       label: 'Мут' },
  member_warn:      { icon: AlertTriangle, color: '#f97316',                     label: 'Предупреждение' },
  message_delete:   { icon: MessageSquare, color: 'var(--discord-red)',          label: 'Удаление сообщения' },
  channel_create:   { icon: Hash,          color: 'var(--discord-green)',        label: 'Создание канала' },
  channel_delete:   { icon: Hash,          color: 'var(--discord-red)',          label: 'Удаление канала' },
  role_create:      { icon: Shield,        color: 'var(--discord-green)',        label: 'Создание роли' },
  role_delete:      { icon: Shield,        color: 'var(--discord-red)',          label: 'Удаление роли' },
  role_assign:      { icon: ShieldCheck,   color: 'var(--discord-green)',        label: 'Выдача роли' },
  role_unassign:    { icon: ShieldOff,     color: 'var(--discord-yellow)',       label: 'Снятие роли' },
  settings_update:  { icon: Settings,      color: 'var(--discord-blurple)',      label: 'Настройки' },
  giveaway_create:  { icon: Gift,          color: 'var(--discord-green)',        label: 'Розыгрыш создан' },
  giveaway_end:     { icon: Gift,          color: 'var(--discord-yellow)',       label: 'Розыгрыш завершён' },
  giveaway_cancel:  { icon: Gift,          color: 'var(--discord-red)',          label: 'Розыгрыш отменён' },
};

const DEFAULT_DEF = { icon: ClipboardList, color: 'var(--discord-blurple)', label: 'Действие' };

function groupByDate(logs) {
  const groups = {};
  for (const log of logs) {
    const date = new Date(log.createdAt).toISOString().slice(0, 10);
    if (!groups[date]) groups[date] = [];
    groups[date].push(log);
  }
  return groups;
}

function formatDate(dateStr) {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (dateStr === today) return 'Сегодня';
  if (dateStr === yesterday) return 'Вчера';
  return new Date(dateStr).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' });
}

function timeStr(dateStr) {
  return new Date(dateStr).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
}

export default function AuditLog() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const { data: logs = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['audit-log', filter],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '200' });
      if (filter !== 'all') params.set('action', filter);
      return api.get(`/api/v1/audit-log?${params}`).then(r => r.data);
    },
  });

  const filtered = logs.filter(log => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    let meta = {};
    try { meta = JSON.parse(log.meta || '{}'); } catch {}
    return (
      (log.actorId || '').toLowerCase().includes(q) ||
      (log.targetId || '').toLowerCase().includes(q) ||
      (meta.targetName || '').toLowerCase().includes(q) ||
      (log.action || '').toLowerCase().includes(q)
    );
  });

  const groups = groupByDate(filtered);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Audit Log</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--discord-text-muted)' }}>
            Все действия администрации на сервере
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full" style={{ backgroundColor: 'rgba(88,101,242,0.15)', color: 'var(--discord-blurple)' }}>
            <ClipboardList size={13} />
            {isLoading ? '…' : `${logs.length} entries`}
          </div>
          <button onClick={refetch} className="discord-btn discord-btn-ghost flex items-center gap-2 text-xs py-1.5">
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--discord-text-muted)' }} />
          <input
            className="discord-input"
            style={{ paddingLeft: '2.25rem' }}
            placeholder="Поиск по пользователю, цели или действию…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="relative">
          <select
            className="discord-input pr-8 appearance-none cursor-pointer"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            style={{ minWidth: 180 }}
          >
            <option value="all">Все действия</option>
            {Object.entries(ACTION_TYPES).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--discord-text-muted)' }} />
        </div>
      </div>

      {isError && (
        <div className="discord-card flex flex-col items-center justify-center py-20 gap-4" style={{ color: 'var(--discord-text-muted)' }}>
          <p>Не удалось загрузить лог</p>
          <button onClick={refetch} className="discord-btn discord-btn-ghost flex items-center gap-2"><RefreshCw size={14} /> Повторить</button>
        </div>
      )}

      {isLoading ? (
        <div className="discord-card p-4 space-y-3">
          {Array(8).fill(0).map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="w-8 h-8 rounded-full animate-pulse flex-shrink-0" style={{ backgroundColor: 'var(--discord-border)' }} />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-3.5 rounded animate-pulse" style={{ backgroundColor: 'var(--discord-border)', width: `${40 + Math.random() * 40}%` }} />
                <div className="h-2.5 rounded animate-pulse" style={{ backgroundColor: 'var(--discord-border)', width: '25%' }} />
              </div>
            </div>
          ))}
        </div>
      ) : Object.keys(groups).length === 0 ? (
        <div className="discord-card flex flex-col items-center justify-center py-20" style={{ color: 'var(--discord-text-muted)' }}>
          <ClipboardList size={40} className="mb-3 opacity-30" />
          <p className="text-sm">Записей пока нет</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groups).map(([date, entries]) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--discord-text-muted)' }}>
                  {formatDate(date)}
                </span>
                <div className="flex-1 h-px" style={{ backgroundColor: 'var(--discord-border)' }} />
                <span className="text-xs" style={{ color: 'var(--discord-text-muted)' }}>{entries.length}</span>
              </div>
              <div className="discord-card overflow-hidden">
                {entries.map((log, i) => {
                  const def = ACTION_TYPES[log.action] ?? DEFAULT_DEF;
                  const Icon = def.icon;
                  let meta = {};
                  try { meta = JSON.parse(log.meta || '{}'); } catch {}
                  const targetDisplay = meta.targetName ?? log.targetId ?? '';
                  const detail = meta.reason ?? meta.detail ?? '';

                  const roleName = meta.roleName;
                  const msgContent = meta.content;

                  return (
                    <div
                      key={log.id}
                      className="flex items-start gap-4 px-4 py-3 hover:bg-white/5 transition-colors"
                      style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                    >
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: `${def.color}20` }}>
                        <Icon size={15} style={{ color: def.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                          <span className="text-xs font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: `${def.color}20`, color: def.color }}>
                            {def.label}
                          </span>
                          {log.actorId && (
                            <>
                              <span className="text-xs" style={{ color: 'var(--discord-text-muted)' }}>от</span>
                              <span className="text-sm font-medium text-white">{log.actorId}</span>
                            </>
                          )}
                          {targetDisplay && (
                            <>
                              <span className="text-xs" style={{ color: 'var(--discord-text-muted)' }}>→</span>
                              <span className="text-sm text-white">{targetDisplay}</span>
                            </>
                          )}
                          {roleName && (
                            <>
                              <span className="text-xs" style={{ color: 'var(--discord-text-muted)' }}>роль</span>
                              <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: 'rgba(88,101,242,0.2)', color: 'var(--discord-blurple)' }}>{roleName}</span>
                            </>
                          )}
                        </div>
                        {detail && (
                          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--discord-text-muted)' }}>{detail}</p>
                        )}
                        {msgContent && (
                          <p className="text-xs mt-0.5 italic truncate" style={{ color: 'var(--discord-text-muted)' }}>«{msgContent}»</p>
                        )}
                        {log.source === 'DASHBOARD' && (
                          <span className="text-xs px-1 rounded mt-0.5 inline-block" style={{ backgroundColor: 'rgba(88,101,242,0.12)', color: 'var(--discord-blurple)' }}>
                            dashboard
                          </span>
                        )}
                      </div>
                      <span className="text-xs flex-shrink-0 mt-1" style={{ color: 'var(--discord-text-muted)' }}>
                        {timeStr(log.createdAt)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
