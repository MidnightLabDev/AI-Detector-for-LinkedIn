const $ = id => document.getElementById(id);
const fields = ['enabled', 'posts', 'comments', 'en'];
let status, busy = false;

const notice = text => {$('notice').textContent = text;};

async function send(message) {
  try {return await chrome.runtime.sendMessage(message);}
  catch {return {ok: false, message: 'Reload the extension and try again.'};}
}

function controls() {
  $('connect').disabled = busy || !$('apiKey').value.trim();
  $('remove').disabled = busy;
  for (const id of fields) {
    $(id).disabled = busy || (id === 'enabled' && !status?.settings.connected);
  }
  $('minWords').disabled = busy;
}

async function refresh() {
  const result = await send({type: 'GET_STATUS'});
  if (!result?.ok) {
    notice(result?.message || 'Could not read settings.');
    return;
  }

  status = result;
  for (const id of fields) $(id).checked = !!result.settings[id];
  $('minWords').value = Number.isInteger(result.settings.minWords) ? result.settings.minWords : 10;
  $('remove').hidden = !result.hasKey;
  $('connection').textContent = result.hasKey ? `Ready · ${result.model}` : 'No Zhuque key saved';
  $('remember').checked = !!result.remembered;
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

$('keyForm').addEventListener('submit', async event => {
  event.preventDefault();
  notice('Checking Zhuque key…');
  const result = await action(
    {type: 'CONNECT', provider: 'zhuque', apiKey: $('apiKey').value, remember: $('remember').checked},
    'Zhuque key connected. Enable the detector, then reload LinkedIn.'
  );
  if (result?.ok) {
    $('apiKey').value = '';
    controls();
  }
});

$('remove').addEventListener('click', () => {
  action({type: 'REMOVE_KEY', provider: 'zhuque'}, 'Zhuque key removed. Detection is off.');
});

for (const id of fields) {
  $(id).addEventListener('change', () =>
    action({type: 'UPDATE_SETTINGS', settings: {[id]: $(id).checked}}, 'Settings saved.')
  );
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
    if (!result?.ok) {
      $('pageStatus').textContent = result?.message || 'Refresh LinkedIn, then check again.';
      return;
    }

    const comments = result.comments;

    if (result.version !== '0.1') {
      $('pageStatus').textContent = 'Refresh LinkedIn to load version 0.1, then check again.';
      return;
    }

    $('pageCounts').textContent = `Found ${comments.found} · Visible ${comments.visible} · Results ${comments.classified} · Pending ${comments.pending} · Skipped ${comments.skipped} · Failed ${comments.failed}`;
    $('pageCounts').hidden = false;

    let text;
    if (!result.supported) text = 'Open the feed, a post page or recent activity to analyze comments.';
    else if (!result.connected) text = 'Save your Zhuque AI API key, then enable detection.';
    else if (!result.enabled) text = 'Turn on Detector enabled above.';
    else if (!result.commentsEnabled) text = 'Turn on Analyze comments above.';
    else if (!comments.found) text = 'No comment text recognized. Expand the thread and scroll a comment into view. If it is already visible, this page layout needs an update.';
    else if (!comments.visible) text = 'Comments were found. Scroll them into view to start detection.';
    else if (comments.failed) text = 'Some requests failed. ' + Object.keys(comments.reasons).map(reason => ({
      invalid_key: 'Check your Zhuque AI API key.',
      billing: 'Check your Tencent EdgeOne account or quota.',
      rate_limit: 'Zhuque is limiting requests. Wait before trying again.',
      disconnected: 'Refresh LinkedIn to reconnect the extension.',
      network_error: 'Check your connection and refresh LinkedIn.',
      timeout: 'The request timed out. Refresh LinkedIn to retry.'
    }[reason] || `Status: ${reason.replaceAll('_', ' ')}.`)).join(' ');
    else if (comments.skipped) text = 'Some comments were skipped. ' + Object.keys(comments.reasons).map(reason => ({
      unsupported: 'Only reliably detected English text is analyzed.',
      language_disabled: 'English detection is switched off.',
      language_unknown: 'The text language could not be confirmed as English.',
      insufficient: 'There is not enough text for your minimum word setting.',
      too_long: 'The text exceeds the request limit.'
    }[reason] || `Status: ${reason.replaceAll('_', ' ')}.`)).join(' ');
    else if (comments.pending) text = 'Comments are waiting or being analyzed. Check again in a moment.';
    else if (comments.classified && comments.badges < comments.classified) text = 'Results arrived, but a badge was removed by the page. Refresh LinkedIn if it does not return.';
    else text = 'Comment results are ready below each analyzed comment.';

    $('pageStatus').textContent = text;
  } finally {
    $('checkPage').disabled = false;
  }
});

await refresh();
