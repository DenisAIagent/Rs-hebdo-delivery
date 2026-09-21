import { create } from 'zustand';
import { supabase } from '../lib/supabase.ts';
import { getProfile, getAuthConfig } from '../services/api.ts';
import type { Profile } from '../types/index.ts';

interface AuthState {
  user: Profile | null;
  loading: boolean;
  initialized: boolean;
  /** Session ouverte (mot de passe OK) mais 2FA pas encore passee (si la politique l'exige). */
  mfaRequired: boolean;
  /** Politique 2FA cote serveur (reglable dans l'admin). */
  mfaPolicy: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** Appele apres verification TOTP reussie : charge le profil et entre dans l'app. */
  completeMfa: () => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
}

/** True quand la session courante a passe la 2FA (AAL2), ou si la 2FA est desactivee. */
async function isSessionAal2(required: boolean): Promise<boolean> {
  if (!required) return true;
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return data?.currentLevel === 'aal2';
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  initialized: false,
  mfaRequired: false,
  mfaPolicy: false,

  initialize: async () => {
    try {
      set({ loading: true });
      const [{ data: { session } }, { mfaRequired: policy }] = await Promise.all([
        supabase.auth.getSession(),
        getAuthConfig(),
      ]);
      set({ mfaPolicy: policy });
      if (!session) {
        set({ user: null, mfaRequired: false, initialized: true, loading: false });
        return;
      }
      if (await isSessionAal2(policy)) {
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
    // Le login par mot de passe donne une session AAL1 : si la politique exige la 2FA,
    // verification TOTP si un facteur existe, sinon enrolement.
    const { mfaRequired: policy } = await getAuthConfig();
    set({ mfaPolicy: policy });
    if (await isSessionAal2(policy)) {
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
