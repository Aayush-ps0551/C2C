/**
 * API configuration helper.
 * When VITE_API_URL or VITE_BACKEND_URL is configured (e.g. https://your-backend.onrender.com),
 * endpoints are prefixed with that URL.
 * When neither is configured, it defaults to empty string so that relative URLs (/api/...)
 * are used (working with Vite dev proxy or Vercel rewrites).
 */
export const API_BASE_URL: string = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  ''
).replace(/\/+$/, '');

export function apiUrl(endpoint: string): string {
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${path}`;
}
