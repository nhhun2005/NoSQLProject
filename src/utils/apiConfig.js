export function normalizeApiBaseUrl(rawUrl, isDev = Boolean(import.meta.env?.DEV)) {
  if (rawUrl === undefined || rawUrl === null) {
    return isDev ? '/api' : 'https://nosqlproject-hfc6.onrender.com/api';
  }

  if (typeof rawUrl !== 'string') {
    throw new Error(`Invalid API base URL configuration: expected string, received ${typeof rawUrl}.`);
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return isDev ? '/api' : 'https://nosqlproject-hfc6.onrender.com/api';
  }

  if (trimmed.startsWith('//')) {
    throw new Error(`Invalid API base URL configuration: protocol-relative URL "${rawUrl}" is not allowed.`);
  }

  if (/[\s\\]/.test(trimmed)) {
    throw new Error('Invalid API base URL configuration: whitespace or backslashes are not allowed.');
  }

  if (trimmed.includes('?') || trimmed.includes('#')) {
    throw new Error(`Invalid API base URL configuration: URL "${rawUrl}" must not contain query parameters or hash fragments.`);
  }

  if (trimmed.startsWith('/')) {
    const cleaned = trimmed.replace(/\/+$/, '');
    return cleaned === '' ? '/api' : cleaned;
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`Invalid API base URL configuration: malformed URL "${rawUrl}".`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Invalid API base URL configuration: unsupported scheme "${parsed.protocol}". Only http: and https: are allowed.`);
  }

  if (parsed.username || parsed.password) {
    throw new Error('Invalid API base URL configuration: credentials are not allowed.');
  }

  const path = parsed.pathname.replace(/\/+$/, '');
  return path ? `${parsed.origin}${path}` : `${parsed.origin}/api`;
}

// One API origin for requests and relative question images.
export const API_BASE_URL = normalizeApiBaseUrl(import.meta.env?.VITE_API_BASE_URL);

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
