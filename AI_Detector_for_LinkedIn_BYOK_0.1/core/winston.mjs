import {DetectorError, parseRetryAfter} from './provider-utils.mjs';

export const API = 'https://api.gowinston.ai';
export const PATH = '/v2/ai-content-detection';
export const PROVIDER = 'winston';
export const MODEL = 'Winston AI v2 latest';
export const MIN_CHARS = 300;
export const WARN_CHARS = 600;
export const LANGUAGES = Object.freeze(['en','fr','es','pt','nl','de','pl','it','ro','id','tl','ru','bg','zh']);

function parseWinston(body) {
  const score = Number(body?.score);
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new DetectorError('invalid_response', 'Winston AI returned an unexpected Human Score.');
  }
  const human = score / 100;
  return {
    ai: 1 - human,
    human,
    suspected: null,
    model: typeof body?.version === 'string' && body.version ? `Winston AI ${body.version}` : MODEL,
    language: typeof body?.language === 'string' ? body.language.toLowerCase() : null,
    credits_used: Number.isFinite(Number(body?.credits_used)) ? Number(body.credits_used) : null,
    credits_remaining: Number.isFinite(Number(body?.credits_remaining)) ? Number(body.credits_remaining) : null
  };
}

export function createWinstonClient({fetcher = fetch, timeoutMs = 20000, onAttempt = () => {}} = {}) {
  async function classify(text, key, signal) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, {once: true});
    if (signal?.aborted) abort();
    const timer = setTimeout(abort, timeoutMs);

    try {
      if (controller.signal.aborted) throw new DetectorError('cancelled', 'Analysis cancelled.');
      await onAttempt(PROVIDER);
      const response = await fetcher(API + PATH, {
        method: 'POST',
        headers: {Authorization: `Bearer ${key}`, 'Content-Type': 'application/json'},
        body: JSON.stringify({text, version: 'latest', sentences: false, language: 'auto'}),
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'error',
        signal: controller.signal
      });

      if (response.status === 401 || response.status === 403) throw new DetectorError('invalid_key', 'Winston AI rejected this API key. Check your developer token.');
      if (response.status === 402) throw new DetectorError('billing', 'Your Winston AI developer account does not have enough credits.');
      if (response.status === 429) throw new DetectorError('rate_limit', 'Winston AI is limiting requests. Analysis will resume shortly.', parseRetryAfter(response));
      if (!response.ok) {
        let message = `Winston AI returned HTTP ${response.status}.`;
        try {
          const body = await response.json();
          if (body?.description) message = String(body.description);
        } catch {}
        throw new DetectorError('provider_error', message, response.status >= 500 ? 30 : 0);
      }

      let body;
      try { body = await response.json(); }
      catch { throw new DetectorError('invalid_response', 'Winston AI returned an unreadable response.'); }
      return parseWinston(body);
    } catch (error) {
      if (signal?.aborted) throw new DetectorError('cancelled', 'Analysis cancelled.');
      if (error instanceof DetectorError) throw error;
      throw new DetectorError('network_error', 'Winston AI could not be reached or the request timed out.', 30);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }

  async function verify(_key, signal) {
    if (signal?.aborted) throw new DetectorError('cancelled', 'Connection cancelled.');
    // Winston charges by word and requires at least 300 characters for a scan.
    // To avoid consuming credits merely for saving a key, validation happens on the first eligible scan.
    return {provider: PROVIDER, model: MODEL, connected_at: new Date().toISOString(), verified: false};
  }

  return {classify, verify};
}
