// One API origin for requests and relative question images.
export const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || (import.meta.env?.DEV ? '/api' : 'https://nosqlproject-fp2f.onrender.com/api');
export function resolveAssetUrl(value, apiBase = API_BASE_URL, origin = window.location.origin) {
  if (typeof value !== 'string' || !value.trim()) return '';
  const input = value.trim();
  try {
    const api = new URL(apiBase, origin);
    // API URLs commonly end in /api; uploads are served from the same host root.
    const assetBase = import.meta.env?.VITE_ASSET_BASE_URL || new URL('/', api).href;
    const url = new URL(input, new URL(assetBase, origin));
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}
