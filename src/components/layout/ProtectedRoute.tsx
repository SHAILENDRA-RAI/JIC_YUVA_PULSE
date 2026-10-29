import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';

import { useAuth } from '@/context/AuthContext';
import { LoadingState } from '@/components/ui/EmptyState';

export function ProtectedRoute({
  children,
}: {
  children: ReactNode;
}) {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return <LoadingState message="Loading your workspace..." />;
  }

  if (!session) {
    return <Navigate to="/signin" replace />;
  }

  if (!profile || profile.status !== 'active') {
    return <Navigate to="/pending-approval" replace />;
  }

  return <>{children}</>;
}

export function AdminRoute({
  children,
}: {
  children: ReactNode;
}) {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return <LoadingState message="Loading..." />;
  }

  if (!session) {
    return <Navigate to="/signin" replace />;
  }

  if (!profile || profile.status !== 'active') {
    return <Navigate to="/pending-approval" replace />;
  }

  if (profile.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
