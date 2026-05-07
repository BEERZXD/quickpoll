import { appCopy } from "./copy";

const FALLBACK_REALTIME_PORT = "8787";

export function realtimeHttpUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_REALTIME_URL || localRealtimeUrl();
  return `${base.replace(/\/$/, "")}${path}`;
}

export function realtimeSocketUrl(path: string): string {
  const httpUrl = realtimeHttpUrl(path);
  return httpUrl.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = (await response.json().catch(() => null)) as T | { error?: string } | null;

  if (!response.ok) {
    const message =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : appCopy.api.requestFailed;
    throw new Error(message);
  }

  return data as T;
}

function localRealtimeUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:${FALLBACK_REALTIME_PORT}`;
  }

  return `http://localhost:${FALLBACK_REALTIME_PORT}`;
}
