import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Gift, Plus, X, Trophy, Users, Clock, StopCircle, RefreshCw, Trash2, ChevronDown } from 'lucide-react';
import api from '../lib/api';

// ─── Helpers ────────────────────────────────────────────────────────────────

function statusBadge(status) {
  const map = {
    ACTIVE:    { label: 'Активен',  color: 'var(--discord-green)' },
    ENDED:     { label: 'Завершён', color: 'var(--discord-text-muted)' },
    CANCELLED: { label: 'Отменён',  color: 'var(--discord-red)' },
  };
  const s = map[status] ?? map.ENDED;
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ backgroundColor: `${s.color}22`, color: s.color }}>
      {s.label}
    </span>
  );
}

function timeLabel(endsAt, status) {
  if (status !== 'ACTIVE') return new Date(endsAt).toLocaleDateString('ru', { day: 'numeric', month: 'short', year: 'numeric' });
  const diff = new Date(endsAt) - Date.now();
  if (diff <= 0) return 'Скоро';
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (d > 0) return `${d}д ${h}ч`;
  if (h > 0) return `${h}ч ${m}м`;
  return `${m}м`;
}

// ─── Create modal ───────────────────────────────────────────────────────────

function CreateModal({ channels, onClose, onCreated }) {
  const [form, setForm] = useState({
    prize: '', description: '', channelId: '', winnersCount: 1,
    endsAt: '', requiredRoleId: '',
  });
  const [error, setError] = useState('');

  const mut = useMutation({
    mutationFn: body => api.post('/api/v1/giveaways', body).then(r => r.data),
    onSuccess: data => { onCreated(data); onClose(); },
    onError: err => setError(err.response?.data?.error || 'Ошибка создания'),
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const minDate = new Date(Date.now() + 60000).toISOString().slice(0, 16);

  const submit = () => {
    if (!form.prize.trim()) return setError('Укажи приз');
    if (!form.channelId) return setError('Выбери канал');
    if (!form.endsAt) return setError('Укажи дату окончания');
    setError('');
    mut.mutate({
      ...form,
      winnersCount: parseInt(form.winnersCount),
      requiredRoleId: form.requiredRoleId || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}>
      <div className="discord-card w-full max-w-lg p-6 relative space-y-4" style={{ backgroundColor: 'var(--discord-bg-secondary)' }}>
        <button onClick={onClose} className="absolute top-4 right-4 p-1 rounded hover:bg-white/10" style={{ color: 'var(--discord-text-muted)' }}>
          <X size={18} />
        </button>
        <h2 className="text-lg font-bold text-white flex items-center gap-2"><Gift size={18} /> Новый розыгрыш</h2>

        {/* Prize */}
        <div>
          <label className="block text-xs font-semibold uppercase mb-1" style={{ color: 'var(--discord-text-muted)' }}>Приз *</label>
          <input className="discord-input" placeholder="Nitro на 1 месяц" value={form.prize} onChange={e => set('prize', e.target.value)} />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold uppercase mb-1" style={{ color: 'var(--discord-text-muted)' }}>Описание</label>
          <textarea
            className="discord-input resize-none"
            rows={2}
            placeholder="Подробности о призе..."
            value={form.description}
            onChange={e => set('description', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Channel */}
          <div>
            <label className="block text-xs font-semibold uppercase mb-1" style={{ color: 'var(--discord-text-muted)' }}>Канал *</label>
            <div className="relative">
              <select className="discord-input appearance-none pr-7" value={form.channelId} onChange={e => set('channelId', e.target.value)}>
                <option value="">Выбрать...</option>
                {channels.filter(c => c.type === 'TEXT' || c.type === 'text').map(c => (
                  <option key={c.id} value={c.id}>#{c.name}</option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--discord-text-muted)' }} />
            </div>
          </div>

          {/* Winners count */}
          <div>
            <label className="block text-xs font-semibold uppercase mb-1" style={{ color: 'var(--discord-text-muted)' }}>Победителей</label>
            <input
              type="number" min={1} max={20}
              className="discord-input"
              value={form.winnersCount}
              onChange={e => set('winnersCount', e.target.value)}
            />
          </div>
        </div>

        {/* End date */}
        <div>
          <label className="block text-xs font-semibold uppercase mb-1" style={{ color: 'var(--discord-text-muted)' }}>Конец розыгрыша *</label>
          <input
            type="datetime-local"
            className="discord-input"
            min={minDate}
            value={form.endsAt}
            onChange={e => set('endsAt', e.target.value)}
            style={{ colorScheme: 'dark' }}
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
            <Gift size={15} />
            {mut.isPending ? 'Создаём…' : 'Запустить розыгрыш'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Giveaway card ──────────────────────────────────────────────────────────

function GiveawayCard({ g, onEnd, onReroll, onCancel }) {
  const winners = g.winners ?? [];

  return (
    <div className="discord-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-semibold truncate">{g.prize}</span>
            {statusBadge(g.status)}
          </div>
          {g.description && (
            <p className="text-sm mt-0.5 line-clamp-2" style={{ color: 'var(--discord-text-muted)' }}>{g.description}</p>
          )}
        </div>

        {g.status === 'ACTIVE' && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => onEnd(g.id)} title="Завершить" className="p-1.5 rounded hover:bg-yellow-500/20 transition-colors" style={{ color: 'var(--discord-yellow)' }}>
              <StopCircle size={15} />
            </button>
            <button onClick={() => onCancel(g.id)} title="Отменить" className="p-1.5 rounded hover:bg-red-500/20 transition-colors" style={{ color: 'var(--discord-red)' }}>
              <Trash2 size={15} />
            </button>
          </div>
        )}
        {g.status === 'ENDED' && (
          <button onClick={() => onReroll(g.id)} title="Перебросить" className="p-1.5 rounded hover:bg-white/10 transition-colors flex items-center gap-1 text-xs" style={{ color: 'var(--discord-text-muted)' }}>
            <RefreshCw size={13} /> Reroll
          </button>
        )}
      </div>

      <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--discord-text-muted)' }}>
        <span className="flex items-center gap-1"><Users size={12} /> {g.entryCount} участников</span>
        <span className="flex items-center gap-1"><Trophy size={12} /> {g.winnersCount} победителей</span>
        <span className="flex items-center gap-1">
          <Clock size={12} />
          {g.status === 'ACTIVE' ? `Конец через ${timeLabel(g.endsAt, g.status)}` : timeLabel(g.endsAt, g.status)}
        </span>
      </div>

      {winners.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          <span className="text-xs font-semibold" style={{ color: 'var(--discord-yellow)' }}>🏆</span>
          {winners.map(w => (
            <span key={w.id} className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(240,178,50,0.15)', color: 'var(--discord-yellow)' }}>
              {w.userId}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Giveaways() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');

  const { data: giveaways = [], isLoading } = useQuery({
    queryKey: ['giveaways', statusFilter],
    queryFn: () => api.get(`/api/v1/giveaways?status=${statusFilter}&limit=50`).then(r => r.data),
    refetchInterval: 30000,
  });

  const { data: channels = [] } = useQuery({
    queryKey: ['channels'],
    queryFn: () => api.get('/api/v1/channels').then(r => r.data),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['giveaways'] });

  const endMut = useMutation({
    mutationFn: id => api.post(`/api/v1/giveaways/${id}/end`),
    onSuccess: invalidate,
  });

  const rerollMut = useMutation({
    mutationFn: id => api.post(`/api/v1/giveaways/${id}/reroll`),
    onSuccess: invalidate,
  });

  const cancelMut = useMutation({
    mutationFn: id => api.delete(`/api/v1/giveaways/${id}`),
    onSuccess: invalidate,
  });

  const active  = giveaways.filter(g => g.status === 'ACTIVE');
  const ended   = giveaways.filter(g => g.status !== 'ACTIVE');

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Giveaways</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--discord-text-muted)' }}>
            {isLoading ? '…' : `${active.length} активных · ${ended.length} завершённых`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              className="discord-input appearance-none pr-7 text-sm py-2"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{ minWidth: 130 }}
            >
              <option value="ALL">Все</option>
              <option value="ACTIVE">Активные</option>
              <option value="ENDED">Завершённые</option>
            </select>
            <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--discord-text-muted)' }} />
          </div>
          <button onClick={() => setShowCreate(true)} className="discord-btn discord-btn-primary flex items-center gap-2">
            <Plus size={16} /> Новый розыгрыш
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="discord-card p-4 h-24 animate-pulse" style={{ backgroundColor: 'var(--discord-border)' }} />
          ))}
        </div>
      ) : giveaways.length === 0 ? (
        <div className="discord-card flex flex-col items-center justify-center py-20 gap-3" style={{ color: 'var(--discord-text-muted)' }}>
          <Gift size={40} className="opacity-25" />
          <p className="text-sm">Розыгрышей пока нет</p>
          <button onClick={() => setShowCreate(true)} className="discord-btn discord-btn-primary flex items-center gap-2 mt-1">
            <Plus size={15} /> Запустить первый
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {giveaways.map(g => (
            <GiveawayCard
              key={g.id}
              g={g}
              onEnd={id => endMut.mutate(id)}
              onReroll={id => rerollMut.mutate(id)}
              onCancel={id => cancelMut.mutate(id)}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateModal
          channels={channels}
          onClose={() => setShowCreate(false)}
          onCreated={invalidate}
        />
      )}
    </div>
  );
}
