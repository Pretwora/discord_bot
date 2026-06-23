import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard, Hash, Shield, Users,
  ClipboardList, Settings, Bot, LogOut, RefreshCw, Gift, Swords,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../hooks/useSocket';
import api from '../lib/api';
import AiChat from './AiChat';

const adminNavItems = [
  { to: '/',          icon: LayoutDashboard, label: 'Overview'  },
  { to: '/channels',  icon: Hash,            label: 'Channels'  },
  { to: '/roles',     icon: Shield,          label: 'Roles'     },
  { to: '/members',    icon: Users,           label: 'Members'   },
  { to: '/giveaways',  icon: Gift,            label: 'Giveaways' },
  { to: '/goldbids',   icon: Swords,          label: 'Голдбиды'  },
  { to: '/audit-log',  icon: ClipboardList,   label: 'Audit Log' },
  { to: '/settings',  icon: Settings,        label: 'Settings'  },
];

const rlNavItems = [
  { to: '/goldbids', icon: Swords, label: 'Мои рейды' },
];

export default function Layout() {
  const { user, logout, isRL } = useAuth();
  const navItems = isRL ? rlNavItems : adminNavItems;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  const handleSync = async () => {
    setSyncing(true);
    await api.post('/api/v1/stats/sync').catch(() => {});
    // will stop spinning when bot:ack arrives via socket
  };

  useSocket((event, data) => {
    if (event === 'bot:ack' && data.event === 'bot:sync:request') {
      setSyncing(false);
      // Invalidate all queries so every page refreshes
      qc.invalidateQueries();
    }
  });

  const avatarUrl = user?.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`
    : null;

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--discord-bg)' }}>
      {/* Sidebar */}
      <aside
        className="w-60 flex-shrink-0 flex flex-col"
        style={{ backgroundColor: 'var(--discord-bg-secondary)', borderRight: '1px solid var(--discord-border)' }}
      >
        {/* Server header */}
        <div
          className="px-4 py-3 flex items-center gap-3"
          style={{ borderBottom: '1px solid var(--discord-border)' }}
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: 'var(--discord-blurple)' }}
          >
            <Bot size={20} className="text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate">Pretwora DS</p>
            <p className="text-xs" style={{ color: 'var(--discord-text-muted)' }}>{isRL ? 'РЛ Панель' : 'Admin Panel'}</p>
          </div>
          {!isRL && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="p-1.5 rounded hover:bg-white/10 transition-colors flex-shrink-0"
              style={{ color: syncing ? 'var(--discord-blurple)' : 'var(--discord-text-muted)' }}
              title="Sync from Discord"
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          <p
            className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--discord-text-muted)' }}
          >
            Management
          </p>
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors cursor-pointer ${
                  isActive ? 'text-white' : 'hover:text-white'
                }`
              }
              style={({ isActive }) => ({
                backgroundColor: isActive ? 'rgba(88,101,242,0.2)' : 'transparent',
                color: isActive ? 'white' : 'var(--discord-text-muted)',
              })}
            >
              {({ isActive }) => (
                <>
                  <Icon size={18} style={{ color: isActive ? 'var(--discord-blurple)' : undefined }} />
                  <span>{label}</span>
                  {isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--discord-blurple)' }} />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div
          className="p-3 flex items-center gap-2"
          style={{ borderTop: '1px solid var(--discord-border)', backgroundColor: 'var(--discord-bg-tertiary)' }}
        >
          <div className="relative flex-shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt={user.username} className="w-8 h-8 rounded-full" />
            ) : (
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--discord-blurple)' }}>
                <Bot size={16} className="text-white" />
              </div>
            )}
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2" style={{ backgroundColor: 'var(--discord-green)', borderColor: 'var(--discord-bg-tertiary)' }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-white truncate">{user?.username ?? 'Admin'}</p>
            <p className="text-xs status-online">● Online</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded hover:bg-white/10 transition-colors flex-shrink-0"
            style={{ color: 'var(--discord-text-muted)' }}
            title="Logout"
          >
            <LogOut size={14} />
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto" style={{ backgroundColor: 'var(--discord-bg)' }}>
        <Outlet />
      </main>

      <AiChat />
    </div>
  );
}
