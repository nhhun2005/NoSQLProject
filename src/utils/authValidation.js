export const validEmail = value => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) && value.trim().length <= 254;
export function safeReturnTo(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes(String.fromCharCode(92)) || [...value].some(char => char.charCodeAt(0) < 32)) return '/about';
  if (/^\/(login|login-test|register|forgot-password|banned)(?:[/?#]|$)/.test(value)) return '/about';
  return value;
}
