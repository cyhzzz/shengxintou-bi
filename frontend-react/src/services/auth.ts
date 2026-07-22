/**
 * 鉴权相关前端服务（feat-cloud-supabase）。
 * - login(email, password) -> POST /api/v1/auth/login
 * - logout() -> 清 store + POST /api/v1/auth/logout
 * - fetchMe() -> GET /api/v1/auth/me
 *
 * 注意：必须用 http.post / http.get 形式调用（实例方法），不能解构 `import { post }`，
 * 否则 prototype method 的 this 会变 undefined -> Cannot read 'buildUrl'。
 */
import { http } from './http';
import { useAuthStore } from '@/stores/useAuthStore';

export interface LoginResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: 'bearer';
  user: { id: string; email: string };
}

export interface MeResponse {
  id: string;
  email: string | null;
  profile: null | {
    id: string;
    email: string | null;
    display_name: string | null;
    department: string | null;
    role: string | null;
    is_active: boolean;
  };
}

export async function login(email: string, password: string): Promise<void> {
  const resp = await http.post<LoginResponse>('/auth/login', { email, password });
  if (!resp.success || !resp.data) {
    // feat-cloud-supabase：把后端 error code + message 一起抛出，前端按 code 做判断
    const code = resp.error || 'UNKNOWN';
    const msg = resp.message || '登录失败';
    const err = new Error(`${code}: ${msg}`);
    (err as Error & { code?: string }).code = code;
    throw err;
  }
  const { access_token, user } = resp.data;
  useAuthStore.getState().setSession({
    accessToken: access_token,
    userId: user.id,
    email: user.email ?? null,
  });
}

export async function logout(): Promise<void> {
  // 调用后端登出（best-effort），清前端 store 即可
  try { await http.post('/auth/logout'); } catch { /* ignore */ }
  useAuthStore.getState().clear();
}

export async function fetchMe(): Promise<MeResponse | null> {
  const resp = await http.get<MeResponse>('/auth/me');
  if (!resp.success || !resp.data) return null;
  const data = resp.data;
  useAuthStore.getState().setProfile(
    data.profile
      ? {
          id: data.profile.id,
          email: data.profile.email ?? null,
          display_name: data.profile.display_name ?? null,
          department: data.profile.department ?? null,
          role: data.profile.role ?? null,
          is_active: !!data.profile.is_active,
        }
      : null
  );
  return data;
}
