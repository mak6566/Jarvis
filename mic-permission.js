const btn = document.getElementById('grantBtn');
const statusEl = document.getElementById('status');

btn.addEventListener('click', async () => {
  statusEl.textContent = 'Requesting permission...';
  statusEl.className = '';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    statusEl.textContent = '✓ Microphone enabled. You can close this window and return to the JARVIS popup.';
    statusEl.className = 'ok';
    btn.style.display = 'none';
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
        statusEl.textContent = 'Microphone is already enabled. You can close this window.';
        statusEl.className = 'ok';
        btn.style.display = 'none';
      }
    }
  } catch (_) {
    /* Permissions API for 'microphone' may be unsupported — ignore */
  }
})();
