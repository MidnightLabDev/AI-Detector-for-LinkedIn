import {createService} from './core/service.mjs';
// Listener registration is synchronous so a sleeping MV3 worker receives its wakeup message.
const production = fetch(chrome.runtime.getURL('production.json')).then(r => r.json());
const service = production.then(config => createService(chrome, {production: config}));
chrome.tabs.onRemoved.addListener(tabId => {service.then(s => s.tabClosed(tabId));});
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  service.then(s => s.handle(message, sender)).then(reply, error => {
    reply({ok: false, error: error.code || 'unavailable', message: error.code ? error.message : 'Analysis is unavailable.', retryAfter: error.retryAfter || 0});
  });
  return true;
});
