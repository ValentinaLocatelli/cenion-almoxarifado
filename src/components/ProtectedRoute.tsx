import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireStrictAdmin?: boolean;
  requireUsersAccess?: boolean;
  requireBusinessUnitsAccess?: boolean;
}

export function ProtectedRoute({
  children,
  requireAdmin = false,
  requireStrictAdmin = false,
  requireUsersAccess = false,
  requireBusinessUnitsAccess = false,
}: ProtectedRouteProps) {
  const { user, isAuthenticated, isManager, isAdmin, isLoading, canManageUsers, canAccessBusinessUnits } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user?.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  if (requireAdmin && !isManager) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireStrictAdmin && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireUsersAccess && !canManageUsers) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireBusinessUnitsAccess && !canAccessBusinessUnits) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
