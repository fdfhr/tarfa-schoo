import { Navigate, useLocation } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { Logo } from './ui';
import { Button } from './ui';

export function FullPageLoader() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <Logo className="h-20 w-20 animate-pulse" />
      <p className="text-sm text-muted">جاري تحميل النظام...</p>
    </div>
  );
}

export default function ProtectedRoute({ children, roles }) {
  const { session, loading, me, role, signOut } = useApp();
  const loc = useLocation();
  if (loading) return <FullPageLoader />;
  if (!session) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (me?.error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="max-w-md text-red-600 dark:text-red-400">{me.error}</p>
        <Button variant="outline" onClick={signOut}>تسجيل الخروج</Button>
      </div>
    );
  }
  if (roles && !roles.includes(role)) return <Navigate to="/dashboard" replace />;
  return children;
}
