export const TEXT_VERSION = 'nfc_v2';
export const MAX_TEXT = 16000;

export function normalizeText(text) {
  return String(text).normalize('NFC').replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').trim();
}

export function tokenCount(text) {
  return (text.match(/[\p{L}\p{N}]+/gu) || []).length;
}

export async function hashText(text) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), b => b.toString(16).padStart(2, '0')).join('');
}

export function normalizeLanguage(code) {
  const value = String(code || '').toLowerCase().replace('_', '-');
  if (value === 'fil') return 'tl';
  if (value.startsWith('zh')) return 'zh';
  return value.split('-')[0] || null;
}

export function detectedLanguage(result, supported) {
  if (!result?.isReliable || !Array.isArray(result.languages)) return {language: null, reliable: false};
  const top = [...result.languages].sort((a, b) => b.percentage - a.percentage)[0];
  if (!top) return {language: null, reliable: false};
  const language = normalizeLanguage(top.language);
  return {language, reliable: top.percentage >= 80, supported: supported.includes(language)};
}

export function supportedPath(path) {
  return /^\/(feed(?:\/|$)|posts\/|in\/[^/]+\/recent-activity(?:\/|$))/.test(path);
}
