const normalizeBase = (value) => value.replace(/\/+$/, "");
function resolveApiBase() {
    const configured = import.meta.env.VITE_API_BASE?.trim();
    if (configured) {
        return normalizeBase(configured);
    }
    if (typeof window !== "undefined" &&
        (window.location.hostname.endsWith(".netlify.app") || window.location.hostname.endsWith(".netlify.live"))) {
        return "/.netlify/functions/api";
    }
    return "/api/v1";
}
const API_BASE = resolveApiBase();
export async function api(path, options = {}) {
    const headers = new Headers(options.headers);
    headers.set("Content-Type", "application/json");
    if (options.token) {
        headers.set("Authorization", `Bearer ${options.token}`);
    }
    let response;
    try {
        response = await fetch(`${API_BASE}${path}`, {
            ...options,
            headers
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Network request failed.";
        throw new Error(`Unable to reach the service right now (${message}). Please refresh and try again.`);
    }
  if (!response.ok) {
    const rawText = await response.text().catch(() => "");
    if (rawText.trim()) {
      try {
        const payload = JSON.parse(rawText);
        throw new Error(payload.message ?? rawText);
      }
      catch {
        throw new Error(rawText);
      }
    }
    throw new Error("API request failed.");
  }
    if (response.status === 204) {
        return undefined;
    }
    return response.json();
}
export { API_BASE };
