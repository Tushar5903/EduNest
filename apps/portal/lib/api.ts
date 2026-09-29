import { apiFetch, type ApiClientOptions } from "@edunest/shared";

function base(): ApiClientOptions {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
  return { baseUrl, client: "portal" };
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  return apiFetch<T>(base(), path, init);
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return api<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return api<T>(path, { method: "PATCH", body: body === undefined ? undefined : JSON.stringify(body) });
}

export function apiQueryKey(scope: string, params?: Record<string, string | undefined>) {
  return [scope, params ?? {}] as const;
}
