import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  isLoading: boolean;
  signInWithEmail: (email: string) => Promise<{ error?: string }>;
  signOut: () => Promise<{ error?: string }>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    let isMounted = true;

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) {
        return;
      }

      setSession(error ? null : data.session);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  return (
    <AuthContext.Provider
      value={{
        session,
        isLoading,
        signInWithEmail: async (email: string) => {
          const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
              emailRedirectTo: window.location.origin,
            },
          });

          return error ? { error: error.message } : {};
        },
        signOut: async () => {
          const { error } = await supabase.auth.signOut();
          return error ? { error: error.message } : {};
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return value;
}
