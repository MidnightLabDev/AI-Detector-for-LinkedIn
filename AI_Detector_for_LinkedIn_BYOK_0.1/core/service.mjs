import {createZhuqueClient, MODEL as ZHUQUE_MODEL} from './zhuque.mjs';
import {createWinstonClient, MODEL as WINSTON_MODEL, LANGUAGES as WINSTON_LANGUAGES, MIN_CHARS as WINSTON_MIN_CHARS} from './winston.mjs';
import {DetectorError, publicError, cleanKey} from './provider-utils.mjs';
import {distributionPercentages, percentages} from './probability.mjs';
import {normalizeText, hashText, tokenCount, detectedLanguage, normalizeLanguage, supportedPath, TEXT_VERSION, MAX_TEXT} from './text.mjs';

const PROVIDERS = Object.freeze({
  zhuque: {id: 'zhuque', provider: 'zhuque-text', label: 'Zhuque AI', model: ZHUQUE_MODEL, languages: ['en']},
  winston: {id: 'winston', provider: 'winston-v2', label: 'Winston AI', model: WINSTON_MODEL, languages: [...WINSTON_LANGUAGES]}
});

export const DEFAULTS = Object.freeze({provider: 'zhuque', enabled: false, posts: true, comments: true, en: true, minWords: 10});

export function createService(chrome, {production, fetcher = fetch, now = Date.now, timeoutMs = 20000} = {}) {
  let state, serial = Promise.resolve(), epoch = 0, running = 0, setupController;
  const work = new Map(), subscribers = new Map(), queue = [];

  const providerConfig = id => PROVIDERS[id] || null;
  const scoringVersion = id => production?.providers?.[id]?.scoring_version || `${id}_v1`;

  const ready = (async () => {
    if (production?.schema_version !== 2 || !production?.providers?.zhuque || !production?.providers?.winston) {
      throw new DetectorError('configuration', 'The detector configuration is invalid.');
    }

    await Promise.all([
      chrome.storage.local.setAccessLevel({accessLevel: 'TRUSTED_CONTEXTS'}),
      chrome.storage.session.setAccessLevel({accessLevel: 'TRUSTED_CONTEXTS'})
    ]);

    const [local, session] = await Promise.all([
      chrome.storage.local.get(['settings', 'providerPins', 'providerKeys', 'pin', 'key']),
      chrome.storage.session.get(['providerKeys', 'key', 'cache', 'stats', 'cooldowns', 'cooldown'])
    ]);

    const settings = {...DEFAULTS, ...local.settings};
    delete settings.ar;
    if (!providerConfig(settings.provider)) settings.provider = 'zhuque';

    const pins = {...(local.providerPins || {})};
    const localKeys = {...(local.providerKeys || {})};
    const sessionKeys = {...(session.providerKeys || {})};

    if (!pins.zhuque && local.pin?.provider === 'zhuque-text') pins.zhuque = {...local.pin, provider: 'zhuque'};
    if (!localKeys.zhuque && !sessionKeys.zhuque && (local.key || session.key)) {
      if (local.key) localKeys.zhuque = local.key;
      else sessionKeys.zhuque = session.key;
    }

    const keys = {
      zhuque: sessionKeys.zhuque || localKeys.zhuque || '',
      winston: sessionKeys.winston || localKeys.winston || ''
    };
    const remembered = {zhuque: !!localKeys.zhuque, winston: !!localKeys.winston};
    const validPins = {};
    for (const id of Object.keys(PROVIDERS)) {
      if (pins[id]?.provider === id && keys[id]) validPins[id] = pins[id];
    }

    state = {
      settings,
      keys,
      remembered,
      pins: validPins,
      cache: session.cache || {},
      cooldowns: {...(session.cooldowns || {}), zhuque: session.cooldowns?.zhuque || session.cooldown || 0, winston: session.cooldowns?.winston || 0},
      stats: session.stats || {requests: 0, failures: 0, cache_hits: 0, duplicate_hits: 0, lookups: 0, latencies: []}
    };

    if (!state.keys[state.settings.provider] || !state.pins[state.settings.provider]) state.settings.enabled = false;

    await chrome.storage.local.set({settings: state.settings, providerPins: state.pins, providerKeys: localKeys});
    await chrome.storage.session.set({providerKeys: sessionKeys, cooldowns: state.cooldowns});
    await chrome.storage.local.remove(['pin', 'key']);
    await chrome.storage.session.remove(['key', 'cooldown']);
  })();

  function locked(fn) {
    const task = serial.then(() => ready).then(fn);
    serial = task.catch(() => {});
    return task;
  }

  const onAttempt = () => locked(async () => {
    state.stats.requests++;
    await persistSession();
  });

  const clients = {
    zhuque: createZhuqueClient({fetcher, timeoutMs, onAttempt}),
    winston: createWinstonClient({fetcher, timeoutMs, onAttempt})
  };

  const activeProvider = () => state.settings.provider;
  const connected = id => !!state.keys[id] && !!state.pins[id];
  const activeModel = id => state.pins[id]?.model || providerConfig(id)?.model || '';
  const safeSettings = () => ({...state.settings, connected: connected(activeProvider()), enabled: state.settings.enabled && connected(activeProvider())});

  async function persistSession() {
    await chrome.storage.session.set({cache: state.cache, stats: state.stats, cooldowns: state.cooldowns});
  }

  async function broadcast() {
    const tabs = await chrome.tabs.query({url: 'https://www.linkedin.com/*'});
    await Promise.allSettled(tabs.map(tab => chrome.tabs.sendMessage(tab.id, {type: 'SETTINGS_CHANGED', settings: safeSettings()})));
  }

  function status() {
    const provider = activeProvider();
    return {
      ok: true,
      settings: safeSettings(),
      provider,
      providerLabel: providerConfig(provider).label,
      hasKey: connected(provider),
      remembered: !!state.remembered[provider],
      model: activeModel(provider),
      connections: Object.fromEntries(Object.keys(PROVIDERS).map(id => [id, {
        hasKey: connected(id),
        remembered: !!state.remembered[id],
        model: activeModel(id),
        verified: !!state.pins[id]?.verified
      }]))
    };
  }

  function abortAll() {
    epoch++;
    setupController?.abort();
    for (const task of work.values()) {
      task.controller.abort();
      finish(task, publicError(new DetectorError('cancelled', 'Analysis cancelled.')));
    }
    queue.length = 0;
  }

  function finish(task, response) {
    if (task.done) return;
    task.done = true;
    if (work.get(task.hash) === task) work.delete(task.hash);
    for (const [id, resolve] of task.listeners) {
      subscribers.delete(id);
      resolve(response);
    }
    task.listeners.clear();
    task.text = '';
  }

  async function writeProviderKey(provider, key, remember) {
    const [local, session] = await Promise.all([
      chrome.storage.local.get('providerKeys'),
      chrome.storage.session.get('providerKeys')
    ]);
    const localKeys = {...(local.providerKeys || {})};
    const sessionKeys = {...(session.providerKeys || {})};
    delete localKeys[provider];
    delete sessionKeys[provider];
    if (remember) localKeys[provider] = key;
    else sessionKeys[provider] = key;
    await Promise.all([
      chrome.storage.local.set({providerKeys: localKeys}),
      chrome.storage.session.set({providerKeys: sessionKeys})
    ]);
  }

  async function connect(provider, raw, remember) {
    const config = providerConfig(provider);
    if (!config) throw new DetectorError('invalid_request', 'Choose a supported detector.');
    const key = cleanKey(raw, config.label);
    let generation, controller;

    await locked(async () => {
      abortAll();
      generation = epoch;
      controller = setupController = new AbortController();
      state.settings.provider = provider;
      state.settings.enabled = false;
      await chrome.storage.local.set({settings: state.settings});
    });
    await broadcast();

    const pin = await clients[provider].verify(key, controller.signal);

    await locked(async () => {
      if (generation !== epoch) throw new DetectorError('cancelled', 'Connection cancelled.');
      await writeProviderKey(provider, key, remember);
      state.keys[provider] = key;
      state.remembered[provider] = !!remember;
      state.pins[provider] = pin;
      state.cache = {};
      state.cooldowns[provider] = 0;
      await chrome.storage.local.set({providerPins: state.pins, settings: state.settings});
      await persistSession();
    });
    return status();
  }

  async function remove(provider) {
    const id = providerConfig(provider) ? provider : activeProvider();
    await locked(async () => {
      abortAll();
      state.keys[id] = '';
      state.remembered[id] = false;
      delete state.pins[id];
      state.cache = {};
      state.cooldowns[id] = 0;
      if (state.settings.provider === id) state.settings.enabled = false;
      await writeProviderKey(id, '', false);
      const session = await chrome.storage.session.get('providerKeys');
      const sessionKeys = {...(session.providerKeys || {})};
      delete sessionKeys[id];
      await chrome.storage.session.set({providerKeys: sessionKeys});
      await chrome.storage.local.set({providerPins: state.pins, settings: state.settings});
      await persistSession();
    });
    await broadcast();
    return status();
  }

  async function update(input) {
    await locked(async () => {
      const next = {...state.settings};
      if (input?.provider !== undefined) {
        if (!providerConfig(input.provider)) throw new DetectorError('invalid_request', 'Choose Zhuque AI or Winston AI.');
        if (state.settings.enabled && input.provider !== state.settings.provider) {
          throw new DetectorError('invalid_request', 'Untick Detector enabled before changing provider.');
        }
        next.provider = input.provider;
      }
      for (const key of ['enabled', 'posts', 'comments', 'en']) if (typeof input?.[key] === 'boolean') next[key] = input[key];
      if (input?.minWords !== undefined) {
        const minWords = Number(input.minWords);
        if (!Number.isInteger(minWords) || minWords < 1 || minWords > 100) throw new DetectorError('invalid_request', 'Minimum words must be between 1 and 100.');
        next.minWords = minWords;
      }
      if (next.enabled && !connected(next.provider)) throw new DetectorError('missing_key', `Save your ${providerConfig(next.provider).label} API key first.`);
      abortAll();
      state.settings = next;
      if (!connected(next.provider)) state.settings.enabled = false;
      await chrome.storage.local.set({settings: state.settings});
    });
    await broadcast();
    return status();
  }

  function localLanguage(text, detection, provider) {
    const config = providerConfig(provider);
    const detected = detectedLanguage(detection, config.languages);

    if (provider === 'zhuque') {
      // Strict English-only policy:
      // Zhuque receives text only when Chrome reliably identifies English.
      // No Latin-script fallback is allowed.
      return detected.reliable && detected.language === 'en' ? 'en' : '__unsupported__';
    }

    if (detected.reliable) return detected.supported ? detected.language : '__unsupported__';
    return null;
  }

  function providerLanguageEnabled(provider, language) {
    if (provider !== 'zhuque') return true;
    return language === 'en' && !!state.settings.en;
  }

  async function submit(message, sender) {
    if (
      Object.keys(message).some(key => !['type', 'text', 'kind', 'requestId'].includes(key)) ||
      !['post', 'comment'].includes(message.kind) ||
      typeof message.requestId !== 'string' ||
      message.requestId.length > 100 ||
      typeof message.text !== 'string'
    ) throw new DetectorError('invalid_request', 'Invalid text request.');

    const text = normalizeText(message.text);
    const tokens = tokenCount(text);
    if (!text || tokens === 0 || tokens < state.settings.minWords) return {ok: true, status: 'insufficient', language: 'en'};
    if (text.length > MAX_TEXT) return {ok: true, status: 'too_long'};

    const provider = activeProvider();
    if (provider === 'winston' && text.length < WINSTON_MIN_CHARS) {
      return {ok: true, status: 'insufficient', provider, minimum_chars: WINSTON_MIN_CHARS};
    }

    const hash = await hashText(JSON.stringify([provider, activeModel(provider), scoringVersion(provider), TEXT_VERSION, text]));
    const id = `${sender.tab.id}:${sender.frameId || 0}:${message.requestId}`;
    let responsePromise;

    await locked(async () => {
      if (provider !== activeProvider()) throw new DetectorError('cancelled', 'Detector changed.');
      if (!connected(provider)) throw new DetectorError('missing_key', `Save your ${providerConfig(provider).label} API key first.`);
      if (!state.settings.enabled || !state.settings[message.kind === 'post' ? 'posts' : 'comments']) throw new DetectorError('disabled', 'Analysis is off.');
      state.stats.lookups++;

      if (state.cache[hash]) {
        const result = state.cache[hash];
        if (!providerLanguageEnabled(provider, result.language)) {
          responsePromise = Promise.resolve({ok: true, status: 'language_disabled'});
          return;
        }
        state.stats.cache_hits++;
        responsePromise = Promise.resolve({...result, cached: true});
        await persistSession();
        return;
      }

      if ((state.cooldowns[provider] || 0) > now()) throw new DetectorError('rate_limit', 'Analysis is paused briefly.', Math.ceil((state.cooldowns[provider] - now()) / 1000));
      if (subscribers.has(id)) throw new DetectorError('invalid_request', 'Duplicate request identifier.');

      let task = work.get(hash);
      if (task) state.stats.duplicate_hits++;
      else {
        if (queue.length >= 100) throw new DetectorError('busy', 'Analysis is queued. Try again shortly.', 3);
        task = {hash, text, provider, listeners: new Map(), controller: new AbortController(), epoch, key: state.keys[provider]};
        work.set(hash, task);
        queue.push(task);
      }

      responsePromise = new Promise(resolve => task.listeners.set(id, resolve));
      subscribers.set(id, task);
    });

    pump();
    return responsePromise;
  }

  function cancel(requestId, sender) {
    const id = `${sender.tab.id}:${sender.frameId || 0}:${requestId}`;
    const task = subscribers.get(id);
    if (task) {
      task.listeners.get(id)?.(publicError(new DetectorError('cancelled', 'Analysis cancelled.')));
      task.listeners.delete(id);
      subscribers.delete(id);
      if (!task.listeners.size) {
        task.controller.abort();
        finish(task, publicError(new DetectorError('cancelled', 'Analysis cancelled.')));
      }
    }
    return {ok: true};
  }

  function pump() {
    while (running < 2 && queue.length) {
      const task = queue.shift();
      if (task.done) continue;
      running++;
      execute(task)
        .then(response => finish(task, response), error => finish(task, publicError(error)))
        .finally(() => {running--; pump();});
    }
  }

  async function execute(task) {
    try {
      if (task.done || task.epoch !== epoch) throw new DetectorError('cancelled', 'Analysis cancelled.');

      let detection;
      try { detection = await chrome.i18n.detectLanguage(task.text); }
      catch { detection = null; }
      let language = localLanguage(task.text, detection, task.provider);

      if (task.done || task.epoch !== epoch) throw new DetectorError('cancelled', 'Analysis cancelled.');
      if (language === '__unsupported__') return {ok: true, status: 'unsupported'};
      if (task.provider === 'zhuque' && !language) return {ok: true, status: 'unsupported'};
      if (!providerLanguageEnabled(task.provider, language)) return {ok: true, status: 'language_disabled'};
      if ((state.cooldowns[task.provider] || 0) > now()) throw new DetectorError('rate_limit', 'Analysis is paused briefly.', Math.ceil((state.cooldowns[task.provider] - now()) / 1000));

      const start = now();
      const raw = await clients[task.provider].classify(task.text, task.key, task.controller.signal);

      if (task.provider === 'winston') {
        const responseLanguage = normalizeLanguage(raw.language);
        if (responseLanguage && !WINSTON_LANGUAGES.includes(responseLanguage)) return {ok: true, status: 'unsupported'};
        language = responseLanguage || language || 'en';
      }

      const scores = task.provider === 'zhuque'
        ? {...distributionPercentages(raw.ai, raw.suspected, raw.human), score_mode: 'three'}
        : {...percentages(raw.ai), suspected_ai: null, score_mode: 'binary'};

      const result = {
        ok: true,
        status: 'classified',
        language,
        ...scores,
        model: raw.model,
        provider: task.provider,
        scoring_version: scoringVersion(task.provider)
      };

      if (task.provider === 'zhuque') {
        result.ratio_confidence = raw.ratio_confidence;
        result.softmax_confidence = raw.softmax_confidence;
      } else {
        result.credits_used = raw.credits_used;
        result.credits_remaining = raw.credits_remaining;
      }

      await locked(async () => {
        if (task.epoch !== epoch || task.done) throw new DetectorError('cancelled', 'Analysis cancelled.');
        state.stats.latencies.push(now() - start);
        state.stats.latencies = state.stats.latencies.slice(-1000);
        state.cache = {...Object.fromEntries(Object.entries(state.cache).slice(-999)), [task.hash]: result};
        if (task.provider === 'winston' && state.pins.winston) {
          state.pins.winston = {...state.pins.winston, verified: true, model: raw.model};
          await chrome.storage.local.set({providerPins: state.pins});
        }
        await persistSession();
      });
      return result;
    } catch (error) {
      await locked(async () => {
        if (task.epoch !== epoch || error.code === 'cancelled') return;
        state.stats.failures++;
        if (error.retryAfter) state.cooldowns[task.provider] = Math.max(state.cooldowns[task.provider] || 0, now() + error.retryAfter * 1000);
        if (['invalid_key', 'billing'].includes(error.code) && state.settings.provider === task.provider) {
          state.settings.enabled = false;
          await chrome.storage.local.set({settings: state.settings});
        }
        await persistSession();
      });
      if (['invalid_key', 'billing'].includes(error.code) && task.epoch === epoch) await broadcast();
      throw error;
    }
  }

  async function handle(message, sender) {
    await ready;
    if (sender?.id !== chrome.runtime.id) throw new DetectorError('forbidden', 'Untrusted caller.');
    const popup = sender.url === chrome.runtime.getURL('popup.html');
    let source;
    try { source = new URL(sender.url); }
    catch { throw new DetectorError('forbidden', 'Untrusted caller.'); }
    const linkedin = !!sender.tab && source.origin === 'https://www.linkedin.com';
    if (!popup && !linkedin) throw new DetectorError('forbidden', 'Untrusted caller.');

    if (message?.type === 'GET_SETTINGS') return {ok: true, settings: safeSettings()};
    if (linkedin && message.type === 'CANCEL') return cancel(message.requestId, sender);
    if (linkedin && supportedPath(source.pathname) && message.type === 'CLASSIFY') return submit(message, sender);
    if (!popup) throw new DetectorError('forbidden', 'This action is available only in the popup.');

    if (message.type === 'GET_STATUS') return status();
    if (message.type === 'CONNECT') return connect(message.provider, message.apiKey, message.remember === true);
    if (message.type === 'REMOVE_KEY') return remove(message.provider);
    if (message.type === 'UPDATE_SETTINGS') return update(message.settings);

    if (message.type === 'PAGE_DIAGNOSTICS') {
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      let url;
      try { url = new URL(tab?.url); } catch {}
      if (url?.origin !== 'https://www.linkedin.com') return {ok: false, message: 'Open LinkedIn in the active tab, then check again.'};
      try {
        const result = await chrome.tabs.sendMessage(tab.id, {type: 'PAGE_DIAGNOSTICS'}, {frameId: 0});
        if (result?.ok) return result;
      } catch {}
      return {ok: false, message: 'Refresh LinkedIn to load this extension version, then check again.'};
    }

    if (message.type === 'DIAGNOSTICS') {
      const values = [...state.stats.latencies].sort((a, b) => a - b);
      return {
        ok: true,
        ...state.stats,
        latencies: undefined,
        median_ms: values[Math.floor(values.length * .5)] ?? null,
        p95_ms: values[Math.min(values.length - 1, Math.ceil(values.length * .95) - 1)] ?? null,
        cache_hit_rate: state.stats.lookups ? state.stats.cache_hits / state.stats.lookups : null
      };
    }

    throw new DetectorError('invalid_request', 'Unknown request.');
  }

  function tabClosed(tabId) {
    for (const id of [...subscribers.keys()]) if (id.startsWith(tabId + ':')) {
      const [, frame, ...rest] = id.split(':');
      cancel(rest.join(':'), {tab: {id: tabId}, frameId: Number(frame)});
    }
  }

  return {handle, ready, tabClosed};
}
