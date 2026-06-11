import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSocket } from '../hooks/useSocket';
import {
  Hash, Volume2, ChevronDown, ChevronRight,
  Plus, Trash2, Edit3, Lock, X, Search, RefreshCw, FolderOpen
} from 'lucide-react';
import api from '../lib/api';

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
      <div className="discord-card w-full max-w-md p-6 relative" style={{ backgroundColor: 'var(--discord-bg-secondary)' }}>
        <button onClick={onClose} className="absolute top-4 right-4 p-1 rounded hover:bg-white/10 transition-colors" style={{ color: 'var(--discord-text-muted)' }}>
          <X size={18} />
        </button>
        <h2 className="text-lg font-bold text-white mb-4">{title}</h2>
        {children}
      </div>
    </div>
  );
}

// Group flat channel list into categories
function groupChannels(channels) {
  const categories = channels
    .filter(c => c.type === 'CATEGORY' || c.type === 'category')
    .sort((a, b) => a.position - b.position);

  const uncategorised = { id: '__none', name: 'UNCATEGORISED', channels: [] };

  const result = categories.map(cat => ({
    id: cat.id,
    name: cat.name.toUpperCase(),
    channels: channels
      .filter(c => c.categoryId === cat.id && c.type !== 'CATEGORY' && c.type !== 'category')
      .sort((a, b) => a.position - b.position),
  }));

  const assigned = new Set(result.flatMap(g => g.channels.map(c => c.id)));
  const loose = channels.filter(
    c => !assigned.has(c.id) && c.type !== 'CATEGORY' && c.type !== 'category'
  );
  if (loose.length) {
    uncategorised.channels = loose;
    result.push(uncategorised);
  }

  return result;
}

export default function Channels() {
  const qc = useQueryClient();
  const [collapsed, setCollapsed] = useState({});
  const [showCreate, setShowCreate] = useState(false);
  const [newCh, setNewCh] = useState({ name: '', type: 'TEXT', categoryId: '' });
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data: channels = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['channels'],
    queryFn: () => api.get('/api/v1/channels').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: body => api.post('/api/v1/channels', body),
    onSuccess: () => { setShowCreate(false); setNewCh({ name: '', type: 'TEXT', categoryId: '' }); qc.invalidateQueries({ queryKey: ['channels'] }); },
  });

  const deleteMutation = useMutation({
    mutationFn: id => api.delete(`/api/v1/channels/${id}`),
    onSuccess: (_, id) => {
      setDeleteTarget(null);
      qc.setQueryData(['channels'], old => (old || []).filter(c => c.id !== id));
    },
  });

  useSocket((event, data) => {
    if (event === 'bot:ack' && data.status === 'ok' && (
      data.event === 'bot:channel:create' ||
      data.event === 'bot:channel:delete'
    )) {
      qc.invalidateQueries({ queryKey: ['channels'] });
    }
  });

  const groups = groupChannels(channels);

  const filtered = search.trim()
    ? groups.map(g => ({ ...g, channels: g.channels.filter(c => c.name.toLowerCase().includes(search.toLowerCase())) })).filter(g => g.channels.length)
    : groups;

  const totalText  = channels.filter(c => c.type === 'TEXT'  || c.type === 'text').length;
  const totalVoice = channels.filter(c => c.type === 'VOICE' || c.type === 'voice').length;

  const categories = channels.filter(c => c.type === 'CATEGORY' || c.type === 'category');

  if (isError) {
    return (
      <div className="p-6">
        <div className="discord-card flex flex-col items-center justify-center py-20 gap-4" style={{ color: 'var(--discord-text-muted)' }}>
          <p>Failed to load channels</p>
          <button onClick={refetch} className="discord-btn discord-btn-ghost flex items-center gap-2"><RefreshCw size={14} /> Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Channels</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--discord-text-muted)' }}>
            {isLoading ? '…' : `${totalText} text · ${totalVoice} voice`}
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="discord-btn discord-btn-primary flex items-center gap-2">
          <Plus size={16} /> New Channel
        </button>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--discord-text-muted)' }} />
        <input className="discord-input" style={{ paddingLeft: '2.25rem' }} placeholder="Поиск каналов…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="discord-card p-4 space-y-3">
          {Array(8).fill(0).map((_, i) => (
            <div key={i} className="h-8 rounded animate-pulse" style={{ backgroundColor: 'var(--discord-border)', width: `${60 + Math.random() * 30}%` }} />
          ))}
        </div>
      ) : (
        <div className="discord-card overflow-hidden">
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16" style={{ color: 'var(--discord-text-muted)' }}>
              <FolderOpen size={40} className="mb-3 opacity-30" />
              <p className="text-sm">No channels found</p>
            </div>
          )}
          {filtered.map((cat, ci) => (
            <div key={cat.id}>
              <button
                onClick={() => setCollapsed(p => ({ ...p, [cat.id]: !p[cat.id] }))}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors hover:bg-white/5"
                style={{ color: 'var(--discord-text-muted)', borderTop: ci > 0 ? '1px solid var(--discord-border)' : 'none' }}
              >
                {collapsed[cat.id] ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                {cat.name}
                <span className="ml-auto font-normal normal-case tracking-normal">{cat.channels.length} channels</span>
              </button>
              {!collapsed[cat.id] && cat.channels.map(ch => (
                <div
                  key={ch.id}
                  className="group flex items-center gap-3 px-4 py-2 transition-colors hover:bg-white/5"
                  style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}
                >
                  {(ch.type === 'VOICE' || ch.type === 'voice')
                    ? <Volume2 size={16} style={{ color: 'var(--discord-text-muted)' }} />
                    : <Hash size={16} style={{ color: 'var(--discord-text-muted)' }} />
                  }
                  <span className="flex-1 text-sm text-white">{ch.name}</span>
                  {ch.topic && (
                    <span className="hidden sm:block text-xs max-w-[200px] truncate" style={{ color: 'var(--discord-text-muted)' }}>
                      {ch.topic}
                    </span>
                  )}
                  {ch.slowmode > 0 && <Lock size={13} style={{ color: 'var(--discord-yellow)' }} />}
                  <div className="flex items-center gap-1 opacity-40 hover:opacity-100 transition-opacity">
                    <button className="p-1 rounded hover:bg-white/10 transition-colors" style={{ color: 'var(--discord-text-muted)' }}>
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(ch)}
                      className="p-1 rounded hover:bg-red-500/20 transition-colors"
                      style={{ color: 'var(--discord-red)' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <Modal title="Create Channel" onClose={() => setShowCreate(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: 'var(--discord-text-muted)' }}>Channel type</label>
              <div className="grid grid-cols-2 gap-2">
                {['TEXT', 'VOICE'].map(t => (
                  <button
                    key={t}
                    onClick={() => setNewCh(p => ({ ...p, type: t }))}
                    className="flex items-center gap-2 p-3 rounded-lg border transition-colors text-sm"
                    style={{
                      borderColor: newCh.type === t ? 'var(--discord-blurple)' : 'var(--discord-border)',
                      backgroundColor: newCh.type === t ? 'rgba(88,101,242,0.15)' : 'var(--discord-darkest)',
                      color: newCh.type === t ? 'white' : 'var(--discord-text-muted)',
                    }}
                  >
                    {t === 'TEXT' ? <Hash size={16} /> : <Volume2 size={16} />}
                    {t.charAt(0) + t.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: 'var(--discord-text-muted)' }}>Channel name</label>
              <input
                className="discord-input"
                placeholder={newCh.type === 'TEXT' ? 'new-channel' : 'New Channel'}
                value={newCh.name}
                onChange={e => setNewCh(p => ({ ...p, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && createMutation.mutate(newCh)}
                autoFocus
              />
            </div>
            {categories.length > 0 && (
              <div>
                <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: 'var(--discord-text-muted)' }}>Category</label>
                <select className="discord-input" value={newCh.categoryId} onChange={e => setNewCh(p => ({ ...p, categoryId: e.target.value }))}>
                  <option value="">None</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button className="discord-btn discord-btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              <button
                className="discord-btn discord-btn-primary"
                onClick={() => createMutation.mutate(newCh)}
                disabled={createMutation.isPending || !newCh.name.trim()}
              >
                {createMutation.isPending ? 'Creating…' : 'Create Channel'}
              </button>
            </div>
            {createMutation.isError && (
              <p className="text-xs" style={{ color: 'var(--discord-red)' }}>Failed to create channel. The bot may take a moment to process.</p>
            )}
          </div>
        </Modal>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <Modal title="Delete Channel" onClose={() => setDeleteTarget(null)}>
          <p className="text-sm mb-4" style={{ color: 'var(--discord-text-muted)' }}>
            Are you sure you want to delete <span className="font-semibold text-white">#{deleteTarget.name}</span>? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <button className="discord-btn discord-btn-ghost" onClick={() => setDeleteTarget(null)}>Cancel</button>
            <button
              className="discord-btn discord-btn-danger"
              onClick={() => deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete Channel'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
