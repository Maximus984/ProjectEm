import { create } from "zustand";
export const useAuthStore = create((set) => ({
    accessToken: null,
    refreshToken: null,
    role: null,
    email: null,
    setSession: ({ accessToken, refreshToken, role, email }) => set({ accessToken, refreshToken, role, email }),
    clear: () => set({
        accessToken: null,
        refreshToken: null,
        role: null,
        email: null
    })
}));
