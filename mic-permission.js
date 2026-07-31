const btn = document.getElementById('grantBtn');
const statusEl = document.getElementById('status');

function notifyGranted() {
  // Tells the background worker to recycle the offscreen audio document (it was
  // created before permission existed) and to wake the side panel listener.
  try {
    chrome.runtime.sendMessage({ type: 'JARVIS_MIC_GRANTED' }).catch(() => {});
  } catch (_) {}
}

btn.addEventListener('click', async () => {
  statusEl.textContent = 'Requesting permission...';
  statusEl.className = '';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    statusEl.textContent = '✓ Microphone enabled. JARVIS is starting to listen — you can close this tab.';
    statusEl.className = 'ok';
    btn.style.display = 'none';
    notifyGranted();
  } catch (e) {
    statusEl.textContent = `Error: ${e.message || e}. Check the browser microphone settings (the lock icon next to the address bar).`;
    statusEl.className = 'err';
  }
});

// If permission was already granted earlier, report it right away.
(async () => {
  try {
    if (navigator.permissions && navigator.permissions.query) {
      const p = await navigator.permissions.query({ name: 'microphone' });
      if (p.state === 'granted') {
        statusEl.textContent = 'Microphone is already enabled. You can close this tab.';
        statusEl.className = 'ok';
        btn.style.display = 'none';
        notifyGranted();
      }
      p.onchange = () => { if (p.state === 'granted') notifyGranted(); };
    }
  } catch (_) {
    /* Permissions API for 'microphone' may be unsupported — ignore */
  }
})();
