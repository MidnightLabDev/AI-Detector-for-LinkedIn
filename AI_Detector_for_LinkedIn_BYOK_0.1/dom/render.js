(() => {
  const css = `
    :host{all:initial;display:block;position:static;float:none;box-sizing:border-box;inline-size:auto;max-inline-size:100%;min-inline-size:0;margin:8px 0 9px;padding:0;padding-inline-start:var(--authorship-indent,0px);flex:0 0 100%;grid-column:1/-1;font:11px/1.4 Arial,sans-serif;color:#52656b;text-align:start;direction:ltr}
    :host([data-kind="comment"]){margin:5px 0 5px;padding:0;font-size:10px}
    :host([dir="rtl"]){direction:rtl}
    *{box-sizing:border-box}
    .estimate{display:inline-flex;flex-flow:row nowrap;align-items:center;gap:7px;max-inline-size:100%;min-inline-size:0;vertical-align:top}
    .line{display:inline-flex;align-items:center;gap:4px;flex:0 1 auto;min-inline-size:0;white-space:nowrap;font-size:11px;font-weight:700;line-height:1.4;border:1px solid;border-radius:5px;padding:4px 7px}
    .ai{color:#a7261f;background:#fff0ed;border-color:#e9bcb6}
    .suspected{color:#7a5600;background:#fff7d6;border-color:#dfc979}
    .human{color:#24623b;background:#eaf6ee;border-color:#abd3b8}
    .neutral{color:#5b656b;background:#f2f4f5;border-color:#ccd3d7}
    .label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-inline-size:0}
    .number{flex:none;font-weight:700;font-variant-numeric:tabular-nums}
    :host([data-kind="comment"]) .estimate{gap:6px}
    :host([data-kind="comment"]) .line{font-size:10px;gap:3px;padding:3px 6px}
    .note{display:inline-block;max-inline-size:100%;font-size:11px;line-height:16px;color:#6a797e;overflow-wrap:anywhere}
    @media(prefers-color-scheme:dark){.ai{color:#ffc0b9;background:#402624;border-color:#84504b}.suspected{color:#f5dda0;background:#403718;border-color:#806e32}.human{color:#bfe7c9;background:#233c2b;border-color:#527a5e}.neutral{color:#d3dade;background:#30393d;border-color:#69777e}.note{color:#b5c5c2}}
    @media(forced-colors:active){.line{color:CanvasText;background:Canvas;border-color:CanvasText}.note{color:CanvasText}}
  `;
  const HIGHLIGHT = 'data-authorship-state';

  function mode(result) {
    const binary = result?.score_mode === 'binary' || result?.suspected_ai === null;
    if (binary) {
      return Number.isInteger(result?.ai) && Number.isInteger(result?.human) &&
        result.ai >= 0 && result.human >= 0 && result.ai + result.human === 100 ? 'binary' : null;
    }
    return Number.isInteger(result?.ai) && Number.isInteger(result?.suspected_ai) && Number.isInteger(result?.human) &&
      result.ai >= 0 && result.suspected_ai >= 0 && result.human >= 0 &&
      result.ai + result.suspected_ai + result.human === 100 ? 'three' : null;
  }

  function valid(result) {
    return result?.ok !== false && result?.status === 'classified' && !!mode(result);
  }

  function dominant(result) {
    const resultMode = mode(result);
    if (!resultMode) return null;
    const values = resultMode === 'binary' ? [[0, result.ai], [2, result.human]] : [[0, result.ai], [1, result.suspected_ai], [2, result.human]];
    const max = Math.max(...values.map(([, value]) => value));
    const winners = values.filter(([, value]) => value === max).map(([index]) => index);
    return winners.length === 1 ? winners[0] : null;
  }

  function highlight(surface, result) {
    if (!surface) return;
    const winner = dominant(result);
    const state = winner === 0 ? 'ai' : winner === 1 ? 'suspected' : winner === 2 ? 'human' : null;
    if (!state) {surface.removeAttribute(HIGHLIGHT); return;}
    const doc = surface.ownerDocument;
    if (!doc.getElementById('authorship-highlight-style')) {
      const style = doc.createElement('style');
      style.id = 'authorship-highlight-style';
      style.textContent = `
        [data-authorship-state="ai"]{box-shadow:inset 4px 0 0 #b83228!important}
        [data-authorship-state="suspected"]{box-shadow:inset 4px 0 0 #b78103!important}
        [data-authorship-state="human"]{box-shadow:inset 4px 0 0 #2f7d4a!important}
        @media(forced-colors:active){[data-authorship-state]{box-shadow:none!important}}
      `;
      (doc.head || doc.documentElement).append(style);
    }
    surface.setAttribute(HIGHLIGHT, state);
  }

  function render(node, result, previous, options = {}) {
    previous?.remove();
    if (!result || ['unsupported', 'language_disabled'].includes(result.status) || result.error === 'cancelled' || result.error === 'disabled') return null;
    const doc = node.ownerDocument;
    const kind = options.kind || (node.closest(globalThis.AuthorshipDOM?.COMMENT || '.comments-comment-item') ? 'comment' : 'post');
    const host = doc.createElement('span');
    host.setAttribute('data-authorship-ui', '');
    host.setAttribute('data-kind', kind);
    host.style.setProperty('display', 'block', 'important');
    host.style.setProperty('position', 'static', 'important');
    host.style.setProperty('float', 'none', 'important');
    host.style.setProperty('clear', 'both', 'important');
    host.style.setProperty('flex', '0 0 100%', 'important');
    host.style.setProperty('margin-top', kind === 'comment' ? '5px' : '8px', 'important');
    host.style.setProperty('margin-bottom', kind === 'comment' ? '5px' : '9px', 'important');
    host.style.setProperty('padding-top', '0', 'important');
    host.style.setProperty('padding-bottom', '0', 'important');
    const shadow = host.attachShadow({mode: 'open'}), style = doc.createElement('style');
    style.textContent = css;
    shadow.append(style);
    const box = doc.createElement('span');
    box.className = 'estimate';
    const ar = result.language === 'ar';
    box.dir = ar ? 'rtl' : 'ltr';
    box.lang = ar ? 'ar' : 'en';
    host.dir = box.dir;

    if (valid(result)) {
      const resultMode = mode(result);
      const full = ar
        ? ['مولد بالذكاء الاصطناعي', 'مشتبه بأنه مولد بالذكاء الاصطناعي', 'مكتوب بواسطة إنسان']
        : ['AI generated', 'Suspected AI', 'Human written'];
      const labels = kind === 'comment'
        ? (ar ? ['آلي', 'مشتبه', 'بشري'] : ['AI', 'Suspected', 'Human'])
        : full;
      const values = [result.ai, result.suspected_ai, result.human];
      const classes = ['ai', 'suspected', 'human'];
      const winner = dominant(result);
      const tied = winner === null;
      const shown = tied || values[winner] <= 0 ? [] : [winner];
      const description = tied
        ? (ar ? 'غير محسوم: أعلى الاحتمالات متساوية' : 'Uncertain: highest estimates are equal')
        : shown.map(i => full[i] + ': ' + values[i] + '%.').join(' ');
      box.setAttribute('role', 'img');
      box.setAttribute('aria-label', description);
      box.title = description;

      if (tied) {
        const line = doc.createElement('span');
        line.className = 'line badge neutral';
        line.textContent = ar ? 'غير محسوم' : 'Uncertain';
        box.append(line);
      }

      shown.forEach(i => {
        const line = doc.createElement('span');
        line.className = 'line badge ' + classes[i];
        const label = doc.createElement('span');
        label.className = 'label';
        label.textContent = labels[i] + (kind === 'post' ? ':' : '');
        const number = doc.createElement('bdi');
        number.className = 'number';
        number.textContent = values[i] + '%';
        line.append(label, number);
        box.append(line);
      });
    } else {
      box.className = 'note';
      box.textContent = result.status === 'insufficient'
        ? (ar ? 'النص قصير جداً للتحليل' : 'Not enough text')
        : result.status === 'pending'
          ? (ar ? 'جارٍ التحليل…' : 'Analyzing…')
          : result.status === 'language_unknown'
            ? (ar ? 'لغة النص غير واضحة' : 'Language unclear')
            : result.status === 'too_long'
              ? (ar ? 'النص أطول من حد التحليل' : 'Text exceeds analysis limit')
              : (ar ? 'التحليل غير متاح مؤقتاً' : 'Analysis unavailable');
    }

    shadow.append(box);
    const anchor = options.anchor?.isConnected ? options.anchor : node;
    anchor.insertAdjacentElement('afterend', host);
    try {
      const hostRect = host.getBoundingClientRect(), textRect = node.getBoundingClientRect();
      const direction = doc.defaultView.getComputedStyle(node).direction;
      const indent = direction === 'rtl' ? Math.max(0, hostRect.right - textRect.right) : Math.max(0, textRect.left - hostRect.left);
      if (indent > 0) {
        const px = Math.min(indent, 64) + 'px';
        host.style.setProperty('--authorship-indent', px);
        host.style.setProperty('padding-inline-start', px, 'important');
      }
    } catch {}
    return host;
  }

  globalThis.AuthorshipUI = {render, highlight};
})();
