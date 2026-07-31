// ═══════════════════════════════════════════════════════════
//  JARVIS v2.0 — Master Controller
//  Iron Man HUD · Puter.js AI · Hybrid Voice + Chat
// ═══════════════════════════════════════════════════════════
'use strict';

// ── Helpers ──────────────────────────────────────────────
const $  = (id) => document.getElementById(id);
const ts = () => new Date().toLocaleTimeString('en-US', { hour12: false });

// ── App state ────────────────────────────────────────────
const S = {
  jarvisState: 'idle',      // idle | listening | thinking | speaking
  recognition: null,
  utterance:   null,
  puterReady:  false,
  puterUser:   null,
  history:     [],          // rolling conversation memory [{role, content}]
  wakeMode:    false,       // passively listening for the wake word
  wakeArmed:   false,       // true = next transcript is a command, not a hotword
  _wakeArmTimer: null,
  settings: {
    model:       'inclusionai/ling-3.0-flash:free',
    rate:        1.1,
    pitch:       1.0,
    lang:        'en-US',
    speakAI:     true,
    continuous:  false,
    wakeword:    'jarvis',
    wakeActivation: true,   // passively listen for the wake word and auto-arm
    indicator:   true,
  },
};

// ── DOM refs ─────────────────────────────────────────────
const el = {
  root:         $('jarvisRoot'),
  // Auth
  authOverlay:  $('authOverlay'),
  authBtn:      $('authBtn'),
  authStatus:   $('authStatus'),
  authInfo:     $('authInfo'),
  authActionBtn:$('authActionBtn'),
  // Header
  stateLabel:   $('stateLabel'),
  statusPip:    $('statusPip'),
  puterBadge:   $('puterBadge'),
  // Stats
  svSys:        $('sv-sys'),
  svMic:        $('sv-mic'),
  svAi:         $('sv-ai'),
  svTts:        $('sv-tts'),
  // HUD
  reactorTxt:   $('reactorStateTxt'),
  micBtn:       $('micBtn'),
  micLabel:     $('micLabel'),
  lastHeard:    $('lastHeard'),
  // Chat
  chatFeed:     $('chatFeed'),
  chatInput:    $('chatInput'),
  chatSend:     $('chatSend'),
  chatMicBtn:   $('chatMicBtn'),
  // Log
  logFeed:      $('logFeed'),
  clearLogBtn:  $('clearLogBtn'),
  bootTs:       $('bootTs'),
  // Settings
  modelList:    $('modelList'),
  rateSlider:   $('rateSlider'),
  rateOut:      $('rateOut'),
  pitchSlider:  $('pitchSlider'),
  pitchOut:     $('pitchOut'),
  langSel:      $('langSel'),
  tglSpeak:     $('tglSpeak'),
  tglContinuous:$('tglContinuous'),
  wakewordInput:$('wakewordInput'),
  tglWakeActivation: $('tglWakeActivation'),
  tglIndicator: $('tglIndicator'),
  saveCfgBtn:   $('saveCfgBtn'),
};

document.addEventListener('DOMContentLoaded', async () => {
  el.bootTs.textContent = ts();
  loadSettings();
  initTabs();
  initMicBtn();
  initChat();
  initLog();
  initSettings();
  drawTickMarks();
  initPuterAuth();
  setState('idle');
  log('info', 'JARVIS v1.0 boot sequence complete');

  // Auto-arm wake-word listening once the boot sequence finishes so the user
  // never has to click the mic to start using JARVIS.
  if (S.settings.wakeActivation) {
    setTimeout(() => enableWakeMode(true), 400);
  }
});

// ═══════════════════════════════════════════════════════════
//  WAKE-WORD LISTENING MODE
// ═══════════════════════════════════════════════════════════
function enableWakeMode(on) {
  S.wakeMode = !!on;
  S.wakeArmed = false;
  clearTimeout(S._wakeArmTimer);
  if (on) {
    el.root?.classList.add('wake-listening');
    log('info', `Wake mode ON — say "${S.settings.wakeword}" to activate.`);
    if (S.jarvisState === 'idle') startListening(false);
  } else {
    el.root?.classList.remove('wake-listening');
    log('info', 'Wake mode OFF');
    if (S.jarvisState === 'listening') stopListening();
  }
}

// ═══════════════════════════════════════════════════════════
//  STATE MACHINE
// ═══════════════════════════════════════════════════════════
const STATE_META = {
  idle:      { label: 'IDLE',       sys: 'NOMINAL', mic: 'OFF',    ai: 'READY',   tts: 'IDLE' },
  listening: { label: 'LISTENING',  sys: 'ACTIVE',  mic: 'ACTIVE', ai: 'STANDBY', tts: 'IDLE' },
  thinking:  { label: 'PROCESSING', sys: 'ACTIVE',  mic: 'PAUSED', ai: 'WORKING', tts: 'IDLE' },
  speaking:  { label: 'SPEAKING',   sys: 'ACTIVE',  mic: 'PAUSED', ai: 'DONE',    tts: 'ACTIVE' },
};

function setState(s) {
  S.jarvisState = s;
  el.root.dataset.state = s;
  const m = STATE_META[s] || STATE_META.idle;
  el.stateLabel.textContent  = m.label;
  el.reactorTxt.textContent  = m.label;
  el.svSys.textContent       = m.sys;
  el.svMic.textContent       = m.mic;
  el.svAi.textContent        = m.ai;
  el.svTts.textContent       = m.tts;
}

// ═══════════════════════════════════════════════════════════
//  TABS
// ═══════════════════════════════════════════════════════════
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });
}

// ═══════════════════════════════════════════════════════════
//  PUTER.JS AUTHENTICATION — token-based (reliable inside the extension)
// ═══════════════════════════════════════════════════════════
// puter.auth.signIn() popup inside a chrome-extension:// page does not return
// the token reliably, which is why "AI error: unauthorized" appears. Instead
// we let the user sign in on puter.com in a real tab, read the auth token from
// there (via the background service worker) and inject it into the extension's
// puter instance with puter.setAuthToken(token). The token is stored in
// chrome.storage so the user only has to sign in once.

const TOKEN_STORE_KEY = 'jarvisPuterToken';

function puterAvailable() {
  return typeof puter !== 'undefined' && !!puter?.auth;
}

function applyToken(token) {
  if (typeof puter === 'undefined' || !token) return false;
  try {
    // Root puter.setAuthToken propagates the token to ALL submodules (incl. ai)
    // and persists it to localStorage. puter.auth.setAuthToken would only set the auth module.
    if (typeof puter.setAuthToken === 'function') puter.setAuthToken(token);
    else if (puter.auth?.setAuthToken) puter.auth.setAuthToken(token);
    return true;
  } catch (e) {
    log('error', `setAuthToken failed: ${e?.message || e}`);
    return false;
  }
}

function saveToken(token) {
  return new Promise((res) => chrome.storage.local.set({ [TOKEN_STORE_KEY]: token }, res));
}
function loadStoredToken() {
  return new Promise((res) => chrome.storage.local.get(TOKEN_STORE_KEY, (r) => res(r?.[TOKEN_STORE_KEY] || null)));
}
function clearToken() {
  return new Promise((res) => chrome.storage.local.remove(TOKEN_STORE_KEY, res));
}

async function verifyUser() {
  if (!puterAvailable()) return null;
  try {
    if (!puter.auth.isSignedIn()) return null;
    const user = await puter.auth.getUser();
    // Reject temporary / guest users — they cannot use puter.ai.chat and would
    // otherwise silently sign the user in as a guest, hiding the real login UI.
    if (!user) return null;
    if (user.is_temp === true) return null;
    if (typeof user.username === 'string' && /^temp_/i.test(user.username)) return null;
    return user;
  } catch (_) {
    return null;
  }
}

async function initPuterAuth() {
  hideAuthOverlay();

  if (!puterAvailable()) {
    log('error', 'Puter.js failed to load.');
    updatePuterUI(false, null);
  } else {
    // 1) restore token stored in the extension
    const stored = await loadStoredToken();
    if (stored) applyToken(stored);

    // 2) verify the user (rejects temp / guest sessions)
    let user = await verifyUser();

    // If the stored token belonged to a temp/guest user, drop it so we do not
    // keep applying a token that cannot use puter.ai.chat.
    if (!user && stored) {
      try { puter.auth.signOut(); } catch (_) {}
      await clearToken();
    }

    // 3) if no valid user yet, silently try to grab a token from an open
    //    puter.com tab (background rejects tabs without `logged_in_users`).
    if (!user) {
      const token = await requestToken('PUTER_GET_TOKEN');
      if (token) {
        applyToken(token);
        user = await verifyUser();
        if (user) await saveToken(token);
        else {
          try { puter.auth.signOut(); } catch (_) {}
          await clearToken();
        }
      }
    }

    if (user) onPuterSignedIn(user);
    else updatePuterUI(false, null);
  }

  el.authActionBtn?.addEventListener('click', () => onAuthButton(el.authActionBtn));
  el.authBtn?.addEventListener('click', () => onAuthButton(el.authBtn));
}

async function onAuthButton(btn) {
  if (S.puterReady) {
    // Sign out
    try { puter.auth.signOut(); } catch (_) {}
    await clearToken();
    onPuterSignedOut();
    return;
  }
  await doConnect(btn);
}

function requestToken(type) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type }, (res) => {
      if (chrome.runtime.lastError) return resolve(null);
      resolve(res?.token || null);
    });
  });
}

// Returns true if the connection succeeded.
async function doConnect(btn) {
  if (!puterAvailable()) {
    log('error', 'Puter.js is not available.');
    return false;
  }
  const prevLabel = btn?.textContent;
  if (btn) { btn.textContent = 'CONNECTING…'; btn.disabled = true; }
  log('info', 'Opening puter.com — sign-in continues in that tab…');
  addMsg('jarvis', 'JARVIS', 'Opening puter.com, sir — sign in there (or you may already be signed in). I will connect the moment your token is available. You can leave the tab open.');

  try {
    const token = await requestToken('PUTER_CONNECT');
    if (!token) {
      log('error', 'Could not retrieve Puter token (sign-in not completed).');
      addMsg('err', 'JARVIS', 'Sign-in was not completed. Please try again, sir.');
      updatePuterUI(false, null);
      return false;
    }
    applyToken(token);
    const user = await verifyUser();
    if (user) {
      await saveToken(token);
      onPuterSignedIn(user);
      return true;
    }
    // Token exists but user is a temp/guest — drop it so we do not keep a bad
    // token around, and prompt the user to actually sign in.
    try { puter.auth.signOut(); } catch (_) {}
    await clearToken();
    log('error', 'Sign-in did not complete (guest session detected).');
    addMsg('err', 'JARVIS', 'That looks like a guest session, sir. Please sign in to your Puter account and try again.');
    updatePuterUI(false, null);
    return false;
  } catch (e) {
    log('error', `Connection failed: ${e?.message || e}`);
    updatePuterUI(false, null);
    return false;
  } finally {
    if (btn) { btn.disabled = false; if (!S.puterReady && prevLabel) btn.textContent = prevLabel; }
  }
}

function onPuterSignedIn(user) {
  S.puterReady = true;
  S.puterUser  = user;
  updatePuterUI(true, user);
  log('success', `Puter connected as: ${user?.username || 'user'}`);
}

function onPuterSignedOut() {
  S.puterReady = false;
  S.puterUser  = null;
  updatePuterUI(false, null);
  log('info', 'Puter signed out');
}

function updatePuterUI(online, user) {
  if (el.puterBadge) {
    if (online) {
      const uname = user?.username || 'online';
      el.puterBadge.textContent = `AI: ${uname.slice(0, 8).toUpperCase()}`;
      el.puterBadge.title = `Puter AI online — signed in as ${uname}`;
      el.puterBadge.classList.add('online');
    } else {
      el.puterBadge.textContent = 'AI: READY';
      el.puterBadge.title = 'Puter AI not connected — click CONNECT in Settings';
      el.puterBadge.classList.remove('online');
    }
  }
  if (el.authInfo) el.authInfo.textContent = online ? `@${user?.username || 'connected'}` : 'Not connected';
  if (el.authActionBtn) {
    el.authActionBtn.textContent = online ? 'SIGN OUT' : 'CONNECT';
    el.authActionBtn.className = `auth-action-btn${online ? ' signout' : ''}`;
    el.authActionBtn.disabled = false;
  }
}

function showAuthOverlay() {
  el.authOverlay?.classList.remove('hidden');
}
function hideAuthOverlay() {
  el.authOverlay?.classList.add('hidden');
}

// ═══════════════════════════════════════════════════════════
//  VOICE RECOGNITION (runs in the offscreen document, not in the popup)
// ═══════════════════════════════════════════════════════════
// Chrome extension action popups cannot reliably capture the microphone,
// regardless of whether permission was already granted — this is a Chromium
// limitation, not a settings issue. SpeechRecognition therefore runs in a
// hidden offscreen document (offscreen.js) and the popup only sends it
// start/stop commands and receives results back via chrome.runtime messages.
let _chatMicActive = false;

function initMicBtn() {
  el.micBtn.addEventListener('click', toggleMic);
}

function toggleMic() {
  if (S.jarvisState === 'listening') {
    stopListening();
  } else if (S.jarvisState === 'idle') {
    startListening(false);
  }
}

// A one-time microphone permission must come from a visible tab (neither the
// offscreen document nor the side panel can show the native prompt). The tab is
// opened through the background worker, which guarantees exactly ONE tab ever
// exists — earlier builds spawned a new tab for every failed attempt.
let _micTabRequested = false;
function openMicPermissionTab(reason) {
  if (_micTabRequested) {
    log('warn', 'Microphone permission tab is already open — finish it there.');
    return;
  }
  _micTabRequested = true;
  addMsg('err', 'JARVIS', 'Microphone is not enabled yet. I opened a one-time permission tab — click "ENABLE MICROPHONE" there and come back.');
  log('warn', `Microphone not granted (${reason || 'no permission'}) — opening permission tab`);
  chrome.runtime.sendMessage({ type: 'JARVIS_OPEN_MIC_TAB' }).catch(() => {});
}

async function micPermissionState() {
  try {
    if (navigator.permissions && navigator.permissions.query) {
      const status = await navigator.permissions.query({ name: 'microphone' });
      return status.state; // 'granted' | 'denied' | 'prompt'
    }
  } catch (_) { /* unsupported */ }
  return 'unknown';
}

let _starting = false;

async function startListening(isChatMic) {
  if (_starting) return;
  _starting = true;
  try {
    const state = await micPermissionState();
    if (state === 'denied' || state === 'prompt') {
      // 'prompt' means no permission yet — the offscreen document cannot show
      // the native dialog, so asking it to start would just fail in a loop.
      openMicPermissionTab(state);
      return;
    }

    _chatMicActive = !!isChatMic;
    log('info', 'Starting microphone…');

    const ready = await chrome.runtime.sendMessage({ type: 'JARVIS_ENSURE_OFFSCREEN' });
    if (!ready?.ok) {
      log('error', `Offscreen audio module failed: ${ready?.error || 'unknown error'}`);
      resetMicUI();
      return;
    }
    await chrome.runtime.sendMessage({
      type: 'JARVIS_SR_START',
      lang: S.settings.lang,
      continuous: S.settings.continuous || S.wakeMode
    });
  } catch (e) {
    log('error', `Could not start microphone: ${e.message || e}`);
    resetMicUI();
  } finally {
    _starting = false;
  }
}

function stopListening(resetState = true) {
  chrome.runtime.sendMessage({ type: 'JARVIS_SR_STOP' }).catch(() => {});
  resetMicUI(resetState);
}

function resetMicUI(resetState = true) {
  el.micBtn.classList.remove('active');
  el.micLabel.textContent = 'ACTIVATE';
  el.chatMicBtn.classList.remove('active');
  if (resetState && S.jarvisState === 'listening') setState('idle');
}


// Messages from offscreen.js (runs independently of whether the popup is open)
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'JARVIS_SR_STATE') {
    if (message.state === 'listening') {
      setState('listening');
      el.micBtn.classList.add('active');
      el.micLabel.textContent = 'LISTENING…';
      if (_chatMicActive) el.chatMicBtn.classList.add('active');
      log('info', 'Microphone activated');
    } else {
      resetMicUI();
    }
  } else if (message.type === 'JARVIS_SR_RESULT') {
    const transcript = message.text.trim();
    if (!transcript) return;
    el.lastHeard.textContent = `"${transcript}"`;
    log('info', `Voice: "${transcript}"`);

    // Wake-word activation mode: mic runs passively, only transcripts that
    // start with (or contain) the wake word trigger command processing.
    if (S.wakeMode && !S.wakeArmed) {
      const wwRe = new RegExp(`\\b${S.settings.wakeword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (!wwRe.test(transcript)) {
        // Not the hotword — keep listening silently.
        return;
      }
      // Hotword heard: strip everything up to it and process the rest.
      const idx = transcript.search(wwRe);
      const after = transcript.slice(idx).replace(wwRe, '').replace(/^[\s,.!?:;-]+/, '').trim();
      if (after) {
        // "Jarvis, open youtube" → run the command right away.
        handleInput(after);
      } else {
        // Just "Jarvis" on its own → arm for the next utterance and beep.
        S.wakeArmed = true;
        el.root?.classList.remove('wake-listening');
        setState('listening');
        addMsg('jarvis', 'JARVIS', 'Yes, sir?');
        try { speak('Yes, sir?'); } catch (_) {}
        // Auto-disarm after 8 s of silence so we drop back to passive listening.
        clearTimeout(S._wakeArmTimer);
        S._wakeArmTimer = setTimeout(() => {
          S.wakeArmed = false;
          if (S.wakeMode) el.root?.classList.add('wake-listening');
        }, 8000);
      }
      return;
    }

    // Normal path (mic tapped manually, or wake mode already armed).
    if (S.wakeMode) {
      S.wakeArmed = false;
      clearTimeout(S._wakeArmTimer);
      el.root?.classList.add('wake-listening');
    }
    if (!S.settings.continuous && !S.wakeMode) stopListening(false);
    handleInput(transcript);
  } else if (message.type === 'JARVIS_SR_ERROR') {
    log('error', `Speech error: ${message.error}`);
    resetMicUI();
    if (message.fatal) {
      // Fatal → the offscreen document already stopped; do not auto-retry.
      S.wakeMode = false;
      el.root?.classList.remove('wake-listening');
    }
    if (message.error === 'not-allowed' || message.error === 'service-not-allowed') {
      addMsg('err', 'JARVIS', 'Microphone permission denied.');
      openMicPermissionTab(message.error);
    } else if (message.error === 'audio-capture') {
      addMsg('err', 'JARVIS', 'No usable microphone was found.');
    }
  } else if (message.type === 'JARVIS_MIC_READY') {
    // The permission tab reported success → allow a fresh start and resume.
    _micTabRequested = false;
    log('info', 'Microphone permission granted — restarting listener');
    addMsg('jarvis', 'JARVIS', 'Microphone enabled. Listening is back online.');
    if (S.settings.wakeActivation) {
      enableWakeMode(true);
    } else if (S.jarvisState === 'idle') {
      startListening(false);
    }
  }
});


// ═══════════════════════════════════════════════════════════
//  CHAT INPUT
// ═══════════════════════════════════════════════════════════
function initChat() {
  el.chatSend.addEventListener('click', submitChat);
  el.chatInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitChat(); }
  });
  el.chatMicBtn.addEventListener('click', () => {
    if (S.jarvisState === 'listening') {
      stopListening();
    } else if (S.jarvisState === 'idle') {
      startListening(true);
    }
  });
}

function submitChat() {
  const text = el.chatInput.value.trim();
  if (!text) return;
  el.chatInput.value = '';
  handleInput(text);
}

// ═══════════════════════════════════════════════════════════
//  MASTER INPUT ROUTER
// ═══════════════════════════════════════════════════════════
async function handleInput(raw) {
  const text = raw.trim();
  if (!text) return;

  // Strip wakeword prefix
  const ww = S.settings.wakeword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const cleaned = text.replace(new RegExp(`^${ww}[,\\.!\\s]+`, 'i'), '').trim() || text;

  addMsg('user', 'YOU', text);

  const cmd = matchCommand(cleaned.toLowerCase());
  if (cmd) {
    log('cmd', `Local command: ${cmd.id}`);
    await runCommand(cmd, cleaned);
  } else {
    await queryAI(cleaned);
  }
}

// ═══════════════════════════════════════════════════════════
//  LOCAL COMMAND MATCHING
// ═══════════════════════════════════════════════════════════
const CMDS = [
  // Sites (fast shortcuts → exact destination)
  { id:'yt',        re:/\b(open\s+)?(youtube|yt)\b/i,       type:'url', url:'https://youtube.com' },
  { id:'google',    re:/\bopen\s+google\b/i,                 type:'url', url:'https://google.com' },
  { id:'gmail',     re:/\bopen\s+gmail\b/i,                  type:'url', url:'https://mail.google.com/mail/u/0/' },
  { id:'drive',     re:/\bopen\s+(google\s+)?drive\b/i,      type:'url', url:'https://drive.google.com' },
  { id:'calendar',  re:/\bopen\s+(google\s+)?calendar\b/i,   type:'url', url:'https://calendar.google.com' },
  { id:'maps',      re:/\bopen\s+(google\s+)?maps\b/i,       type:'url', url:'https://maps.google.com' },
  { id:'translate', re:/\bopen\s+(google\s+)?translate\b/i,  type:'url', url:'https://translate.google.com' },
  { id:'github',    re:/\bopen\s+github\b/i,                 type:'url', url:'https://github.com' },
  { id:'twitter',   re:/\bopen\s+(twitter|x\.com)\b/i,       type:'url', url:'https://x.com' },
  { id:'reddit',    re:/\bopen\s+reddit\b/i,                 type:'url', url:'https://reddit.com' },
  { id:'netflix',   re:/\bopen\s+netflix\b/i,                type:'url', url:'https://netflix.com' },
  { id:'spotify',   re:/\bopen\s+spotify\b/i,                type:'url', url:'https://open.spotify.com' },
  { id:'twitch',    re:/\bopen\s+twitch\b/i,                 type:'url', url:'https://twitch.tv' },
  { id:'linkedin',  re:/\bopen\s+linkedin\b/i,               type:'url', url:'https://linkedin.com/feed/' },
  { id:'instagram', re:/\bopen\s+instagram\b/i,              type:'url', url:'https://instagram.com' },
  { id:'facebook',  re:/\bopen\s+facebook\b/i,               type:'url', url:'https://facebook.com' },
  { id:'whatsapp',  re:/\bopen\s+whatsapp\b/i,               type:'url', url:'https://web.whatsapp.com' },
  { id:'amazon',    re:/\bopen\s+amazon\b/i,                 type:'url', url:'https://amazon.com' },
  { id:'wikipedia', re:/\bopen\s+wikipedia\b/i,              type:'url', url:'https://wikipedia.org' },
  { id:'chatgpt',   re:/\bopen\s+(chatgpt|chat\s*gpt)\b/i,   type:'url', url:'https://chat.openai.com' },
  { id:'puter',     re:/\bopen\s+puter\b/i,                  type:'url', url:'https://puter.com' },

  // Browser internal pages
  { id:'history',   re:/\bopen\s+history\b/i,                type:'bg', cmd:'open_browser_page', arg:{url:'chrome://history'} },
  { id:'downloads', re:/\bopen\s+downloads?\b/i,             type:'bg', cmd:'open_browser_page', arg:{url:'chrome://downloads'} },
  { id:'bmarks',    re:/\bopen\s+bookmarks?\b/i,             type:'bg', cmd:'open_browser_page', arg:{url:'chrome://bookmarks'} },
  { id:'exts',      re:/\bopen\s+extensions?\b/i,            type:'bg', cmd:'open_browser_page', arg:{url:'chrome://extensions'} },
  { id:'bsettings', re:/\bopen\s+(browser\s+)?settings\b/i,  type:'bg', cmd:'open_browser_page', arg:{url:'chrome://settings'} },

  // Search directly on Google / on the web
  { id:'search',    re:/\b(?:search|google|look\s+up)\s+(?:for\s+)?(.+)/i, type:'search' },

  // Numbered link click (before generic navigate so "open link 5" works)
  { id:'click_num', re:/\b(?:click|open|select|press|choose|hit)\s+(?:link\s+|number\s+|#\s*)?(\d{1,3})\b/i, type:'hint' },

  // Dynamic navigation (after specific site shortcuts)
  { id:'navigate',  re:/\b(?:open|go\s+to|navigate\s+to|visit)\s+(.+?)(?:\s+(?:in\s+new\s+tab|on\s+new\s+tab))?$/i, type:'navigate' },

  // Link-hint mode (hands-free clicking of anything on the page)
  { id:'hints_on',  re:/\b(show|list|enable)\s+(links|hints|numbers)\b/i, type:'bg', cmd:'link_hints_show' },
  { id:'hints_off', re:/\b(hide|clear|disable)\s+(links|hints|numbers)\b/i, type:'bg', cmd:'link_hints_hide' },

  // Read / summarize the page with AI
  { id:'read',      re:/\b(read|summari[sz]e)\b.*\b(page|article|this|it|screen)?\b/i, type:'read' },

  // Tab management (numbers before generic)
  { id:'mute_tab',  re:/\bmute\s+(this\s+)?tab\b/i,          type:'bg', cmd:'mute_tab' },
  { id:'switch_n',  re:/\b(?:switch|go|move)\s+to\s+tab\s+(\d+)\b/i, type:'tabnum', cmd:'switch_tab' },
  { id:'close_n',   re:/\bclose\s+tab\s+(\d+)\b/i,           type:'tabnum', cmd:'close_tab_n' },
  { id:'dup_tab',   re:/\bduplicate\s+(this\s+)?tab\b/i,     type:'bg', cmd:'duplicate_tab' },
  { id:'pin_tab',   re:/\b(pin|unpin)\s+(this\s+)?tab\b/i,   type:'bg', cmd:'pin_tab' },
  { id:'reopen',    re:/\b(reopen|restore)\s+(closed\s+)?tab\b/i, type:'bg', cmd:'reopen_tab' },
  { id:'new_win',   re:/\bnew\s+window\b/i,                  type:'bg', cmd:'new_window' },
  { id:'incognito', re:/\b(incognito|private)\s+(window|mode|tab)?\b/i, type:'bg', cmd:'incognito' },
  { id:'new_tab',   re:/\bnew\s+tab\b/i,                     type:'bg', cmd:'new_tab' },
  { id:'close_tab', re:/\bclose\s+(this\s+)?tab\b/i,         type:'bg', cmd:'close_tab' },
  { id:'next_tab',  re:/\bnext\s+tab\b/i,                    type:'bg', cmd:'next_tab' },
  { id:'prev_tab',  re:/\b(prev(ious)?\s+tab|last\s+tab)\b/i, type:'bg', cmd:'prev_tab' },
  { id:'list_tabs', re:/\blist\s+tabs\b/i,                   type:'bg', cmd:'list_tabs' },

  // Media control
  { id:'m_play',    re:/\b(play|resume)\b/i,                 type:'bg', cmd:'media_play' },
  { id:'m_pause',   re:/\b(pause|stop\s+video)\b/i,          type:'bg', cmd:'media_pause' },
  { id:'m_unmute',  re:/\bunmute\b/i,                        type:'bg', cmd:'media_unmute' },
  { id:'m_mute',    re:/\bmute\b/i,                          type:'bg', cmd:'media_mute' },
  { id:'m_faster',  re:/\b(speed\s+up|faster|playback\s+faster)\b/i, type:'bg', cmd:'media_faster' },
  { id:'m_slower',  re:/\b(slow\s+down|slower)\b/i,          type:'bg', cmd:'media_slower' },

  // Navigation
  { id:'go_back',   re:/\b(go\s+back|back)\b/i,              type:'bg', cmd:'go_back'   },
  { id:'go_fwd',    re:/\bgo\s+forward\b/i,                  type:'bg', cmd:'go_forward'},
  { id:'reload',    re:/\b(reload|refresh)\s*(page|tab)?\b/i, type:'bg', cmd:'reload'},

  // Scroll
  { id:'s_down',    re:/\bscroll\s+down\b/i,                 type:'bg', cmd:'scroll_down'   },
  { id:'s_up',      re:/\bscroll\s+up\b/i,                   type:'bg', cmd:'scroll_up'     },
  { id:'s_top',     re:/\bscroll\s+(to\s+)?top\b/i,          type:'bg', cmd:'scroll_top'    },
  { id:'s_bot',     re:/\bscroll\s+(to\s+)?(bottom|end)\b/i, type:'bg', cmd:'scroll_bottom'},
  // Scroll/jump to a specific text (after the fixed-direction scrolls above)
  { id:'scroll_to', re:/\b(?:scroll|jump)\s+to\s+(?:the\s+)?(?:text\s+)?(.+)/i, type:'scroll_to' },

  // Zoom
  { id:'z_in',     re:/\bzoom\s+in\b/i,                      type:'bg', cmd:'zoom_in'   },
  { id:'z_out',    re:/\bzoom\s+out\b/i,                     type:'bg', cmd:'zoom_out'  },
  { id:'z_reset',  re:/\bzoom\s+reset\b/i,                   type:'bg', cmd:'zoom_reset'},
  { id:'fscreen',  re:/\b(full\s?screen)\b/i,                type:'bg', cmd:'fullscreen'},

  // Type / submit / click by text (put type/submit before generic click-text)
  { id:'type',     re:/\btype\s+(.+)/i,                      type:'type_text' },
  { id:'submit',   re:/\b(submit|press\s+enter|hit\s+enter|confirm)\b/i, type:'bg', cmd:'press_enter' },
  { id:'clicktxt', re:/\b(?:click|press|tap|select|choose)\s+(?:on\s+)?(.+)/i, type:'click_text' },

  // Find on page
  { id:'find',     re:/\bfind\s+(.+)$/i,                     type:'find' },

  // Bookmark / screenshot
  { id:'bookmark', re:/\b(bookmark|save\s+page)\b/i,         type:'bg', cmd:'bookmark_page'},
  { id:'screenshot', re:/\btake\s+(a\s+)?screenshot\b/i,     type:'bg', cmd:'screenshot'},

  // System info (local)
  { id:'time',     re:/\b(what\s+(time|is\s+it)|current\s+time|time\s+now)\b/i, type:'local', fn: cmdTime },
  { id:'date',     re:/\b(what('s|\s+is)\s+(the\s+)?date|today('s|\s+is)?\s+date)\b/i, type:'local', fn: cmdDate },
  { id:'status',   re:/\b(status\s+report|system\s+status)\b/i, type:'local', fn: cmdStatus },
  { id:'model',    re:/\b(what\s+model|which\s+(ai\s+)?model)\b/i, type:'local', fn: cmdModel },
  { id:'help',     re:/\b(help|what\s+can\s+you\s+do|commands|list\s+commands)\b/i, type:'local', fn: cmdHelp },
  { id:'stop',     re:/\b(stop\s+(talking|speaking)|shut\s+up|silence)\b/i, type:'local', fn: cmdStop },
];

function matchCommand(txt) {
  for (const c of CMDS) {
    const m = txt.match(c.re);
    if (m) return { ...c, match: m };
  }
  return null;
}

// ── Local fns ─────────────────────────────────────────────
function cmdTime()   { jarvisReply(`The current time is ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}, sir.`); }
function cmdDate()   { jarvisReply(`Today is ${new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}.`); }
function cmdStatus() { jarvisReply(`All systems nominal, sir. JARVIS v1.0 online. Puter AI: ${S.puterReady ? 'connected' : 'offline'}. Model: ${S.settings.model}.`); }
function cmdModel()  { jarvisReply(`Current AI model is ${S.settings.model}.`); }
function cmdStop()   { window.speechSynthesis.cancel(); setState('idle'); jarvisReply('Of course, sir.', false); }
function cmdHelp()   {
  jarvisReply('Voice control ready, sir. Try: "open gmail", "search for weather", "show links" then "click 5", ' +
    '"scroll down", "go to <text>", "read the page", "type hello", "submit", "play"/"pause"/"mute", ' +
    '"new tab", "switch to tab 2", "close tab 3", "reload", "zoom in", "fullscreen", or just ask me anything.', false);
}

// Read / summarize the current page with AI.
async function cmdReadPage(mode) {
  setState('thinking');
  const res = await sendBg('get_readable_text', {});
  if (!res.success || !res.result) {
    setState('idle');
    addMsg('err', 'JARVIS', 'I could not read this page, sir.');
    return;
  }
  const verb = /summari/i.test(mode) ? 'Summarize' : 'Read and briefly explain';
  await queryAI(`${verb} the following page content for me:\n\n${res.result}`);
}

// ─────────────────────────────────────────────────────────
//  COMMAND EXECUTION
// ─────────────────────────────────────────────────────────
async function runCommand(cmd, originalText) {
  if (cmd.type === 'local') { cmd.fn(); return; }

  if (cmd.type === 'read') { await cmdReadPage(cmd.match[1] || originalText); return; }

  if (cmd.type === 'url') {
    await sendBg('open_url', { url: cmd.url });
    jarvisReply(`Opening ${cmd.id.replace(/_/g,' ')}, sir.`);
    return;
  }

  if (cmd.type === 'search') {
    const q = cmd.match[1]?.trim() || '';
    await sendBg('open_url', { url: `https://www.google.com/search?q=${encodeURIComponent(q)}` });
    jarvisReply(`Searching for "${q}", sir.`);
    return;
  }

  if (cmd.type === 'navigate') {
    const query = cmd.match[1]?.trim() || '';
    let url = query;
    if (!/^https?:\/\//i.test(url)) {
      if (/^[\w-]+\.(com|org|net|io|co|dev|app|ai|gov|edu)(\/.*)?\s*$/.test(url)) {
        url = `https://${url}`;
      } else {
        url = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
      }
    }
    await sendBg('open_url', { url });
    jarvisReply(`Navigating to ${query}, sir.`);
    return;
  }

  if (cmd.type === 'find') {
    const term = cmd.match[1];
    await sendBg('find_text', { text: term });
    jarvisReply(`Searching for "${term}".`);
    return;
  }

  if (cmd.type === 'click_text') {
    await bgAction('click_text', { text: cmd.match[1].trim() }, `Clicking "${cmd.match[1].trim()}", sir.`);
    return;
  }

  if (cmd.type === 'scroll_to') {
    await bgAction('scroll_to_text', { text: cmd.match[1].trim() }, `Jumping to "${cmd.match[1].trim()}", sir.`);
    return;
  }

  if (cmd.type === 'type_text') {
    await bgAction('type_text', { text: cmd.match[1] }, `Typed, sir.`);
    return;
  }

  if (cmd.type === 'hint') {
    await bgAction('click_hint', { num: parseInt(cmd.match[1], 10) }, `Activating link ${cmd.match[1]}, sir.`);
    return;
  }

  if (cmd.type === 'tabnum') {
    await bgAction(cmd.cmd, { num: parseInt(cmd.match[1], 10) }, null);
    return;
  }

  if (cmd.type === 'bg') {
    await bgAction(cmd.cmd, cmd.arg || {}, null);
  }
}

// Runs a background command, speaks a reply, handles errors + page indicator.
async function bgAction(command, data, spokenOverride) {
  setState('thinking');
  try {
    const res = await sendBg(command, data);
    if (!res.success) throw new Error(res.error || 'Command failed');
    const response = spokenOverride || buildReply(command, res.result);
    jarvisReply(response);
    log('success', `${command}: done`);
    if (el.micBtn) { el.micBtn.classList.add('cmd-flash'); setTimeout(() => el.micBtn.classList.remove('cmd-flash'), 600); }
    if (S.settings.indicator) notifyPage(command.replace(/_/g,' ').toUpperCase());
  } catch (e) {
    setState('idle');
    const msg = e.message || String(e);
    addMsg('err', 'JARVIS', `Command error: ${msg}`);
    log('error', `${command} failed: ${msg}`);
  }
}

function buildReply(cmd, result) {
  const map = {
    new_tab:       'New tab opened.',
    close_tab:     'Tab closed.',
    go_back:       'Going back.',
    go_forward:    'Going forward.',
    reload:        'Page reloaded.',
    scroll_down:   'Scrolling down.',
    scroll_up:     'Scrolling up.',
    scroll_top:    'Scrolled to top.',
    scroll_bottom: 'Scrolled to bottom.',
    zoom_in:       'Zoomed in.',
    zoom_out:      'Zoomed out.',
    zoom_reset:    'Zoom reset to 100 percent.',
    next_tab:      'Switched to next tab.',
    prev_tab:      'Switched to previous tab.',
    bookmark_page: 'Page bookmarked.',
    screenshot:    'Screenshot captured.',
    list_tabs:     `Current tabs: ${result}`,
  };
  return map[cmd] || String(result || 'Done.');
}

// ─────────────────────────────────────────────────────────
//  BACKGROUND MESSAGE
// ─────────────────────────────────────────────────────────
function sendBg(command, data) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'EXECUTE_COMMAND', command, data }, (res) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: chrome.runtime.lastError.message });
      } else {
        resolve(res || { success: false, error: 'No response' });
      }
    });
  });
}

// ─────────────────────────────────────────────────────────
//  PUTER.JS AI QUERY
// ─────────────────────────────────────────────────────────
async function queryAI(prompt) {
  if (!puterAvailable()) {
    addMsg('err', 'JARVIS', 'Puter.js failed to load — check your internet connection and try again.');
    log('error', 'AI query blocked — puter.js not loaded');
    return;
  }

  // If we are not connected, start the connect flow (opens puter.com to sign in).
  if (!S.puterReady) {
    log('warn', 'AI request requires a Puter connection — starting CONNECT.');
    const ok = await doConnect(el.authActionBtn);
    if (!ok) {
      addMsg('err', 'JARVIS', 'Not connected to Puter AI. Click CONNECT and sign in, sir.');
      return;
    }
  }

  setState('thinking');
  log('ai', `Querying ${S.settings.model}…`);

  const typingId = addTyping();

  const systemPrompt =
    'You are JARVIS, Tony Stark\'s ultra-intelligent AI assistant. ' +
    'Be concise, polite, and precise. Keep answers under 3 sentences unless code or lists are needed. ' +
    'Address the user as "sir" once per reply. Never break character.';

  // Keep short-term conversation memory (last ~8 turns) so JARVIS stays in context.
  S.history.push({ role: 'user', content: prompt });
  if (S.history.length > 16) S.history = S.history.slice(-16);

  try {
    const result = await puter.ai.chat(
      [
        { role: 'system', content: systemPrompt },
        ...S.history
      ],
      { model: S.settings.model }
    );

    removeTyping(typingId);

    const text = extractPuterText(result).trim();
    if (!text) throw new Error('Empty response from AI.');

    S.history.push({ role: 'assistant', content: text });
    log('ai', `Response: "${text.slice(0, 70)}${text.length > 70 ? '…' : ''}"`);
    jarvisReply(text);

  } catch (e) {
    removeTyping(typingId);
    setState('idle');
    S.history.pop(); // drop the user turn that failed
    const errMsg = e?.message || (typeof e === 'string' ? e : JSON.stringify(e));

    // Token expired / invalid → clear it and prompt to reconnect.
    if (/unauthor|401|permission|token|not.*sign/i.test(errMsg)) {
      await clearToken();
      onPuterSignedOut();
      addMsg('err', 'JARVIS', 'Your Puter session expired. Click CONNECT and sign in again, sir.');
      log('error', `AI auth error: ${errMsg}`);
      return;
    }

    addMsg('err', 'JARVIS', `AI error: ${errMsg}`);
    log('error', `AI query failed: ${errMsg}`);
    speak('I encountered an error with the AI request, sir.');
  }
}

// Puter's response shape varies by provider: OpenAI-style models return a
// plain string in message.content, Claude-style models return an array of
// content blocks ([{type:'text', text:'...'}]).
function extractPuterText(result) {
  if (typeof result === 'string') return result;
  const content = result?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((b) => b.text || '').join('');
  if (result?.text) return result.text;
  if (result?.choices?.[0]?.message?.content) return result.choices[0].message.content;
  return JSON.stringify(result);
}

// ─────────────────────────────────────────────────────────
//  JARVIS REPLY (chat + TTS)
// ─────────────────────────────────────────────────────────
function jarvisReply(text, doSpeak = true) {
  addMsg('jarvis', 'JARVIS', text);
  if (doSpeak && S.settings.speakAI) {
    speak(text);
  } else {
    if (S.jarvisState !== 'listening') setState('idle');
  }
}

// ─────────────────────────────────────────────────────────
//  TEXT-TO-SPEECH
// ─────────────────────────────────────────────────────────
function speak(text) {
  if (!text || !window.speechSynthesis) { setState('idle'); return; }
  window.speechSynthesis.cancel();
  setState('speaking');

  const u = new SpeechSynthesisUtterance(text);
  u.rate  = S.settings.rate;
  u.pitch = S.settings.pitch;
  u.lang  = S.settings.lang;

  // Pick a quality voice
  const voices = window.speechSynthesis.getVoices();
  const best = voices.find(v => v.lang.startsWith('en') && /Google|Microsoft|Alex|Samantha/i.test(v.name))
            || voices.find(v => v.lang.startsWith('en'));
  if (best) u.voice = best;

  u.onend   = () => { if (S.jarvisState === 'speaking') setState('idle'); };
  u.onerror = () => { if (S.jarvisState === 'speaking') setState('idle'); };

  S.utterance = u;
  window.speechSynthesis.speak(u);
}

// Voices may not be loaded immediately on first call
window.speechSynthesis.onvoiceschanged = () => {};

// ─────────────────────────────────────────────────────────
//  CHAT MESSAGES
// ─────────────────────────────────────────────────────────
function addMsg(type, sender, text) {
  const wrap = document.createElement('div');
  wrap.className = `msg ${type}`;

  const lbl = document.createElement('div');
  lbl.className = 'msg-label';
  lbl.textContent = sender;

  const bub = document.createElement('div');
  bub.className = 'msg-bubble';
  bub.textContent = text;

  wrap.appendChild(lbl);
  wrap.appendChild(bub);
  el.chatFeed.appendChild(wrap);
  el.chatFeed.scrollTop = el.chatFeed.scrollHeight;

  // Switch to chat tab to show the response
  if (type === 'jarvis' || type === 'err') {
    // only auto-switch if current tab is HUD
    const activeTab = document.querySelector('.tab-btn.active');
    if (activeTab?.dataset.tab === 'hud') {
      // don't switch — user may be watching the HUD
    }
  }
  return wrap;
}

let _typingSeq = 0;
function addTyping() {
  const id = `typing-${++_typingSeq}`;
  const wrap = document.createElement('div');
  wrap.className = 'msg jarvis';
  wrap.id = id;

  const lbl = document.createElement('div');
  lbl.className = 'msg-label';
  lbl.textContent = 'JARVIS';

  const bub = document.createElement('div');
  bub.className = 'msg-bubble';
  bub.innerHTML = '<span class="typing-dots"><i></i><i></i><i></i></span>';

  wrap.appendChild(lbl);
  wrap.appendChild(bub);
  el.chatFeed.appendChild(wrap);
  el.chatFeed.scrollTop = el.chatFeed.scrollHeight;
  return id;
}
function removeTyping(id) {
  const el2 = document.getElementById(id);
  if (el2) el2.remove();
}

// ─────────────────────────────────────────────────────────
//  SYSTEM LOG
// ─────────────────────────────────────────────────────────
function initLog() {
  el.clearLogBtn.addEventListener('click', () => {
    el.logFeed.innerHTML = '';
    log('info', 'Log cleared');
  });
}

function log(type, msg) {
  const row = document.createElement('div');
  row.className = `log-row ${type}`;

  const tEl = document.createElement('span');
  tEl.className = 'log-ts';
  tEl.textContent = ts();

  const mEl = document.createElement('span');
  mEl.className = 'log-msg';
  mEl.textContent = msg;

  row.appendChild(tEl);
  row.appendChild(mEl);
  el.logFeed.appendChild(row);

  // Keep log capped at 200 entries
  const rows = el.logFeed.querySelectorAll('.log-row');
  if (rows.length > 200) rows[0].remove();

  el.logFeed.scrollTop = el.logFeed.scrollHeight;
}

// ─────────────────────────────────────────────────────────
//  SETTINGS
// ─────────────────────────────────────────────────────────
function loadSettings() {
  chrome.storage.local.get('jarvisV2Settings', ({ jarvisV2Settings }) => {
    if (jarvisV2Settings) Object.assign(S.settings, jarvisV2Settings);
    applySettingsUI();
  });
}

function applySettingsUI() {
  const { model, rate, pitch, lang, speakAI, continuous, wakeword, wakeActivation, indicator } = S.settings;

  const knownVals = Array.from(document.querySelectorAll('.model-row[data-val]'))
    .map(r => r.dataset.val)
    .filter(v => v !== '__custom__');
  const isCustom = !knownVals.includes(model);
  const customInput = $('customModelInput');

  document.querySelectorAll('.model-row').forEach(row => {
    const active = isCustom ? row.dataset.val === '__custom__' : row.dataset.val === model;
    row.classList.toggle('active', active);
    const inp = row.querySelector('input');
    if (inp) inp.checked = active;
  });
  if (customInput) {
    customInput.style.display = isCustom ? 'block' : 'none';
    if (isCustom) customInput.value = model;
  }

  el.rateSlider.value      = rate;
  el.rateOut.textContent   = `${rate}×`;
  el.pitchSlider.value     = pitch;
  el.pitchOut.textContent  = String(pitch);
  el.langSel.value         = lang;
  el.tglSpeak.checked      = speakAI;
  el.tglContinuous.checked = continuous;
  el.wakewordInput.value   = wakeword;
  if (el.tglWakeActivation) el.tglWakeActivation.checked = wakeActivation;
  el.tglIndicator.checked  = indicator;

  updateRangeTrack(el.rateSlider);
  updateRangeTrack(el.pitchSlider);
}

function initSettings() {
  // Model selection
  const customInput = $('customModelInput');

  el.modelList.querySelectorAll('.model-row').forEach(row => {
    row.addEventListener('click', () => {
      el.modelList.querySelectorAll('.model-row').forEach(r => r.classList.remove('active'));
      row.classList.add('active');
      const inp = row.querySelector('input');
      if (inp) inp.checked = true;

      if (row.dataset.val === '__custom__') {
        customInput.style.display = 'block';
        customInput.focus();
        S.settings.model = customInput.value.trim() || S.settings.model;
      } else {
        customInput.style.display = 'none';
        S.settings.model = row.dataset.val;
      }
      log('info', `AI model → ${S.settings.model}`);
    });
  });

  customInput?.addEventListener('input', () => {
    S.settings.model = customInput.value.trim();
  });
  customInput?.addEventListener('change', () => {
    log('info', `AI model → ${S.settings.model}`);
  });

  // Sliders
  el.rateSlider.addEventListener('input', () => {
    S.settings.rate = parseFloat(el.rateSlider.value);
    el.rateOut.textContent = `${S.settings.rate}×`;
    updateRangeTrack(el.rateSlider);
  });
  el.pitchSlider.addEventListener('input', () => {
    S.settings.pitch = parseFloat(el.pitchSlider.value);
    el.pitchOut.textContent = String(S.settings.pitch);
    updateRangeTrack(el.pitchSlider);
  });

  // Select
  el.langSel.addEventListener('change', () => { S.settings.lang = el.langSel.value; });

  // Toggles
  el.tglSpeak.addEventListener('change', ()     => { S.settings.speakAI    = el.tglSpeak.checked; });
  el.tglContinuous.addEventListener('change', () => { S.settings.continuous = el.tglContinuous.checked; });
  el.tglIndicator.addEventListener('change', ()  => { S.settings.indicator  = el.tglIndicator.checked; });
  if (el.tglWakeActivation) {
    el.tglWakeActivation.addEventListener('change', () => {
      S.settings.wakeActivation = el.tglWakeActivation.checked;
      enableWakeMode(S.settings.wakeActivation);
      chrome.storage.local.set({ jarvisV2Settings: S.settings });
    });
  }
  el.wakewordInput.addEventListener('change', () => {
    S.settings.wakeword = el.wakewordInput.value.trim().toLowerCase() || 'jarvis';
  });

  // Save
  el.saveCfgBtn.addEventListener('click', () => {
    chrome.storage.local.set({ jarvisV2Settings: S.settings }, () => {
      el.saveCfgBtn.textContent = '✓ SAVED';
      log('success', 'Configuration saved');
      setTimeout(() => { el.saveCfgBtn.textContent = 'SAVE CONFIGURATION'; }, 2000);
    });
  });
}

function updateRangeTrack(input) {
  const min = parseFloat(input.min), max = parseFloat(input.max), val = parseFloat(input.value);
  const pct = ((val - min) / (max - min)) * 100;
  input.style.background =
    `linear-gradient(90deg, var(--c-cyan) ${pct}%, rgba(0,243,255,.15) ${pct}%)`;
}

// ─────────────────────────────────────────────────────────
//  SVG TICK MARKS
// ─────────────────────────────────────────────────────────
function drawTickMarks() {
  const svg = $('tickSvg');
  if (!svg) return;
  const cx = 110, cy = 110, r = 106, total = 48;
  const NS = 'http://www.w3.org/2000/svg';

  for (let i = 0; i < total; i++) {
    const major = i % 12 === 0;
    const med   = i % 4  === 0;
    const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
    const len   = major ? 12 : (med ? 7 : 4);
    const stroke = major ? '#00f3ff' : (med ? 'rgba(0,243,255,.5)' : 'rgba(0,243,255,.25)');
    const sw     = major ? 1.8 : (med ? 1 : 0.7);

    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', (cx + r * Math.cos(angle)).toFixed(2));
    line.setAttribute('y1', (cy + r * Math.sin(angle)).toFixed(2));
    line.setAttribute('x2', (cx + (r - len) * Math.cos(angle)).toFixed(2));
    line.setAttribute('y2', (cy + (r - len) * Math.sin(angle)).toFixed(2));
    line.setAttribute('stroke', stroke);
    line.setAttribute('stroke-width', sw);
    svg.appendChild(line);
  }
}

// ─────────────────────────────────────────────────────────
//  PAGE INDICATOR (via content script)
// ─────────────────────────────────────────────────────────
async function notifyPage(text) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'SHOW_INDICATOR', text }).catch(() => {});
    }
  } catch (_) {}
}
