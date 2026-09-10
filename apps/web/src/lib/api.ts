'use client';

export interface ApiErrorShape {
  statusCode: number;
  code: string;
  message: string;
}

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? '/api/v1';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('followa_token');
}

export function setAuth(token: string, user: unknown) {
  localStorage.setItem('followa_token', token);
  localStorage.setItem('followa_user', JSON.stringify(user));
  localStorage.removeItem('followa_admin');
}

export function setAdminAuth(token: string, admin: unknown) {
  localStorage.setItem('followa_token', token);
  localStorage.setItem('followa_admin', JSON.stringify(admin));
  localStorage.removeItem('followa_user');
}

export function clearAuth() {
  localStorage.removeItem('followa_token');
  localStorage.removeItem('followa_user');
  localStorage.removeItem('followa_admin');
}

export function clearAdminAuth() {
  localStorage.removeItem('followa_token');
  localStorage.removeItem('followa_admin');
}

export function getCachedUser<T>(): T | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('followa_user');
  return raw ? (JSON.parse(raw) as T) : null;
}

export function getCachedAdmin<T>(): T | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('followa_admin');
  return raw ? (JSON.parse(raw) as T) : null;
}

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.authorization = `Bearer ${token}`;
  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  if (!res.ok) {
    let err: ApiErrorShape | null = null;
    try {
      err = await res.json();
    } catch {}
    throw new ApiError(res.status, err?.code ?? 'ERROR', err?.message ?? 'خطای غیرمنتظره');
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
};

/**
 * Authenticated file download: fetches with the bearer token, then hands the
 * blob to the browser as a download. Never exposes a raw auth error page.
 */
export async function downloadFile(path: string, filename: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) {
    let err: ApiErrorShape | null = null;
    try {
      err = await res.json();
    } catch {}
    throw new ApiError(res.status, err?.code ?? 'ERROR', err?.message ?? 'خطا در دریافت فایل');
  }
  const disposition = res.headers.get('content-disposition') ?? '';
  const match = disposition.match(/filename="([^"]+)"/);
  const serverName = match ? decodeURIComponent(match[1]) : filename;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = serverName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Authenticated inline view of images/audio — returns an object URL for <img>/<audio>. */
export async function getFileObjectUrl(path: string): Promise<{ url: string; type: string }> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) {
    let err: ApiErrorShape | null = null;
    try {
      err = await res.json();
    } catch {}
    throw new ApiError(res.status, err?.code ?? 'ERROR', err?.message ?? 'خطا در دریافت فایل');
  }
  const blob = await res.blob();
  return { url: URL.createObjectURL(blob), type: blob.type };
}
