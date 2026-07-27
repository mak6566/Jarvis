// offscreen.js — runs in the hidden offscreen document
// ═══════════════════════════════════════════════════════════════════════
// WHY IT LIVES HERE: Chrome has long disallowed reliable capture of the
// microphone (getUserMedia / SpeechRecognition) directly inside an extension
// "action popup" — regardless of whether the microphone permission was already
// granted for the extension origin. This is a known Chromium limitation, not a
// permissions bug. The officially recommended approach is a chrome.offscreen
// document (reason 'USER_MEDIA') that runs hidden in the background and
// captures the microphone reliably, once permission was granted (via
// mic-permission.html).

let recognition = null;
let recognizing = false;
let currentLang = 'en-US';
let continuous = true;

function post(type, payload = {}) {
  chrome.runtime.sendMessage({ type, ...payload }).catch(() => {
    /* nobody is listening (popup is closed) — fine, ignore */
  });
}

function buildRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    post('JARVIS_SR_ERROR', { error: 'SpeechRecognition API is not available in this browser.' });
    return null;
  }
  const r = new SR();
  r.continuous = continuous;
  r.interimResults = false;
  r.lang = currentLang;

  r.onstart = () => {
    recognizing = true;
    post('JARVIS_SR_STATE', { state: 'listening' });
  };

  r.onresult = (e) => {
    let finalTranscript = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) finalTranscript += e.results[i][0].transcript;
    }
    if (finalTranscript.trim()) {
      post('JARVIS_SR_RESULT', { text: finalTranscript.trim() });
    }
  };

  r.onerror = (e) => {
    if (e.error === 'no-speech' || e.error === 'aborted') return;
    post('JARVIS_SR_ERROR', { error: e.error });
  };

  r.onend = () => {
    recognizing = false;
    post('JARVIS_SR_STATE', { state: 'idle' });
    // Chrome ends recognition after silence (~60s) — restart if it should keep running.
    if (continuous && S_shouldRun) {
      setTimeout(() => startRecognition(), 300);
    }
  };

  return r;
}

let S_shouldRun = false;

function startRecognition(lang, cont) {
  if (lang) currentLang = lang;
  if (typeof cont === 'boolean') continuous = cont;
  S_shouldRun = true;
  if (recognizing) return;
  try {
    recognition = buildRecognition();
    if (recognition) recognition.start();
  } catch (e) {
    post('JARVIS_SR_ERROR', { error: e.message || String(e) });
  }
}

function stopRecognition() {
  S_shouldRun = false;
  if (recognition && recognizing) {
    try { recognition.stop(); } catch (e) { /* noop */ }
  }
  recognizing = false;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'JARVIS_SR_START') {
    startRecognition(message.lang, message.continuous);
    sendResponse({ ok: true });
  } else if (message.type === 'JARVIS_SR_STOP') {
    stopRecognition();
    sendResponse({ ok: true });
  }
});
