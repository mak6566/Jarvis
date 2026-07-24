/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * JARVIS — SidePanel Dashboard Logic (sidepanel.js)
 * Real-time UI: State indicator, To-Do checklist, Telemetry stream,
 * Risk confirmation modal, Settings management.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════════
  // SECTION 1: DOM REFERENCES
  // ═══════════════════════════════════════════════════════════════════════════════

  const els = {
    stateBadge: document.getElementById('stateBadge'),
    stateText: document.getElementById('stateText'),
    taskInput: document.getElementById('taskInput'),
    startBtn: document.getElementById('startBtn'),
    abortBtn: document.getElementById('abortBtn'),
    clearMemoryBtn: document.getElementById('clearMemoryBtn'),
    planList: document.getElementById('planList'),
    planProgress: document.getElementById('planProgress'),
    telemetryLog: document.getElementById('telemetryLog'),
    logCount: document.getElementById('logCount'),
    clearLogsBtn: document.getElementById('clearLogsBtn'),
    exportLogsBtn: document.getElementById('exportLogsBtn'),
    riskModal: document.getElementById('riskModal'),
    riskTierBadge: document.getElementById('riskTierBadge'),
    riskReason: document.getElementById('riskReason'),
    riskActionType: document.getElementById('riskActionType'),
    riskTarget: document.getElementById('riskTarget'),
    riskCellId: document.getElementById('riskCellId'),
    userNoteInput: document.getElementById('userNoteInput'),
    approveRiskBtn: document.getElementById('approveRiskBtn'),
    rejectRiskBtn: document.getElementById('rejectRiskBtn'),
    providerSelect: document.getElementById('providerSelect'),
    apiKeyInput: document.getElementById('apiKeyInput'),
    gridColsInput: document.getElementById('gridColsInput'),
    gridRowsInput: document.getElementById('gridRowsInput'),
    maxRetriesInput: document.getElementById('maxRetriesInput'),
    saveSettingsBtn: document.getElementById('saveSettingsBtn'),
    clearWebCacheBtn: document.getElementById('clearWebCacheBtn'),
    clearActionMemoryBtn: document.getElementById('clearActionMemoryBtn'),
    clearTelemetryBtn: document.getElementById('clearTelemetryBtn'),
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // SECTION 2: STATE
  // ═══════════════════════════════════════════════════════════════════════════════

  let currentPlan = [];
  let currentStep = 0;
  let pendingRiskCorrelationId = null;
  let logEntries = [];
  let isTaskRunning = false;

  // ═══════════════════════════════════════════════════════════════════════════════
  // SECTION 3: TAB SWITCHING
  // ═══════════════════════════════════════════════════════════════════════════════

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;

      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      document.getElementById(`panel-${target}`).classList.add('active');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SECTION 4: STATE MACHINE UI UPDATES
  // ═══════════════════════════════════════════════════════════════════════════════

  function updateStateBadge(state) {
    const stateName = state.toLowerCase();
    els.stateBadge.className = `state-badge state-${stateName}`;
    els.stateText.textContent = state;

    // Update button states
    const isIdle = state === 'IDLE' || state === 'DONE' || state === 'ERROR';
    els.startBtn.disabled = !isIdle;
    els.abortBtn.disabled = isIdle;
    isTaskRunning = !isIdle;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // SECTION 5: TASK CONTROL
  // ═══════════════════════════════════════════════════════════════════════════════

  async function startTask() {
    const task = els.taskInput.value.trim();
    if (!task) {
      showToast('Please enter a task description', 'warn');
      els.taskInput.focus();
      return;
    }

    try {
      // Get active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        throw new Error('No active tab found');
      }

      els.startBtn.disabled = true;
      els.startBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="spin"><circle cx="12" cy="12" r="10"/></svg> Starting...`;

      const response = await chrome.runtime.sendMessage({
        type: 'START_TASK',
        payload: { task, tabId: tab.id },
      });

      if (response?.success) {
        showToast('Task started successfully', 'info');
      } else {
        throw new Error(response?.error || 'Failed to start task');
      }

    } catch (err) {
      console.error('[Jarvis SidePanel] Start task failed:', err);
      showToast(`Failed to start: ${err.message}`, 'error');
      els.startBtn.disabled = false;
    } finally {
      els.startBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg> Start`;
    }
  }

  async function abortTask() {
    try {
      await chrome.runtime.sendMessage({
        type: 'ABORT_TASK',
        payload: { reason: 'User abort from SidePanel' },
      });
      showToast('Task aborted', 'warn');
    } catch (err) {
      showToast(`Abort failed: ${err.message}`, 'error');
    }
  }

  els.startBtn.addEventListener('click', startTask);
  els.abortBtn.addEventListener('click', abortTask);

  // Enter key to submit
  els.taskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      startTask();
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SECTION 6: PLAN / TO-DO RENDERING
  // ═══════════════════════════════════════════════════════════════════════════════

  function renderPlan(plan, activeStep = 0) {
    currentPlan = plan || [];
    currentStep = activeStep || 0;

    if (!currentPlan.length) {
      els.planList.innerHTML = `
        <li class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
          <p>No active plan. Start a task to see the execution roadmap.</p>
        </li>`;
      els.planProgress.textContent = '0 / 0';
      return;
    }

    els.planProgress.textContent = `${Math.min(currentStep, currentPlan.length)} / ${currentPlan.length}`;

    els.planList.innerHTML = currentPlan.map((step, idx) => {
      const isCompleted = idx < currentStep;
      const isCurrent = idx === currentStep;
      const checkIcon = isCompleted ? '✓' : '';

      return `
        <li class="plan-item ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}">
          <div class="plan-check">${checkIcon}</div>
          <div class="plan-content">
            <div class="plan-step-num">Step ${step.step || idx + 1}</div>
            <div class="plan-action">${step.action || 'Unknown'} ${step.target ? `→ ${step.target}` : ''}</div>
            ${step.value ? `<div class="plan-target">Value: "${String(step.value).substring(0, 60)}"</div>` : ''}
            ${step.reason ? `<div class="plan-reason">${step.reason}</div>` : ''}
          </div>
        </li>
      `;
    }).join('');

    // Auto-scroll to current step
    const currentEl = els.planList.querySelector('.current');
    if (currentEl) {
      currentEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // SECTION 7: TELEMETRY LOG STREAM
  // ═══════════════════════════════════════════════════════════════════════════════

  function appendLogEntry(entry) {
    logEntries.push(entry);

    // Remove empty state if present
    const emptyState = els.telemetryLog.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    const time = new Date(entry.ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const level = entry.level || 'info';
    const category = entry.category || 'SYS';
    const message = entry.message || '';

    let metaHtml = '';
    if (entry.meta && Object.keys(entry.meta).length > 0) {
      const metaStr = Object.entries(entry.meta)
        .map(([k, v]) => `${k}: ${JSON.stringify(v).substring(0, 120)}`)
        .join(' | ');
      metaHtml = `<div class="log-meta">${escapeHtml(metaStr)}</div>`;
    }

    const logEl = document.createElement('div');
    logEl.className = `log-entry level-${level}`;
    logEl.innerHTML = `
      <span class="log-time">${time}</span>
      <span class="log-category">${escapeHtml(category)}</span>
      <div>
        <span class="log-message">${escapeHtml(message)}</span>
        ${metaHtml}
      </div>
    `;

    els.telemetryLog.appendChild(logEl);
    els.telemetryLog.scrollTop = els.telemetryLog.scrollHeight;

    // Update count
    els.logCount.textContent = `${logEntries.length} logs`;

    // Trim old entries (keep last 500 in DOM)
    while (els.telemetryLog.children.length > 500) {
      els.telemetryLog.removeChild(els.telemetryLog.firstChild);
    }
  }

  function clearLogs() {
    logEntries = [];
    els.telemetryLog.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
        <p>Telemetry logs will appear here in real-time.</p>
      </div>`;
    els.logCount.textContent = '0 logs';
  }

  function exportLogs() {
    const data = JSON.stringify(logEntries, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jarvis-telemetry-${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Telemetry exported', 'info');
  }

  els.clearLogsBtn.addEventListener('click', clearLogs);
  els.exportLogsBtn.addEventListener('click', exportLogs);

  // ═══════════════════════════════════════════════════════════════════════════════
  // SECTION 8: RISK CONFIRMATION MODAL
  // ═══════════════════════════════════════════════════════════════════════════════

  function showRiskModal(payload) {
    pendingRiskCorrelationId = payload.correlationId;

    els.riskTierBadge.textContent = `${payload.tier} RISK`;
    els.riskTierBadge.className = `risk-tier-badge risk-tier-${payload.tier}`;
    els.riskReason.textContent = payload.reason;
    els.riskActionType.textContent = payload.action?.type || '—';
    els.riskTarget.textContent = payload.action?.target || '—';
    els.riskCellId.textContent = payload.action?.cellId !== undefined ? String(payload.action.cellId) : '—';
    els.userNoteInput.value = '';

    els.riskModal.classList.add('visible');
  }

  function hideRiskModal() {
    els.riskModal.classList.remove('visible');
    pendingRiskCorrelationId = null;
  }

  async function sendRiskResponse(approved) {
    if (!pendingRiskCorrelationId) return;

    try {
      await chrome.runtime.sendMessage({
        type: 'RISK_CONFIRMATION_RESPONSE',
        payload: {
          correlationId: pendingRiskCorrelationId,
          approved,
          userNote: els.userNoteInput.value.trim(),
        },
      });
      hideRiskModal();
      showToast(approved ? 'Action approved' : 'Action rejected', approved ? 'info' : 'warn');
    } catch (err) {
      showToast(`Confirmation failed: ${err.message}`, 'error');
    }
  }

  els.approveRiskBtn.addEventListener('click', () => sendRiskResponse(true));
  els.rejectRiskBtn.addEventListener('click', () => sendRiskResponse(false));

  // Close modal on overlay click
  els.riskModal.addEventListener('click', (e) => {
    if (e.target === els.riskModal) hideRiskModal();
  });

  // Keyboard shortcuts for modal
  document.addEventListener('keydown', (e) => {
    if (!els.riskModal.classList.contains('visible')) return;
    if (e.key === 'Escape') {
      sendRiskResponse(false);
    } else if (e.key === 'Enter' && e.ctrlKey) {
      sendRiskResponse(true);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SECTION 9: SETTINGS MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════════

  async function loadSettings() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
      if (response?.success && response.settings) {
        const s = response.settings;
        if (s.aiProvider) els.providerSelect.value = s.aiProvider;
        if (s.providerConfigs?.openai?.apiKey) els.apiKeyInput.value = s.providerConfigs.openai.apiKey;
        if (s.providerConfigs?.anthropic?.apiKey) els.apiKeyInput.value = s.providerConfigs.anthropic.apiKey;
        if (s.providerConfigs?.puter?.apiKey) els.apiKeyInput.value = s.providerConfigs.puter.apiKey;
        if (s.gridCols) els.gridColsInput.value = s.gridCols;
        if (s.gridRows) els.gridRowsInput.value = s.gridRows;
        if (s.maxRetries !== undefined) els.maxRetriesInput.value = s.maxRetries;
      }
    } catch (err) {
      console.error('[Jarvis SidePanel] Failed to load settings:', err);
    }
  }

  async function saveSettings() {
    const provider = els.providerSelect.value;
    const apiKey = els.apiKeyInput.value.trim();

    const settings = {
      aiProvider: provider,
      gridCols: parseInt(els.gridColsInput.value) || 40,
      gridRows: parseInt(els.gridRowsInput.value) || 30,
      maxRetries: parseInt(els.maxRetriesInput.value) || 3,
      providerConfigs: {
        [provider]: { apiKey },
      },
    };

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'UPDATE_SETTINGS',
        payload: settings,
      });

      if (response?.success) {
        showToast('Settings saved', 'info');
      } else {
        throw new Error(response?.error || 'Save failed');
      }
    } catch (err) {
      showToast(`Save failed: ${err.message}`, 'error');
    }
  }

  els.saveSettingsBtn.addEventListener('click', saveSettings);

  // ═══════════════════════════════════════════════════════════════════════════════
  // SECTION 10: MEMORY MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════════

  async function clearMemory(type) {
    try {
      await chrome.runtime.sendMessage({
        type: 'CLEAR_MEMORY',
        payload: { memoryType: type },
      });
      showToast(`${type} cleared`, 'info');
    } catch (err) {
      showToast(`Clear failed: ${err.message}`, 'error');
    }
  }

  els.clearMemoryBtn.addEventListener('click', () => clearMemory(null));
  els.clearWebCacheBtn.addEventListener('click', () => clearMemory('web_cache'));
  els.clearActionMemoryBtn.addEventListener('click', () => clearMemory('action_memory'));
  els.clearTelemetryBtn.addEventListener('click', () => clearMemory('telemetry'));

  // ═══════════════════════════════════════════════════════════════════════════════
  // SECTION 11: BACKGROUND MESSAGE LISTENERS
  // ═══════════════════════════════════════════════════════════════════════════════

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { type, payload } = message;

    switch (type) {
      case 'STATE_CHANGED': {
        updateStateBadge(payload.to);
        break;
      }

      case 'PLAN_UPDATED': {
        renderPlan(payload.plan, payload.currentStep);
        break;
      }

      case 'PLAN_PROGRESS': {
        renderPlan(currentPlan, payload.currentStep);
        break;
      }

      case 'telemetry': {
        appendLogEntry(payload);
        break;
      }

      case 'RISK_CONFIRMATION_REQUIRED': {
        showRiskModal(payload);
        break;
      }

      case 'TASK_COMPLETED': {
        showToast(`Task completed in ${formatDuration(payload.duration)}`, 'success');
        els.taskInput.value = '';
        break;
      }

      case 'TASK_ERROR': {
        showToast('Task failed — check telemetry for details', 'error');
        break;
      }

      default:
        // Unhandled message types
        break;
    }

    sendResponse({ received: true });
    return true;
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SECTION 12: UTILITY FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

  function formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const mins = Math.floor(ms / 60000);
    const secs = ((ms % 60000) / 1000).toFixed(0);
    return `${mins}m ${secs}s`;
  }

  function showToast(message, level = 'info') {
    // Simple toast implementation
    const toast = document.createElement('div');
    const colors = {
      info: 'var(--accent-blue)',
      success: 'var(--accent-green)',
      warn: 'var(--accent-yellow)',
      error: 'var(--accent-red)',
    };

    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--bg-secondary);
      border: 1px solid ${colors[level] || colors.info};
      color: var(--text-primary);
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      z-index: 10000;
      box-shadow: var(--shadow);
      animation: fadeIn 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // SECTION 13: INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════════

  async function init() {
    // Load current state from background
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
      if (response?.success) {
        updateStateBadge(response.state);
        if (response.plan?.length > 0) {
          renderPlan(response.plan, response.planIndex);
        }
      }
    } catch (err) {
      console.warn('[Jarvis SidePanel] Could not sync initial state:', err);
    }

    // Load settings
    await loadSettings();

    // Load existing telemetry
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_TELEMETRY' });
      if (response?.logs?.length > 0) {
        response.logs.slice(-100).forEach(appendLogEntry);
      }
    } catch (err) {
      // Telemetry may be empty — ignore
    }

    console.log('[Jarvis] SidePanel initialized');
  }

  // Add spin animation style
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin { to { transform: rotate(360deg); } }
    .spin { animation: spin 1s linear infinite; }
  `;
  document.head.appendChild(style);

  init();

})();
