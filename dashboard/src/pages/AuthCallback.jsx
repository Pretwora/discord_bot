import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ShieldBan, RefreshCw } from 'lucide-react';
import api from '../lib/api';

const REASON_TEXT = {
  not_member:    'You are not a member of the Pretwora DS server.',
  no_permission: 'You do not have the required role to access this panel.',
  api_error:     'Could not verify your permissions. Try again later.',
};

function AccessDenied({ reason }) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--discord-bg)' }}>
      <div className="discord-card p-10 flex flex-col items-center gap-5 w-full max-w-sm text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(242,63,67,0.15)' }}>
          <ShieldBan size={36} style={{ color: 'var(--discord-red)' }} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Access Denied</h1>
          <p className="text-sm mt-2" style={{ color: 'var(--discord-text-muted)' }}>
            {REASON_TEXT[reason] ?? 'You do not have permission to access this panel.'}
          </p>
        </div>
        {reason === 'no_permission' && (
          <p className="text-xs px-4 py-2 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--discord-text-muted)' }}>
            Ask the server owner to give you the <span className="font-semibold text-white">Управление</span> role.
          </p>
        )}
        <a
          href="/login"
          className="discord-btn discord-btn-ghost flex items-center gap-2 text-sm"
        >
          <RefreshCw size={14} /> Try another account
        </a>
      </div>
    </div>
  );
}

export default function AuthCallback() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const called = useRef(false);
  const [denied, setDenied] = useState(null); // null | reason string

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    const code = new URLSearchParams(window.location.search).get('code');
    if (!code) { navigate('/login'); return; }

    api.get(`/api/v1/auth/callback?code=${code}`)
      .then(({ data }) => {
        login(data.token, data.user);
        navigate('/');
      })
      .catch(err => {
        const reason = err.response?.data?.reason;
        if (err.response?.status === 403) {
          setDenied(reason ?? 'no_permission');
        } else {
          navigate('/login');
        }
      });
  }, []);

  if (denied) return <AccessDenied reason={denied} />;

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--discord-bg)' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--discord-blurple)' }} />
        <p className="text-sm" style={{ color: 'var(--discord-text-muted)' }}>Verifying access…</p>
      </div>
    </div>
  );
}
