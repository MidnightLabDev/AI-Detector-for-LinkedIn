const $ = id => document.getElementById(id);
const fields = ['enabled', 'posts', 'comments', 'en'];
let status, busy = false;

const notice = text => {$('notice').textContent = text;};
const currentProvider = () => $('providerWinston').checked ? 'winston' : 'zhuque';

async function send(message) {
  try {return await chrome.runtime.sendMessage(message);}
  catch {return {ok: false, message: 'Reload the extension and try again.'};}
}

function syncProviderUI() {
  const provider = status?.settings?.provider || 'zhuque';
  $('providerZhuque').checked = provider === 'zhuque';
  $('providerWinston').checked = provider === 'winston';
  $('zhuqueState').textContent = status?.connections?.zhuque?.hasKey ? 'Key saved' : 'No key';
  $('winstonState').textContent = status?.connections?.winston?.hasKey ? 'Key saved' : 'No key';

  const winston = provider === 'winston';
  $('zhuqueGuide').hidden = winston;
  $('winstonGuide').hidden = !winston;
  $('zhuqueLanguages').hidden = winston;
  $('winstonLanguages').hidden = !winston;
  $('apiKeyLabel').textContent = winston ? 'Winston AI API key' : 'Tencent EdgeOne API key';
  $('apiKey').placeholder = winston ? 'Paste your Winston developer token' : 'Paste your EdgeOne API key';
  $('connection').textContent = status?.hasKey ? `Ready · ${status.model}` : `No ${winston ? 'Winston AI' : 'Zhuque'} key saved`;
  $('remember').checked = !!status?.remembered;
  const providerLocked = !!status?.settings?.enabled;
  $('providerLockNote').hidden = !providerLocked;
  document.querySelector('.provider-section')?.classList.toggle('locked', providerLocked);
}

function controls() {
  const provider = currentProvider();
  $('connect').disabled = busy || !$('apiKey').value.trim();
  $('remove').disabled = busy;
  const providerLocked = !!status?.settings?.enabled;
  $('providerZhuque').disabled = busy || providerLocked;
  $('providerWinston').disabled = busy || providerLocked;
  for (const id of fields) {
    const providerDisabled = id === 'en' && provider === 'winston';
    $(id).disabled = busy || providerDisabled || (id === 'enabled' && !status?.settings.connected);
  }
  $('minWords').disabled = busy;
}

async function refresh() {
  const result = await send({type: 'GET_STATUS'});
  if (!result?.ok) {notice(result?.message || 'Could not read settings.'); return;}
  status = result;
  for (const id of fields) $(id).checked = !!result.settings[id];
  $('minWords').value = Number.isInteger(result.settings.minWords) ? result.settings.minWords : 10;
  $('remove').hidden = !result.hasKey;
  syncProviderUI();
  controls();
}

async function action(message, success) {
  busy = true;
  controls();
  try {
    const result = await send(message);
    notice(result?.ok ? success : result?.message || 'The action could not be completed.');
    return result;
  } finally {
    busy = false;
    await refresh();
  }
}

$('apiKey').addEventListener('input', controls);

for (const id of ['providerZhuque', 'providerWinston']) {
  $(id).addEventListener('change', async () => {
    if (!$(id).checked) return;
    const provider = currentProvider();
    await action({type: 'UPDATE_SETTINGS', settings: {provider}}, `${provider === 'winston' ? 'Winston AI' : 'Zhuque AI'} selected.`);
    $('apiKey').value = '';
    controls();
  });
}

$('keyForm').addEventListener('submit', async event => {
  event.preventDefault();
  const provider = currentProvider();
  notice(provider === 'winston' ? 'Saving Winston AI key…' : 'Checking Zhuque key…');
  const success = provider === 'winston'
    ? 'Winston AI key saved. It will be checked on the first eligible scan.'
    : 'Zhuque key connected. Enable the detector, then reload LinkedIn.';
  const result = await action({type: 'CONNECT', provider, apiKey: $('apiKey').value, remember: $('remember').checked}, success);
  if (result?.ok) {$('apiKey').value = ''; controls();}
});

$('remove').addEventListener('click', () => {
  const provider = currentProvider();
  action({type: 'REMOVE_KEY', provider}, `${provider === 'winston' ? 'Winston AI' : 'Zhuque'} key removed. Detection is off if this is the selected detector.`);
});

for (const id of fields) {
  $(id).addEventListener('change', () => action({type: 'UPDATE_SETTINGS', settings: {[id]: $(id).checked}}, 'Settings saved.'));
}

$('minWords').addEventListener('change', () => {
  const value = Math.max(1, Math.min(100, Math.round(Number($('minWords').value) || 10)));
  $('minWords').value = value;
  action({type: 'UPDATE_SETTINGS', settings: {minWords: value}}, 'Minimum text length saved.');
});

$('checkPage').addEventListener('click', async () => {
  $('checkPage').disabled = true;
  $('pageStatus').textContent = 'Checking this page…';
  $('pageCounts').hidden = true;
  try {
    const result = await send({type: 'PAGE_DIAGNOSTICS'});
    if (!result?.ok) {$('pageStatus').textContent = result?.message || 'Refresh LinkedIn, then check again.'; return;}
    const comments = result.comments;
    if (result.version !== '0.1') {$('pageStatus').textContent = 'Refresh LinkedIn to load version 0.1, then check again.'; return;}
    $('pageCounts').textContent = `Found ${comments.found} · Visible ${comments.visible} · Results ${comments.classified} · Pending ${comments.pending} · Skipped ${comments.skipped} · Failed ${comments.failed}`;
    $('pageCounts').hidden = false;
    let text;
    if (!result.supported) text = 'Open the feed, a post page or recent activity to analyze comments.';
    else if (!result.connected) text = 'Save an API key for the selected detector, then enable detection.';
    else if (!result.enabled) text = 'Turn on Detector enabled above.';
    else if (!result.commentsEnabled) text = 'Turn on Analyze comments above.';
    else if (!comments.found) text = 'No comment text recognized. Expand the thread and scroll a comment into view. If it is already visible, this page layout needs an update.';
    else if (!comments.visible) text = 'Comments were found. Scroll them into view to start detection.';
    else if (comments.failed) text = 'Some requests failed. ' + Object.keys(comments.reasons).map(reason => ({invalid_key: 'Check the selected provider API key.', billing: 'Check the selected provider account, quota or credits.', rate_limit: 'The selected provider is limiting requests. Wait before trying again.', disconnected: 'Refresh LinkedIn to reconnect the extension.', network_error: 'Check your connection and refresh LinkedIn.', timeout: 'The request timed out. Refresh LinkedIn to retry.'}[reason] || `Status: ${reason.replaceAll('_', ' ')}.`)).join(' ');
    else if (comments.skipped) text = 'Some comments were skipped. ' + Object.keys(comments.reasons).map(reason => ({unsupported: 'Their language is not supported by the selected detector.', language_disabled: 'Their language is switched off.', language_unknown: 'Their language could not be confirmed.', insufficient: 'There is not enough text for the selected detector or your minimum word setting.', too_long: 'Their text exceeds the request limit.'}[reason] || `Status: ${reason.replaceAll('_', ' ')}.`)).join(' ');
    else if (comments.pending) text = 'Comments are waiting or being analyzed. Check again in a moment.';
    else if (comments.classified && comments.badges < comments.classified) text = 'Results arrived, but a badge was removed by the page. Refresh LinkedIn if it does not return.';
    else text = 'Comment results are ready below each analyzed comment.';
    $('pageStatus').textContent = text;
  } finally {
    $('checkPage').disabled = false;
  }
});

await refresh();
