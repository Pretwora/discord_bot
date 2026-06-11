import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Plus, Trash2, Edit3, Users, X, RefreshCw } from 'lucide-react';
import api from '../lib/api';
import { useSocket } from '../hooks/useSocket';

const PRESET_COLORS = ['#f23f43','#f0b232','#23a55a','#5865F2','#ff73fa','#00b0f4','#eb459e','#faa61a','#96989d','#ffffff'];

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

// Convert #rrggbb to integer Discord uses; or use raw hex string from API
function colorHex(c) {
  if (!c || c === '#000000') return '#96989d';
  if (typeof c === 'number') return `#${c.toString(16).padStart(6, '0')}`;
  return c;
}

export default function Roles() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState({ name: '', color: '#5865F2', hoist: false, mentionable: false });

  const { data: roles = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api.get('/api/v1/roles').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: body => api.post('/api/v1/roles', body),
    onSuccess: (res) => {
      setShowCreate(false);
      setForm({ name: '', color: '#5865F2', hoist: false, mentionable: false });
      qc.invalidateQueries({ queryKey: ['roles'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: id => api.delete(`/api/v1/roles/${id}`),
    onSuccess: (_, id) => {
      setDeleteTarget(null);
      qc.setQueryData(['roles'], old => (old || []).filter(r => r.id !== id));
    },
  });

  // Refresh list when bot confirms the action
  useSocket((event, data) => {
    if (event === 'bot:ack' && data.status === 'ok' && (
      data.event === 'bot:role:create' ||
      data.event === 'bot:role:delete' ||
      data.event === 'bot:role:assign' ||
      data.event === 'bot:role:remove'
    )) {
      qc.invalidateQueries({ queryKey: ['roles'] });
    }
  });

  if (isError) {
    return (
      <div className="p-6">
        <div className="discord-card flex flex-col items-center justify-center py-20 gap-4" style={{ color: 'var(--discord-text-muted)' }}>
          <p>Failed to load roles</p>
          <button onClick={refetch} className="discord-btn discord-btn-ghost flex items-center gap-2"><RefreshCw size={14} /> Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Roles</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--discord-text-muted)' }}>
            {isLoading ? '…' : `${roles.length} roles`} · manage hierarchy and permissions
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="discord-btn discord-btn-primary flex items-center gap-2">
          <Plus size={16} /> New Role
        </button>
      </div>

      {isLoading ? (
        <div className="discord-card overflow-hidden">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3" style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: 'var(--discord-border)' }} />
              <div className="h-4 rounded animate-pulse flex-1" style={{ backgroundColor: 'var(--discord-border)', maxWidth: 160 }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="discord-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--discord-border)' }}>
                {['Role', 'Color', 'Position', 'Hoist', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--discord-text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roles.map((role, i) => {
                const hex = colorHex(role.color);
                return (
                  <tr key={role.id} className="group transition-colors hover:bg-white/5" style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: hex }} />
                        <span className="font-medium text-sm text-white">{role.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--discord-darkest)', color: hex }}>
                        {hex}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--discord-text-muted)' }}>
                      #{role.position}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs" style={{ color: role.hoist ? 'var(--discord-green)' : 'var(--discord-text-muted)' }}>
                        {role.hoist ? '✓ Hoisted' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {role.name !== '@everyone' && (
                        <button
                          onClick={() => setDeleteTarget(role)}
                          className="p-1.5 rounded hover:bg-red-500/20 transition-colors opacity-40 hover:opacity-100"
                          style={{ color: 'var(--discord-red)' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {roles.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16" style={{ color: 'var(--discord-text-muted)' }}>
              <Shield size={40} className="mb-3 opacity-30" />
              <p className="text-sm">No roles found</p>
            </div>
          )}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <Modal title="Create Role" onClose={() => setShowCreate(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: 'var(--discord-text-muted)' }}>Role name</label>
              <input
                className="discord-input"
                placeholder="new role"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: 'var(--discord-text-muted)' }}>Role color</label>
              <div className="flex items-center gap-3">
                <div className="grid grid-cols-5 gap-2 flex-1">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setForm(p => ({ ...p, color: c }))}
                      className="w-8 h-8 rounded-full transition-transform hover:scale-110"
                      style={{ backgroundColor: c, outline: form.color === c ? '2px solid white' : 'none', outlineOffset: '2px' }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input type="color" value={form.color} onChange={e => setForm(p => ({ ...p, color: e.target.value }))} className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent" />
                  <span className="text-xs font-mono" style={{ color: 'var(--discord-text-muted)' }}>{form.color}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={form.hoist} onChange={e => setForm(p => ({ ...p, hoist: e.target.checked }))} className="accent-indigo-500" />
                <span className="text-sm text-white">Display separately</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={form.mentionable} onChange={e => setForm(p => ({ ...p, mentionable: e.target.checked }))} className="accent-indigo-500" />
                <span className="text-sm text-white">Mentionable</span>
              </label>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--discord-darkest)' }}>
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: form.color }} />
              <span className="text-sm font-medium" style={{ color: form.color }}>{form.name || 'Preview'}</span>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="discord-btn discord-btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              <button
                className="discord-btn discord-btn-primary"
                onClick={() => createMutation.mutate(form)}
                disabled={createMutation.isPending || !form.name.trim()}
              >
                {createMutation.isPending ? 'Creating…' : 'Create Role'}
              </button>
            </div>
            {createMutation.isError && (
              <p className="text-xs" style={{ color: 'var(--discord-red)' }}>Failed — the bot may take a moment to process.</p>
            )}
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Delete Role" onClose={() => setDeleteTarget(null)}>
          <p className="text-sm mb-4" style={{ color: 'var(--discord-text-muted)' }}>
            Are you sure you want to delete{' '}
            <span className="font-semibold" style={{ color: colorHex(deleteTarget.color) }}>{deleteTarget.name}</span>?
            {' '}This action cannot be undone.
          </p>
          {deleteMutation.isError && (
            <p className="text-xs mb-3 p-2 rounded" style={{ backgroundColor: 'rgba(242,63,67,0.1)', color: 'var(--discord-red)' }}>
              {deleteMutation.error?.response?.data?.error || 'Failed to delete role.'}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button className="discord-btn discord-btn-ghost" onClick={() => setDeleteTarget(null)}>Cancel</button>
            <button
              className="discord-btn discord-btn-danger"
              onClick={() => deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete Role'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
