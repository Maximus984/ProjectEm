const normalizeBase = (value: string) => value.replace(/\/+$/, "");
const GITHUB_PAGES_API_BASE = "https://maxxforgegeniuses.com/api/v1";

function resolveApiBase() {
  const configured = import.meta.env.VITE_API_BASE?.trim();
  if (configured) {
    return normalizeBase(configured);
  }

  if (
    typeof window !== "undefined" &&
    (window.location.hostname.endsWith(".netlify.app") || window.location.hostname.endsWith(".netlify.live"))
  ) {
    return "/.netlify/functions/api";
  }

  if (typeof window !== "undefined" && window.location.hostname.endsWith(".github.io")) {
    return GITHUB_PAGES_API_BASE;
  }

  return "/api/v1";
}

const API_BASE = resolveApiBase();

type ApiOptions = RequestInit & {
  token?: string;
};

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network request failed.";
    throw new Error(
      `Unable to reach the service right now (${message}). Please refresh and try again.`
    );
  }

  if (!response.ok) {
    const rawText = await response.text().catch(() => "");
    if (rawText.trim()) {
      try {
        const payload = JSON.parse(rawText) as { message?: string };
        throw new Error(payload.message ?? rawText);
      } catch {
        throw new Error(rawText);
      }
    }
    throw new Error("API request failed.");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export { API_BASE };
