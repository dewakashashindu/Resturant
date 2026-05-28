import { create } from 'zustand';

type AuthUser = {
  userName: string;
  userId: string | number;
};

type AuthStore = {
  user: AuthUser | null;
  setUser: (user: AuthUser) => void;
  clearUser: () => void;
};

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null }),
}));
