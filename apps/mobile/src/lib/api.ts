import type { AuthResponse } from '@landconnect/shared';
import { storedRefreshToken, useSession } from './session';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

export class ApiError extends Error {
  status: number;
  fields?: Record<string, string>;
  constructor(status: number, message: string, fields?: Record<string, string>) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

let refreshing: Promise<boolean> | null = null;

/** Single-flight refresh: N parallel 401s trigger one /auth/refresh. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    const token = useSession.getState().refreshToken ?? (await storedRefreshToken());
    if (!token) return false;
    try {
      const r = await request<AuthResponse>('/auth/refresh', { method: 'POST', body: { refreshToken: token }, auth: false });
      await useSession.getState().set(r);
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) await useSession.getState().clear();
      return false;
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

interface Opts {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  form?: FormData;
  auth?: boolean;
  signal?: AbortSignal;
}

async function request<T>(path: string, { method = 'GET', body, form, auth = true, signal }: Opts, retried = false): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  const token = useSession.getState().accessToken;
  if (auth && token) headers.authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
      signal,
    });
  } catch {
    throw new ApiError(0, "Can't reach LandConnect. Check your connection.");
  }

  if (res.status === 401 && auth && !retried && (await refreshSession()))
    return request<T>(path, { method, body, form, auth, signal }, true);
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'Something went wrong', data.fields);
  return data as T;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string) => request<T>(path, { method: 'PUT' }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, form: FormData) => request<T>(path, { method: 'POST', form }),
  public: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body, auth: false }),
};
