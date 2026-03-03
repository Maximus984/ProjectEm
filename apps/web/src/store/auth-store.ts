import type { UserRole } from "@projectm/contracts";
import { create } from "zustand";

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  role: UserRole | null;
  email: string | null;
  setSession: (session: {
    accessToken: string;
    refreshToken: string;
    role: UserRole;
    email: string;
  }) => void;
  clear: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  role: null,
  email: null,
  setSession: ({ accessToken, refreshToken, role, email }) =>
    set({ accessToken, refreshToken, role, email }),
  clear: () =>
    set({
      accessToken: null,
      refreshToken: null,
      role: null,
      email: null
    })
}));
