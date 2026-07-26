// JARVIS Background Service Worker
// Handles tab control commands from popup

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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

    default:
      throw new Error(`Unknown command: ${command}`);
  }
}
