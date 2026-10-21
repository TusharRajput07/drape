import { create } from 'zustand';

// Memory only (03 §4.2): after a reload the refresh cookie brings the token back.
type AuthStatus = 'unknown' | 'authed' | 'guest';

type AuthState = {
  accessToken: string | null;
  status: AuthStatus;
  signIn: (accessToken: string) => void;
  signOut: () => void;
};

export const useAuthStore = create<AuthState>()((set) => ({
  accessToken: null,
  status: 'unknown',
  signIn: (accessToken) => set({ accessToken, status: 'authed' }),
  signOut: () => set({ accessToken: null, status: 'guest' }),
}));
