// JARVIS Content Script
// Injected into all pages for direct DOM interaction

(function() {
  'use strict';

  // Listen for messages from popup or background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'DOM_COMMAND') {
      try {
        const result = executeDOMCommand(message.command, message.data);
        sendResponse({ success: true, result });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    }
    return true;
  });

  function executeDOMCommand(command, data = {}) {
    switch (command) {
      case 'click_element': {
        const el = document.querySelector(data.selector);
        if (el) { el.click(); return 'Clicked element'; }
        throw new Error(`Element not found: ${data.selector}`);
      }
      case 'fill_input': {
        const el = document.querySelector(data.selector);
        if (el) {
          el.value = data.value;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return 'Input filled';
        }
        throw new Error(`Input not found: ${data.selector}`);
      }
      case 'get_text': {
        const el = document.querySelector(data.selector || 'body');
        return el ? el.innerText.slice(0, 500) : '';
      }
      case 'highlight': {
        const el = document.querySelector(data.selector);
        if (el) {
          const prev = el.style.outline;
          el.style.outline = '3px solid #00f3ff';
          el.style.boxShadow = '0 0 12px #00f3ff';
          setTimeout(() => {
            el.style.outline = prev;
            el.style.boxShadow = '';
          }, 2000);
          return 'Element highlighted';
        }
        throw new Error('Element not found');
      }
      default:
        throw new Error(`Unknown DOM command: ${command}`);
    }
  }

  // Visual JARVIS overlay indicator (minimal, non-intrusive)
  function showJarvisIndicator(text) {
    let el = document.getElementById('jarvis-hud-indicator');
    if (!el) {
      el = document.createElement('div');
      el.id = 'jarvis-hud-indicator';
      el.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(8, 11, 16, 0.92);
        border: 1px solid #00f3ff;
        border-radius: 8px;
        padding: 10px 16px;
        color: #00f3ff;
        font-family: 'Courier New', monospace;
        font-size: 12px;
        letter-spacing: 1px;
        z-index: 2147483647;
        box-shadow: 0 0 20px rgba(0,243,255,0.3), inset 0 0 20px rgba(0,243,255,0.05);
        transition: opacity 0.3s;
        pointer-events: none;
        text-transform: uppercase;
      `;
      document.body.appendChild(el);
    }
    el.textContent = `⬡ JARVIS: ${text}`;
    el.style.opacity = '1';
    clearTimeout(el._timeout);
    el._timeout = setTimeout(() => { el.style.opacity = '0'; }, 3000);
  }

  // Listen for indicator messages
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'SHOW_INDICATOR') {
      showJarvisIndicator(message.text);
    }
  });
})();
