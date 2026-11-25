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
    let unsubscribeAuth: (() => void) | null = null;

    async function initialiseAuth() {
      // Finish Supabase auth initialisation before registering the listener.
      // This avoids an initialise/refresh race seen in older auth-js builds.
      try {
        const { data: { session: initialSession }, error: sessionError } =
          await supabase.auth.getSession();

        if (sessionError) throw sessionError;
        if (!mounted) return;

        setSession(initialSession);

        if (initialSession?.user) {
          await loadProfile(initialSession.user.id);
        } else {
          const { count, error } = await supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true });

          if (error) throw error;
          if (mounted) setNeedsSetup(count === 0);
        }
      } catch (error) {
        console.error('Could not initialise the JIC session:', error);
      } finally {
        if (mounted) setLoading(false);
      }

      if (!mounted) return;

      // Register only after getSession/profile initialisation has completed.
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
        if (!mounted) return;

        // Keep this callback synchronous. Do not call Supabase APIs directly here.
        setSession(nextSession);

        if (!nextSession?.user) {
          setProfile(null);
          setLoading(false);
          return;
        }

        // Initial session has already been loaded above. Token refresh does not
        // require another profile query.
        if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;
        if (event !== 'SIGNED_IN' && event !== 'USER_UPDATED') return;

        const userId = nextSession.user.id;
        setLoading(true);

        // Run the profile request after the auth callback has returned.
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

      unsubscribeAuth = () => subscription.unsubscribe();
    }

    void initialiseAuth();

    return () => {
      mounted = false;
      unsubscribeAuth?.();
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
