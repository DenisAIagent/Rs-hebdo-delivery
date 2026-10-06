import { isAdminRole } from '../types/index.ts';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore.ts';

interface Props {
  children: React.ReactNode;
  adminOnly?: boolean;
}

export function ProtectedRoute({ children, adminOnly = false }: Props) {
  const { user, initialized, loading, mfaRequired } = useAuthStore();

  if (!initialized || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-rs-red border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    // Session ouverte mais 2FA pas encore validee → ecran de verification
    return <Navigate to={mfaRequired ? '/mfa' : '/login'} replace />;
  }

  if (adminOnly && !isAdminRole(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
