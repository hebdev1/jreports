import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { toAdminError } from './errors';
import { can, type Permission, type Role } from './permissions';
import { sb } from './supabase';

export interface Member {
  user_id: string;
  email: string;
  display_name: string;
  role: Role;
}

type Status = 'loading' | 'signed_out' | 'no_access' | 'ready' | 'error';

interface AuthApi {
  status: Status;
  session: Session | null;
  member: Member | null;
  error: string | null;
  can: (p: Permission) => boolean;
  signOut: () => Promise<void>;
  reload: () => void;
}

const AuthContext = createContext<AuthApi | null>(null);

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Tracks the Supabase session and the signed-in person's team role. */
export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const qc = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    sb.auth.getSession().then(({ data }) => alive && setSession(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === 'PASSWORD_RECOVERY') navigate('/admin/reset-password', { replace: true });
      if (event === 'SIGNED_OUT') qc.clear();
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate, qc]);

  const userId = session?.user.id;
  const memberQuery = useQuery({
    queryKey: ['me', userId],
    enabled: Boolean(userId),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await sb.from('admin_members').select('user_id, email, display_name, role').eq('user_id', userId!).maybeSingle();
      if (error) throw toAdminError(error);
      return data as Member | null;
    },
  });

  const value = useMemo<AuthApi>(() => {
    let status: Status = 'loading';
    if (session === null) status = 'signed_out';
    else if (session && memberQuery.isError) status = 'error';
    else if (session && memberQuery.isSuccess) status = memberQuery.data ? 'ready' : 'no_access';
    const member = memberQuery.data ?? null;
    return {
      status,
      session: session ?? null,
      member,
      error: memberQuery.error ? (memberQuery.error as Error).message : null,
      can: (p) => can(member?.role, p),
      signOut: async () => {
        await sb.auth.signOut();
        qc.clear();
        navigate('/admin/login', { replace: true });
      },
      reload: () => void memberQuery.refetch(),
    };
  }, [session, memberQuery, qc, navigate]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
