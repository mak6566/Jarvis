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
let meterEnabled = false;   // on only when the popup explicitly asks (off by default)
let micBoost = true;        // far-field boost: AGC on, noise-suppression off, more alternatives

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

  // Some devices/drivers fail when explicit processing toggles are requested,
  // so fall back to a plain capture before declaring the mic unusable.
  // Far-field boost: AGC amplifies quiet/distant speech, noise-suppression is
  // off so the filter does not swallow it. Falls back to standard then plain.
  const attempts = micBoost
    ? [
        { autoGainControl: true, echoCancellation: true, noiseSuppression: false },
        { autoGainControl: true, echoCancellation: true, noiseSuppression: true },
        true,
      ]
    : [
        { autoGainControl: true, echoCancellation: true, noiseSuppression: true },
        true,
      ];
  let stream = null;
  let lastErr = null;
  for (const c of attempts) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: c });
      break;
    } catch (e) { lastErr = e; }
  }
  if (!stream) {
    const name = lastErr?.name || '';
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      fail('not-allowed', true);
    } else if (name === 'NotFoundError' || name === 'NotReadableError') {
      fail('audio-capture', true);
    } else {
      fail(lastErr?.message || String(lastErr), true);
    }
    return false;
  }
  // Release it immediately: SpeechRecognition opens its own stream and two
  // concurrent captures can make recognition end instantly on some builds.
  stream.getTracks().forEach((t) => t.stop());
  return true;
}

function buildRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    fail('SpeechRecognition API is not available in this browser.', true);
    return null;
  }
  const r = new SR();
  r.continuous = continuous;
  r.interimResults = true;  // live (unfinished) transcript → popup shows it while speaking
  r.maxAlternatives = micBoost ? 12 : 8;   // boosted: try even more candidates
  r.lang = currentLang;

  r.onstart = () => {
    recognizing = true;
    failStreak = 0;
    lastStartAt = Date.now();
    if (meterEnabled) startMeter();
    post('JARVIS_SR_STATE', { state: 'listening' });
  };

  r.onaudiostart = () => { failStreak = 0; };

  r.onresult = (e) => {
    let finalTranscript = '';
    let interimTranscript = '';
    const alts = [];
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i];
      const best = res[0]?.transcript || '';
      for (let j = 0; j < res.length; j++) {
        const tr = (res[j]?.transcript || '').trim();
        if (tr && !alts.includes(tr)) alts.push(tr);
      }
      if (res.isFinal) finalTranscript += best;
      else interimTranscript += best;
    }
    const inter = interimTranscript.trim();
    if (inter) post('JARVIS_SR_INTERIM', { text: inter, alts: alts.slice(0, 5) });
    if (finalTranscript.trim()) {
      failStreak = 0;
      post('JARVIS_SR_RESULT', {
        text: finalTranscript.trim(),
        alts: alts.length ? alts.slice(0, 5) : [finalTranscript.trim()],
      });
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
    const hadMeter = meterActive;
    stopMeter();
    post('JARVIS_SR_STATE', { state: 'idle' });
    if (!shouldRun || !continuous) return;

    // Died almost instantly → something is wrong; count it.
    if (Date.now() - lastStartAt < 800) {
      failStreak++;
      // The meter's second capture can break recognition on some Chrome
      // builds — disable it permanently rather than fight it.
      if (hadMeter) { meterDisabled = true; post('JARVIS_MIC_LEVEL', { level: 0 }); }
    }
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

async function startRecognition(lang, cont, meter, boost) {
  if (lang) currentLang = lang;
  if (typeof cont === 'boolean') continuous = cont;
  if (typeof meter === 'boolean') meterEnabled = meter;
  if (typeof boost === 'boolean') micBoost = boost;
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
  stopMeter();
  post('JARVIS_SR_STATE', { state: 'idle' });
  post('JARVIS_MIC_LEVEL', { level: 0 });
}

// ── Live mic level meter (visual feedback) ─────────────────────────
// A separate analyser stream reports the input volume to the popup so the
// user can see whether the microphone hears them. On Chrome builds where a
// second capture kills SpeechRecognition, the meter disables itself.
let meterCtx = null, meterStream = null, meterAnalyser = null, meterRAF = null;
let meterActive = false, meterDisabled = false;

function startMeter() {
  if (!meterEnabled || meterDisabled || meterCtx || meterActive) return;
  try {
    navigator.mediaDevices.getUserMedia({ audio: { autoGainControl: true, echoCancellation: true, noiseSuppression: true } }).then((stream) => {
      if (!shouldRun) { stream.getTracks().forEach((t) => t.stop()); return; }
      meterStream = stream;
      meterActive = true;
      meterCtx = new (window.AudioContext || window.webkitAudioContext)();
      const src = meterCtx.createMediaStreamSource(stream);
      meterAnalyser = meterCtx.createAnalyser();
      meterAnalyser.fftSize = 256;
      meterAnalyser.smoothingTimeConstant = 0.5;
      src.connect(meterAnalyser);
      const buf = new Uint8Array(meterAnalyser.frequencyBinCount);
      let last = 0;
      let frame = 0;
      const tick = () => {
        if (!meterAnalyser) return;
        if (frame++ % 3 !== 0) { meterRAF = requestAnimationFrame(tick); return; } // ~20fps, CPU-light
        meterAnalyser.getByteFrequencyData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length);
        const level = Math.min(1, (rms / 128) * 2.6); // display boost (whisper-friendly)
        const now = performance.now();
        if (now - last > 110) { last = now; post('JARVIS_MIC_LEVEL', { level }); }
        meterRAF = requestAnimationFrame(tick);
      };
      meterRAF = requestAnimationFrame(tick);
    }).catch(() => { meterDisabled = true; });
  } catch (_) { meterDisabled = true; }
}

function stopMeter() {
  meterActive = false;
  if (meterRAF) { cancelAnimationFrame(meterRAF); meterRAF = null; }
  if (meterAnalyser) { try { meterAnalyser.disconnect(); } catch (_) {} meterAnalyser = null; }
  if (meterCtx) { try { meterCtx.close(); } catch (_) {} meterCtx = null; }
  if (meterStream) { try { meterStream.getTracks().forEach((t) => t.stop()); } catch (_) {} meterStream = null; }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'JARVIS_SR_START') {
    startRecognition(message.lang, message.continuous, message.meter, message.boost);
    sendResponse({ ok: true });
  } else if (message.type === 'JARVIS_SR_STOP') {
    stopRecognition();
    sendResponse({ ok: true });
  } else if (message.type === 'JARVIS_SR_PING') {
    sendResponse({ ok: true, recognizing, shouldRun });
  }
});
