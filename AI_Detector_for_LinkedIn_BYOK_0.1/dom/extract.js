(() => {
  const POST = '[data-testid="mainFeed"] [role="listitem"], [data-view-name="feed-full-update"], .feed-shared-update-v2, .occludable-update, [data-urn^="urn:li:activity:"], [data-id^="urn:li:activity:"]';
  // The current feed can expose only component keys and generic text boxes.
  // These observed identifiers do not depend on changing, hashed CSS classes.
  const COMPONENT_COMMENT = '[componentkey^="replaceableComment_urn:li:comment:"], [data-component-type] > div > div > [componentkey*=":comment:"]';
  const COMMENT = COMPONENT_COMMENT + ', .comments-comment-item, .comments-comment-entity, .comments-reply-item, [data-testid="comment-item"], [data-testid="comment-entity"], [data-testid="comment"], [data-test-id="comment-item"], [data-view-name="feed-comment"], [data-view-name="feed-comment-item"], [data-view-name="comment"], [data-view-name="comment-item"], [data-comment-id], [data-id^="urn:li:comment:"], [data-urn^="urn:li:comment:"], [data-id^="urn:li:fsd_comment:"], [data-urn^="urn:li:fsd_comment:"], [data-entity-urn^="urn:li:comment:"], [data-entity-urn^="urn:li:fsd_comment:"], [data-testid="comments-list"] [role="listitem"], .comments-comments-list > article, .comments-comments-list > li';
  const POST_TEXT = ['[data-view-name="feed-commentary"]', '[data-testid="expandable-text-box"]', '.update-components-text', '.feed-shared-update-v2__description', '.feed-shared-inline-show-more-text', '.feed-shared-text', '[data-test-id="main-feed-activity-card__commentary"]'];
  const COMMENT_BODY = '[data-testid="comment-text"], [data-view-name="comment-text"], .comments-comment-item__main-content, .comments-comment-entity__main-content, .comments-comment-item__inline-show-more-text, .comments-comment-entity__text, .comments-comment-item-content-body, .comments-comment-entity__content';
  const COMMENT_TEXT = ['[data-testid="comment-text"]', '[data-view-name="comment-text"]', '.comments-comment-item__main-content', '.comments-comment-entity__main-content', '.comments-comment-item__inline-show-more-text', '.comments-comment-entity__text', '[data-testid="expandable-text-box"]', '.comments-comment-item-content-body .update-components-text', '.comments-comment-entity__content .update-components-text', '.comments-comment-item-content-body .feed-shared-inline-show-more-text', '.comments-comment-entity__content .feed-shared-inline-show-more-text', '.comments-comment-item-content-body .feed-shared-text', '.comments-comment-item-content-body', '.comments-comment-entity__content'];
  const TEXT_WRAPPER = '.comments-comment-item-content-body, .comments-comment-item__inline-show-more-text, .comments-comment-entity__content, .comments-comment-item__main-content, .comments-comment-entity__main-content, .feed-shared-inline-show-more-text, .update-components-text, [data-testid="expandable-text-box"], [data-view-name="feed-commentary"]';
  const COMMENT_META = '.comments-post-meta, .comments-comment-meta, .comments-comment-item__meta, .comments-comment-entity__meta, .comments-comment-social-bar, .comments-comment-item__social-actions, .comments-comment-entity__social-actions, .comments-comment-item__timestamp, time';
  const PRIVATE = 'aside, nav, [role="complementary"], [contenteditable="true"], [role="textbox"], .msg-overlay-list-bubble, [data-testid*="messaging"], [data-view-name*="messaging"], .comments-comment-box, .comments-comment-box__form, [data-authorship-ui]';
  const COMMENT_THREAD = '.comments-comments-list, [data-testid="comments-list"], [data-view-name="comments-thread"]';
  const COMMENT_AREA = `${COMMENT}, ${COMMENT_BODY}, ${COMMENT_THREAD}`;
  const COMMENT_SEED = `${COMMENT_BODY}, ${COMMENT_THREAD.split(',').map(selector => `${selector.trim()} [data-testid="expandable-text-box"]`).join(',')}`;
  const RESHARE = '.update-components-reshared-content, [data-view-name="feed-reshared-content"], [data-testid="reshared-content"], .feed-shared-article';
  const ROOT = POST + ',' + COMMENT;
  function postSurface(root) {
    return root.closest('.feed-shared-update-v2, [data-view-name="feed-full-update"]') || root.closest('.occludable-update') || root.closest('[data-testid="mainFeed"] [role="listitem"]') || root;
  }
  function anchorFor(node, root) {
    // Exit inline text and clamped text wrappers, but stay in this comment's body.
    // The badge is a normal sibling below the text, never a floating overlay.
    let anchor = node;
    for (let parent = node.parentElement; node !== root && parent && parent !== root; parent = parent.parentElement) {
      if (parent.matches(PRIVATE) || parent.querySelector(COMMENT_META)) break;
      if (parent.matches(TEXT_WRAPPER)) anchor = parent;
      else if (parent.querySelector('button, [role="button"]')) break;
      else if (anchor === node && ['SPAN', 'A', 'B', 'STRONG', 'EM'].includes(node.tagName) && ['P', 'DIV'].includes(parent.tagName)) anchor = parent;
    }
    return anchor;
  }
  function rootsWithin(scope) {
    const roots = new Set(scope.querySelectorAll?.(ROOT) || []);
    if (scope.matches?.(ROOT)) roots.add(scope);
    const parent = scope.closest?.(ROOT); if (parent) roots.add(parent);
    return roots;
  }
  function descriptor(root) {
    if (root.closest(PRIVATE) || root.closest(RESHARE)) return null;
    const kind = root.matches(COMMENT) ? 'comment' : 'post';
    if (kind === 'post' && root.closest(COMMENT_AREA)) return null;
    const owners = kind === 'post' ? POST : COMMENT;
    for (const selector of kind === 'post' ? POST_TEXT : COMMENT_TEXT) {
      const nodes = [...(root.matches(selector) ? [root] : []), ...root.querySelectorAll(selector)];
      for (const node of nodes) {
        if (node.closest(PRIVATE) || node.closest(RESHARE) || node.closest(owners) !== root) continue;
        if (kind === 'post' && node.closest(COMMENT_AREA)) continue;
        // Generic feed list items nested inside cards are normally comments or actions.
        if (kind === 'post' && root.matches('[role="listitem"]') && root.parentElement?.closest('[data-testid="mainFeed"] [role="listitem"]')) continue;
        return {root, node, kind, anchor: anchorFor(node, root), surface: kind === 'post' ? postSurface(root) : null};
      }
    }
    return null;
  }
  function discover(scope) {
    const seen = new Set(), items = [];
    for (const root of rootsWithin(scope)) {
      const item = descriptor(root);
      if (item && !seen.has(item.node)) { seen.add(item.node); items.push(item); }
    }
    // Comment text can arrive before, or without, one of the known outer cards.
    // Only explicit comment bodies or text inside an explicit thread qualify.
    // Never infer a comment from arbitrary page paragraphs or button labels.
    const seeds = new Set(scope.querySelectorAll?.(COMMENT_SEED) || []);
    if (scope.matches?.(COMMENT_SEED)) seeds.add(scope);
    const parent = scope.closest?.(COMMENT_SEED); if (parent) seeds.add(parent);
    // Prefer the smallest body, so wrapper aliases cannot duplicate a result.
    const ordered = [...seeds].sort((a, b) => a.contains(b) ? 1 : b.contains(a) ? -1 : 0);
    for (const node of ordered) {
      if (node.closest(PRIVATE) || node.closest(RESHARE)) continue;
      if (items.some(item => item.kind === 'comment' && (item.node.contains(node) || node.contains(item.node)))) continue;
      const boundary = node.parentElement?.closest(`${ROOT}, ${COMMENT_THREAD}`) || node.ownerDocument.body;
      const anchor = anchorFor(node, boundary);
      items.push({root: anchor, node, kind: 'comment', anchor, surface: null});
    }
    return items;
  }
  function read(node) {
    const copy = node.cloneNode(true);
    copy.querySelectorAll(`${PRIVATE}, ${COMMENT}, ${COMMENT_META}, button, [role="button"], [data-testid="expandable-text-button"], script, style, [hidden], [aria-hidden="true"], .visually-hidden, .sr-only, .feed-shared-inline-show-more-text__see-more-less-toggle, .comments-comment-item__see-more-less-toggle`).forEach(n => n.remove());
    copy.querySelectorAll('br').forEach(n => n.replaceWith('\n'));
    copy.querySelectorAll('p,div,li').forEach(n => n.append('\n'));
    return (copy.textContent || '').normalize('NFC').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }
  function visible(node) {
    if (!node.isConnected || node.closest('[hidden],[aria-hidden="true"]')) return false;
    const view = node.ownerDocument.defaultView, style = view.getComputedStyle?.(node);
    if (style?.display === 'none' || ['hidden', 'collapse'].includes(style?.visibility)) return false;
    const inView = r => r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < view.innerHeight && r.left < view.innerWidth;
    if (inView(node.getBoundingClientRect())) return true;
    // A display:contents body has no box, although its text is on screen.
    if (style?.display !== 'contents') return false;
    const range = node.ownerDocument.createRange(); range.selectNodeContents(node);
    return [...range.getClientRects()].some(inView);
  }
  function supports(path) { return /^\/(feed(?:\/|$)|posts\/|in\/[^/]+\/recent-activity(?:\/|$))/.test(path); }
  globalThis.AuthorshipDOM = {POST, COMMENT, ROOT, PRIVATE, discover, read, visible, supports};
})();
