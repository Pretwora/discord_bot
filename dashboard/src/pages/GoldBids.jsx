import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Swords, Plus, X, ChevronDown, ChevronRight, Trophy,
  Users, Coins, Ban, ShieldOff, CheckCircle2, Clock, Pencil, Save,
} from 'lucide-react';
import api from '../lib/api';

// ─── Constants ───────────────────────────────────────────────────────────────

const LOOT_TABLE = {
  GRUUL:       { name: 'Логово Груула',      emoji: '🐉', format: 25, drops: [{ slot: 'LEGS', label: 'Штаны', qty: 1 }, { slot: 'SHOULDERS', label: 'Плечи', qty: 1 }] },
  MAGTHERIDON: { name: 'Логово Магтеридона', emoji: '🔥', format: 25, drops: [{ slot: 'CHEST', label: 'Нагрудник', qty: 1 }] },
  KARAZHAN:    { name: 'Каражан',            emoji: '🏰', format: 10, drops: [{ slot: 'GLOVES', label: 'Перчатки', qty: 1 }, { slot: 'HEAD', label: 'Голова', qty: 1 }] },
};
const TOKEN_TYPES = ['ПРШ', 'ЛХМД', 'ВЖД'];

const RAID_TYPES = {
  GRUUL_MAGTHERIDON: { label: 'Груул + Магтеридон', keys: ['GRUUL', 'MAGTHERIDON'] },
  KARAZHAN:          { label: 'Каражан',             keys: ['KARAZHAN'] },
  GRUUL:             { label: 'Логово Груула',        keys: ['GRUUL'] },
  MAGTHERIDON:       { label: 'Логово Магтеридона',  keys: ['MAGTHERIDON'] },
};

const STATUS_MAP = {
  OPEN:        { label: 'Открыт',   color: 'var(--discord-green)' },
  LOCKED:      { label: 'Закрыт',   color: 'var(--discord-yellow)' },
  IN_PROGRESS: { label: 'Идёт',     color: 'var(--discord-blurple)' },
  COMPLETED:   { label: 'Завершён', color: 'var(--discord-text-muted)' },
  CANCELLED:   { label: 'Отменён',  color: 'var(--discord-red)' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.CANCELLED;
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ backgroundColor: `${s.color}22`, color: s.color }}>
      {s.label}
    </span>
  );
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ru', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Create modal ─────────────────────────────────────────────────────────────

function CreateModal({ onClose, onCreated }) {
  const [raidType, setRaidType] = useState('GRUUL_MAGTHERIDON');
  const [slotPrice, setSlotPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [error, setError] = useState('');

  const mut = useMutation({
    mutationFn: body => api.post('/api/v1/gold-raids', body).then(r => r.data),
    onSuccess: data => { onCreated(data); onClose(); },
    onError: err => setError(err.response?.data?.error || 'Ошибка создания'),
  });

  const submit = () => {
    setError('');
    mut.mutate({
      raidType,
      slotPrice: slotPrice ? parseInt(slotPrice) : null,
      notes: notes || null,
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}>
      <div className="discord-card w-full max-w-md p-6 relative space-y-4" style={{ backgroundColor: 'var(--discord-bg-secondary)' }}>
        <button onClick={onClose} className="absolute top-4 right-4 p-1 rounded hover:bg-white/10" style={{ color: 'var(--discord-text-muted)' }}>
          <X size={18} />
        </button>
        <h2 className="text-lg font-bold text-white flex items-center gap-2"><Swords size={18} /> Новый рейд</h2>

        <div>
          <label className="block text-xs font-semibold uppercase mb-1" style={{ color: 'var(--discord-text-muted)' }}>Рейд *</label>
          <div className="relative">
            <select
              className="discord-input appearance-none pr-7 w-full"
              value={raidType}
              onChange={e => setRaidType(e.target.value)}
            >
              <option value="GRUUL_MAGTHERIDON">🐉🔥 Груул + Магтеридон (25 чел)</option>
              <option value="KARAZHAN">🏰 Каражан (10 чел)</option>
              <option value="GRUUL">🐉 Логово Груула (25 чел)</option>
              <option value="MAGTHERIDON">🔥 Логово Магтеридона (25 чел)</option>
            </select>
            <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--discord-text-muted)' }} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase mb-1" style={{ color: 'var(--discord-text-muted)' }}>💰 Цена за токен (золото)</label>
          <input
            type="number"
            min="0"
            className="discord-input text-lg font-bold w-full"
            placeholder="например: 5000"
            value={slotPrice}
            onChange={e => setSlotPrice(e.target.value)}
            style={{ color: 'var(--discord-yellow)' }}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase mb-1" style={{ color: 'var(--discord-text-muted)' }}>Дата и время (необязательно)</label>
          <input
            type="datetime-local"
            className="discord-input"
            value={scheduledAt}
            onChange={e => setScheduledAt(e.target.value)}
            style={{ colorScheme: 'dark' }}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase mb-1" style={{ color: 'var(--discord-text-muted)' }}>Примечание</label>
          <input
            className="discord-input"
            placeholder="Пятница 20:00, сбор в голосовом..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        {error && <p className="text-xs" style={{ color: 'var(--discord-red)' }}>{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button className="discord-btn discord-btn-ghost" onClick={onClose}>Отмена</button>
          <button
            className="discord-btn discord-btn-primary flex items-center gap-2"
            onClick={submit}
            disabled={mut.isPending}
          >
            <Swords size={15} />
            {mut.isPending ? 'Создаём…' : 'Создать рейд'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Raid detail panel ────────────────────────────────────────────────────────

function RaidDetail({ raidId, onClose }) {
  const qc = useQueryClient();

  const { data: raid, isLoading } = useQuery({
    queryKey: ['gold-raid', raidId],
    queryFn: () => api.get(`/api/v1/gold-raids/${raidId}`).then(r => r.data),
    refetchInterval: 10000,
  });

  const statusMut = useMutation({
    mutationFn: ({ status, totalGold }) => api.patch(`/api/v1/gold-raids/${raidId}`, { status, totalGold }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['gold-raids'] }); qc.invalidateQueries({ queryKey: ['gold-raid', raidId] }); },
  });

  const cancelMut = useMutation({
    mutationFn: () => api.delete(`/api/v1/gold-raids/${raidId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['gold-raids'] }); onClose(); },
  });

  const editMut = useMutation({
    mutationFn: body => api.patch(`/api/v1/gold-raids/${raidId}`, body).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gold-raids'] });
      qc.invalidateQueries({ queryKey: ['gold-raid', raidId] });
      setEditing(false);
    },
  });

  const [goldInput, setGoldInput] = useState('');
  const [editing, setEditing] = useState(false);
  const [editNotes, setEditNotes] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editScheduledAt, setEditScheduledAt] = useState('');
  const [editText, setEditText] = useState('');

  function startEdit() {
    setEditNotes(raid.notes ?? '');
    setEditPrice(raid.slotPrice != null ? String(raid.slotPrice) : '');
    setEditScheduledAt(raid.scheduledAt ? new Date(raid.scheduledAt).toISOString().slice(0, 16) : '');
    setEditText(raid.extraText ?? '');
    setEditing(true);
  }

  function saveEdit() {
    editMut.mutate({
      notes: editNotes || null,
      slotPrice: editPrice ? parseInt(editPrice) : null,
      scheduledAt: editScheduledAt ? new Date(editScheduledAt).toISOString() : null,
      extraText: editText || null,
    });
  }

  if (isLoading) return (
    <div className="discord-card p-6 flex items-center justify-center" style={{ minHeight: 200 }}>
      <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--discord-blurple)', borderTopColor: 'transparent' }} />
    </div>
  );
  if (!raid) return null;

  const buyers = raid.buyers ?? [];
  const pumpers = raid.pumpers ?? [];

  return (
    <div className="discord-card p-5 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-white font-semibold">{RAID_TYPES[raid.raidType]?.label ?? 'Рейд'}</span>
            <StatusBadge status={raid.status} />
          </div>
          <p className="text-xs font-mono" style={{ color: 'var(--discord-text-muted)' }}>#{raid.id.slice(0, 8)}</p>
          {raid.slotPrice != null && (
            <p className="text-2xl font-bold mt-1" style={{ color: 'var(--discord-yellow)' }}>
              💰 {raid.slotPrice.toLocaleString()} золота за токен
            </p>
          )}
          {raid.notes && <p className="text-sm" style={{ color: 'var(--discord-text-muted)' }}>{raid.notes}</p>}
          {raid.extraText && <p className="text-sm" style={{ color: 'var(--discord-text)' }}>{raid.extraText}</p>}
          {raid.scheduledAt && <p className="text-xs" style={{ color: 'var(--discord-text-muted)' }}>📅 {fmtDate(raid.scheduledAt)}</p>}
        </div>
        <div className="flex items-center gap-1">
          {!editing && (
            <button onClick={startEdit} className="p-1.5 rounded hover:bg-white/10 transition-colors" style={{ color: 'var(--discord-text-muted)' }} title="Редактировать">
              <Pencil size={14} />
            </button>
          )}
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10" style={{ color: 'var(--discord-text-muted)' }}>
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <div className="rounded-lg p-4 space-y-3" style={{ backgroundColor: 'var(--discord-bg)', border: '1px solid var(--discord-blurple)' }}>
          <p className="text-xs font-semibold uppercase" style={{ color: 'var(--discord-blurple)' }}>✏️ Редактирование</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase mb-1" style={{ color: 'var(--discord-text-muted)' }}>💰 Цена за токен</label>
              <input type="number" min="0" className="discord-input w-full text-sm" style={{ color: 'var(--discord-yellow)' }}
                placeholder="5000" value={editPrice} onChange={e => setEditPrice(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase mb-1" style={{ color: 'var(--discord-text-muted)' }}>📅 Дата и время</label>
              <input type="datetime-local" className="discord-input w-full text-sm" style={{ colorScheme: 'dark' }}
                value={editScheduledAt} onChange={e => setEditScheduledAt(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase mb-1" style={{ color: 'var(--discord-text-muted)' }}>📝 Заметка</label>
            <input className="discord-input w-full text-sm" placeholder="Пятница 20:00, сбор в голосовом..."
              value={editNotes} onChange={e => setEditNotes(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase mb-1" style={{ color: 'var(--discord-text-muted)' }}>📄 Произвольный текст в embed</label>
            <textarea className="discord-input w-full text-sm resize-none" rows={3}
              placeholder="Любой текст который появится в анонсе..."
              value={editText} onChange={e => setEditText(e.target.value)} />
          </div>
          <div className="flex gap-2 justify-end">
            <button className="discord-btn discord-btn-ghost text-sm" onClick={() => setEditing(false)}>Отмена</button>
            <button className="discord-btn discord-btn-primary text-sm flex items-center gap-1.5"
              onClick={saveEdit} disabled={editMut.isPending}>
              <Save size={13} /> {editMut.isPending ? 'Сохраняем…' : 'Сохранить и обновить Discord'}
            </button>
          </div>
        </div>
      )}

      {/* Status controls */}
      {raid.status === 'OPEN' && (
        <div className="flex gap-2 flex-wrap">
          <button className="discord-btn discord-btn-ghost text-sm" onClick={() => statusMut.mutate({ status: 'LOCKED' })}>🔒 Закрыть запись</button>
          <button className="discord-btn text-sm" style={{ backgroundColor: 'var(--discord-red)', color: '#fff' }} onClick={() => cancelMut.mutate()}>❌ Отменить</button>
        </div>
      )}
      {raid.status === 'LOCKED' && (
        <div className="flex gap-2 flex-wrap">
          <button className="discord-btn discord-btn-primary text-sm" onClick={() => statusMut.mutate({ status: 'IN_PROGRESS' })}>⚔️ Начать рейд</button>
          <button className="discord-btn discord-btn-ghost text-sm" onClick={() => statusMut.mutate({ status: 'OPEN' })}>🔓 Открыть запись</button>
        </div>
      )}
      {raid.status === 'IN_PROGRESS' && (
        <div className="flex items-end gap-2 flex-wrap">
          <div>
            <label className="block text-xs font-semibold uppercase mb-1" style={{ color: 'var(--discord-text-muted)' }}>Общая голда</label>
            <input
              type="number" min="0" placeholder="0"
              className="discord-input w-36 text-sm"
              value={goldInput}
              onChange={e => setGoldInput(e.target.value)}
            />
          </div>
          <button
            className="discord-btn discord-btn-primary text-sm flex items-center gap-1"
            onClick={() => statusMut.mutate({ status: 'COMPLETED', totalGold: parseInt(goldInput) || 0 })}
          >
            <CheckCircle2 size={14} /> Завершить
          </button>
        </div>
      )}
      {raid.status === 'COMPLETED' && raid.totalGold > 0 && (
        <p className="text-sm" style={{ color: 'var(--discord-green)' }}>
          💰 Итого: <strong>{raid.totalGold.toLocaleString()}g</strong>
          {pumpers.filter(p => !p.noShow).length > 0 && ` → по ${Math.floor(raid.totalGold / pumpers.filter(p => !p.noShow).length).toLocaleString()}g каждому`}
        </p>
      )}

      {/* Pumpers */}
      <div>
        <p className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--discord-text-muted)' }}>⚔️ Памперы [{pumpers.length}]</p>
        {pumpers.length === 0
          ? <p className="text-xs" style={{ color: 'var(--discord-text-muted)' }}>Нет записей</p>
          : <div className="flex flex-wrap gap-1.5">
            {pumpers.map(p => (
              <span key={p.id} className="text-xs px-2 py-1 rounded flex items-center gap-1"
                style={{ backgroundColor: 'var(--discord-bg)', color: p.noShow ? 'var(--discord-red)' : p.confirmed ? 'var(--discord-green)' : 'var(--discord-text)' }}>
                {p.confirmed ? '✅' : '⬜'} {p.username}
                {p.earnedGold != null && ` +${p.earnedGold.toLocaleString()}g`}
              </span>
            ))}
          </div>
        }
      </div>

      {/* Buyer queues */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase" style={{ color: 'var(--discord-text-muted)' }}>
          💰 Очередь баеров — {RAID_TYPES[raid.raidType]?.label ?? raid.raidType ?? ''}
        </p>
        {Object.entries(LOOT_TABLE).filter(([raidKey]) => (RAID_TYPES[raid.raidType]?.keys ?? Object.keys(LOOT_TABLE)).includes(raidKey)).map(([raidKey, raidData]) => (
          <div key={raidKey}>
            <p className="text-sm font-semibold text-white mb-1.5">{raidData.emoji} {raidData.name}</p>
            <div className="space-y-1">
              {raidData.drops.map(drop => (
                <div key={drop.slot}>
                  <p className="text-xs mb-1" style={{ color: 'var(--discord-text-muted)' }}>{drop.label}</p>
                  <div className="grid grid-cols-3 gap-1">
                    {TOKEN_TYPES.map(token => {
                      const queued = buyers.filter(b => b.raidTarget === raidKey && b.slot === drop.slot && b.tokenType === token && b.status === 'QUEUED');
                      const full = queued.length >= drop.qty;
                      return (
                        <div key={token} className="rounded p-1.5 text-xs" style={{ backgroundColor: full ? 'rgba(87,242,135,0.1)' : 'var(--discord-bg)' }}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold" style={{ color: full ? 'var(--discord-green)' : 'var(--discord-text)' }}>{token}</span>
                            <span style={{ color: 'var(--discord-text-muted)' }}>{queued.length}/{drop.qty}</span>
                          </div>
                          {queued.length > 0
                            ? queued.map(b => (
                              <div key={b.id} className="truncate" style={{ color: 'var(--discord-text-muted)' }}>
                                {b.username}{b.characterName && <span style={{ color: 'var(--discord-blurple)' }}> ({b.characterName})</span>}
                              </div>
                            ))
                            : <div style={{ color: 'var(--discord-text-muted)' }}>—</div>
                          }
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Raid card ────────────────────────────────────────────────────────────────

function RaidCard({ raid, isSelected, onSelect }) {
  return (
    <button
      onClick={onSelect}
      className="discord-card p-4 w-full text-left transition-all hover:brightness-110"
      style={isSelected ? { borderColor: 'var(--discord-blurple)', borderWidth: 1, borderStyle: 'solid' } : {}}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-xs" style={{ color: 'var(--discord-text-muted)' }}>{raid.id.slice(0, 8)}</span>
          <StatusBadge status={raid.status} />
          {raid.notes && <span className="text-sm text-white truncate">{raid.notes}</span>}
        </div>
        <ChevronRight size={15} style={{ color: 'var(--discord-text-muted)', flexShrink: 0 }} />
      </div>
      <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: 'var(--discord-text-muted)' }}>
        <span className="font-medium" style={{ color: 'var(--discord-text)' }}>{RAID_TYPES[raid.raidType]?.label ?? raid.raidType ?? '—'}</span>
        {raid.slotPrice != null && (
          <span className="font-bold text-sm px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(240,178,50,0.15)', color: 'var(--discord-yellow)' }}>
            💰 {raid.slotPrice.toLocaleString()}g / вещь
          </span>
        )}
        <span className="flex items-center gap-1"><Users size={11} /> {raid.pumperCount} памперов</span>
        <span className="flex items-center gap-1"><Coins size={11} /> {raid.buyerCount} заказов</span>
        <span className="flex items-center gap-1 ml-auto"><Clock size={11} /> {fmtDate(raid.createdAt)}</span>
      </div>
    </button>
  );
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

function Leaderboard() {
  const { data: stats = [], isLoading } = useQuery({
    queryKey: ['gb-leaderboard'],
    queryFn: () => api.get('/api/v1/gold-raids/stats/leaderboard').then(r => r.data),
  });

  if (isLoading) return <div className="p-6 text-center" style={{ color: 'var(--discord-text-muted)' }}>Загрузка...</div>;

  return (
    <div className="space-y-2">
      {stats.length === 0
        ? <p className="text-sm text-center py-8" style={{ color: 'var(--discord-text-muted)' }}>Статистики пока нет</p>
        : stats.map((s, i) => (
          <div key={s.id} className="discord-card p-3 flex items-center gap-3">
            <span className="text-lg font-bold w-7 text-center" style={{ color: i === 0 ? '#f0b232' : i === 1 ? '#b0b0b0' : i === 2 ? '#cd7f32' : 'var(--discord-text-muted)' }}>
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{s.username}</p>
              <p className="text-xs" style={{ color: 'var(--discord-text-muted)' }}>{s.pumperRaids} рейдов</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold" style={{ color: 'var(--discord-yellow)' }}>{s.pumperGold.toLocaleString()}g</p>
              <p className="text-xs" style={{ color: 'var(--discord-text-muted)' }}>заработано</p>
            </div>
          </div>
        ))
      }
    </div>
  );
}

// ─── Blacklist ────────────────────────────────────────────────────────────────

function Blacklist() {
  const qc = useQueryClient();
  const { data: list = [], isLoading } = useQuery({
    queryKey: ['gb-blacklist'],
    queryFn: () => api.get('/api/v1/gold-raids/blacklist/all').then(r => r.data),
  });

  const removeMut = useMutation({
    mutationFn: userId => api.delete(`/api/v1/gold-raids/blacklist/${userId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gb-blacklist'] }),
  });

  if (isLoading) return <div className="p-6 text-center" style={{ color: 'var(--discord-text-muted)' }}>Загрузка...</div>;

  return (
    <div className="space-y-2">
      {list.length === 0
        ? <p className="text-sm text-center py-8" style={{ color: 'var(--discord-text-muted)' }}>Чёрный список пуст</p>
        : list.map(b => (
          <div key={b.id} className="discord-card p-3 flex items-center gap-3">
            <Ban size={16} style={{ color: 'var(--discord-red)', flexShrink: 0 }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">{b.username}</p>
              <p className="text-xs" style={{ color: 'var(--discord-text-muted)' }}>{b.reason ?? 'причина не указана'} · {b.noShows} пропусков</p>
            </div>
            <button
              onClick={() => removeMut.mutate(b.userId)}
              disabled={removeMut.isPending}
              className="p-1.5 rounded hover:bg-white/10 transition-colors"
              style={{ color: 'var(--discord-text-muted)' }}
              title="Снять бан"
            >
              <ShieldOff size={14} />
            </button>
          </div>
        ))
      }
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GoldBids() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState('raids'); // raids | leaderboard | blacklist

  const { data: raids = [], isLoading } = useQuery({
    queryKey: ['gold-raids', statusFilter],
    queryFn: () => api.get(`/api/v1/gold-raids?status=${statusFilter}&limit=50`).then(r => r.data),
    refetchInterval: 15000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['gold-raids'] });

  const active = raids.filter(r => ['OPEN', 'LOCKED', 'IN_PROGRESS'].includes(r.status));
  const done   = raids.filter(r => ['COMPLETED', 'CANCELLED'].includes(r.status));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Swords size={22} /> Голдбиды
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--discord-text-muted)' }}>
            {isLoading ? '…' : `${active.length} активных · ${done.length} завершённых`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              className="discord-input appearance-none pr-7 text-sm py-2"
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setSelectedId(null); }}
              style={{ minWidth: 130 }}
            >
              <option value="ALL">Все</option>
              <option value="OPEN">Открытые</option>
              <option value="COMPLETED">Завершённые</option>
              <option value="CANCELLED">Отменённые</option>
            </select>
            <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--discord-text-muted)' }} />
          </div>
          <button onClick={() => setShowCreate(true)} className="discord-btn discord-btn-primary flex items-center gap-2">
            <Plus size={16} /> Новый рейд
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b" style={{ borderColor: 'var(--discord-border)' }}>
        {[
          { id: 'raids',       label: 'Рейды',     icon: Swords },
          { id: 'leaderboard', label: 'Топ памперов', icon: Trophy },
          { id: 'blacklist',   label: 'Чёрный список', icon: Ban },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="px-4 py-2 text-sm font-medium flex items-center gap-1.5 border-b-2 -mb-px transition-colors"
            style={{
              borderColor: tab === id ? 'var(--discord-blurple)' : 'transparent',
              color: tab === id ? 'var(--discord-blurple)' : 'var(--discord-text-muted)',
            }}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'raids' && (
        <div className="grid grid-cols-1 gap-4" style={{ gridTemplateColumns: selectedId ? '1fr 1fr' : '1fr' }}>
          {/* List */}
          <div className="space-y-2">
            {isLoading ? (
              Array(3).fill(0).map((_, i) => (
                <div key={i} className="discord-card p-4 h-20 animate-pulse" style={{ backgroundColor: 'var(--discord-border)' }} />
              ))
            ) : raids.length === 0 ? (
              <div className="discord-card flex flex-col items-center justify-center py-20 gap-3" style={{ color: 'var(--discord-text-muted)' }}>
                <Swords size={40} className="opacity-25" />
                <p className="text-sm">Рейдов пока нет</p>
                <button onClick={() => setShowCreate(true)} className="discord-btn discord-btn-primary flex items-center gap-2 mt-1">
                  <Plus size={15} /> Создать первый
                </button>
              </div>
            ) : (
              raids.map(r => (
                <RaidCard
                  key={r.id}
                  raid={r}
                  isSelected={r.id === selectedId}
                  onSelect={() => setSelectedId(r.id === selectedId ? null : r.id)}
                />
              ))
            )}
          </div>

          {/* Detail panel */}
          {selectedId && (
            <RaidDetail raidId={selectedId} onClose={() => setSelectedId(null)} />
          )}
        </div>
      )}

      {tab === 'leaderboard' && <Leaderboard />}
      {tab === 'blacklist' && <Blacklist />}

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={invalidate}
        />
      )}
    </div>
  );
}
