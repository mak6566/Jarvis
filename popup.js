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
  settings: {
    model:       'ling-3.0-flash',
    rate:        1.1,
    pitch:       1.0,
    lang:        'en-US',
    speakAI:     true,
    continuous:  false,
    wakeword:    'jarvis',
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
  tglIndicator: $('tglIndicator'),
  saveCfgBtn:   $('saveCfgBtn'),
};

// ═══════════════════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════════════════
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
  log('info', 'JARVIS v2.0 boot sequence complete');
});

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
//  PUTER.JS AUTHENTICATION
// ═══════════════════════════════════════════════════════════
//
// No manual sign-in. Puter.js prompts for auth automatically the first time
// puter.ai.chat() (or any other authed call) runs, so the extension just
// reflects the current session state and lets the AI call itself trigger
// sign-in on demand.

async function refreshPuterUser() {
  if (typeof puter === 'undefined') return null;
  try {
    if (!puter.auth.isSignedIn()) return null;
    return await puter.auth.getUser();
  } catch (_) {
    return null;
  }
}

async function initPuterAuth() {
  // Auth overlay is never shown — puter.js handles sign-in on demand.
  hideAuthOverlay();

  if (typeof puter === 'undefined') {
    log('warn', 'Puter.js not found — AI disabled');
    updatePuterUI(false, null);
    return;
  }

  const user = await refreshPuterUser();
  if (user) {
    onPuterSignedIn(user);
  } else {
    updatePuterUI(false, null);
  }

  // Settings row: only used to sign out (or show status).
  el.authActionBtn?.addEventListener('click', async () => {
    if (S.puterReady) {
      try {
        await puter.auth.signOut();
        onPuterSignedOut();
      } catch (e) {
        log('error', `Sign-out failed: ${e.message}`);
      }
      return;
    }
    // Not signed in: trigger a lightweight AI call so puter.js shows its own
    // sign-in prompt. The user asked to rely on puter's automatic flow.
    el.authActionBtn.textContent = 'CONNECTING…';
    el.authActionBtn.disabled = true;
    try {
      await puter.ai.chat('hi', { model: S.settings.model });
      const u = await refreshPuterUser();
      if (u) onPuterSignedIn(u);
      else updatePuterUI(false, null);
    } catch (e) {
      log('error', `Sign-in via AI failed: ${e.message || e}`);
      updatePuterUI(false, null);
    }
  });
}

function onPuterSignedIn(user) {
  S.puterReady = true;
  S.puterUser  = user;
  updatePuterUI(true, user);
  log('success', `Puter signed in as: ${user?.username || 'user'}`);
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
      el.puterBadge.textContent = `AI: ${(user?.username || 'online').slice(0, 8).toUpperCase()}`;
      el.puterBadge.classList.add('online');
    } else {
      el.puterBadge.textContent = 'AI: READY';
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
  el.authOverlay?.classList.add('hidden');
}
function hideAuthOverlay() {
  el.authOverlay?.classList.add('hidden');
}

// ═══════════════════════════════════════════════════════════
//  VOICE RECOGNITION
// ═══════════════════════════════════════════════════════════
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

function startListening(isChatMic) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    addMsg('err', 'JARVIS', 'Speech Recognition is not supported in this browser.');
    log('error', 'SpeechRecognition API unavailable');
    return;
  }
  if (S.recognition) { S.recognition.abort(); }

  const r = new SR();
  r.continuous     = S.settings.continuous;
  r.interimResults = false;
  r.lang           = S.settings.lang;
  S.recognition    = r;

  r.onstart = () => {
    setState('listening');
    el.micBtn.classList.add('active');
    el.micLabel.textContent = 'LISTENING…';
    if (isChatMic) el.chatMicBtn.classList.add('active');
    log('info', 'Microphone activated');
  };

  r.onresult = (e) => {
    const transcript = Array.from(e.results)
      .filter(res => res.isFinal)
      .map(res => res[0].transcript)
      .join(' ')
      .trim();
    if (!transcript) return;
    el.lastHeard.textContent = `"${transcript}"`;
    log('info', `Voice: "${transcript}"`);
    if (!S.settings.continuous) stopListening(false);
    handleInput(transcript);
  };

  r.onerror = (e) => {
    if (e.error === 'aborted') return;
    log('error', `Speech error: ${e.error}`);
    resetMicUI();
    if (e.error === 'not-allowed') {
      addMsg('err', 'JARVIS', 'Microphone permission denied. Please allow mic access.');
    }
  };

  r.onend = () => {
    if (S.settings.continuous && S.jarvisState === 'listening') {
      try { r.start(); } catch (_) { resetMicUI(); }
    } else {
      resetMicUI();
    }
  };

  try { r.start(); }
  catch (e) { log('error', `Failed to start mic: ${e.message}`); resetMicUI(); }
}

function stopListening(resetState = true) {
  if (S.recognition) {
    try { S.recognition.abort(); } catch (_) {}
    S.recognition = null;
  }
  resetMicUI(resetState);
}

function resetMicUI(resetState = true) {
  el.micBtn.classList.remove('active');
  el.micLabel.textContent = 'ACTIVATE';
  el.chatMicBtn.classList.remove('active');
  if (resetState && S.jarvisState === 'listening') setState('idle');
}

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
  // Sites (fast shortcuts)
  { id:'yt',        re:/\b(open\s+)?(youtube|yt)\b/i,       type:'url', url:'https://youtube.com' },
  { id:'google',    re:/\bopen\s+google\b/i,                 type:'url', url:'https://google.com' },
  { id:'gmail',     re:/\bopen\s+gmail\b/i,                  type:'url', url:'https://mail.google.com' },
  { id:'github',    re:/\bopen\s+github\b/i,                 type:'url', url:'https://github.com' },
  { id:'twitter',   re:/\bopen\s+(twitter|x\.com)\b/i,       type:'url', url:'https://x.com' },
  { id:'reddit',    re:/\bopen\s+reddit\b/i,                 type:'url', url:'https://reddit.com' },
  { id:'netflix',   re:/\bopen\s+netflix\b/i,                type:'url', url:'https://netflix.com' },
  { id:'spotify',   re:/\bopen\s+spotify\b/i,                type:'url', url:'https://open.spotify.com' },
  { id:'wikipedia', re:/\bopen\s+wikipedia\b/i,              type:'url', url:'https://wikipedia.org' },
  { id:'chatgpt',   re:/\bopen\s+(chatgpt|chat\s*gpt)\b/i,   type:'url', url:'https://chat.openai.com' },
  { id:'puter',     re:/\bopen\s+puter\b/i,                  type:'url', url:'https://puter.com' },

  // Dynamic navigation (must come after specific site shortcuts)
  { id:'navigate', re:/\b(?:open|go\s+to|navigate\s+to|visit)\s+(.+?)(?:\s+(?:in\s+new\s+tab|on\s+new\s+tab))?$/i, type:'navigate' },

  // Tab management
  { id:'new_tab',   re:/\bnew\s+tab\b/i,          type:'bg', cmd:'new_tab'   },
  { id:'close_tab', re:/\bclose\s+(this\s+)?tab\b/i, type:'bg', cmd:'close_tab'},
  { id:'next_tab',  re:/\bnext\s+tab\b/i,          type:'bg', cmd:'next_tab'  },
  { id:'prev_tab',  re:/\b(prev(ious)?\s+tab|last\s+tab)\b/i, type:'bg', cmd:'prev_tab'},
  { id:'list_tabs', re:/\blist\s+tabs\b/i,          type:'bg', cmd:'list_tabs' },

  // Navigation
  { id:'go_back',   re:/\b(go\s+back|back)\b/i,    type:'bg', cmd:'go_back'   },
  { id:'go_fwd',    re:/\bgo\s+forward\b/i,         type:'bg', cmd:'go_forward'},
  { id:'reload',    re:/\b(reload|refresh)\s*(page|tab)?\b/i, type:'bg', cmd:'reload'},

  // Scroll
  { id:'s_down',    re:/\bscroll\s+down\b/i,        type:'bg', cmd:'scroll_down'   },
  { id:'s_up',      re:/\bscroll\s+up\b/i,          type:'bg', cmd:'scroll_up'     },
  { id:'s_top',     re:/\bscroll\s+(to\s+)?top\b/i, type:'bg', cmd:'scroll_top'    },
  { id:'s_bot',     re:/\bscroll\s+(to\s+)?(bottom|end)\b/i, type:'bg', cmd:'scroll_bottom'},

  // Zoom
  { id:'z_in',     re:/\bzoom\s+in\b/i,             type:'bg', cmd:'zoom_in'   },
  { id:'z_out',    re:/\bzoom\s+out\b/i,             type:'bg', cmd:'zoom_out'  },
  { id:'z_reset',  re:/\bzoom\s+reset\b/i,           type:'bg', cmd:'zoom_reset'},

  // Find
  { id:'find',     re:/\bfind\s+(.+)$/i,             type:'find' },

  // Bookmark
  { id:'bookmark', re:/\b(bookmark|save\s+page|bookmark\s+(this|page))\b/i, type:'bg', cmd:'bookmark_page'},

  // Screenshot
  { id:'screenshot', re:/\btake\s+(a\s+)?screenshot\b/i, type:'bg', cmd:'screenshot'},

  // System info (handled locally, no bg needed)
  { id:'time',     re:/\b(what\s+(time|is\s+it)|current\s+time|time\s+now)\b/i, type:'local', fn: cmdTime },
  { id:'date',     re:/\b(what('s|\s+is)\s+(the\s+)?date|today('s|\s+is)?\s+date)\b/i, type:'local', fn: cmdDate },
  { id:'status',   re:/\b(status\s+report|system\s+status)\b/i, type:'local', fn: cmdStatus },
  { id:'model',    re:/\b(what\s+model|which\s+(ai\s+)?model)\b/i, type:'local', fn: cmdModel },
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
function cmdStatus() { jarvisReply(`All systems nominal, sir. JARVIS v2.0 online. Puter AI: ${S.puterReady ? 'connected' : 'offline'}. Model: ${S.settings.model}.`); }
function cmdModel()  { jarvisReply(`Current AI model is ${S.settings.model}.`); }
function cmdStop()   { window.speechSynthesis.cancel(); setState('idle'); jarvisReply('Of course, sir.', false); }

// ─────────────────────────────────────────────────────────
//  COMMAND EXECUTION
// ─────────────────────────────────────────────────────────
async function runCommand(cmd, originalText) {
  if (cmd.type === 'local') { cmd.fn(); return; }

  if (cmd.type === 'url') {
    await sendBg('open_url', { url: cmd.url });
    jarvisReply(`Opening ${cmd.id.replace(/_/g,' ')}, sir.`);
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

  if (cmd.type === 'bg') {
    setState('thinking');
    try {
      const res = await sendBg(cmd.cmd, {});
      if (!res.success) throw new Error(res.error || 'Command failed');

      const response = buildReply(cmd.cmd, res.result);
      jarvisReply(response);
      log('success', `${cmd.cmd}: done`);

      if (S.settings.indicator) {
        notifyPage(cmd.cmd.replace(/_/g,' ').toUpperCase());
      }
    } catch (e) {
      setState('idle');
      const msg = e.message || String(e);
      addMsg('err', 'JARVIS', `Command error: ${msg}`);
      log('error', `${cmd.cmd} failed: ${msg}`);
    }
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
  if (typeof puter === 'undefined') {
    jarvisReply('Puter.js failed to load, sir.');
    log('error', 'AI query blocked — puter.js not loaded');
    return;
  }


  setState('thinking');
  log('ai', `Querying ${S.settings.model}…`);

  const typingId = addTyping();

  const systemPrompt =
    'You are JARVIS, Tony Stark\'s ultra-intelligent AI assistant. ' +
    'Be concise, polite, and precise. Keep answers under 3 sentences unless code or lists are needed. ' +
    'Address the user as "sir" once per reply. Never break character.';

  try {
    const result = await puter.ai.chat(prompt, {
      model: S.settings.model,
      systemPrompt,
    });

    removeTyping(typingId);

    // Normalise puter response shape
    let text = '';
    if (typeof result === 'string') {
      text = result;
    } else if (result?.message?.content) {
      const c = result.message.content;
      text = Array.isArray(c) ? c.map(b => b.text || '').join('') : String(c);
    } else if (result?.text) {
      text = result.text;
    } else if (result?.choices?.[0]?.message?.content) {
      text = result.choices[0].message.content;
    } else {
      text = JSON.stringify(result);
    }

    text = text.trim();
    log('ai', `Response: "${text.slice(0, 70)}${text.length > 70 ? '…' : ''}"`);
    jarvisReply(text);

    // First successful call implies puter.js auto-authenticated — refresh badge.
    if (!S.puterReady) {
      const u = await refreshPuterUser();
      if (u) onPuterSignedIn(u);
    }


  } catch (e) {
    removeTyping(typingId);
    setState('idle');
    const errMsg = e.message || String(e);
    addMsg('err', 'JARVIS', `AI error: ${errMsg}`);
    log('error', `AI query failed: ${errMsg}`);
    speak('I encountered an error with the AI request, sir.');
  }
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
  const { model, rate, pitch, lang, speakAI, continuous, wakeword, indicator } = S.settings;

  document.querySelectorAll('.model-row').forEach(row => {
    const active = row.dataset.val === model;
    row.classList.toggle('active', active);
    const inp = row.querySelector('input');
    if (inp) inp.checked = active;
  });

  el.rateSlider.value      = rate;
  el.rateOut.textContent   = `${rate}×`;
  el.pitchSlider.value     = pitch;
  el.pitchOut.textContent  = String(pitch);
  el.langSel.value         = lang;
  el.tglSpeak.checked      = speakAI;
  el.tglContinuous.checked = continuous;
  el.wakewordInput.value   = wakeword;
  el.tglIndicator.checked  = indicator;

  updateRangeTrack(el.rateSlider);
  updateRangeTrack(el.pitchSlider);
}

function initSettings() {
  // Model selection
  el.modelList.querySelectorAll('.model-row').forEach(row => {
    row.addEventListener('click', () => {
      el.modelList.querySelectorAll('.model-row').forEach(r => r.classList.remove('active'));
      row.classList.add('active');
      const inp = row.querySelector('input');
      if (inp) inp.checked = true;
      S.settings.model = row.dataset.val;
      log('info', `AI model → ${row.dataset.val}`);
    });
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
