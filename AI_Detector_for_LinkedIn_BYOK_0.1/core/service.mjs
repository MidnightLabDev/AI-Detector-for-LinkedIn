import {createZhuqueClient, MODEL as ZHUQUE_MODEL} from './zhuque.mjs';
import {DetectorError, publicError, cleanKey} from './provider-utils.mjs';
import {distributionPercentages} from './probability.mjs';
import {normalizeText, hashText, tokenCount, detectedLanguage, supportedPath, TEXT_VERSION, MAX_TEXT} from './text.mjs';

const PROVIDER = Object.freeze({
  id: 'zhuque',
  provider: 'zhuque-text',
  label: 'Zhuque AI',
  model: ZHUQUE_MODEL,
  languages: ['en']
});

export const DEFAULTS = Object.freeze({
  provider: 'zhuque',
  enabled: false,
  posts: true,
  comments: true,
  en: true,
  minWords: 10
});

export function createService(chrome, {production, fetcher = fetch, now = Date.now, timeoutMs = 20000} = {}) {
  let state, serial = Promise.resolve(), epoch = 0, running = 0, setupController;
  const work = new Map(), subscribers = new Map(), queue = [];

  const scoringVersion = () => production?.providers?.zhuque?.scoring_version || 'zhuque_three_labels_v1';

  const ready = (async () => {
    if (production?.schema_version !== 2 || !production?.providers?.zhuque) {
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

    const settings = {...DEFAULTS, ...local.settings, provider: 'zhuque'};
    delete settings.ar;

    const pins = {};
    const localKeys = {};
    const sessionKeys = {};

    const existingLocalKeys = {...(local.providerKeys || {})};
    const existingSessionKeys = {...(session.providerKeys || {})};
    const existingPins = {...(local.providerPins || {})};

    if (existingLocalKeys.zhuque) localKeys.zhuque = existingLocalKeys.zhuque;
    if (existingSessionKeys.zhuque) sessionKeys.zhuque = existingSessionKeys.zhuque;

    if (!localKeys.zhuque && !sessionKeys.zhuque && (local.key || session.key)) {
      if (local.key) localKeys.zhuque = local.key;
      else sessionKeys.zhuque = session.key;
    }

    if (existingPins.zhuque?.provider === 'zhuque') pins.zhuque = existingPins.zhuque;
    else if (local.pin?.provider === 'zhuque-text') pins.zhuque = {...local.pin, provider: 'zhuque'};

    const key = sessionKeys.zhuque || localKeys.zhuque || '';
    if (!key) delete pins.zhuque;

    state = {
      settings,
      key,
      remembered: !!localKeys.zhuque,
      pin: pins.zhuque || null,
      cache: session.cache || {},
      cooldown: session.cooldowns?.zhuque || session.cooldown || 0,
      stats: session.stats || {
        requests: 0,
        failures: 0,
        cache_hits: 0,
        duplicate_hits: 0,
        lookups: 0,
        latencies: []
      }
    };

    if (!state.key || !state.pin) state.settings.enabled = false;

    await chrome.storage.local.set({
      settings: state.settings,
      providerPins: state.pin ? {zhuque: state.pin} : {},
      providerKeys: localKeys
    });
    await chrome.storage.session.set({
      providerKeys: sessionKeys,
      cooldowns: {zhuque: state.cooldown}
    });

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

  const client = createZhuqueClient({fetcher, timeoutMs, onAttempt});

  const connected = () => !!state.key && !!state.pin;
  const activeModel = () => state.pin?.model || PROVIDER.model || '';
  const safeSettings = () => ({
    ...state.settings,
    connected: connected(),
    enabled: state.settings.enabled && connected()
  });

  async function persistSession() {
    await chrome.storage.session.set({
      cache: state.cache,
      stats: state.stats,
      cooldowns: {zhuque: state.cooldown}
    });
  }

  async function broadcast() {
    const tabs = await chrome.tabs.query({url: 'https://www.linkedin.com/*'});
    await Promise.allSettled(
      tabs.map(tab => chrome.tabs.sendMessage(tab.id, {type: 'SETTINGS_CHANGED', settings: safeSettings()}))
    );
  }

  function status() {
    return {
      ok: true,
      settings: safeSettings(),
      provider: 'zhuque',
      providerLabel: PROVIDER.label,
      hasKey: connected(),
      remembered: state.remembered,
      model: activeModel(),
      connections: {
        zhuque: {
          hasKey: connected(),
          remembered: state.remembered,
          model: activeModel(),
          verified: !!state.pin?.verified
        }
      }
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

  async function writeKey(key, remember) {
    const [local, session] = await Promise.all([
      chrome.storage.local.get('providerKeys'),
      chrome.storage.session.get('providerKeys')
    ]);

    const localKeys = {};
    const sessionKeys = {};

    if (remember && key) localKeys.zhuque = key;
    else if (key) sessionKeys.zhuque = key;

    await Promise.all([
      chrome.storage.local.set({providerKeys: localKeys}),
      chrome.storage.session.set({providerKeys: sessionKeys})
    ]);
  }

  async function connect(provider, raw, remember) {
    if (provider && provider !== 'zhuque') {
      throw new DetectorError('invalid_request', 'This build supports Zhuque AI only.');
    }

    const key = cleanKey(raw, PROVIDER.label);
    let generation, controller;

    await locked(async () => {
      abortAll();
      generation = epoch;
      controller = setupController = new AbortController();
      state.settings.provider = 'zhuque';
      state.settings.enabled = false;
      await chrome.storage.local.set({settings: state.settings});
    });

    await broadcast();

    const pin = await client.verify(key, controller.signal);

    await locked(async () => {
      if (generation !== epoch) throw new DetectorError('cancelled', 'Connection cancelled.');

      await writeKey(key, remember);
      state.key = key;
      state.remembered = !!remember;
      state.pin = pin;
      state.cache = {};
      state.cooldown = 0;

      await chrome.storage.local.set({
        providerPins: {zhuque: state.pin},
        settings: state.settings
      });

      await persistSession();
    });

    return status();
  }

  async function remove() {
    await locked(async () => {
      abortAll();
      state.key = '';
      state.remembered = false;
      state.pin = null;
      state.cache = {};
      state.cooldown = 0;
      state.settings.enabled = false;

      await writeKey('', false);
      await chrome.storage.local.set({providerPins: {}, settings: state.settings});
      await persistSession();
    });

    await broadcast();
    return status();
  }

  async function update(input) {
    await locked(async () => {
      const next = {...state.settings, provider: 'zhuque'};

      if (input?.provider !== undefined && input.provider !== 'zhuque') {
        throw new DetectorError('invalid_request', 'This build supports Zhuque AI only.');
      }

      for (const key of ['enabled', 'posts', 'comments', 'en']) {
        if (typeof input?.[key] === 'boolean') next[key] = input[key];
      }

      if (input?.minWords !== undefined) {
        const minWords = Number(input.minWords);
        if (!Number.isInteger(minWords) || minWords < 1 || minWords > 100) {
          throw new DetectorError('invalid_request', 'Minimum words must be between 1 and 100.');
        }
        next.minWords = minWords;
      }

      if (next.enabled && !connected()) {
        throw new DetectorError('missing_key', 'Save your Zhuque AI API key first.');
      }

      abortAll();
      state.settings = next;

      if (!connected()) state.settings.enabled = false;

      await chrome.storage.local.set({settings: state.settings});
    });

    await broadcast();
    return status();
  }

  function localLanguage(detection) {
    const detected = detectedLanguage(detection, PROVIDER.languages);
    return detected.reliable && detected.language === 'en' ? 'en' : '__unsupported__';
  }

  function languageEnabled(language) {
    return language === 'en' && !!state.settings.en;
  }

  async function submit(message, sender) {
    if (
      Object.keys(message).some(key => !['type', 'text', 'kind', 'requestId'].includes(key)) ||
      !['post', 'comment'].includes(message.kind) ||
      typeof message.requestId !== 'string' ||
      message.requestId.length > 100 ||
      typeof message.text !== 'string'
    ) {
      throw new DetectorError('invalid_request', 'Invalid text request.');
    }

    const text = normalizeText(message.text);
    const tokens = tokenCount(text);

    if (!text || tokens === 0 || tokens < state.settings.minWords) {
      return {ok: true, status: 'insufficient', language: 'en'};
    }

    if (text.length > MAX_TEXT) return {ok: true, status: 'too_long'};

    const hash = await hashText(
      JSON.stringify(['zhuque', activeModel(), scoringVersion(), TEXT_VERSION, text])
    );

    const id = `${sender.tab.id}:${sender.frameId || 0}:${message.requestId}`;
    let responsePromise;

    await locked(async () => {
      if (!connected()) throw new DetectorError('missing_key', 'Save your Zhuque AI API key first.');

      if (!state.settings.enabled || !state.settings[message.kind === 'post' ? 'posts' : 'comments']) {
        throw new DetectorError('disabled', 'Analysis is off.');
      }

      state.stats.lookups++;

      if (state.cache[hash]) {
        const result = state.cache[hash];

        if (!languageEnabled(result.language)) {
          responsePromise = Promise.resolve({ok: true, status: 'language_disabled'});
          return;
        }

        state.stats.cache_hits++;
        responsePromise = Promise.resolve({...result, cached: true});
        await persistSession();
        return;
      }

      if (state.cooldown > now()) {
        throw new DetectorError(
          'rate_limit',
          'Analysis is paused briefly.',
          Math.ceil((state.cooldown - now()) / 1000)
        );
      }

      if (subscribers.has(id)) {
        throw new DetectorError('invalid_request', 'Duplicate request identifier.');
      }

      let task = work.get(hash);

      if (task) {
        state.stats.duplicate_hits++;
      } else {
        if (queue.length >= 100) {
          throw new DetectorError('busy', 'Analysis is queued. Try again shortly.', 3);
        }

        task = {
          hash,
          text,
          listeners: new Map(),
          controller: new AbortController(),
          epoch,
          key: state.key
        };

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
      task.listeners.get(id)?.(
        publicError(new DetectorError('cancelled', 'Analysis cancelled.'))
      );

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
        .then(
          response => finish(task, response),
          error => finish(task, publicError(error))
        )
        .finally(() => {
          running--;
          pump();
        });
    }
  }

  async function execute(task) {
    try {
      if (task.done || task.epoch !== epoch) {
        throw new DetectorError('cancelled', 'Analysis cancelled.');
      }

      let detection;
      try {
        detection = await chrome.i18n.detectLanguage(task.text);
      } catch {
        detection = null;
      }

      const language = localLanguage(detection);

      if (task.done || task.epoch !== epoch) {
        throw new DetectorError('cancelled', 'Analysis cancelled.');
      }

      if (language === '__unsupported__') {
        return {ok: true, status: 'unsupported'};
      }

      if (!languageEnabled(language)) {
        return {ok: true, status: 'language_disabled'};
      }

      if (state.cooldown > now()) {
        throw new DetectorError(
          'rate_limit',
          'Analysis is paused briefly.',
          Math.ceil((state.cooldown - now()) / 1000)
        );
      }

      const start = now();
      const raw = await client.classify(task.text, task.key, task.controller.signal);
      const scores = {
        ...distributionPercentages(raw.ai, raw.suspected, raw.human),
        score_mode: 'three'
      };

      const result = {
        ok: true,
        status: 'classified',
        language,
        ...scores,
        model: raw.model,
        provider: 'zhuque',
        scoring_version: scoringVersion(),
        ratio_confidence: raw.ratio_confidence,
        softmax_confidence: raw.softmax_confidence
      };

      await locked(async () => {
        if (task.epoch !== epoch || task.done) {
          throw new DetectorError('cancelled', 'Analysis cancelled.');
        }

        state.stats.latencies.push(now() - start);
        state.stats.latencies = state.stats.latencies.slice(-1000);

        state.cache = {
          ...Object.fromEntries(Object.entries(state.cache).slice(-999)),
          [task.hash]: result
        };

        await persistSession();
      });

      return result;
    } catch (error) {
      await locked(async () => {
        if (task.epoch !== epoch || error.code === 'cancelled') return;

        state.stats.failures++;

        if (error.retryAfter) {
          state.cooldown = Math.max(
            state.cooldown,
            now() + error.retryAfter * 1000
          );
        }

        if (['invalid_key', 'billing'].includes(error.code)) {
          state.settings.enabled = false;
          await chrome.storage.local.set({settings: state.settings});
        }

        await persistSession();
      });

      if (['invalid_key', 'billing'].includes(error.code) && task.epoch === epoch) {
        await broadcast();
      }

      throw error;
    }
  }

  async function handle(message, sender) {
    await ready;

    if (sender?.id !== chrome.runtime.id) {
      throw new DetectorError('forbidden', 'Untrusted caller.');
    }

    const popup = sender.url === chrome.runtime.getURL('popup.html');

    let source;
    try {
      source = new URL(sender.url);
    } catch {
      throw new DetectorError('forbidden', 'Untrusted caller.');
    }

    const linkedin = !!sender.tab && source.origin === 'https://www.linkedin.com';

    if (!popup && !linkedin) {
      throw new DetectorError('forbidden', 'Untrusted caller.');
    }

    if (message?.type === 'GET_SETTINGS') {
      return {ok: true, settings: safeSettings()};
    }

    if (linkedin && message.type === 'CANCEL') {
      return cancel(message.requestId, sender);
    }

    if (linkedin && supportedPath(source.pathname) && message.type === 'CLASSIFY') {
      return submit(message, sender);
    }

    if (!popup) {
      throw new DetectorError('forbidden', 'This action is available only in the popup.');
    }

    if (message.type === 'GET_STATUS') return status();
    if (message.type === 'CONNECT') return connect(message.provider, message.apiKey, message.remember === true);
    if (message.type === 'REMOVE_KEY') return remove();
    if (message.type === 'UPDATE_SETTINGS') return update(message.settings);

    if (message.type === 'PAGE_DIAGNOSTICS') {
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});

      let url;
      try {
        url = new URL(tab?.url);
      } catch {}

      if (url?.origin !== 'https://www.linkedin.com') {
        return {ok: false, message: 'Open LinkedIn in the active tab, then check again.'};
      }

      try {
        const result = await chrome.tabs.sendMessage(
          tab.id,
          {type: 'PAGE_DIAGNOSTICS'},
          {frameId: 0}
        );

        if (result?.ok) return result;
      } catch {}

      return {
        ok: false,
        message: 'Refresh LinkedIn to load this extension version, then check again.'
      };
    }

    if (message.type === 'DIAGNOSTICS') {
      const values = [...state.stats.latencies].sort((a, b) => a - b);

      return {
        ok: true,
        ...state.stats,
        latencies: undefined,
        median_ms: values[Math.floor(values.length * .5)] ?? null,
        p95_ms: values[Math.min(values.length - 1, Math.ceil(values.length * .95) - 1)] ?? null,
        cache_hit_rate: state.stats.lookups
          ? state.stats.cache_hits / state.stats.lookups
          : null
      };
    }

    throw new DetectorError('invalid_request', 'Unknown request.');
  }

  function tabClosed(tabId) {
    for (const id of [...subscribers.keys()]) {
      if (!id.startsWith(tabId + ':')) continue;

      const [, frame, ...rest] = id.split(':');
      cancel(rest.join(':'), {tab: {id: tabId}, frameId: Number(frame)});
    }
  }

  return {handle, ready, tabClosed};
}
