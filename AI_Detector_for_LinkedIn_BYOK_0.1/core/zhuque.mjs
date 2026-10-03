import {probability} from './probability.mjs';
import {DetectorError, parseRetryAfter} from './provider-utils.mjs';

export const API = 'https://ai-gateway.edgeone.link';
export const MODEL = '@makers/zhuque-text';
export const PROVIDER = 'zhuque';
export const PATH = '/v1/providers/zhuque-text/classify';

function parseZhuque(body) {
  if (body?.status !== 'success') throw new DetectorError('provider_error', 'Zhuque could not analyze this text.');
  const labels = body?.labels_ratio;
  if (!labels || typeof labels !== 'object') throw new DetectorError('invalid_response', 'Zhuque returned an unexpected result.');

  const humanRaw = probability(labels['0']);
  const aiRaw = probability(labels['1']);
  const suspectedRaw = probability(labels['2']);
  const total = humanRaw + aiRaw + suspectedRaw;
  if (!Number.isFinite(total) || total <= 0 || Math.abs(total - 1) > 0.05) {
    throw new DetectorError('invalid_response', 'Zhuque returned an unexpected probability distribution.');
  }

  return {
    ai: aiRaw / total,
    human: humanRaw / total,
    suspected: suspectedRaw / total,
    model: MODEL,
    language: null,
    ratio_confidence: typeof body.ratio_confidence === 'number' ? body.ratio_confidence : null,
    softmax_confidence: typeof body.softmax_confidence === 'number' ? body.softmax_confidence : null
  };
}

export function createZhuqueClient({fetcher = fetch, timeoutMs = 20000, onAttempt = () => {}} = {}) {
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
        body: JSON.stringify({text, is_merge: true}),
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'error',
        signal: controller.signal
      });

      if ([401, 403].includes(response.status)) throw new DetectorError('invalid_key', 'Zhuque rejected this key. Check your Tencent EdgeOne API access.');
      if (response.status === 402) throw new DetectorError('billing', 'Your Tencent EdgeOne account cannot process more model usage.');
      if ([429, 529].includes(response.status)) throw new DetectorError('rate_limit', 'Zhuque is limiting requests. Analysis will resume shortly.', parseRetryAfter(response));
      if (!response.ok) throw new DetectorError('provider_error', `Zhuque returned HTTP ${response.status}.`, response.status >= 500 ? 30 : 0);

      let body;
      try { body = await response.json(); }
      catch { throw new DetectorError('invalid_response', 'Zhuque returned an unreadable response.'); }
      return parseZhuque(body);
    } catch (error) {
      if (signal?.aborted) throw new DetectorError('cancelled', 'Analysis cancelled.');
      if (error instanceof DetectorError) throw error;
      throw new DetectorError('network_error', 'Zhuque could not be reached or the request timed out.', 30);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }

  async function verify(key, signal) {
    const result = await classify('This is a connection check for the AI detector.', key, signal);
    return {provider: PROVIDER, model: result.model, connected_at: new Date().toISOString(), verified: true};
  }

  return {classify, verify};
}
