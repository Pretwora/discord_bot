import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, UserX, ShieldBan, X, MoreVertical, Users, RefreshCw, Shield, Plus, Check,
  AlertTriangle, Trash2, User, MessageSquare, Calendar, Clock
} from 'lucide-react';
import api from '../lib/api';
import { useSocket } from '../hooks/useSocket';

const AVATARS = ['🐱','🐶','🦊','🐸','🐼','🐨','🦁','🐯','🐻','🦝'];

const STATUS_COLORS = { online: '#23a55a', idle: '#f0b232', dnd: '#f23f43', offline: '#80848e' };

function StatusDot({ status }) {
  const color = STATUS_COLORS[status] || STATUS_COLORS.offline;
  if (status === 'offline' || !status) return null;
  return (
    <div
      className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
      style={{ backgroundColor: color, borderColor: 'var(--discord-bg)' }}
    />
  );
}

function avatarEmoji(id) {
  const n = parseInt(id?.slice(-4) || '0', 16) || 0;
  return AVATARS[n % AVATARS.length];
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
      <div className="discord-card w-full max-w-sm p-6 relative" style={{ backgroundColor: 'var(--discord-bg-secondary)' }}>
        <button onClick={onClose} className="absolute top-4 right-4 p-1 rounded hover:bg-white/10 transition-colors" style={{ color: 'var(--discord-text-muted)' }}>
          <X size={18} />
        </button>
        <h2 className="text-lg font-bold text-white mb-1">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function parseRoles(rolesField) {
  if (Array.isArray(rolesField)) return rolesField;
  try {
    const parsed = JSON.parse(rolesField || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

const WARN_COLORS = ['#23a55a', '#f0b232', '#f0b232', '#f23f43', '#f23f43'];

function WarnModal({ member, onClose }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState(null);
  const [actionResult, setActionResult] = useState(null);

  const { data: warnings = [], refetch } = useQuery({
    queryKey: ['warnings', member.id],
    queryFn: () => api.get(`/api/v1/warnings/${member.id}`).then(r => r.data),
  });

  async function issueWarn() {
    if (!reason.trim() || issuing) return;
    setIssuing(true); setError(null); setActionResult(null);
    try {
      const { data } = await api.post(`/api/v1/warnings/${member.id}`, { reason });
      setReason('');
      refetch();
      qc.invalidateQueries({ queryKey: ['members'] });
      if (data.action) setActionResult(data.action);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setIssuing(false);
    }
  }

  async function removeWarn(warningId) {
    await api.delete(`/api/v1/warnings/${member.id}/${warningId}`);
    refetch();
    qc.invalidateQueries({ queryKey: ['members'] });
  }

  async function clearWarns() {
    await api.delete(`/api/v1/warnings/${member.id}`);
    refetch();
    qc.invalidateQueries({ queryKey: ['members'] });
    setActionResult(null);
  }

  function actionLabel(a) {
    if (!a) return '';
    if (a === 'ban') return '🔨 Участник забанен';
    if (a?.type === 'mute') return `🔇 ${a.label}`;
    return '';
  }
  const count = warnings.length;

  return (
    <Modal title={`Предупреждения — ${member.username}`} onClose={onClose}>
      {/* Warn counter */}
      <div className="flex items-center gap-2 mb-3 mt-1">
        {[1, 2, 3, 4, 5].map(n => (
          <div key={n} className="flex-1 h-2 rounded-full transition-colors" style={{ backgroundColor: count >= n ? WARN_COLORS[n - 1] : 'var(--discord-border)' }} />
        ))}
        <span className="text-xs font-bold ml-1 w-6" style={{ color: count >= 4 ? '#f23f43' : count >= 2 ? '#f0b232' : 'var(--discord-text-muted)' }}>
          {count}/5
        </span>
      </div>
      <div className="text-xs mb-4 space-y-0.5" style={{ color: 'var(--discord-text-muted)' }}>
        <p>1 → без действий · 2 → мут 30 мин · 3 → мут 3 ч</p>
        <p>4 → мут 24 ч · 5 → бан</p>
      </div>

      {/* Issue new warning */}
      <div className="flex gap-2 mb-4">
        <input
          className="discord-input flex-1 text-sm"
          placeholder="Причина предупреждения…"
          value={reason}
          onChange={e => setReason(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && issueWarn()}
        />
        <button
          onClick={issueWarn}
          disabled={issuing || !reason.trim()}
          className="discord-btn discord-btn-danger px-3 text-sm"
        >
          {issuing ? '…' : '⚠ Варн'}
        </button>
      </div>

      {actionResult && (
        <div className="mb-3 px-3 py-2 rounded text-sm" style={{ backgroundColor: 'rgba(242,63,67,0.1)', color: 'var(--discord-red)' }}>
          {actionLabel(actionResult)}
        </div>
      )}
      {error && <p className="text-xs mb-3" style={{ color: 'var(--discord-red)' }}>{error}</p>}

      {/* Warning history */}
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {warnings.length === 0 && (
          <p className="text-xs text-center py-3" style={{ color: 'var(--discord-text-muted)' }}>Предупреждений нет</p>
        )}
        {warnings.map((w, i) => {
          const num = count - i;
          return (
          <div key={w.id} className="flex items-start gap-2 px-2 py-1.5 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
            <span className="text-xs font-bold mt-0.5 w-4" style={{ color: WARN_COLORS[num - 1] || '#f23f43' }}>#{num}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">{w.reason}</p>
              <p className="text-xs" style={{ color: 'var(--discord-text-muted)' }}>
                {w.moderator} · {new Date(w.createdAt).toLocaleDateString()}
              </p>
            </div>
            <button onClick={() => removeWarn(w.id)} className="p-1 rounded hover:bg-white/10 flex-shrink-0" style={{ color: 'var(--discord-text-muted)' }}>
              <Trash2 size={12} />
            </button>
          </div>
          );
        })}
      </div>

      {warnings.length > 0 && (
        <button onClick={clearWarns} className="w-full mt-3 text-xs py-1.5 rounded hover:bg-white/10 transition-colors" style={{ color: 'var(--discord-text-muted)' }}>
          Снять все предупреждения
        </button>
      )}
    </Modal>
  );
}

function RolesModal({ member, allRoles, onClose }) {
  const qc = useQueryClient();
  const memberRoles = parseRoles(member.roles);
  const [activeIds, setActiveIds] = useState(
    new Set(memberRoles.map(r => typeof r === 'string' ? r : r.id))
  );
  const [pendingId, setPendingId] = useState(null);
  const [error, setError] = useState(null);

  const manageable = allRoles.filter(r => r.name !== '@everyone' && r.name !== 'Pretwora_bot');

  async function toggle(role) {
    if (pendingId) return;
    setError(null);
    setPendingId(role.id);
    try {
      if (activeIds.has(role.id)) {
        await api.delete(`/api/v1/roles/${role.id}/assign/${member.id}`);
        setActiveIds(prev => { const next = new Set(prev); next.delete(role.id); return next; });
      } else {
        await api.post(`/api/v1/roles/${role.id}/assign`, { userId: member.id });
        setActiveIds(prev => new Set([...prev, role.id]));
      }
      qc.invalidateQueries({ queryKey: ['members'] });
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <Modal title={`Роли — ${member.username}`} onClose={onClose}>
      <p className="text-xs mb-4" style={{ color: 'var(--discord-text-muted)' }}>
        Нажми на роль чтобы выдать или снять
      </p>
      <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
        {manageable.map(role => {
          const has = activeIds.has(role.id);
          const loading = pendingId === role.id;
          const color = role.color || '#96989d';
          return (
            <button
              key={role.id}
              onClick={() => toggle(role)}
              disabled={!!pendingId}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-left"
              style={{
                backgroundColor: has ? `${color}18` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${has ? color + '40' : 'transparent'}`,
                opacity: pendingId && !loading ? 0.5 : 1,
              }}
            >
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              <span className="flex-1 text-sm text-white">{role.name}</span>
              {loading && <div className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: color, borderTopColor: 'transparent' }} />}
              {!loading && has && <Check size={14} style={{ color }} />}
            </button>
          );
        })}
      </div>
      {error && (
        <p className="text-xs mt-3 p-2 rounded" style={{ backgroundColor: 'rgba(242,63,67,0.1)', color: 'var(--discord-red)' }}>
          {error}
        </p>
      )}
    </Modal>
  );
}

const LEVEL_ROLES = [
  { level: 3,  name: '🌱 Росток' },
  { level: 7,  name: '⚡ Активный' },
  { level: 12, name: '🔥 Ветеран' },
  { level: 17, name: '💫 Избранный' },
  { level: 20, name: '👑 Легенда' },
];

function ProfileModal({ member, allRoles, onClose, onWarn, onRoles }) {
  const { data: warnings = [] } = useQuery({
    queryKey: ['warnings', member.id],
    queryFn: () => api.get(`/api/v1/warnings/${member.id}`).then(r => r.data),
  });

  const roles = parseRoles(member.roles);
  const xp = member.xp ?? 0;
  const level = member.level ?? 0;
  const curFloor  = xpForLevelCalc(level);
  const nextFloor = xpForLevelCalc(level + 1);
  const progress  = nextFloor > curFloor ? Math.round(((xp - curFloor) / (nextFloor - curFloor)) * 100) : 100;
  const currentLvlRole = [...LEVEL_ROLES].reverse().find(r => r.level <= level);
  const nextLvlRole = LEVEL_ROLES.find(r => r.level > level);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
      <div className="discord-card w-full max-w-lg relative overflow-hidden" style={{ backgroundColor: 'var(--discord-bg-secondary)', maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Header banner */}
        <div className="h-20 w-full" style={{ background: 'linear-gradient(135deg, #5865f2 0%, #eb459e 100%)' }} />
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-black/20 transition-colors text-white">
          <X size={16} />
        </button>

        {/* Avatar */}
        <div className="px-6 pb-4">
          <div className="-mt-8 mb-3">
            <div className="relative inline-block">
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl border-4" style={{ backgroundColor: 'var(--discord-darkest)', borderColor: 'var(--discord-bg-secondary)' }}>
                {avatarEmoji(member.id)}
              </div>
              <StatusDot status={member.onlineStatus} />
            </div>
          </div>

          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-white">{member.nickname || member.username}</h2>
              {member.nickname && <p className="text-sm" style={{ color: 'var(--discord-text-muted)' }}>{member.username}</p>}
            </div>
            <div className="flex gap-2 mt-1">
              <button onClick={onRoles} className="discord-btn discord-btn-ghost text-xs py-1.5 flex items-center gap-1.5">
                <Shield size={13} /> Роли
              </button>
              <button onClick={onWarn} className="discord-btn discord-btn-danger text-xs py-1.5 flex items-center gap-1.5">
                <AlertTriangle size={13} /> Варн
              </button>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { icon: MessageSquare, label: 'Сообщений', value: (member.messageCount ?? 0).toLocaleString() },
              { icon: Calendar, label: 'На сервере с', value: member.joinedAt ? new Date(member.joinedAt).toLocaleDateString('ru') : '—' },
              { icon: Clock, label: 'Активность', value: member.lastActive ? new Date(member.lastActive).toLocaleDateString('ru') : '—' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="p-3 rounded-lg text-center" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
                <Icon size={16} className="mx-auto mb-1" style={{ color: 'var(--discord-text-muted)' }} />
                <p className="text-sm font-semibold text-white">{value}</p>
                <p className="text-xs" style={{ color: 'var(--discord-text-muted)' }}>{label}</p>
              </div>
            ))}
          </div>

          {/* XP / Level */}
          <div className="p-3 rounded-lg mb-4" style={{ backgroundColor: 'rgba(88,101,242,0.1)', border: '1px solid rgba(88,101,242,0.2)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-white">
                Уровень {level} {currentLvlRole ? `· ${currentLvlRole.name}` : ''}
              </span>
              <span className="text-xs" style={{ color: 'var(--discord-blurple)' }}>{xp.toLocaleString()} XP</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden mb-1" style={{ backgroundColor: 'var(--discord-border)' }}>
              <div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: 'var(--discord-blurple)' }} />
            </div>
            {nextLvlRole && (
              <p className="text-xs" style={{ color: 'var(--discord-text-muted)' }}>
                До {nextLvlRole.name}: ещё {(xpForLevelCalc(nextLvlRole.level) - xp).toLocaleString()} XP
              </p>
            )}
          </div>

          {/* Roles */}
          {roles.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--discord-text-muted)' }}>Роли</p>
              <div className="flex flex-wrap gap-1.5">
                {roles.map(r => {
                  const name  = typeof r === 'string' ? r : r.name;
                  const color = typeof r === 'string' ? '#5865F2' : (r.color || '#96989d');
                  const key   = typeof r === 'string' ? r : r.id;
                  return (
                    <span key={key} className="text-xs px-2 py-0.5 rounded-sm font-medium" style={{ backgroundColor: `${color}25`, color }}>
                      {name}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Warnings */}
          <div>
            <p className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--discord-text-muted)' }}>
              Предупреждения {warnings.length > 0 ? `(${warnings.length})` : ''}
            </p>
            {warnings.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--discord-text-muted)' }}>Нет предупреждений</p>
            ) : (
              <div className="space-y-1.5">
                {warnings.slice(0, 3).map((w, i) => (
                  <div key={w.id} className="flex items-start gap-2 px-2 py-1.5 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
                    <span className="text-xs font-bold mt-0.5 w-5" style={{ color: WARN_COLORS[warnings.length - 1 - i] || '#f23f43' }}>#{warnings.length - i}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{w.reason}</p>
                      <p className="text-xs" style={{ color: 'var(--discord-text-muted)' }}>{w.moderator} · {new Date(w.createdAt).toLocaleDateString('ru')}</p>
                    </div>
                  </div>
                ))}
                {warnings.length > 3 && (
                  <p className="text-xs" style={{ color: 'var(--discord-text-muted)' }}>и ещё {warnings.length - 3}...</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function xpForLevelCalc(lvl) {
  return lvl <= 0 ? 0 : (lvl * (lvl + 1)) / 2 * 100;
}

function XpBadge({ xp, level }) {
  const curFloor = xpForLevelCalc(level);
  const nextFloor = xpForLevelCalc(level + 1);
  const progress = nextFloor > curFloor ? Math.round(((xp - curFloor) / (nextFloor - curFloor)) * 100) : 100;
  return (
    <div className="min-w-[90px]">
      <div className="flex items-center justify-between mb-1 gap-2">
        <span className="text-xs font-bold" style={{ color: 'var(--discord-blurple)' }}>Lvl {level}</span>
        <span className="text-xs" style={{ color: 'var(--discord-text-muted)' }}>{xp.toLocaleString()} XP</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--discord-border)' }}>
        <div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: 'var(--discord-blurple)' }} />
      </div>
    </div>
  );
}

export default function Members() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [actionTarget, setActionTarget] = useState(null);
  const [rolesTarget, setRolesTarget] = useState(null);
  const [warnTarget, setWarnTarget] = useState(null);
  const [profileTarget, setProfileTarget] = useState(null);
  const [reason, setReason] = useState('');
  const [openMenu, setOpenMenu] = useState(null);

  const { data: members = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['members'],
    queryFn: () => api.get('/api/v1/members?limit=100').then(r => r.data),
  });

  const { data: allRoles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api.get('/api/v1/roles').then(r => r.data),
  });

  const kickMutation = useMutation({
    mutationFn: ({ id, reason }) => api.post(`/api/v1/members/${id}/kick`, { reason }),
    onSuccess: () => { setActionTarget(null); setReason(''); },
  });

  const banMutation = useMutation({
    mutationFn: ({ id, reason }) => api.post(`/api/v1/members/${id}/ban`, { reason }),
    onSuccess: () => { setActionTarget(null); setReason(''); },
  });

  useSocket((event, data) => {
    if (event === 'bot:ack' && data.status === 'ok' && (
      data.event === 'bot:member:kick' || data.event === 'bot:member:ban'
    )) {
      qc.invalidateQueries({ queryKey: ['members'] });
    }
  });

  // Real-time presence updates via socket
  useSocket((event, data) => {
    if (event === 'member:status') {
      qc.setQueryData(['members'], old =>
        (old || []).map(m => m.id === data.userId ? { ...m, onlineStatus: data.status } : m)
      );
    }
    if (event === 'member:status:bulk') {
      qc.setQueryData(['members'], old =>
        (old || []).map(m => ({ ...m, onlineStatus: data[m.id] || m.onlineStatus || 'offline' }))
      );
    }
  });

  const STATUS_ORDER = { online: 0, idle: 1, dnd: 2, offline: 3 };
  const filtered = members
    .filter(m =>
      (m.username ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (m.nickname ?? '').toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => (STATUS_ORDER[a.onlineStatus] ?? 3) - (STATUS_ORDER[b.onlineStatus] ?? 3));

  const handleAction = () => {
    if (!actionTarget) return;
    const args = { id: actionTarget.member.id, reason };
    if (actionTarget.action === 'kick') kickMutation.mutate(args);
    if (actionTarget.action === 'ban')  banMutation.mutate(args);
    setOpenMenu(null);
  };

  const isPending = kickMutation.isPending || banMutation.isPending;

  if (isError) {
    return (
      <div className="p-6">
        <div className="discord-card flex flex-col items-center justify-center py-20 gap-4" style={{ color: 'var(--discord-text-muted)' }}>
          <p>Failed to load members</p>
          <button onClick={refetch} className="discord-btn discord-btn-ghost flex items-center gap-2"><RefreshCw size={14} /> Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Members</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--discord-text-muted)' }}>
            {isLoading ? '…' : `${members.length} members`}
          </p>
        </div>
        <button onClick={refetch} className="discord-btn discord-btn-ghost flex items-center gap-2">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--discord-text-muted)' }} />
        <input className="discord-input" style={{ paddingLeft: '2.25rem' }} placeholder="Поиск участников…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="discord-card overflow-hidden">
          {Array(8).fill(0).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              <div className="w-8 h-8 rounded-full animate-pulse" style={{ backgroundColor: 'var(--discord-border)' }} />
              <div className="h-4 rounded animate-pulse flex-1" style={{ backgroundColor: 'var(--discord-border)', maxWidth: 180 }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="discord-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--discord-border)' }}>
                {['Участник', 'Ник', 'Роли', 'Сообщений', 'XP / Уровень', 'Вступил', 'Варны', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--discord-text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((member, i) => {
                const roles = parseRoles(member.roles);
                return (
                  <tr key={member.id} className="group transition-colors hover:bg-white/5" style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative flex-shrink-0">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-base" style={{ backgroundColor: 'var(--discord-darkest)' }}>
                            {avatarEmoji(member.id)}
                          </div>
                          <StatusDot status={member.onlineStatus} />
                        </div>
                        <p className="text-sm font-medium text-white">{member.username}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--discord-text-muted)' }}>
                      {member.nickname || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 items-center">
                        {roles.slice(0, 3).map(r => {
                          const name  = typeof r === 'string' ? r : r.name;
                          const color = typeof r === 'string' ? '#5865F2' : (r.color || '#96989d');
                          const key   = typeof r === 'string' ? r : r.id;
                          return (
                            <span key={key} className="text-xs px-1.5 py-0.5 rounded-sm font-medium" style={{ backgroundColor: `${color}25`, color }}>
                              {name}
                            </span>
                          );
                        })}
                        {roles.length > 3 && (
                          <span className="text-xs px-1.5 py-0.5 rounded-sm" style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--discord-text-muted)' }}>
                            +{roles.length - 3}
                          </span>
                        )}
                        <button
                          onClick={() => setRolesTarget(member)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-white/10"
                          style={{ color: 'var(--discord-text-muted)' }}
                          title="Управление ролями"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--discord-text-muted)' }}>
                      {(member.messageCount ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <XpBadge xp={member.xp ?? 0} level={member.level ?? 0} />
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--discord-text-muted)' }}>
                      {member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {member.warnCount > 0 ? (
                        <button
                          onClick={() => setWarnTarget(member)}
                          className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: member.warnCount >= 3 ? 'rgba(242,63,67,0.2)' : member.warnCount >= 2 ? 'rgba(240,178,50,0.2)' : 'rgba(242,63,67,0.1)', color: member.warnCount >= 2 ? '#f0b232' : '#f23f43' }}
                        >
                          <AlertTriangle size={11} /> {member.warnCount}
                        </button>
                      ) : (
                        <span style={{ color: 'var(--discord-text-muted)' }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="relative">
                        <button
                          onClick={() => setOpenMenu(openMenu === member.id ? null : member.id)}
                          className="p-1.5 rounded hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100"
                          style={{ color: 'var(--discord-text-muted)' }}
                        >
                          <MoreVertical size={15} />
                        </button>
                        {openMenu === member.id && (
                          <div
                            className="absolute right-0 top-8 z-20 rounded-lg overflow-hidden py-1 w-40"
                            style={{ backgroundColor: 'var(--discord-darkest)', border: '1px solid var(--discord-border)', boxShadow: '0 8px 16px rgba(0,0,0,0.4)' }}
                          >
                            <button
                              onClick={() => { setProfileTarget(member); setOpenMenu(null); }}
                              className="flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:bg-white/10 transition-colors"
                              style={{ color: 'var(--discord-text)' }}
                            >
                              <User size={14} /> Профиль
                            </button>
                            <button
                              onClick={() => { setRolesTarget(member); setOpenMenu(null); }}
                              className="flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:bg-white/10 transition-colors"
                              style={{ color: 'var(--discord-text)' }}
                            >
                              <Shield size={14} /> Роли
                            </button>
                            <button
                              onClick={() => { setWarnTarget(member); setOpenMenu(null); }}
                              className="flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:bg-yellow-500/10 transition-colors"
                              style={{ color: '#f0b232' }}
                            >
                              <AlertTriangle size={14} /> Предупреждение
                            </button>
                            <div style={{ height: '1px', backgroundColor: 'var(--discord-border)', margin: '4px 0' }} />
                            <button
                              onClick={() => { setActionTarget({ member, action: 'kick' }); setOpenMenu(null); }}
                              className="flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:bg-white/10 transition-colors"
                              style={{ color: 'var(--discord-text)' }}
                            >
                              <UserX size={14} /> Кик
                            </button>
                            <button
                              onClick={() => { setActionTarget({ member, action: 'ban' }); setOpenMenu(null); }}
                              className="flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:bg-red-500/20 transition-colors"
                              style={{ color: 'var(--discord-red)' }}
                            >
                              <ShieldBan size={14} /> Бан
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center py-16" style={{ color: 'var(--discord-text-muted)' }}>
              <Users size={40} className="mb-3 opacity-30" />
              <p className="text-sm">No members found</p>
            </div>
          )}
        </div>
      )}

      {rolesTarget && (
        <RolesModal
          member={rolesTarget}
          allRoles={allRoles}
          onClose={() => setRolesTarget(null)}
        />
      )}

      {warnTarget && (
        <WarnModal
          member={warnTarget}
          onClose={() => setWarnTarget(null)}
        />
      )}

      {/* Return to profile after closing Roles/Warn if opened from profile */}
      {!warnTarget && !rolesTarget && profileTarget && (
        <ProfileModal
          member={profileTarget}
          allRoles={allRoles}
          onClose={() => setProfileTarget(null)}
          onWarn={() => setWarnTarget(profileTarget)}
          onRoles={() => setRolesTarget(profileTarget)}
        />
      )}

      {actionTarget && (
        <Modal
          title={actionTarget.action === 'kick' ? `Кик ${actionTarget.member.username}` : `Бан ${actionTarget.member.username}`}
          onClose={() => { setActionTarget(null); setReason(''); }}
        >
          <p className="text-sm mb-4 mt-1" style={{ color: 'var(--discord-text-muted)' }}>
            {actionTarget.action === 'kick' && 'Участник сможет вернуться по инвайту.'}
            {actionTarget.action === 'ban'  && 'Участник не сможет вернуться на сервер.'}
          </p>
          <div className="mb-4">
            <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: 'var(--discord-text-muted)' }}>Причина (необязательно)</label>
            <input className="discord-input" placeholder="Укажи причину…" value={reason} onChange={e => setReason(e.target.value)} />
          </div>
          {(kickMutation.isError || banMutation.isError) && (
            <p className="text-xs mb-3" style={{ color: 'var(--discord-red)' }}>Действие не выполнено. Бот недоступен.</p>
          )}
          <div className="flex justify-end gap-2">
            <button className="discord-btn discord-btn-ghost" onClick={() => { setActionTarget(null); setReason(''); }}>Отмена</button>
            <button
              className={`discord-btn ${actionTarget.action === 'ban' ? 'discord-btn-danger' : 'discord-btn-primary'}`}
              onClick={handleAction}
              disabled={isPending}
            >
              {isPending ? 'Выполняется…' : actionTarget.action === 'kick' ? 'Кик' : 'Бан'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
