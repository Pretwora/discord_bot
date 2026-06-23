import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import Overview from './pages/Overview';
import Channels from './pages/Channels';
import Roles from './pages/Roles';
import Members from './pages/Members';
import AuditLog from './pages/AuditLog';
import Settings from './pages/Settings';
import Giveaways from './pages/Giveaways';
import GoldBids from './pages/GoldBids';

function ProtectedRoute({ children }) {
  const { isAuth } = useAuth();
  return isAuth ? children : <Navigate to="/login" replace />;
}

// Для РЛ — разрешаем только /goldbids, всё остальное редиректим туда
function AdminOnlyRoute({ children }) {
  const { isRL } = useAuth();
  return isRL ? <Navigate to="/goldbids" replace /> : children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminOnlyRoute><Overview /></AdminOnlyRoute>} />
        <Route path="channels"  element={<AdminOnlyRoute><Channels /></AdminOnlyRoute>} />
        <Route path="roles"     element={<AdminOnlyRoute><Roles /></AdminOnlyRoute>} />
        <Route path="members"   element={<AdminOnlyRoute><Members /></AdminOnlyRoute>} />
        <Route path="giveaways" element={<AdminOnlyRoute><Giveaways /></AdminOnlyRoute>} />
        <Route path="goldbids"  element={<GoldBids />} />
        <Route path="audit-log" element={<AdminOnlyRoute><AuditLog /></AdminOnlyRoute>} />
        <Route path="settings"  element={<AdminOnlyRoute><Settings /></AdminOnlyRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
