const SESSION_STORAGE_KEY = "cdh_customer_session";

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function authHeader(): Record<string, string> {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    const session = raw ? (JSON.parse(raw) as { token?: string }) : null;
    return session?.token ? { Authorization: `Bearer ${session.token}` } : {};
  } catch {
    return {};
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...authHeader(),
      ...(options.headers || {}),
    },
  });

  if (res.status === 204) return undefined as T;

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    // A stale/invalid token (expired, or the backend's JWT secret rotated)
    // self-heals here instead of leaving the customer stuck retrying a
    // request that can never succeed.
    if (res.status === 401) {
      try {
        localStorage.removeItem(SESSION_STORAGE_KEY);
      } catch {
        // Nothing to clean up if storage isn't available.
      }
      if (!window.location.pathname.startsWith("/verify")) window.location.href = "/verify";
    }
    const message = body?.error?.message || `Request failed (${res.status})`;
    throw new ApiError(message, res.status, body?.error?.code, body?.error?.details);
  }

  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, data?: unknown) => request<T>(path, { method: "POST", body: data ? JSON.stringify(data) : undefined }),
};
