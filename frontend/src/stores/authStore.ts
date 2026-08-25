import { create } from 'zustand';
import { supabase } from '../lib/supabase.ts';
import { getProfile } from '../services/api.ts';
import type { Profile } from '../types/index.ts';

interface AuthState {
  user: Profile | null;
  loading: boolean;
  initialized: boolean;
  /** Session ouverte (mot de passe OK) mais 2FA pas encore passee — obligatoire pour tous. */
  mfaRequired: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** Appele apres verification TOTP reussie : charge le profil et entre dans l'app. */
  completeMfa: () => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
}

/** True quand la session courante a passe la 2FA (AAL2). */
async function isSessionAal2(): Promise<boolean> {
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return data?.currentLevel === 'aal2';
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  initialized: false,
  mfaRequired: false,

  initialize: async () => {
    try {
      set({ loading: true });
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        set({ user: null, mfaRequired: false, initialized: true, loading: false });
        return;
      }
      if (await isSessionAal2()) {
        const profile = await getProfile();
        set({ user: profile, mfaRequired: false, initialized: true, loading: false });
      } else {
        set({ user: null, mfaRequired: true, initialized: true, loading: false });
      }
    } catch {
      set({ user: null, mfaRequired: false, initialized: true, loading: false });
    }
  },

  login: async (email: string, password: string) => {
    set({ loading: true });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      set({ loading: false });
      throw new Error(error.message);
    }
    // Le login par mot de passe donne une session AAL1 : la 2FA (TOTP) est
    // toujours requise ensuite — verification si un facteur existe, sinon enrolement.
    if (await isSessionAal2()) {
      const profile = await getProfile();
      set({ user: profile, mfaRequired: false, loading: false });
    } else {
      set({ user: null, mfaRequired: true, loading: false });
    }
  },

  completeMfa: async () => {
    set({ loading: true });
    try {
      const profile = await getProfile();
      set({ user: profile, mfaRequired: false, loading: false });
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null, mfaRequired: false });
  },
}));
