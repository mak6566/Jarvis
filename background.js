// JARVIS Background Service Worker
// Handles tab control commands from popup

// ═══════════════════════════════════════════════════════════
//  OFFSCREEN DOCUMENT — microphone / SpeechRecognition
// ═══════════════════════════════════════════════════════════
// Chrome extension action popups cannot reliably capture the microphone
// regardless of granted permission — so SpeechRecognition runs in a hidden
// offscreen document (offscreen.html / offscreen.js), which the popup requests
// via this helper before starting recognition.
let creatingOffscreen = null;

async function ensureOffscreenDocument() {
  const existing = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });
  if (existing.length > 0) return;

  if (creatingOffscreen) {
    await creatingOffscreen;
    return;
  }

  creatingOffscreen = chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['USER_MEDIA'],
    justification: 'Speech recognition for JARVIS voice commands'
  });
  try {
    await creatingOffscreen;
  } finally {
    creatingOffscreen = null;
  }
}

// ═══════════════════════════════════════════════════════════
//  PUTER AUTH — token-based (reliable inside the extension)
// ═══════════════════════════════════════════════════════════
// puter.auth.signIn() popup inside a chrome-extension:// page does not return
// the token reliably → puter.ai.chat() runs without a token → 401 unauthorized.
// Solution: the user signs in on puter.com in a real tab, from where we read
// the auth token from localStorage and inject it into the extension's puter
// instance via puter.setAuthToken(token).

const PUTER_TOKEN_KEYS = ['puter.auth.token.v2', 'puter.auth.token'];
// URL that forces puter.com to show its real login form and disables the
// auto-created temporary/guest user (see `disable_temp_users = true` in the
// authme HTML). Without this parameter, puter.com auto-creates a guest session
// and lands the user on the puter desktop with apps — no login prompt, and the
// resulting guest token cannot access puter.ai.chat.
const PUTER_LOGIN_URL = 'https://puter.com/?action=authme';

// Reads the token from a puter.com tab, but only if a real user is signed in
// there. We use `logged_in_users` (an array persisted by puter.com for every
// real, non-temp account) as the ground-truth signal. Guest / temp sessions do
// not appear in this list, so their tokens are correctly ignored.
function readTokenFromTab(tabId) {
  return chrome.scripting.executeScript({
    target: { tabId },
    func: (keys) => {
      try {
        let loggedIn = [];
        try { loggedIn = JSON.parse(window.localStorage.getItem('logged_in_users') || '[]'); } catch (_) {}
        if (!Array.isArray(loggedIn) || loggedIn.length === 0) return null;

        // Prefer the token from `logged_in_users` (it is guaranteed to belong to
        // a real, non-temp account). Fall back to the raw token keys.
        const withToken = loggedIn.find((u) => u && u.auth_token);
        if (withToken) return withToken.auth_token;

        for (const k of keys) {
          const v = window.localStorage.getItem(k);
          if (v) return v;
        }
      } catch (e) {}
      return null;
    },
    args: [PUTER_TOKEN_KEYS],
  }).then((res) => res?.[0]?.result || null).catch(() => null);
}

async function getTokenFromExistingPuterTabs() {
  const tabs = await chrome.tabs.query({ url: ['https://puter.com/*', 'https://*.puter.com/*'] });
  for (const t of tabs) {
    const token = await readTokenFromTab(t.id);
    if (token) return token;
  }
  return null;
}

async function connectPuter() {
  // 1) try existing puter.com tabs (user may already be signed in as a real user)
  let token = await getTokenFromExistingPuterTabs();
  if (token) return { token, opened: false };

  // 2) open puter.com's real login form and wait until the user signs in.
  //    Poll aggressively for the first ~15s (users usually log in fast), then
  //    back off to 2s so we don't hammer the tab for the full timeout window.
  const tab = await chrome.tabs.create({ url: PUTER_LOGIN_URL, active: true });
  const deadline = Date.now() + 5 * 60 * 1000;  // 5-minute ceiling
  let attempt = 0;
  while (Date.now() < deadline) {
    const delay = attempt < 30 ? 500 : 2000;
    await new Promise((r) => setTimeout(r, delay));
    attempt++;
    let stillOpen = true;
    try { await chrome.tabs.get(tab.id); } catch (_) { stillOpen = false; }
    if (!stillOpen) break;
    token = await readTokenFromTab(tab.id);
    if (token) {
      try { await chrome.tabs.remove(tab.id); } catch (_) {}
      return { token, opened: true };
    }
  }
  return { token: null, opened: true };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PUTER_GET_TOKEN') {
    getTokenFromExistingPuterTabs()
      .then((token) => sendResponse({ token }))
      .catch((e) => sendResponse({ token: null, error: e.message || String(e) }));
    return true;
  }

  if (message.type === 'PUTER_CONNECT') {
    connectPuter()
      .then((res) => sendResponse(res))
      .catch((e) => sendResponse({ token: null, error: e.message || String(e) }));
    return true;
  }

  if (message.type === 'JARVIS_ENSURE_OFFSCREEN') {
    ensureOffscreenDocument()
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: e.message || String(e) }));
    return true;
  }

  if (message.type === 'EXECUTE_COMMAND') {
    handleCommand(message.command, message.data)
      .then(result => sendResponse({ success: true, result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // keep channel open for async
  }

  if (message.type === 'GET_TAB_INFO') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        sendResponse({ tab: tabs[0] });
      } else {
        sendResponse({ tab: null });
      }
    });
    return true;
  }
});

async function handleCommand(command, data = {}) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  switch (command) {
    // --- Navigation ---
    case 'open_url':
      await chrome.tabs.update(tab.id, { url: data.url });
      return `Navigating to ${data.url}`;

    case 'new_tab':
      await chrome.tabs.create({ url: data.url || 'chrome://newtab' });
      return 'New tab opened';

    case 'close_tab':
      await chrome.tabs.remove(tab.id);
      return 'Tab closed';

    case 'go_back':
      await chrome.tabs.goBack(tab.id);
      return 'Going back';

    case 'go_forward':
      await chrome.tabs.goForward(tab.id);
      return 'Going forward';

    case 'reload':
      await chrome.tabs.reload(tab.id);
      return 'Page reloaded';

    // --- Page interaction via content script ---
    case 'scroll_down':
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.scrollBy({ top: 400, behavior: 'smooth' })
      });
      return 'Scrolling down';

    case 'scroll_up':
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.scrollBy({ top: -400, behavior: 'smooth' })
      });
      return 'Scrolling up';

    case 'scroll_top':
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.scrollTo({ top: 0, behavior: 'smooth' })
      });
      return 'Scrolling to top';

    case 'scroll_bottom':
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
      });
      return 'Scrolling to bottom';

    case 'zoom_in':
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const cur = parseFloat(document.body.style.zoom) || 1;
          document.body.style.zoom = Math.min(cur + 0.1, 3).toFixed(1);
        }
      });
      return 'Zooming in';

    case 'zoom_out':
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const cur = parseFloat(document.body.style.zoom) || 1;
          document.body.style.zoom = Math.max(cur - 0.1, 0.3).toFixed(1);
        }
      });
      return 'Zooming out';

    case 'zoom_reset':
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => { document.body.style.zoom = '1'; }
      });
      return 'Zoom reset';

    case 'find_text':
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (text) => { window.find(text); },
        args: [data.text]
      });
      return `Searching for: ${data.text}`;

    case 'get_page_info':
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => ({
          title: document.title,
          url: window.location.href,
          scrollY: window.scrollY,
          height: document.body.scrollHeight
        })
      });
      return result.result;

    case 'screenshot':
      const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
      return dataUrl;

    // --- Tab management ---
    case 'next_tab': {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      const idx = tabs.findIndex(t => t.id === tab.id);
      const next = tabs[(idx + 1) % tabs.length];
      await chrome.tabs.update(next.id, { active: true });
      return 'Switched to next tab';
    }

    case 'prev_tab': {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      const idx = tabs.findIndex(t => t.id === tab.id);
      const prev = tabs[(idx - 1 + tabs.length) % tabs.length];
      await chrome.tabs.update(prev.id, { active: true });
      return 'Switched to previous tab';
    }

    case 'list_tabs': {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      return tabs.map(t => `[${t.index + 1}] ${t.title}`).join('\n');
    }

    // --- Bookmarks ---
    case 'bookmark_page':
      await chrome.bookmarks.create({ title: tab.title, url: tab.url });
      return `Bookmarked: ${tab.title}`;

    // ── Fullscreen ───────────────────────────────────────
    case 'fullscreen':
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          if (document.fullscreenElement) { document.exitFullscreen(); return 'exit'; }
          document.documentElement.requestFullscreen?.(); return 'enter';
        }
      });
      return 'Fullscreen toggled';

    // ── Click an element by its visible text ─────────────
    case 'click_text': {
      const [r] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (q) => {
          q = (q || '').toLowerCase().trim();
          const sel = 'a,button,[role="button"],input[type="submit"],input[type="button"],[onclick],summary,label';
          const els = [...document.querySelectorAll(sel)];
          const txt = (e) => (e.innerText || e.value || e.getAttribute('aria-label') || e.title || '').trim().toLowerCase();
          let t = els.find((e) => txt(e) === q) || els.find((e) => txt(e).includes(q));
          if (t) { t.scrollIntoView({ block: 'center' }); t.click(); return true; }
          return false;
        },
        args: [data.text]
      });
      if (!r.result) throw new Error(`No clickable element matching "${data.text}"`);
      return `Clicked "${data.text}"`;
    }

    // ── Scroll to text and highlight ─────────────────────
    case 'scroll_to_text': {
      const [r] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (q) => {
          q = (q || '').toLowerCase().trim();
          const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          let n; while ((n = walk.nextNode())) {
            if (n.nodeValue.toLowerCase().includes(q) && n.parentElement && n.parentElement.offsetParent !== null) {
              const el = n.parentElement;
              el.scrollIntoView({ block: 'center', behavior: 'smooth' });
              const prev = el.style.background;
              el.style.transition = 'background .4s'; el.style.background = 'rgba(0,243,255,.35)';
              setTimeout(() => { el.style.background = prev; }, 1800);
              return true;
            }
          }
          return false;
        },
        args: [data.text]
      });
      if (!r.result) throw new Error(`Text "${data.text}" not found on page`);
      return `Jumped to "${data.text}"`;
    }

    // ── Type text into the focused / first input ─────────
    case 'type_text': {
      const [r] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (txt) => {
          let el = document.activeElement;
          const typable = (e) => e && (e.isContentEditable || /^(input|textarea)$/i.test(e.tagName));
          if (!typable(el)) {
            el = document.querySelector('input[type="text"],input[type="search"],input[type="email"],input[type="url"],input:not([type]),textarea,[contenteditable="true"]');
          }
          if (!el) return false;
          el.focus();
          if (el.isContentEditable) { document.execCommand('insertText', false, txt); }
          else {
            el.value = txt;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }
          return true;
        },
        args: [data.text]
      });
      if (!r.result) throw new Error('No text field found to type into');
      return `Typed: ${data.text}`;
    }

    // ── Press Enter / submit the current form ────────────
    case 'press_enter':
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const el = document.activeElement || document.querySelector('input,textarea');
          if (!el) return false;
          ['keydown', 'keypress', 'keyup'].forEach((t) =>
            el.dispatchEvent(new KeyboardEvent(t, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true })));
          if (el.form) { el.form.requestSubmit ? el.form.requestSubmit() : el.form.submit(); }
          return true;
        }
      });
      return 'Pressed Enter';

    // ── Media control (video / audio on the page) ────────
    case 'media_play': case 'media_pause': case 'media_mute':
    case 'media_unmute': case 'media_faster': case 'media_slower': {
      const action = command.replace('media_', '');
      const [r] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (a) => {
          const list = [...document.querySelectorAll('video,audio')];
          const m = list.find((x) => !x.paused) || list[0];
          if (!m) return false;
          if (a === 'play') m.play();
          if (a === 'pause') m.pause();
          if (a === 'mute') m.muted = true;
          if (a === 'unmute') m.muted = false;
          if (a === 'faster') m.playbackRate = Math.min(m.playbackRate + 0.25, 4);
          if (a === 'slower') m.playbackRate = Math.max(m.playbackRate - 0.25, 0.25);
          return true;
        },
        args: [action]
      });
      if (!r.result) throw new Error('No media element found on page');
      return `Media: ${action}`;
    }

    // ── Link-hint mode (numbered overlays for hands-free clicking) ─
    case 'link_hints_show': {
      const [r] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          document.querySelectorAll('.jarvis-hint').forEach((n) => n.remove());
          window.__jarvisHints = [];
          const sel = 'a[href],button,[role="button"],input[type="submit"],input[type="button"],[onclick],select,textarea,input[type="text"],input[type="search"]';
          const els = [...document.querySelectorAll(sel)].filter((e) => {
            const r = e.getBoundingClientRect();
            return r.width > 4 && r.height > 4 && r.top < innerHeight && r.bottom > 0 && r.left < innerWidth && r.right > 0;
          });
          els.slice(0, 150).forEach((e, i) => {
            window.__jarvisHints.push(e);
            const r = e.getBoundingClientRect();
            const b = document.createElement('div');
            b.className = 'jarvis-hint';
            b.textContent = i + 1;
            b.style.cssText = `position:fixed;z-index:2147483647;left:${Math.max(0, r.left)}px;top:${Math.max(0, r.top)}px;background:#00f3ff;color:#001014;font:bold 11px 'Courier New',monospace;padding:1px 5px;border-radius:3px;box-shadow:0 0 8px #00f3ff;pointer-events:none;line-height:1.4;`;
            document.body.appendChild(b);
          });
          return window.__jarvisHints.length;
        }
      });
      return `${r.result} links marked. Say "click <number>".`;
    }

    case 'link_hints_hide':
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => { document.querySelectorAll('.jarvis-hint').forEach((n) => n.remove()); }
      });
      return 'Link hints hidden';

    case 'click_hint': {
      const [r] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (n) => {
          const el = (window.__jarvisHints || [])[n - 1];
          document.querySelectorAll('.jarvis-hint').forEach((x) => x.remove());
          if (!el) return false;
          el.scrollIntoView({ block: 'center' });
          if (/^(input|textarea|select)$/i.test(el.tagName) || el.isContentEditable) el.focus();
          else el.click();
          return true;
        },
        args: [data.num]
      });
      if (!r.result) throw new Error(`No link #${data.num}. Say "show links" first.`);
      return `Activated link ${data.num}`;
    }

    // ── Readable page text (for AI summaries) ────────────
    case 'get_readable_text': {
      const [r] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const main = document.querySelector('main,article,[role="main"]') || document.body;
          return (main.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 6000);
        }
      });
      return r.result;
    }

    // ── Tab management by number / state ─────────────────
    case 'switch_tab': {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      const target = tabs[data.num - 1];
      if (!target) throw new Error(`No tab ${data.num}`);
      await chrome.tabs.update(target.id, { active: true });
      return `Switched to tab ${data.num}`;
    }

    case 'close_tab_n': {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      const target = tabs[data.num - 1];
      if (!target) throw new Error(`No tab ${data.num}`);
      await chrome.tabs.remove(target.id);
      return `Closed tab ${data.num}`;
    }

    case 'duplicate_tab':
      await chrome.tabs.duplicate(tab.id);
      return 'Tab duplicated';

    case 'pin_tab':
      await chrome.tabs.update(tab.id, { pinned: !tab.pinned });
      return tab.pinned ? 'Tab unpinned' : 'Tab pinned';

    case 'mute_tab':
      await chrome.tabs.update(tab.id, { muted: !tab.mutedInfo?.muted });
      return tab.mutedInfo?.muted ? 'Tab unmuted' : 'Tab muted';

    case 'reopen_tab':
      await chrome.sessions.restore();
      return 'Reopened last closed tab';

    case 'new_window':
      await chrome.windows.create({});
      return 'New window opened';

    case 'incognito':
      await chrome.windows.create({ incognito: true });
      return 'Incognito window opened';

    case 'open_browser_page':
      await chrome.tabs.create({ url: data.url });
      return `Opening ${data.url}`;

    default:
      throw new Error(`Unknown command: ${command}`);
  }
}
