(() => {
  if (globalThis.__authorshipLoaded) return; globalThis.__authorshipLoaded = true;
  const dom = AuthorshipDOM, records = new Map(), byNode = new WeakMap(), dirty = new Set();
  let settings = {enabled: false}, revision = 0, currentPath = location.pathname, timer, active = 0, counter = 0, fullScan = false;
  const session = Math.random().toString(36).slice(2), maxRecords = 1500;
  function send(message) {
    return new Promise(resolve => {
      let settled = false;
      const finish = value => { if (!settled) {settled = true; clearTimeout(timeout); resolve(value || {ok: false, error: 'unavailable'});} };
      const timeout = setTimeout(() => {if (message.type === 'CLASSIFY') send({type: 'CANCEL', requestId: message.requestId}); finish({ok: false, error: 'timeout', retryAfter: 30});}, 45000);
      try { chrome.runtime.sendMessage(message, value => finish(chrome.runtime.lastError ? {ok: false, error: 'disconnected'} : value)); }
      catch { finish({ok: false, error: 'disconnected'}); }
    });
  }
  function eligible(record) { return settings.enabled && settings.connected && settings[record.kind === 'post' ? 'posts' : 'comments']; }
  function wordCount(text) { return (text.match(/[\p{L}\p{N}]+/gu) || []).length; }
  function minimumWords() { return Number.isInteger(settings.minWords) ? settings.minWords : 10; }
  function discard(record) {
    if (record.requestId) send({type: 'CANCEL', requestId: record.requestId});
    AuthorshipUI.highlight(record.surface, null);
    record.version++; record.host?.remove(); visibility?.unobserve(record.root); records.delete(record.root); byNode.delete(record.node);
  }
  function clear() { for (const r of [...records.values()]) discard(r); dirty.clear(); }
  function render(record, result) { record.result = result; AuthorshipUI.highlight(record.surface, result); record.host = AuthorshipUI.render(record.node, result, record.host, {kind: record.kind, anchor: record.anchor}); }
  function register(item) {
    const text = dom.read(item.node);
    if (!text || wordCount(text) < minimumWords()) {const previous = records.get(item.root); if (previous) discard(previous); return;}
    const sameBody = byNode.get(item.node);
    if (sameBody && sameBody.root !== item.root) {
      const displaced = records.get(item.root); if (displaced) discard(displaced);
      visibility?.unobserve(sameBody.root); records.delete(sameBody.root);
      sameBody.root = item.root; records.set(item.root, sameBody); visibility?.observe(item.root);
    }
    let record = records.get(item.root);
    if (record && (record.text !== text || record.node !== item.node || record.kind !== item.kind)) { discard(record); record = null; }
    if (!record) {
      record = {...item, text, status: 'new', version: 0, visible: false, attempts: 0}; records.set(item.root, record); byNode.set(item.node, record); visibility?.observe(item.root);
    }
    if (record.anchor !== item.anchor) {record.anchor = item.anchor; record.host?.remove();}
    if (record.surface !== item.surface) {AuthorshipUI.highlight(record.surface, null); record.surface = item.surface; AuthorshipUI.highlight(record.surface, record.result);}
    record.visible = dom.visible(record.node);
    if (record.result && !record.host?.isConnected && !['unsupported', 'language_disabled'].includes(record.result.status)) render(record, record.result);
  }
  function scan() {
    timer = null;
    if (currentPath !== location.pathname) {clear(); currentPath = location.pathname; fullScan = true;}
    if (!settings.enabled || !dom.supports(currentPath)) {clear(); return;}
    for (const r of [...records.values()]) if (!r.node.isConnected || !r.root.isConnected || !eligible(r)) discard(r);
    if (document.hidden) return;
    const scopes = fullScan ? [document] : [...dirty]; dirty.clear(); fullScan = false;
    for (const scope of scopes) if (scope === document || scope.isConnected) for (const item of dom.discover(scope)) register(item);
    // Bound retained text when LinkedIn keeps a very large feed DOM alive.
    if (records.size > maxRecords) for (const r of [...records.values()]) {if (records.size <= maxRecords) break; if (!r.visible && r.status !== 'loading') discard(r);}
    for (const r of records.values()) {
      r.visible = dom.visible(r.node);
      if (r.visible && r.result && !r.host?.isConnected && !['unsupported', 'language_disabled'].includes(r.result.status)) render(r, r.result);
    }
    pump();
  }
  function schedule(scope, all = false) {
    if (scope) dirty.add(scope.nodeType === 3 ? scope.parentElement : scope);
    if (all) fullScan = true;
    if (!timer) timer = setTimeout(() => {try {scan();} catch { /* Unknown layouts leave LinkedIn usable. */ }}, 160);
  }
  function pump() {
    if (!settings.enabled || !dom.supports(location.pathname) || document.hidden) return;
    const pending = [...records.values()].filter(r => eligible(r) && r.visible && r.node.isConnected && (r.status === 'new' || (r.status === 'retry' && Date.now() >= r.retryAt)));
    pending.sort((a, b) => a.node.getBoundingClientRect().top - b.node.getBoundingClientRect().top);
    while (active < 2 && pending.length) {
      const r = pending.shift(), version = r.version, text = r.text;
      r.status = 'loading'; r.attempts++; r.requestId = session + '_' + (++counter); active++;
      render(r, {status: 'pending', language: 'en'});
      send({type: 'CLASSIFY', text, kind: r.kind, requestId: r.requestId}).then(result => {
        if (r.version !== version || records.get(r.root) !== r || !eligible(r) || !r.node.isConnected || dom.read(r.node) !== text) return;
        r.requestId = null;
        if (result.ok) r.status = 'done';
        else if (result.retryAfter && r.attempts < 3) {r.status = 'retry'; r.retryAt = Date.now() + result.retryAfter * 1000; setTimeout(() => schedule(r.root), Math.min(result.retryAfter * 1000 + 30, 2147480000));}
        else r.status = 'error';
        render(r, result);
      }).finally(() => {active--; pump();});
    }
  }
  const visibility = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
    for (const entry of entries) {const r = records.get(entry.target); if (r) r.visible = dom.visible(r.node);}
    pump();
  }, {threshold: 0}) : null;
  new MutationObserver(mutations => {
    if (!settings.enabled) return;
    for (const mutation of mutations) {
      if (mutation.target.parentElement?.closest('[data-authorship-ui]') || mutation.target.closest?.('[data-authorship-ui]')) continue;
      if (mutation.type === 'attributes') {schedule(mutation.target); continue;}
      if (mutation.type === 'characterData') {schedule(mutation.target); continue;}
      const added = [...mutation.addedNodes].filter(n => !n.matches?.('[data-authorship-ui]'));
      const removed = [...mutation.removedNodes];
      for (const n of added) schedule(n.nodeType === 1 ? n : mutation.target);
      if (removed.length) schedule(mutation.target);
    }
  }).observe(document.documentElement, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['hidden', 'aria-hidden', 'class', 'style', 'role', 'componentkey', 'data-component-type', 'data-urn', 'data-id', 'data-entity-urn', 'data-testid', 'data-test-id', 'data-view-name', 'data-comment-id']});
  window.addEventListener('scroll', () => schedule(), {passive: true, capture: true});
  window.addEventListener('resize', () => schedule(), {passive: true});
  window.addEventListener('popstate', () => schedule(null, true));
  document.addEventListener('visibilitychange', () => {if (!document.hidden) schedule(null, true);});
  window.addEventListener('pagehide', clear);
  // Route check is cheap. Full DOM recovery is deliberately infrequent.
  let recovery = 0;
  setInterval(() => {
    if (document.hidden) return;
    if (location.pathname !== currentPath) schedule(null, true);
    else if (settings.enabled && ++recovery % 15 === 0) schedule(null, true);
  }, 1000);
  function diagnostics() {
    const count = kind => {
      const values = {found: 0, visible: 0, classified: 0, badges: 0, pending: 0, skipped: 0, failed: 0, reasons: {}};
      for (const record of records.values()) {
        if (record.kind !== kind || !record.node.isConnected) continue;
        values.found++; if (dom.visible(record.node)) values.visible++;
        const result = record.result;
        if (result?.status === 'classified' && result.ok !== false) {
          values.classified++; if (record.host?.isConnected) values.badges++;
        } else if (['new', 'loading', 'retry'].includes(record.status)) values.pending++;
        else {
          const reason = result?.error || result?.status || 'unavailable';
          values[record.status === 'error' ? 'failed' : 'skipped']++;
          values.reasons[reason] = (values.reasons[reason] || 0) + 1;
        }
      }
      return values;
    };
    return {ok: true, version: '0.1', supported: dom.supports(location.pathname), enabled: !!settings.enabled, connected: !!settings.connected, commentsEnabled: !!settings.comments, pageHidden: document.hidden, posts: count('post'), comments: count('comment')};
  }
  chrome.runtime.onMessage.addListener((message, _sender, reply) => {
    if (message.type === 'SETTINGS_CHANGED') {
      revision++; clear(); settings = message.settings; schedule(null, true); reply({ok: true});
    }
    // Read only. Checking the popup never retries or bills an API request.
    if (message.type === 'PAGE_DIAGNOSTICS') reply(diagnostics());
  });
  async function load(attempt = 0) {
    const before = revision, result = await send({type: 'GET_SETTINGS'});
    if (before !== revision) return;
    if (result.ok) {settings = result.settings; fullScan = true; scan();}
    else if (attempt < 2) setTimeout(() => load(attempt + 1), 1000);
  }
  load();
})();
