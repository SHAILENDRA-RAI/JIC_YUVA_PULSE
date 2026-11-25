import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types';

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  needsSetup: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  profile: null,
  loading: true,
  needsSetup: false,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  async function loadProfile(uid: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle();

    if (error) throw error;
    setProfile(data as Profile | null);
    return data as Profile | null;
  }

  useEffect(() => {
    let mounted = true;

    // Initial session/profile loading is performed outside the auth listener.
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!mounted) return;

      setSession(s);

      try {
        if (s?.user) {
          await loadProfile(s.user.id);
        } else {
          // Check if any profiles exist at all (first-admin setup detection).
          const { count, error } = await supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true });

          if (error) throw error;
          if (mounted) setNeedsSetup(count === 0);
        }
      } catch (error) {
        console.error('Could not initialise the signed-in profile:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    }).catch((error) => {
      console.error('Could not restore the Supabase session:', error);
      if (mounted) setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, s) => {
      if (!mounted) return;

      // IMPORTANT: keep this callback synchronous. Calling another Supabase
      // API from inside onAuthStateChange can deadlock the Supabase client.
      setSession(s);

      if (!s?.user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      // getSession() above handles INITIAL_SESSION. Token refreshes do not
      // require a profile reload.
      if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;
      if (event !== 'SIGNED_IN' && event !== 'USER_UPDATED') return;

      const userId = s.user.id;
      setLoading(true);

      // Defer the Supabase query until after the auth callback has returned.
      window.setTimeout(() => {
        if (!mounted) return;

        void loadProfile(userId)
          .catch((error) => {
            console.error('Could not load the updated profile:', error);
          })
          .finally(() => {
            if (mounted) setLoading(false);
          });
      }, 0);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function refreshProfile() {
    if (session?.user) {
      await loadProfile(session.user.id);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, needsSetup, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
