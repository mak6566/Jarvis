/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * JARVIS — Content Script Orchestrator (content.js)
 * Coordinates: Adaptive Grid, Semantic DOM Extraction, Element Scoring,
 * Smart Wait, Action Execution, and Background Messaging.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

(function() {
  'use strict';

  // ─── Guard against double-injection ───
  if (window.__JARVIS_CONTENT_SCRIPT_INJECTED__) return;
  window.__JARVIS_CONTENT_SCRIPT_INJECTED__ = true;

  // ─── Module References (loaded via manifest content_scripts array) ───
  const AdaptiveGrid = window.JarvisAdaptiveGrid;
  const SemanticDOMExtractor = window.JarvisDOMExtractor;
  const ElementScorer = window.JarvisElementScorer;

  if (!AdaptiveGrid || !SemanticDOMExtractor || !ElementScorer) {
    console.error('[Jarvis] Content script modules not loaded. Check manifest content_scripts order.');
    return;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // SECTION 1: INITIALIZATION & STATE
  // ═══════════════════════════════════════════════════════════════════════════════

  const grid = new AdaptiveGrid({ cols: 40, rows: 30, showLabels: true });
  const extractor = new SemanticDOMExtractor({ maxElements: 150, viewportOnly: true });
  const scorer = new ElementScorer();

  let currentState = 'IDLE';
  let isProcessing = false;
  let mutationObserver = null;
  let statusIndicator = null;
  let tooltip = null;

  // ═══════════════════════════════════════════════════════════════════════════════
  // SECTION 2: UI COMPONENTS (Status Indicator + Tooltip)
  // ═══════════════════════════════════════════════════════════════════════════════

  function createStatusIndicator() {
    if (document.getElementById('jarvis-status-indicator')) return;

    const el = document.createElement('div');
    el.id = 'jarvis-status-indicator';
    el.className = 'state-idle';
    el.innerHTML = 'J';
    el.title = 'Jarvis Agent — Click to toggle grid';

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      grid.toggle();
    });

    // Hover tooltip
    el.addEventListener('mouseenter', () => showTooltip(el, getStateDescription()));
    el.addEventListener('mouseleave', hideTooltip);

    document.body.appendChild(el);
    statusIndicator = el;
  }

  function createTooltip() {
    if (document.getElementById('jarvis-tooltip')) return;
    const el = document.createElement('div');
    el.id = 'jarvis-tooltip';
    document.body.appendChild(el);
    tooltip = el;
  }

  function showTooltip(anchorEl, text) {
    if (!tooltip) return;
    const rect = anchorEl.getBoundingClientRect();
    tooltip.textContent = text;
    tooltip.classList.add('visible');
    tooltip.style.left = `${rect.left - tooltip.offsetWidth - 10}px`;
    tooltip.style.top = `${rect.top}px`;
  }

  function hideTooltip() {
    if (tooltip) tooltip.classList.remove('visible');
  }

  function updateStatusIndicator(state) {
    if (!statusIndicator) return;
    currentState = state;
    statusIndicator.className = `state-${state.toLowerCase()}`;
    statusIndicator.title = `Jarvis — ${state}`;
  }

  function getStateDescription() {
    const descriptions = {
      IDLE: 'Ready — waiting for task',
      PLANNING: 'Planning task decomposition...',
      OBSERVING: 'Observing page state & grid...',
      THINKING: 'AI reasoning in progress...',
      VALIDATING_RISK: 'Validating action risk...',
      EXECUTING: 'Executing DOM action...',
      VALIDATING_RESULT: 'Validating action result...',
      DONE: 'Task completed ✓',
      ERROR: 'Error occurred ✗',
      WAITING_FOR_USER: 'Waiting for your confirmation',
    };
    return descriptions[currentState] || currentState;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // SECTION 3: SMART WAIT — MutationObserver + readyState Monitoring
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Smart Wait: Resolves when DOM is stable (no mutations for stabilityMs)
   * AND document is fully loaded.
   * @param {Object} options
   * @param {number} options.stabilityMs — Milliseconds of no mutations (default: 800)
   * @param {number} options.timeoutMs — Maximum wait time (default: 15000)
   * @param {boolean} options.observeSubtree — Watch entire document (default: true)
   * @returns {Promise<{stable: boolean, mutations: number, durationMs: number}>}
   */
  async function smartWait(options = {}) {
    const stabilityMs = options.stabilityMs || 800;
    const timeoutMs = options.timeoutMs || 15000;
    const observeSubtree = options.observeSubtree !== false;

    return new Promise((resolve) => {
      const startTime = performance.now();
      let mutationCount = 0;
      let stabilityTimer = null;
      let resolved = false;

      // If document not ready, wait for it first
      if (document.readyState !== 'complete') {
        window.addEventListener('load', checkStability, { once: true });
      }

      function checkStability() {
        if (resolved) return;

        // Clear previous timer
        if (stabilityTimer) clearTimeout(stabilityTimer);

        // Set new stability timer
        stabilityTimer = setTimeout(() => {
          if (resolved) return;
          resolved = true;
          if (mutationObserver) {
            mutationObserver.disconnect();
            mutationObserver = null;
          }
          resolve({
            stable: true,
            mutations: mutationCount,
            durationMs: Math.round(performance.now() - startTime),
          });
        }, stabilityMs);
      }

      // Setup MutationObserver
      mutationObserver = new MutationObserver((mutations) => {
        mutationCount += mutations.length;
        checkStability();
      });

      mutationObserver.observe(document.body || document.documentElement, {
        childList: true,
        subtree: observeSubtree,
        attributes: true,
        characterData: false,
      });

      // Initial stability check
      checkStability();

      // Hard timeout
      setTimeout(() => {
        if (resolved) return;
        resolved = true;
        if (mutationObserver) {
          mutationObserver.disconnect();
          mutationObserver = null;
        }
        resolve({
          stable: false,
          mutations: mutationCount,
          durationMs: Math.round(performance.now() - startTime),
        });
      }, timeoutMs);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // SECTION 4: SCREENSHOT CAPTURE
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Capture current viewport as base64 PNG via chrome.tabs.captureVisibleTab.
   * Note: This requires activeTab permission and must be called from background.
   * Content script requests it; background executes and returns.
   * For standalone content script, we use a canvas-based fallback.
   */
  async function captureScreenshot() {
    try {
      // Request screenshot from background (preferred, handles permissions)
      const response = await chrome.runtime.sendMessage({
        type: 'REQUEST_SCREENSHOT',
      });
      if (response?.success && response.dataUrl) {
        return response.dataUrl;
      }
    } catch (err) {
      // Fallback: canvas-based capture (limited, same-origin only)
      console.warn('[Jarvis] Background screenshot failed, using fallback:', err.message);
    }

    // Canvas fallback
    try {
      const canvas = document.createElement('canvas');
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawWindow(window, 0, 0, window.innerWidth, window.innerHeight, 'rgb(255,255,255)');
      return canvas.toDataURL('image/png');
    } catch (err) {
      console.error('[Jarvis] Screenshot fallback failed:', err.message);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // SECTION 5: ACTION EXECUTION ENGINE
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Execute a DOM action with advanced element scoring.
   * @param {Object} action
   * @param {string} action.actionType — CLICK, TYPE, SCROLL, SUBMIT, SELECT, WAIT, HOVER
   * @param {number} action.cellId — Target grid cell
   * @param {string} action.value — Value for TYPE/SELECT
   * @param {boolean} action.useAdvancedScoring — Use elementsFromPoint scoring
   * @returns {Promise<{success: boolean, details: Object}>}
   */
  async function executeAction(action) {
    const { actionType, cellId, value, useAdvancedScoring = true } = action;

    try {
      // Highlight target cell on grid
      grid.highlightCell(cellId, 'rgba(16, 185, 129, 0.4)', 3000);

      let targetElement = null;
      let scoreDetails = null;

      if (useAdvancedScoring && cellId !== undefined && cellId !== null) {
        const center = grid.getCellCenter(cellId);
        if (!center) {
          throw new Error(`Invalid cell ID: ${cellId}`);
        }

        const preferredTag = actionType === 'CLICK' ? 'button' : 
                            actionType === 'TYPE' ? 'input' : null;

        const result = scorer.findBestElementAt(center.x, center.y, { preferredTag });

        if (!result) {
          throw new Error(`No interactive element found at cell ${cellId}`);
        }

        targetElement = result.element;
        scoreDetails = result.details;

        // Highlight the chosen element
        scorer.highlightElement(targetElement, 3000);

        console.log('[Jarvis] Element scored:', scoreDetails);
      }

      // Execute based on action type
      const execResult = await dispatchAction(actionType, targetElement, value);

      return {
        success: true,
        details: {
          actionType,
          cellId,
          elementTag: targetElement?.tagName,
          elementId: targetElement?.id,
          scoreDetails,
          ...execResult,
        },
      };

    } catch (err) {
      console.error('[Jarvis] Action execution failed:', err);
      return {
        success: false,
        details: { actionType, cellId, error: err.message },
      };
    }
  }

  /**
   * Dispatch a native DOM action.
   */
  async function dispatchAction(actionType, element, value) {
    switch (actionType) {
      case 'CLICK':
        return dispatchClick(element);
      case 'TYPE':
        return dispatchType(element, value);
      case 'SCROLL':
        return dispatchScroll(element, value);
      case 'SUBMIT':
        return dispatchSubmit(element);
      case 'SELECT':
        return dispatchSelect(element, value);
      case 'HOVER':
        return dispatchHover(element);
      case 'WAIT':
        return dispatchWait(value);
      case 'NAVIGATE':
        return dispatchNavigate(value);
      default:
        throw new Error(`Unknown action type: ${actionType}`);
    }
  }

  function dispatchClick(element) {
    if (!element) throw new Error('CLICK requires a target element');

    // Scroll into view if needed
    element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });

    // Native click with proper event sequence
    const mousedown = new MouseEvent('mousedown', {
      bubbles: true, cancelable: true, view: window, button: 0,
    });
    const mouseup = new MouseEvent('mouseup', {
      bubbles: true, cancelable: true, view: window, button: 0,
    });
    const click = new MouseEvent('click', {
      bubbles: true, cancelable: true, view: window, button: 0,
    });

    element.dispatchEvent(mousedown);
    element.dispatchEvent(mouseup);
    element.dispatchEvent(click);

    // Fallback: element.click()
    if (!click.defaultPrevented) {
      element.click();
    }

    return { method: 'native_click' };
  }

  function dispatchType(element, value) {
    if (!element) throw new Error('TYPE requires a target element');
    if (value === undefined) throw new Error('TYPE requires a value');

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element.focus();

    // Clear existing value for inputs
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      element.value = '';
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Type character by character with realistic timing
    const chars = String(value).split('');
    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];

      const keydown = new KeyboardEvent('keydown', {
        key: char, code: `Key${char.toUpperCase()}`, bubbles: true, cancelable: true,
      });
      const keypress = new KeyboardEvent('keypress', {
        key: char, charCode: char.charCodeAt(0), bubbles: true, cancelable: true,
      });
      const input = new InputEvent('input', {
        data: char, inputType: 'insertText', bubbles: true, cancelable: true,
      });
      const keyup = new KeyboardEvent('keyup', {
        key: char, code: `Key${char.toUpperCase()}`, bubbles: true, cancelable: true,
      });

      element.dispatchEvent(keydown);
      element.dispatchEvent(keypress);

      if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.isContentEditable) {
        if (element.isContentEditable) {
          element.textContent += char;
        } else {
          element.value += char;
        }
      }

      element.dispatchEvent(input);
      element.dispatchEvent(keyup);
    }

    // Final change event
    element.dispatchEvent(new Event('change', { bubbles: true }));

    return { method: 'native_type', length: chars.length };
  }

  function dispatchScroll(element, value) {
    const direction = value || 'down';
    const amount = typeof value === 'number' ? value : window.innerHeight * 0.75;

    if (element) {
      element.scrollBy({ top: direction === 'up' ? -amount : amount, behavior: 'smooth' });
    } else {
      window.scrollBy({ top: direction === 'up' ? -amount : amount, behavior: 'smooth' });
    }

    return { method: 'native_scroll', direction, amount };
  }

  function dispatchSubmit(element) {
    if (element) {
      // Try clicking the element first (if it's a submit button)
      if (element.type === 'submit' || element.tagName === 'BUTTON') {
        return dispatchClick(element);
      }
      // Try form submission
      const form = element.closest('form');
      if (form) {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        form.submit();
        return { method: 'form_submit' };
      }
    }

    // Fallback: find nearest form and submit
    const forms = document.querySelectorAll('form');
    if (forms.length > 0) {
      forms[0].submit();
      return { method: 'fallback_form_submit' };
    }

    throw new Error('No form found for SUBMIT action');
  }

  function dispatchSelect(element, value) {
    if (!element || element.tagName !== 'SELECT') {
      throw new Error('SELECT requires a <select> element');
    }

    const options = Array.from(element.options);
    const targetOption = options.find(o => 
      o.value === value || o.textContent.trim() === value
    );

    if (!targetOption) {
      throw new Error(`Option "${value}" not found in select`);
    }

    element.value = targetOption.value;
    element.dispatchEvent(new Event('change', { bubbles: true }));

    return { method: 'native_select', selectedValue: targetOption.value };
  }

  function dispatchHover(element) {
    if (!element) throw new Error('HOVER requires a target element');

    const mouseenter = new MouseEvent('mouseenter', { bubbles: true, cancelable: true });
    const mouseover = new MouseEvent('mouseover', { bubbles: true, cancelable: true });

    element.dispatchEvent(mouseenter);
    element.dispatchEvent(mouseover);

    return { method: 'native_hover' };
  }

  async function dispatchWait(value) {
    const ms = parseInt(value) || 1000;
    await new Promise(r => setTimeout(r, ms));
    return { method: 'wait', durationMs: ms };
  }

  function dispatchNavigate(url) {
    if (!url) throw new Error('NAVIGATE requires a URL');
    window.location.href = url;
    return { method: 'navigate', url };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // SECTION 6: SEMANTIC VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Validate the result of an action by checking for error messages,
   * unexpected states, and semantic outcomes.
   * @param {Object} options
   * @param {boolean} options.checkForErrors — Look for error indicators
   * @param {string} options.expectedOutcome — Semantic description of expected result
   * @returns {Object} Validation result
   */
  function validateResult(options = {}) {
    const { checkForErrors = true, expectedOutcome = '' } = options;

    const result = {
      isUnexpectedState: false,
      errorMessages: [],
      urlChanged: false,
      pageTitle: document.title,
      currentUrl: window.location.href,
      domMutated: false,
    };

    if (checkForErrors) {
      // Common error message patterns
      const errorSelectors = [
        '[role="alert"]',
        '.error',
        '.alert-danger',
        '.form-error',
        '.notification--error',
        '[data-testid*="error"]',
        '.Toastify__toast--error',
        '.snackbar-error',
      ];

      const errorTexts = [
        /wrong password/i,
        /invalid credentials/i,
        /login failed/i,
        /error occurred/i,
        /something went wrong/i,
        /please try again/i,
        /access denied/i,
        /unauthorized/i,
        /not found/i,
        /failed to/i,
      ];

      // Check error selectors
      for (const selector of errorSelectors) {
        const els = document.querySelectorAll(selector);
        for (const el of els) {
          const text = (el.innerText || el.textContent || '').trim();
          if (text && text.length > 0 && text.length < 500) {
            result.errorMessages.push(text);
          }
        }
      }

      // Check error text patterns across the page
      const bodyText = document.body.innerText || '';
      for (const pattern of errorTexts) {
        if (pattern.test(bodyText)) {
          const match = bodyText.match(pattern);
          if (match) {
            // Extract surrounding context
            const idx = bodyText.indexOf(match[0]);
            const context = bodyText.substring(Math.max(0, idx - 50), idx + 100);
            result.errorMessages.push(context.trim());
          }
        }
      }

      // Deduplicate
      result.errorMessages = [...new Set(result.errorMessages)];
    }

    // Check for unexpected states (e.g., still on login page after "login" action)
    if (expectedOutcome) {
      const lowerExpected = expectedOutcome.toLowerCase();
      const lowerTitle = document.title.toLowerCase();
      const lowerUrl = window.location.href.toLowerCase();

      // Simple heuristic: if expecting navigation but URL hasn't changed
      if (lowerExpected.includes('navigate') || lowerExpected.includes('go to')) {
        // This would need previous URL comparison; simplified here
      }
    }

    result.isUnexpectedState = result.errorMessages.length > 0;

    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // SECTION 7: MESSAGE HANDLERS (Background ↔ Content Script)
  // ═══════════════════════════════════════════════════════════════════════════════

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
      try {
        const { type, payload } = message;

        switch (type) {
          // ─── Background → Content Script: Capture State ───
          case 'CAPTURE_STATE': {
            updateStatusIndicator('OBSERVING');

            // Smart wait for DOM stability
            const waitResult = await smartWait({ stabilityMs: 600, timeoutMs: 10000 });

            // Show grid during capture
            grid.show();

            // Extract DOM
            const domSnapshot = extractor.extract();

            // Capture screenshot (async)
            const screenshot = await captureScreenshot();

            // Export grid data
            const gridData = grid.exportData();

            updateStatusIndicator('IDLE');

            sendResponse({
              success: true,
              domSnapshot,
              gridData,
              screenshot,
              waitResult,
            });
            break;
          }

          // ─── Background → Content Script: Execute Action ───
          case 'EXECUTE_ACTION': {
            updateStatusIndicator('EXECUTING');
            const result = await executeAction(payload);
            updateStatusIndicator('IDLE');
            sendResponse(result);
            break;
          }

          // ─── Background → Content Script: Validate Result ───
          case 'VALIDATE_RESULT': {
            updateStatusIndicator('VALIDATING_RESULT');
            const result = validateResult(payload);
            updateStatusIndicator('IDLE');
            sendResponse({
              success: true,
              ...result,
            });
            break;
          }

          // ─── Background → Content Script: State Update ───
          case 'UPDATE_STATE_INDICATOR': {
            updateStatusIndicator(payload.state);
            sendResponse({ success: true });
            break;
          }

          // ─── Background → Content Script: Grid Control ───
          case 'GRID_SHOW': {
            grid.show();
            sendResponse({ success: true });
            break;
          }
          case 'GRID_HIDE': {
            grid.hide();
            sendResponse({ success: true });
            break;
          }
          case 'GRID_TOGGLE': {
            grid.toggle();
            sendResponse({ success: true, visible: grid.isVisible });
            break;
          }

          // ─── Background → Content Script: Highlight Cell ───
          case 'HIGHLIGHT_CELL': {
            grid.highlightCell(payload.cellId, payload.color, payload.durationMs);
            sendResponse({ success: true });
            break;
          }

          // ─── Ping / Keep-alive ───
          case 'PING': {
            sendResponse({ success: true, pong: true, url: window.location.href });
            break;
          }

          default: {
            sendResponse({ success: false, error: `Unknown message type: ${type}` });
          }
        }
      } catch (err) {
        console.error('[Jarvis Content] Message handler error:', err);
        sendResponse({ success: false, error: err.message });
      }
    })();

    return true; // Async response
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SECTION 8: INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════════

  function init() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
      return;
    }

    createStatusIndicator();
    createTooltip();

    console.log('[Jarvis] Content script initialized on', window.location.href);

    // Notify background that content script is ready
    chrome.runtime.sendMessage({
      type: 'DOM_STATE_REPORT',
      payload: {
        event: 'CONTENT_SCRIPT_READY',
        url: window.location.href,
        title: document.title,
        timestamp: Date.now(),
      },
    }).catch(() => {});
  }

  // Start initialization
  init();

})();
