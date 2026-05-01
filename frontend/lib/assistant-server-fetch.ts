import { parseApiErrorMessage } from "@/lib/api";

/** URL del backend FastAPI (servidor Next o mismo valor público). */
export function assistantBackendBase(): string {
  return (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(
    /\/$/,
    "",
  );
}

export function assistantApiPath(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${assistantBackendBase()}/api${p}`;
}

export async function assistantFetch<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init?.body && typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(assistantApiPath(path), { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(parseApiErrorMessage(text));
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
