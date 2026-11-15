import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { AuthUser } from '@/shared/application/ports/IAuthService';
import { FullPageSpinner } from './layout/FullPageSpinner';
import { useServices } from './ContainerContext';

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({ user: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const { auth } = useServices();
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  useEffect(() => {
    let active = true;
    auth.getCurrentUser().then((user) => active && setState({ user, loading: false }));
    const unsubscribe = auth.onChange((user) => {
      setState((prev) => {
        if (prev.user?.id !== user?.id) queryClient.clear();
        return { user, loading: false };
      });
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [auth, queryClient]);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/entrar" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}
