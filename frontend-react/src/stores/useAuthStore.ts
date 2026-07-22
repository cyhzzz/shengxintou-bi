/**
 * 鉴权状态（feat-cloud-supabase）。
 * 持久化到 localStorage（key: 'sxt-auth'）；包含 access_token 与 user 元数据。
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserProfile {
  id: string;
  email: string | null;
  display_name: string | null;
  department: string | null;
  role: string | null;
  is_active: boolean;
}

interface AuthState {
  accessToken: string | null;
  userId: string | null;
  email: string | null;
  profile: UserProfile | null;
  loginTime: number | null;

  setSession: (data: { accessToken: string; userId: string; email: string | null; expiresIn?: number }) => void;
  setProfile: (profile: UserProfile | null) => void;
  clear: () => void;

  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      userId: null,
      email: null,
      profile: null,
      loginTime: null,

      setSession: ({ accessToken, userId, email }) => set({
        accessToken,
        userId,
        email,
        loginTime: Date.now(),
      }),
      setProfile: (profile) => set({ profile }),
      clear: () => set({
        accessToken: null,
        userId: null,
        email: null,
        profile: null,
        loginTime: null,
      }),
      isAuthenticated: () => !!get().accessToken,
    }),
    {
      name: 'sxt-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        userId: state.userId,
        email: state.email,
        profile: state.profile,
        loginTime: state.loginTime,
      }),
    }
  )
);

/** 兼容旧调用方：直接读 token */
export function getAccessToken(): string | null {
  return useAuthStore.getState().accessToken;
}
