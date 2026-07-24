/**
 * API base for packaged Electron (and optional remote deploys).
 * Empty in Vite dev so relative /api paths use the Vite proxy.
 * Packaged builds resolve from api-config.json via Electron IPC (install-time port).
 */
let API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export async function initApiBase() {
  try {
    if (typeof window !== "undefined" && window.ppmpDesktop?.getApiBaseUrl) {
      const fromDesktop = await window.ppmpDesktop.getApiBaseUrl();
      if (fromDesktop) {
        API_BASE = String(fromDesktop).replace(/\/$/, "");
      }
    }
  } catch (_) {
    // keep build-time / empty default
  }
  return API_BASE;
}

export function getApiBase() {
  return API_BASE;
}

export function apiUrl(path) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${normalized}`;
}

export function apiFetch(path, options) {
  return fetch(apiUrl(path), options);
}
