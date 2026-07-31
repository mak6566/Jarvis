// offscreen.js — runs in the hidden offscreen document
// ═══════════════════════════════════════════════════════════════════════
// WHY IT LIVES HERE: Chrome does not allow reliable microphone capture
// (getUserMedia / SpeechRecognition) inside an extension popup / side panel.
// The supported approach is a chrome.offscreen document (reason 'USER_MEDIA')
// that runs hidden in the background.
//
// Hardening (v1.0.1):
//  • the microphone permission is probed ONCE before recognition starts,
//  • fatal errors (not-allowed / audio-capture / service-not-allowed) stop the
//    loop instead of restarting forever,
//  • restarts use a small backoff and a failure counter, so a broken mic can
//    never spin up an endless cycle of errors (and permission tabs).

let recognition = null;
let recognizing = false;
let currentLang = 'en-US';
let continuous = true;
let shouldRun = false;
let failStreak = 0;
let restartTimer = null;
let lastStartAt = 0;
let micStream = null;

const FATAL_ERRORS = new Set(['not-allowed', 'service-not-allowed', 'audio-capture']);
const MAX_FAIL_STREAK = 3;

function post(type, payload = {}) {
  chrome.runtime.sendMessage({ type, ...payload }).catch(() => {
    /* nobody is listening (panel closed) — fine */
  });
}

function fail(error, fatal = false) {
  if (fatal) {
    shouldRun = false;
    clearTimeout(restartTimer);
    releaseMic();
  }
  post('JARVIS_SR_ERROR', { error, fatal });
  post('JARVIS_SR_STATE', { state: 'idle' });
}

function releaseMic() {
  if (micStream) {
    try { micStream.getTracks().forEach((t) => t.stop()); } catch (_) {}
    micStream = null;
  }
}

// Warm up / verify the microphone. Returns true when we may proceed.
async function ensureMicAccess() {
  try {
    if (navigator.permissions?.query) {
      const p = await navigator.permissions.query({ name: 'microphone' });
      if (p.state === 'denied') {
        fail('not-allowed', true);
        return false;
      }
    }
  } catch (_) { /* permission API may not know 'microphone' — continue */ }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Release it immediately: SpeechRecognition opens its own stream and two
    // concurrent captures can make recognition end instantly on some builds.
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch (e) {
    const name = e?.name || '';
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      fail('not-allowed', true);
    } else if (name === 'NotFoundError' || name === 'NotReadableError') {
      fail('audio-capture', true);
    } else {
      fail(e?.message || String(e), true);
    }
    return false;
  }
}

function buildRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    fail('SpeechRecognition API is not available in this browser.', true);
    return null;
  }
  const r = new SR();
  r.continuous = continuous;
  r.interimResults = false;
  r.lang = currentLang;

  r.onstart = () => {
    recognizing = true;
    failStreak = 0;
    lastStartAt = Date.now();
    post('JARVIS_SR_STATE', { state: 'listening' });
  };

  r.onaudiostart = () => { failStreak = 0; };

  r.onresult = (e) => {
    let finalTranscript = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) finalTranscript += e.results[i][0].transcript;
    }
    if (finalTranscript.trim()) {
      failStreak = 0;
      post('JARVIS_SR_RESULT', { text: finalTranscript.trim() });
    }
  };

  r.onerror = (e) => {
    if (FATAL_ERRORS.has(e.error)) {
      fail(e.error, true);
      return;
    }
    if (e.error === 'no-speech' || e.error === 'aborted') return;
    post('JARVIS_SR_ERROR', { error: e.error, fatal: false });
  };

  r.onend = () => {
    recognizing = false;
    post('JARVIS_SR_STATE', { state: 'idle' });
    if (!shouldRun || !continuous) return;

    // Died almost instantly → something is wrong; count it.
    if (Date.now() - lastStartAt < 800) failStreak++;
    if (failStreak >= MAX_FAIL_STREAK) {
      fail('Speech recognition keeps stopping — microphone unavailable.', true);
      return;
    }
    clearTimeout(restartTimer);
    restartTimer = setTimeout(() => { if (shouldRun) launch(); }, 400 + failStreak * 600);
  };

  return r;
}

function launch() {
  if (recognizing || !shouldRun) return;
  try {
    recognition = buildRecognition();
    if (recognition) {
      lastStartAt = Date.now();
      recognition.start();
    }
  } catch (e) {
    // InvalidStateError = already started; anything else is fatal enough to stop.
    if (e?.name === 'InvalidStateError') return;
    fail(e?.message || String(e), true);
  }
}

async function startRecognition(lang, cont) {
  if (lang) currentLang = lang;
  if (typeof cont === 'boolean') continuous = cont;
  if (shouldRun && recognizing) return;
  clearTimeout(restartTimer);
  failStreak = 0;
  shouldRun = true;

  const ok = await ensureMicAccess();
  if (!ok || !shouldRun) return;
  launch();
}

function stopRecognition() {
  shouldRun = false;
  clearTimeout(restartTimer);
  if (recognition && recognizing) {
    try { recognition.abort(); } catch (_) {}
  }
  recognizing = false;
  releaseMic();
  post('JARVIS_SR_STATE', { state: 'idle' });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'JARVIS_SR_START') {
    startRecognition(message.lang, message.continuous);
    sendResponse({ ok: true });
  } else if (message.type === 'JARVIS_SR_STOP') {
    stopRecognition();
    sendResponse({ ok: true });
  } else if (message.type === 'JARVIS_SR_PING') {
    sendResponse({ ok: true, recognizing, shouldRun });
  }
});
