/**
 * API base for packaged Electron (and optional remote deploys).
 * Empty in Vite dev so relative /api paths use the Vite proxy.
 */
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export function apiUrl(path) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${normalized}`;
}

export function apiFetch(path, options) {
  return fetch(apiUrl(path), options);
}
