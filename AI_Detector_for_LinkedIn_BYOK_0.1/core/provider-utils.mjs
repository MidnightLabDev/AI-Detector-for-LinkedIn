export class DetectorError extends Error {
  constructor(code, message, retryAfter = 0) {
    super(message);
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

export function publicError(error) {
  return {
    ok: false,
    error: error?.code || 'unavailable',
    message: error instanceof DetectorError ? error.message : 'Analysis is unavailable.',
    retryAfter: error?.retryAfter || 0
  };
}

export function cleanKey(raw, label = 'API') {
  const key = typeof raw === 'string' ? raw.trim().replace(/^Bearer\s+/i, '') : '';
  if (key.length < 8 || key.length > 4096 || /[^\x21-\x7e]/.test(key)) {
    throw new DetectorError('invalid_key', `Paste a valid ${label} key on one line.`);
  }
  return key;
}

export function parseRetryAfter(response) {
  const value = response.headers.get('Retry-After');
  if (/^\d+(?:\.\d+)?$/.test(value || '')) return Math.max(1, Math.ceil(Number(value)));
  const dateDelay = (Date.parse(value || '') - Date.now()) / 1000;
  return Math.max(1, Number.isFinite(dateDelay) ? Math.ceil(dateDelay) : 30);
}
