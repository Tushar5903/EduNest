export type ApiErrorShape = { ok: false; error: string; details?: unknown };

export interface ApiClientOptions {
  baseUrl: string;
  client: "portal" | "console";
}

export function createApiUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

export async function apiFetch<T>(
  opts: ApiClientOptions,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(createApiUrl(opts.baseUrl, path), {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-Client": opts.client,
      ...(init?.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => null)) as
    | { ok: true; data: T }
    | ApiErrorShape
    | null;
  if (!res.ok || !body || (body as ApiErrorShape).ok === false) {
    const message = (body as ApiErrorShape | null)?.error ?? `Request failed (${res.status})`;
    throw new ApiClientError(message, res.status, (body as ApiErrorShape | null)?.details);
  }
  return (body as { ok: true; data: T }).data;
}

export class ApiClientError extends Error {
  status: number;
  details?: unknown;
  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function isTerminalPromoteError(status: number, message: string): boolean {
  return status === 403 && /terminal|pass-out/i.test(message);
}
