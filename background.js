/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * JARVIS — Autonomous Multimodal Web Agent
 * Background Service Worker (Orchestrator & Brain)
 * Manifest V3 | Production-Ready | Phase 1: Core Logic
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Responsibilities:
 *   • Deterministic State Machine — strict phase-gated execution flow
 *   • Risk Engine — 4-tier action classification with user confirmation gates
 *   • Abstract askAI() Layer — provider-agnostic LLM interface (Puter.js / Ling 3.0 / OpenAI / Anthropic)
 *   • Dual Memory Systems — Web Site Cache + Action Memory (learned sequences)
 *   • Telemetry & Diagnostics — structured logging for every step
 *   • Cross-layer Messaging — SidePanel ↔ Background ↔ Content Script
 */

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: CONSTANTS & ENUMS
// ═══════════════════════════════════════════════════════════════════════════════

/** @enum {string} Agent lifecycle states — deterministic, strictly ordered */
const AgentState = Object.freeze({
  IDLE:              'IDLE',              // Awaiting user task input
  PLANNING:          'PLANNING',          // Decomposing task into sub-goals
  OBSERVING:         'OBSERVING',         // Capturing DOM state + adaptive grid
  THINKING:          'THINKING',          // LLM reasoning over observation
  VALIDATING_RISK:   'VALIDATING_RISK',   // Risk classification + user gate
  EXECUTING:         'EXECUTING',         // DOM action injection via content script
  VALIDATING_RESULT: 'VALIDATING_RESULT', // Semantic outcome verification
  DONE:              'DONE',              // Task completed successfully
  ERROR:             'ERROR',             // Fatal / unrecoverable failure
  WAITING_FOR_USER:  'WAITING_FOR_USER',  // Paused for explicit user confirmation
});

/** @enum {string} Risk tiers per architectural specification */
const RiskTier = Object.freeze({
  LOW:      'LOW',      // Immediate execution (scroll, hover, info clicks)
  MEDIUM:   'MEDIUM',   // Logged execution (type search, product click)
  HIGH:     'HIGH',     // Requires explicit SidePanel confirmation (submit, payment, settings)
  CRITICAL: 'CRITICAL', // Blocked + double-confirmation dialog (delete account, wipe data)
});

/** @enum {string} Supported DOM action types */
const ActionType = Object.freeze({
  CLICK:       'CLICK',
  TYPE:        'TYPE',
  SCROLL:      'SCROLL',
  HOVER:       'HOVER',
  SUBMIT:      'SUBMIT',
  NAVIGATE:    'NAVIGATE',
  SELECT:      'SELECT',
  WAIT:        'WAIT',
  CAPTURE:     'CAPTURE',
});

/** Valid state transitions: fromState → Set<toState> */
const VALID_TRANSITIONS = Object.freeze({
  [AgentState.IDLE]:              new Set([AgentState.PLANNING]),
  [AgentState.PLANNING]:          new Set([AgentState.OBSERVING, AgentState.ERROR]),
  [AgentState.OBSERVING]:         new Set([AgentState.THINKING, AgentState.ERROR]),
  [AgentState.THINKING]:          new Set([AgentState.VALIDATING_RISK, AgentState.ERROR]),
  [AgentState.VALIDATING_RISK]:   new Set([AgentState.EXECUTING, AgentState.WAITING_FOR_USER, AgentState.ERROR]),
  [AgentState.WAITING_FOR_USER]:  new Set([AgentState.EXECUTING, AgentState.ERROR]),
  [AgentState.EXECUTING]:         new Set([AgentState.VALIDATING_RESULT, AgentState.ERROR]),
  [AgentState.VALIDATING_RESULT]: new Set([AgentState.OBSERVING, AgentState.DONE, AgentState.ERROR]),
  [AgentState.DONE]:              new Set([AgentState.IDLE]),
  [AgentState.ERROR]:             new Set([AgentState.IDLE]),
});

/** Risk classification rules: actionType + context → RiskTier */
const RISK_RULES = [
  // CRITICAL: Destructive, irreversible actions
  { tier: RiskTier.CRITICAL, match: (a) => a.actionType === ActionType.SUBMIT && a.context?.isDestructive === true },
  { tier: RiskTier.CRITICAL, match: (a) => a.actionType === ActionType.CLICK && /delete|remove|erase|wipe|uninstall/i.test(a.targetDescription || '') },

  // HIGH: Form submission, payment, settings changes
  { tier: RiskTier.HIGH,     match: (a) => a.actionType === ActionType.SUBMIT },
  { tier: RiskTier.HIGH,     match: (a) => a.actionType === ActionType.TYPE && a.context?.isPasswordField === true },
  { tier: RiskTier.HIGH,     match: (a) => a.actionType === ActionType.CLICK && /pay|checkout|purchase|confirm|save.*settings/i.test(a.targetDescription || '') },
  { tier: RiskTier.HIGH,     match: (a) => a.actionType === ActionType.NAVIGATE && a.context?.isExternalDomain === true },

  // MEDIUM: Input interactions, navigation within site
  { tier: RiskTier.MEDIUM,   match: (a) => a.actionType === ActionType.TYPE },
  { tier: RiskTier.MEDIUM,   match: (a) => a.actionType === ActionType.CLICK && a.context?.isProductLink === true },
  { tier: RiskTier.MEDIUM,   match: (a) => a.actionType === ActionType.SELECT },

  // LOW: Safe, non-mutating actions (default fallback)
  { tier: RiskTier.LOW,      match: () => true },
];

/** Storage keys for chrome.storage.local */
const StorageKeys = Object.freeze({
  WEB_CACHE:      'jarvis_web_cache_v1',
  ACTION_MEMORY:  'jarvis_action_memory_v1',
  TELEMETRY:      'jarvis_telemetry_v1',
  SETTINGS:       'jarvis_settings_v1',
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: TELEMETRY & DIAGNOSTICS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * TelemetryLogger — structured, append-only diagnostic logging.
 * Every state transition, AI call, and action execution is recorded.
 */
class TelemetryLogger {
  constructor() {
    this.sessionId = this.#generateSessionId();
    this.buffer = [];
    this.flushIntervalMs = 5000;
    this.#startAutoFlush();
  }

  #generateSessionId() {
    return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  #startAutoFlush() {
    setInterval(() => this.flush(), this.flushIntervalMs);
  }

  /**
   * Log a structured event.
   * @param {string} level — 'debug' | 'info' | 'warn' | 'error'
   * @param {string} category — e.g., 'STATE', 'RISK', 'AI', 'EXEC', 'MEMORY'
   * @param {string} message — human-readable description
   * @param {Object} [meta] — contextual data (state, latency, tokens, etc.)
   */
  log(level, category, message, meta = {}) {
    const entry = {
      ts: Date.now(),
      sessionId: this.sessionId,
      level,
      category,
      message,
      meta: { ...meta },
    };
    this.buffer.push(entry);

    // Also emit to SidePanel in real-time for live dashboard
    this.#broadcastToSidePanel('telemetry', entry);

    // Console output for developer debugging
    const prefix = `[${category}]`;
    if (level === 'error') console.error(prefix, message, meta);
    else if (level === 'warn') console.warn(prefix, message, meta);
    else console.log(prefix, message, meta);
  }

  /** Persist buffered logs to chrome.storage.local */
  async flush() {
    if (this.buffer.length === 0) return;
    const batch = this.buffer.splice(0, this.buffer.length);
    try {
      const result = await chrome.storage.local.get(StorageKeys.TELEMETRY);
      const existing = result[StorageKeys.TELEMETRY] || [];
      const updated = existing.concat(batch);
      // Keep last 10,000 entries to prevent unbounded growth
      const trimmed = updated.slice(-10000);
      await chrome.storage.local.set({ [StorageKeys.TELEMETRY]: trimmed });
    } catch (err) {
      console.error('[Telemetry] Flush failed:', err);
      // Re-buffer on failure
      this.buffer.unshift(...batch);
    }
  }

  #broadcastToSidePanel(type, payload) {
    chrome.runtime.sendMessage({ type, payload }).catch(() => {
      // SidePanel may be closed — silently ignore
    });
  }
}

// Global telemetry instance
const telemetry = new TelemetryLogger();

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3: DUAL MEMORY SYSTEMS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * WebSiteCache — Domain-specific element position caching.
 * Maps known domains → frequently-used element selectors/cell positions.
 * Reduces expensive DOM scanning on repeat visits.
 */
class WebSiteCache {
  constructor() {
    this.cache = new Map(); // in-memory hot cache
    this.dirty = false;
    this.#loadFromStorage();
  }

  async #loadFromStorage() {
    try {
      const result = await chrome.storage.local.get(StorageKeys.WEB_CACHE);
      const stored = result[StorageKeys.WEB_CACHE] || {};
      this.cache = new Map(Object.entries(stored));
      telemetry.log('info', 'MEMORY', 'WebSiteCache loaded', { domains: this.cache.size });
    } catch (err) {
      telemetry.log('error', 'MEMORY', 'WebSiteCache load failed', { error: err.message });
    }
  }

  async #persist() {
    if (!this.dirty) return;
    try {
      const obj = Object.fromEntries(this.cache);
      await chrome.storage.local.set({ [StorageKeys.WEB_CACHE]: obj });
      this.dirty = false;
    } catch (err) {
      telemetry.log('error', 'MEMORY', 'WebSiteCache persist failed', { error: err.message });
    }
  }

  /**
   * Retrieve cached element info for a domain + element key.
   * @param {string} domain — e.g., "github.com"
   * @param {string} key — semantic key, e.g., "search_bar", "login_button"
   * @returns {Object|null} Cached entry or null
   */
  get(domain, key) {
    const domainCache = this.cache.get(domain);
    if (!domainCache) return null;
    const entry = domainCache[key];
    if (!entry) return null;
    // TTL check: entries expire after 30 days
    const TTL_MS = 30 * 24 * 60 * 60 * 1000;
    if (Date.now() - entry.cachedAt > TTL_MS) {
      delete domainCache[key];
      this.dirty = true;
      return null;
    }
    telemetry.log('debug', 'MEMORY', 'WebSiteCache hit', { domain, key });
    return entry.data;
  }

  /**
   * Store element info for a domain.
   * @param {string} domain
   * @param {string} key
   * @param {Object} data — e.g., { cellId: 142, selector: "input[name='q']", confidence: 0.95 }
   */
  set(domain, key, data) {
    if (!this.cache.has(domain)) {
      this.cache.set(domain, {});
    }
    this.cache.get(domain)[key] = {
      data,
      cachedAt: Date.now(),
      hitCount: 0,
    };
    this.dirty = true;
    telemetry.log('debug', 'MEMORY', 'WebSiteCache stored', { domain, key });
    // Debounced persist
    this.#debouncedPersist();
  }

  /**
   * Record a successful hit to boost confidence.
   */
  recordHit(domain, key) {
    const domainCache = this.cache.get(domain);
    if (domainCache && domainCache[key]) {
      domainCache[key].hitCount = (domainCache[key].hitCount || 0) + 1;
      this.dirty = true;
    }
  }

  #debouncedPersist() {
    if (this._persistTimer) clearTimeout(this._persistTimer);
    this._persistTimer = setTimeout(() => this.#persist(), 2000);
  }
}

/**
 * ActionMemory — Database of successful execution sequences.
 * Maps task fingerprints → ordered step sequences.
 * Enables deterministic replay without AI token consumption.
 */
class ActionMemory {
  constructor() {
    this.memory = new Map();
    this.maxEntries = 500; // Prevent unbounded growth
    this.#loadFromStorage();
  }

  async #loadFromStorage() {
    try {
      const result = await chrome.storage.local.get(StorageKeys.ACTION_MEMORY);
      const stored = result[StorageKeys.ACTION_MEMORY] || {};
      this.memory = new Map(Object.entries(stored));
      telemetry.log('info', 'MEMORY', 'ActionMemory loaded', { sequences: this.memory.size });
    } catch (err) {
      telemetry.log('error', 'MEMORY', 'ActionMemory load failed', { error: err.message });
    }
  }

  async #persist() {
    try {
      const obj = Object.fromEntries(this.memory);
      await chrome.storage.local.set({ [StorageKeys.ACTION_MEMORY]: obj });
    } catch (err) {
      telemetry.log('error', 'MEMORY', 'ActionMemory persist failed', { error: err.message });
    }
  }

  /**
   * Create a deterministic fingerprint from a task description.
   * Normalizes whitespace, lowercases, and extracts key verbs/nouns.
   */
  #fingerprint(task) {
    const normalized = task
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    // Simple hash for demo — production would use semantic embedding
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      hash = ((hash << 5) - hash) + normalized.charCodeAt(i);
      hash |= 0;
    }
    return `fp_${hash}`;
  }

  /**
   * Check if a successful sequence exists for this task.
   * @param {string} taskDescription
   * @returns {Object|null} { steps: Array, successRate: number, lastUsed: number }
   */
  find(taskDescription) {
    const fp = this.#fingerprint(taskDescription);
    const entry = this.memory.get(fp);
    if (!entry) return null;
    telemetry.log('info', 'MEMORY', 'ActionMemory hit', { fingerprint: fp, steps: entry.steps.length });
    return entry;
  }

  /**
   * Store a successful execution sequence.
   * @param {string} taskDescription
   * @param {Array} steps — ordered action objects
   * @param {number} durationMs — total execution time
   */
  store(taskDescription, steps, durationMs) {
    const fp = this.#fingerprint(taskDescription);
    const existing = this.memory.get(fp);

    const entry = {
      steps: steps.map(s => ({ ...s })), // Deep copy
      successCount: existing ? existing.successCount + 1 : 1,
      failureCount: existing ? existing.failureCount : 0,
      firstSeen: existing ? existing.firstSeen : Date.now(),
      lastUsed: Date.now(),
      avgDurationMs: existing
        ? Math.round((existing.avgDurationMs * existing.successCount + durationMs) / (existing.successCount + 1))
        : durationMs,
    };

    this.memory.set(fp, entry);

    // Enforce max entries via LRU eviction
    if (this.memory.size > this.maxEntries) {
      const oldest = [...this.memory.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed)[0];
      this.memory.delete(oldest[0]);
      telemetry.log('debug', 'MEMORY', 'ActionMemory LRU eviction', { evicted: oldest[0] });
    }

    this.#persist();
    telemetry.log('info', 'MEMORY', 'ActionMemory stored', { fingerprint: fp, steps: steps.length });
  }

  /**
   * Record a failure to lower confidence in this sequence.
   */
  recordFailure(taskDescription) {
    const fp = this.#fingerprint(taskDescription);
    const entry = this.memory.get(fp);
    if (entry) {
      entry.failureCount = (entry.failureCount || 0) + 1;
      this.#persist();
    }
  }

  /**
   * Get success rate for a sequence (0.0 — 1.0).
   */
  getConfidence(taskDescription) {
    const fp = this.#fingerprint(taskDescription);
    const entry = this.memory.get(fp);
    if (!entry) return 0;
    const total = entry.successCount + entry.failureCount;
    return total === 0 ? 0 : entry.successCount / total;
  }
}

// Global memory instances
const webSiteCache = new WebSiteCache();
const actionMemory = new ActionMemory();

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4: ABSTRACT askAI() LAYER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * AIProvider — Abstract base class for LLM providers.
 * All concrete providers must implement `chat(messages, options)`.
 */
class AIProvider {
  constructor(name, config = {}) {
    this.name = name;
    this.config = config;
  }

  async chat(messages, options = {}) {
    throw new Error('AIProvider.chat() must be implemented by subclass');
  }

  /** Estimate token count (rough heuristic) */
  estimateTokens(text) {
    return Math.ceil(text.length / 4);
  }
}

/**
 * PuterProvider — Integration with Puter.js / Ling 3.0 Flash.
 * Assumes Puter.js is available in the SidePanel context or loaded via script.
 * Falls back to fetch-based REST API if SDK is unavailable.
 */
class PuterProvider extends AIProvider {
  constructor(config = {}) {
    super('puter', config);
    this.baseUrl = config.baseUrl || 'https://api.puter.com';
    this.model = config.model || 'ling-3.0-flash';
    this.apiKey = config.apiKey || null;
  }

  async chat(messages, options = {}) {
    const startTime = performance.now();

    try {
      // Attempt 1: Use Puter.js SDK if available (injected in SidePanel)
      if (typeof puter !== 'undefined' && puter.ai?.chat) {
        const response = await puter.ai.chat(messages, {
          model: this.model,
          temperature: options.temperature ?? 0.2,
          max_tokens: options.maxTokens ?? 4096,
        });

        const latency = Math.round(performance.now() - startTime);
        telemetry.log('info', 'AI', 'Puter.js SDK success', { 
          model: this.model, latency, provider: this.name 
        });

        return {
          content: response?.message?.content || response?.content || '',
          usage: response?.usage || { prompt_tokens: 0, completion_tokens: 0 },
          latency,
          provider: this.name,
        };
      }

      // Attempt 2: REST API fallback
      const payload = {
        model: this.model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 4096,
      };

      const headers = {
        'Content-Type': 'application/json',
      };
      if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

      const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Puter API error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      const latency = Math.round(performance.now() - startTime);

      telemetry.log('info', 'AI', 'Puter REST API success', { 
        model: this.model, latency, provider: this.name 
      });

      return {
        content: data.choices?.[0]?.message?.content || '',
        usage: data.usage || { prompt_tokens: 0, completion_tokens: 0 },
        latency,
        provider: this.name,
      };

    } catch (err) {
      telemetry.log('error', 'AI', 'Puter provider failed', { 
        error: err.message, model: this.model 
      });
      throw err;
    }
  }
}

/**
 * OpenAIProvider — OpenAI GPT-4o / GPT-4o-mini integration.
 */
class OpenAIProvider extends AIProvider {
  constructor(config = {}) {
    super('openai', config);
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    this.model = config.model || 'gpt-4o';
    this.apiKey = config.apiKey || '';
  }

  async chat(messages, options = {}) {
    const startTime = performance.now();

    try {
      const payload = {
        model: this.model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 4096,
      };

      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`OpenAI API error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      const latency = Math.round(performance.now() - startTime);

      telemetry.log('info', 'AI', 'OpenAI success', { 
        model: this.model, latency, provider: this.name 
      });

      return {
        content: data.choices?.[0]?.message?.content || '',
        usage: data.usage || { prompt_tokens: 0, completion_tokens: 0 },
        latency,
        provider: this.name,
      };

    } catch (err) {
      telemetry.log('error', 'AI', 'OpenAI provider failed', { 
        error: err.message, model: this.model 
      });
      throw err;
    }
  }
}

/**
 * AnthropicProvider — Claude 3.5 Sonnet integration.
 */
class AnthropicProvider extends AIProvider {
  constructor(config = {}) {
    super('anthropic', config);
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com/v1';
    this.model = config.model || 'claude-3-5-sonnet-20241022';
    this.apiKey = config.apiKey || '';
  }

  async chat(messages, options = {}) {
    const startTime = performance.now();

    try {
      // Anthropic uses "user"/"assistant" roles but system is a top-level param
      const systemMsg = messages.find(m => m.role === 'system');
      const chatMessages = messages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role, content: m.content }));

      const payload = {
        model: this.model,
        messages: chatMessages,
        system: systemMsg?.content || '',
        max_tokens: options.maxTokens ?? 4096,
        temperature: options.temperature ?? 0.2,
      };

      const res = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Anthropic API error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      const latency = Math.round(performance.now() - startTime);

      telemetry.log('info', 'AI', 'Anthropic success', { 
        model: this.model, latency, provider: this.name 
      });

      return {
        content: data.content?.[0]?.text || '',
        usage: data.usage || { input_tokens: 0, output_tokens: 0 },
        latency,
        provider: this.name,
      };

    } catch (err) {
      telemetry.log('error', 'AI', 'Anthropic provider failed', { 
        error: err.message, model: this.model 
      });
      throw err;
    }
  }
}

/**
 * MockProvider — Deterministic mock for testing and offline development.
 * Returns canned responses based on message content patterns.
 */
class MockProvider extends AIProvider {
  constructor(config = {}) {
    super('mock', config);
  }

  async chat(messages, options = {}) {
    const lastMsg = messages[messages.length - 1]?.content || '';
    const startTime = performance.now();

    // Simulate network latency
    await new Promise(r => setTimeout(r, 300));

    let response = '';
    if (lastMsg.includes('plan')) {
      response = JSON.stringify({
        plan: [
          { step: 1, action: 'NAVIGATE', target: 'search page', reason: 'Need to access search functionality' },
          { step: 2, action: 'TYPE', target: 'search input', value: 'example query', reason: 'Enter search terms' },
          { step: 3, action: 'SUBMIT', target: 'search form', reason: 'Execute search' },
        ]
      });
    } else if (lastMsg.includes('observe') || lastMsg.includes('grid')) {
      response = JSON.stringify({
        thought: 'Page loaded with search form visible. Grid cell 142 contains the search input.',
        action: 'CLICK',
        targetCell: 142,
        confidence: 0.94,
      });
    } else {
      response = JSON.stringify({
        thought: 'Task completed successfully.',
        action: 'DONE',
        confidence: 0.99,
      });
    }

    const latency = Math.round(performance.now() - startTime);
    telemetry.log('info', 'AI', 'MockProvider response', { latency, provider: this.name });

    return {
      content: response,
      usage: { prompt_tokens: this.estimateTokens(lastMsg), completion_tokens: this.estimateTokens(response) },
      latency,
      provider: this.name,
    };
  }
}

/**
 * AIProviderRegistry — Manages provider selection, fallback chains, and configuration.
 */
class AIProviderRegistry {
  constructor() {
    this.providers = new Map();
    this.fallbackChain = ['puter', 'openai', 'anthropic', 'mock'];
    this.activeProviderName = 'mock'; // Default to mock until configured

    // Register built-in providers
    this.register('puter', PuterProvider);
    this.register('openai', OpenAIProvider);
    this.register('anthropic', AnthropicProvider);
    this.register('mock', MockProvider);

    this.#loadSettings();
  }

  register(name, ProviderClass) {
    this.providers.set(name, ProviderClass);
  }

  async #loadSettings() {
    try {
      const result = await chrome.storage.local.get(StorageKeys.SETTINGS);
      const settings = result[StorageKeys.SETTINGS] || {};
      if (settings.aiProvider) this.activeProviderName = settings.aiProvider;
      if (settings.fallbackChain) this.fallbackChain = settings.fallbackChain;
      telemetry.log('info', 'AI', 'Provider settings loaded', { 
        active: this.activeProviderName, chain: this.fallbackChain 
      });
    } catch (err) {
      telemetry.log('warn', 'AI', 'Failed to load provider settings', { error: err.message });
    }
  }

  /**
   * Get configured provider instance with API keys.
   */
  async getProvider(name = null) {
    const providerName = name || this.activeProviderName;
    const ProviderClass = this.providers.get(providerName);
    if (!ProviderClass) throw new Error(`Unknown AI provider: ${providerName}`);

    const result = await chrome.storage.local.get(StorageKeys.SETTINGS);
    const settings = result[StorageKeys.SETTINGS] || {};
    const config = settings.providerConfigs?.[providerName] || {};

    return new ProviderClass(config);
  }

  /**
   * Execute chat with automatic fallback across the provider chain.
   */
  async askAI(messages, options = {}) {
    const errors = [];
    const chain = options.provider ? [options.provider] : this.fallbackChain;

    for (const providerName of chain) {
      try {
        const provider = await this.getProvider(providerName);
        telemetry.log('info', 'AI', `Attempting provider: ${providerName}`, { 
          messageCount: messages.length 
        });

        const response = await provider.chat(messages, options);

        // Log token usage
        telemetry.log('info', 'AI', 'Response received', {
          provider: providerName,
          latency: response.latency,
          promptTokens: response.usage?.prompt_tokens || response.usage?.input_tokens,
          completionTokens: response.usage?.completion_tokens || response.usage?.output_tokens,
        });

        return response;

      } catch (err) {
        telemetry.log('warn', 'AI', `Provider ${providerName} failed, trying fallback`, { 
          error: err.message 
        });
        errors.push({ provider: providerName, error: err.message });
      }
    }

    throw new Error(`All AI providers failed: ${JSON.stringify(errors)}`);
  }
}

// Global AI registry
const aiRegistry = new AIProviderRegistry();

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5: RISK ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * RiskEngine — Multi-tier action classification with mandatory confirmation gates.
 * Implements the 4-tier security model from the architectural specification.
 */
class RiskEngine {
  constructor() {
    this.pendingConfirmations = new Map(); // correlationId → { resolve, reject, action, tier }
  }

  /**
   * Classify an action into one of four risk tiers.
   * @param {Object} action — { actionType, targetDescription, context }
   * @returns {{ tier: RiskTier, reason: string, requiresConfirmation: boolean }}
   */
  classify(action) {
    for (const rule of RISK_RULES) {
      if (rule.match(action)) {
        const requiresConfirmation = rule.tier === RiskTier.HIGH || rule.tier === RiskTier.CRITICAL;
        const reason = this.#generateReason(action, rule.tier);

        telemetry.log('info', 'RISK', `Action classified as ${rule.tier}`, {
          actionType: action.actionType,
          target: action.targetDescription,
          reason,
        });

        return { tier: rule.tier, reason, requiresConfirmation };
      }
    }

    // Should never reach here (LOW is catch-all), but defensive fallback
    return { tier: RiskTier.LOW, reason: 'Default low-risk classification', requiresConfirmation: false };
  }

  #generateReason(action, tier) {
    const reasons = {
      [RiskTier.LOW]: `Safe action: ${action.actionType} on non-critical element`,
      [RiskTier.MEDIUM]: `Moderate risk: ${action.actionType} may alter page state`,
      [RiskTier.HIGH]: `High risk: ${action.actionType} could trigger ${action.context?.consequence || 'significant change'}`,
      [RiskTier.CRITICAL]: `CRITICAL: ${action.actionType} is destructive or irreversible`,
    };
    return reasons[tier] || 'Unknown risk classification';
  }

  /**
   * Request user confirmation for HIGH/CRITICAL actions via SidePanel.
   * Returns a Promise that resolves when user approves or rejects.
   */
  async requestConfirmation(action, riskAssessment) {
    const correlationId = `confirm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    return new Promise((resolve, reject) => {
      // Store promise handlers for async resolution
      this.pendingConfirmations.set(correlationId, { resolve, reject, action, riskAssessment });

      // Send confirmation request to SidePanel
      const payload = {
        correlationId,
        tier: riskAssessment.tier,
        reason: riskAssessment.reason,
        action: {
          type: action.actionType,
          target: action.targetDescription,
          cellId: action.cellId,
          value: action.value,
        },
        timestamp: Date.now(),
      };

      chrome.runtime.sendMessage({
        type: 'RISK_CONFIRMATION_REQUIRED',
        payload,
      }).catch(err => {
        telemetry.log('error', 'RISK', 'Failed to send confirmation request', { 
          correlationId, error: err.message 
        });
        this.pendingConfirmations.delete(correlationId);
        reject(new Error('SidePanel unavailable for confirmation'));
      });

      // Auto-reject after timeout (2 minutes) to prevent indefinite blocking
      setTimeout(() => {
        if (this.pendingConfirmations.has(correlationId)) {
          this.pendingConfirmations.delete(correlationId);
          reject(new Error('Confirmation timeout: user did not respond within 2 minutes'));
        }
      }, 120000);
    });
  }

  /**
   * Handle user response from SidePanel.
   * @param {string} correlationId
   * @param {boolean} approved
   * @param {string} [userNote] — optional user-provided context
   */
  handleUserResponse(correlationId, approved, userNote = '') {
    const pending = this.pendingConfirmations.get(correlationId);
    if (!pending) {
      telemetry.log('warn', 'RISK', 'Received confirmation for unknown correlationId', { correlationId });
      return;
    }

    this.pendingConfirmations.delete(correlationId);

    telemetry.log('info', 'RISK', `User ${approved ? 'APPROVED' : 'REJECTED'} action`, {
      correlationId,
      tier: pending.riskAssessment.tier,
      actionType: pending.action.actionType,
      userNote,
    });

    if (approved) {
      pending.resolve({ approved: true, userNote });
    } else {
      pending.reject(new Error(`User rejected ${pending.riskAssessment.tier} risk action: ${pending.riskAssessment.reason}`));
    }
  }

  /**
   * Check if there are any pending confirmations.
   */
  hasPendingConfirmations() {
    return this.pendingConfirmations.size > 0;
  }
}

const riskEngine = new RiskEngine();

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6: DETERMINISTIC STATE MACHINE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * StateMachine — Strict deterministic lifecycle controller.
 * Every transition is validated, logged, and broadcast.
 * Guards against illegal state jumps and provides recovery hooks.
 */
class StateMachine {
  constructor() {
    this.state = AgentState.IDLE;
    this.stateHistory = [];        // Ordered log of all transitions
    this.currentTask = null;       // Active task descriptor
    this.plan = [];                // Hierarchical step plan
    this.planIndex = 0;            // Current plan step
    this.context = {               // Ephemeral execution context
      tabId: null,
      url: null,
      domain: null,
      screenshot: null,
      domSnapshot: null,
      gridData: null,
      actionHistory: [],
      retryCount: 0,
      maxRetries: 3,
    };
    this.listeners = new Set();
  }

  /** Subscribe to state changes */
  onTransition(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  #notify(from, to, reason, meta = {}) {
    const transition = { ts: Date.now(), from, to, reason, meta };
    this.stateHistory.push(transition);

    telemetry.log('info', 'STATE', `${from} → ${to}`, { reason, ...meta });

    // Broadcast to all listeners (SidePanel UI, telemetry, etc.)
    this.listeners.forEach(cb => {
      try { cb(transition); } catch (e) { /* ignore listener errors */ }
    });

    // Broadcast via Chrome runtime messaging
    chrome.runtime.sendMessage({
      type: 'STATE_CHANGED',
      payload: transition,
    }).catch(() => {});
  }

  /**
   * Attempt a state transition. Throws on invalid transitions.
   * @param {AgentState} newState
   * @param {string} reason — human-readable justification
   * @param {Object} meta — contextual metadata
   */
  transition(newState, reason = '', meta = {}) {
    const validTargets = VALID_TRANSITIONS[this.state];

    if (!validTargets || !validTargets.has(newState)) {
      const msg = `Illegal state transition: ${this.state} → ${newState}. Reason: ${reason}`;
      telemetry.log('error', 'STATE', msg, { attempted: newState, current: this.state });
      throw new Error(msg);
    }

    const from = this.state;
    this.state = newState;
    this.#notify(from, newState, reason, meta);
  }

  /** Safe transition that catches errors and moves to ERROR state */
  safeTransition(newState, reason = '', meta = {}) {
    try {
      this.transition(newState, reason, meta);
      return true;
    } catch (err) {
      const from = this.state;
      telemetry.log('error', 'STATE', `Transition failed, entering ERROR state`, { 
        error: err.message, attempted: newState 
      });
      this.state = AgentState.ERROR;
      this.#notify(from, AgentState.ERROR, `Transition error: ${err.message}`, meta);
      return false;
    }
  }

  /** Reset machine to IDLE, clearing ephemeral context */
  reset(reason = 'User reset') {
    const from = this.state;
    this.state = AgentState.IDLE;
    this.currentTask = null;
    this.plan = [];
    this.planIndex = 0;
    this.context = {
      tabId: null,
      url: null,
      domain: null,
      screenshot: null,
      domSnapshot: null,
      gridData: null,
      actionHistory: [],
      retryCount: 0,
      maxRetries: 3,
    };
    this.#notify(from, AgentState.IDLE, reason);
  }

  /** Get current state */
  getState() {
    return this.state;
  }

  /** Get full state history */
  getHistory() {
    return [...this.stateHistory];
  }
}

const stateMachine = new StateMachine();

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 7: ORCHESTRATOR — ReAct Cycle Implementation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Orchestrator — Core controller implementing the full ReAct cycle.
 * Coordinates State Machine, Risk Engine, AI Layer, Memory, and Content Script.
 */
class Orchestrator {
  constructor() {
    this.isRunning = false;
    this.abortController = null;
    this.taskStartTime = 0;

    // Bind state machine listener for reactive behavior
    stateMachine.onTransition((t) => this.#onStateChange(t));
  }

  #onStateChange(transition) {
    // Reactive dispatch based on new state
    switch (transition.to) {
      case AgentState.PLANNING:
        this.#handlePlanning();
        break;
      case AgentState.OBSERVING:
        this.#handleObserving();
        break;
      case AgentState.THINKING:
        this.#handleThinking();
        break;
      case AgentState.VALIDATING_RISK:
        this.#handleRiskValidation();
        break;
      case AgentState.EXECUTING:
        this.#handleExecution();
        break;
      case AgentState.VALIDATING_RESULT:
        this.#handleResultValidation();
        break;
      case AgentState.DONE:
        this.#handleCompletion();
        break;
      case AgentState.ERROR:
        this.#handleError();
        break;
    }
  }

  /**
   * Start a new task. Entry point from SidePanel.
   * @param {string} taskDescription — natural language user goal
   * @param {number} tabId — target Chrome tab
   */
  async startTask(taskDescription, tabId) {
    if (stateMachine.getState() !== AgentState.IDLE) {
      throw new Error(`Cannot start task: agent is in ${stateMachine.getState()} state`);
    }

    this.isRunning = true;
    this.taskStartTime = Date.now();
    this.abortController = new AbortController();

    // Initialize context
    stateMachine.currentTask = taskDescription;
    stateMachine.context.tabId = tabId;

    // Step 1: Check Action Memory for known sequences
    const memorized = actionMemory.find(taskDescription);
    if (memorized && actionMemory.getConfidence(taskDescription) > 0.8) {
      telemetry.log('info', 'ORCH', 'ActionMemory hit — loading memorized sequence', {
        steps: memorized.steps.length,
        confidence: actionMemory.getConfidence(taskDescription),
      });
      stateMachine.plan = memorized.steps;
      stateMachine.transition(AgentState.OBSERVING, 'Memorized sequence found, skipping planning');
      return;
    }

    // Step 2: Enter planning phase
    stateMachine.transition(AgentState.PLANNING, 'New task received, beginning planning');
  }

  /**
   * PLANNING: Decompose task into hierarchical sub-goals via LLM.
   */
  async #handlePlanning() {
    try {
      const systemPrompt = `You are Jarvis, an autonomous web agent. Decompose the user's task into a JSON array of steps. Each step must have: step (number), action (one of: NAVIGATE, CLICK, TYPE, SCROLL, SUBMIT, SELECT, WAIT), target (description), value (optional), reason (why this step is needed). Respond ONLY with valid JSON.`;

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Task: "${stateMachine.currentTask}"\nCurrent URL: ${stateMachine.context.url || 'unknown'}\n\nProvide the execution plan as JSON.` },
      ];

      const response = await aiRegistry.askAI(messages, { temperature: 0.1, maxTokens: 2048 });
      const planData = this.#safeJsonParse(response.content);

      if (!planData?.plan || !Array.isArray(planData.plan)) {
        throw new Error('Invalid plan structure from AI');
      }

      stateMachine.plan = planData.plan;
      stateMachine.planIndex = 0;

      telemetry.log('info', 'ORCH', 'Plan generated', { steps: planData.plan.length });

      // Broadcast plan to SidePanel for To-Do visualization
      chrome.runtime.sendMessage({
        type: 'PLAN_UPDATED',
        payload: { plan: stateMachine.plan, currentStep: 0 },
      }).catch(() => {});

      stateMachine.transition(AgentState.OBSERVING, 'Plan created, beginning observation');

    } catch (err) {
      telemetry.log('error', 'ORCH', 'Planning failed', { error: err.message });
      stateMachine.safeTransition(AgentState.ERROR, `Planning failed: ${err.message}`);
    }
  }

  /**
   * OBSERVING: Instruct Content Script to capture DOM state + adaptive grid.
   */
  async #handleObserving() {
    try {
      const tabId = stateMachine.context.tabId;

      // Get current tab info
      const tab = await chrome.tabs.get(tabId);
      stateMachine.context.url = tab.url;
      stateMachine.context.domain = new URL(tab.url).hostname;

      // Inject / message Content Script to capture state
      const observation = await chrome.tabs.sendMessage(tabId, {
        type: 'CAPTURE_STATE',
        payload: {
          includeGrid: true,
          includeDomText: true,
          includeScreenshot: true,
        },
      });

      stateMachine.context.domSnapshot = observation.domSnapshot;
      stateMachine.context.gridData = observation.gridData;
      stateMachine.context.screenshot = observation.screenshot; // base64

      telemetry.log('info', 'ORCH', 'Observation complete', {
        domain: stateMachine.context.domain,
        gridCells: observation.gridData?.cells?.length || 0,
        interactiveElements: observation.domSnapshot?.elements?.length || 0,
      });

      stateMachine.transition(AgentState.THINKING, 'Observation captured, beginning reasoning');

    } catch (err) {
      telemetry.log('error', 'ORCH', 'Observation failed', { error: err.message });
      stateMachine.safeTransition(AgentState.ERROR, `Observation failed: ${err.message}`);
    }
  }

  /**
   * THINKING: Send observation to LLM for action decision.
   */
  async #handleThinking() {
    try {
      const ctx = stateMachine.context;
      const currentStep = stateMachine.plan[stateMachine.planIndex];

      // Build context-optimized prompt (summary + last 3 actions)
      const historySummary = this.#buildHistorySummary(ctx.actionHistory);

      const systemPrompt = `You are Jarvis, an autonomous web agent. Based on the current page state, grid overlay, and task history, decide the next DOM action. Respond with JSON: { thought, action (CLICK|TYPE|SCROLL|SUBMIT|SELECT|WAIT|DONE), targetCell (number), value (string, optional), confidence (0.0-1.0) }. Be precise.`;

      const userPrompt = `Task: "${stateMachine.currentTask}"\nCurrent Step: ${currentStep?.step || 'N/A'} — ${currentStep?.action || ''} ${currentStep?.target || ''}\nURL: ${ctx.url}\nDomain: ${ctx.domain}\n\nGrid Data: ${JSON.stringify(ctx.gridData)}\n\nDOM Elements (top 50): ${JSON.stringify(ctx.domSnapshot?.elements?.slice(0, 50))}\n\nAction History: ${historySummary}\n\nWhat is the next action?`;

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      const response = await aiRegistry.askAI(messages, { temperature: 0.2, maxTokens: 1024 });
      const decision = this.#safeJsonParse(response.content);

      if (!decision?.action) {
        throw new Error('Invalid decision structure from AI');
      }

      stateMachine.context.pendingDecision = decision;

      telemetry.log('info', 'ORCH', 'AI decision received', {
        action: decision.action,
        targetCell: decision.targetCell,
        confidence: decision.confidence,
        thought: decision.thought?.substring(0, 200),
      });

      stateMachine.transition(AgentState.VALIDATING_RISK, 'Decision received, validating risk');

    } catch (err) {
      telemetry.log('error', 'ORCH', 'Thinking failed', { error: err.message });

      // Self-correction: retry up to maxRetries
      if (stateMachine.context.retryCount < stateMachine.context.maxRetries) {
        stateMachine.context.retryCount++;
        telemetry.log('warn', 'ORCH', `Self-correction attempt ${stateMachine.context.retryCount}/${stateMachine.context.maxRetries}`);
        stateMachine.safeTransition(AgentState.OBSERVING, 'Retrying after thinking failure');
      } else {
        stateMachine.safeTransition(AgentState.ERROR, `Thinking failed after ${stateMachine.context.maxRetries} retries: ${err.message}`);
      }
    }
  }

  /**
   * VALIDATING_RISK: Classify action risk and gate if necessary.
   */
  async #handleRiskValidation() {
    try {
      const decision = stateMachine.context.pendingDecision;
      const action = {
        actionType: decision.action,
        targetDescription: decision.targetCell ? `cell ${decision.targetCell}` : 'unknown',
        cellId: decision.targetCell,
        value: decision.value,
        context: {
          isDestructive: /delete|remove|erase|wipe/i.test(decision.thought || ''),
          isPasswordField: /password|passwd|pwd/i.test(decision.thought || ''),
          isProductLink: /product|item|buy|cart/i.test(decision.thought || ''),
          isExternalDomain: false, // Would need comparison with current domain
          consequence: decision.thought || '',
        },
      };

      const risk = riskEngine.classify(action);

      if (risk.tier === RiskTier.CRITICAL) {
        telemetry.log('error', 'ORCH', 'CRITICAL action blocked', { reason: risk.reason });
        throw new Error(`CRITICAL action blocked: ${risk.reason}`);
      }

      if (risk.requiresConfirmation) {
        telemetry.log('info', 'ORCH', 'HIGH risk action — requesting user confirmation', { reason: risk.reason });
        stateMachine.transition(AgentState.WAITING_FOR_USER, 'Awaiting user confirmation for high-risk action');

        const confirmation = await riskEngine.requestConfirmation(action, risk);

        if (!confirmation.approved) {
          throw new Error('User rejected high-risk action');
        }

        telemetry.log('info', 'ORCH', 'User confirmed high-risk action', { userNote: confirmation.userNote });
      }

      stateMachine.context.pendingAction = action;
      stateMachine.transition(AgentState.EXECUTING, 'Risk validated, proceeding to execution');

    } catch (err) {
      telemetry.log('error', 'ORCH', 'Risk validation failed', { error: err.message });
      stateMachine.safeTransition(AgentState.ERROR, `Risk validation failed: ${err.message}`);
    }
  }

  /**
   * EXECUTING: Send action to Content Script for DOM injection.
   */
  async #handleExecution() {
    try {
      const action = stateMachine.context.pendingAction;
      const tabId = stateMachine.context.tabId;

      telemetry.log('info', 'ORCH', 'Executing action', {
        type: action.actionType,
        cellId: action.cellId,
        value: action.value?.substring(0, 50),
      });

      // Send execution command to Content Script
      const result = await chrome.tabs.sendMessage(tabId, {
        type: 'EXECUTE_ACTION',
        payload: {
          actionType: action.actionType,
          cellId: action.cellId,
          value: action.value,
          useAdvancedScoring: true,
        },
      });

      // Record in history
      stateMachine.context.actionHistory.push({
        action: action.actionType,
        cellId: action.cellId,
        value: action.value,
        timestamp: Date.now(),
        result: result.success ? 'success' : 'failure',
      });

      telemetry.log('info', 'ORCH', 'Action executed', { success: result.success, details: result.details });

      stateMachine.transition(AgentState.VALIDATING_RESULT, 'Action executed, validating result');

    } catch (err) {
      telemetry.log('error', 'ORCH', 'Execution failed', { error: err.message });
      stateMachine.safeTransition(AgentState.ERROR, `Execution failed: ${err.message}`);
    }
  }

  /**
   * VALIDATING_RESULT: Semantic outcome verification (not just URL/DOM mutation).
   */
  async #handleResultValidation() {
    try {
      const tabId = stateMachine.context.tabId;

      // Request post-action state from Content Script
      const validation = await chrome.tabs.sendMessage(tabId, {
        type: 'VALIDATE_RESULT',
        payload: {
          checkForErrors: true,
          expectedOutcome: stateMachine.context.pendingDecision?.thought || '',
        },
      });

      // Semantic validation: detect error messages, wrong states, etc.
      const hasErrors = validation.errorMessages?.length > 0;
      const unexpectedState = validation.isUnexpectedState === true;

      if (hasErrors || unexpectedState) {
        const errorMsg = validation.errorMessages?.join('; ') || 'Unexpected page state detected';
        telemetry.log('warn', 'ORCH', 'Semantic validation failed', { errors: errorMsg });

        // Self-correction loop
        if (stateMachine.context.retryCount < stateMachine.context.maxRetries) {
          stateMachine.context.retryCount++;
          telemetry.log('info', 'ORCH', `Self-correction: re-observing after validation failure`);
          stateMachine.safeTransition(AgentState.OBSERVING, `Validation failed: ${errorMsg}. Retrying...`);
          return;
        }

        throw new Error(`Semantic validation failed after ${stateMachine.context.maxRetries} retries: ${errorMsg}`);
      }

      telemetry.log('info', 'ORCH', 'Semantic validation passed');
      stateMachine.context.retryCount = 0; // Reset retry counter on success

      // Advance plan
      stateMachine.planIndex++;

      // Update SidePanel progress
      chrome.runtime.sendMessage({
        type: 'PLAN_PROGRESS',
        payload: { currentStep: stateMachine.planIndex, totalSteps: stateMachine.plan.length },
      }).catch(() => {});

      // Check if plan is complete
      if (stateMachine.planIndex >= stateMachine.plan.length) {
        stateMachine.transition(AgentState.DONE, 'All plan steps completed successfully');
      } else {
        stateMachine.transition(AgentState.OBSERVING, 'Step complete, observing for next action');
      }

    } catch (err) {
      telemetry.log('error', 'ORCH', 'Result validation failed', { error: err.message });
      stateMachine.safeTransition(AgentState.ERROR, `Result validation failed: ${err.message}`);
    }
  }

  /**
   * DONE: Task completed — store in Action Memory, clean up.
   */
  async #handleCompletion() {
    try {
      const duration = Date.now() - this.taskStartTime;
      const steps = stateMachine.context.actionHistory;

      // Store successful sequence in Action Memory
      actionMemory.store(stateMachine.currentTask, steps, duration);

      telemetry.log('info', 'ORCH', 'Task completed', {
        task: stateMachine.currentTask,
        durationMs: duration,
        steps: steps.length,
      });

      // Notify SidePanel
      chrome.runtime.sendMessage({
        type: 'TASK_COMPLETED',
        payload: {
          task: stateMachine.currentTask,
          duration,
          steps,
        },
      }).catch(() => {});

      // Reset after brief delay to allow UI to show completion
      setTimeout(() => stateMachine.reset('Task completed'), 2000);

    } catch (err) {
      telemetry.log('error', 'ORCH', 'Completion handler error', { error: err.message });
      stateMachine.reset('Completion error');
    }
  }

  /**
   * ERROR: Handle failure, attempt recovery or full reset.
   */
  async #handleError() {
    telemetry.log('error', 'ORCH', 'Entering ERROR state', {
      task: stateMachine.currentTask,
      history: stateMachine.getHistory().slice(-5),
    });

    // Notify SidePanel with error details
    chrome.runtime.sendMessage({
      type: 'TASK_ERROR',
      payload: {
        task: stateMachine.currentTask,
        stateHistory: stateMachine.getHistory(),
      },
    }).catch(() => {});

    // Auto-reset after 5 seconds to allow user to see error
    setTimeout(() => stateMachine.reset('Auto-reset after error'), 5000);
  }

  /** Build condensed history summary for context window optimization */
  #buildHistorySummary(actions) {
    if (actions.length === 0) return 'No previous actions.';

    const recent = actions.slice(-3);
    const older = actions.slice(0, -3);

    let summary = '';
    if (older.length > 0) {
      summary += `Prior: ${older.length} actions completed. `;
    }
    summary += 'Recent:\n' + recent.map((a, i) => 
      `  ${i + 1}. ${a.action} on cell ${a.cellId || 'N/A'} → ${a.result}`
    ).join('\n');

    return summary;
  }

  /** Safe JSON parser with fallback */
  #safeJsonParse(text) {
    try {
      // Try to extract JSON from markdown code blocks
      const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      const cleanText = codeBlockMatch ? codeBlockMatch[1].trim() : text.trim();
      return JSON.parse(cleanText);
    } catch (err) {
      telemetry.log('warn', 'ORCH', 'JSON parse failed, attempting recovery', { text: text.substring(0, 200) });
      // Fallback: return raw text wrapped
      return { raw: text, parseError: err.message };
    }
  }

  /** Abort current task */
  abort(reason = 'User abort') {
    if (this.abortController) {
      this.abortController.abort(reason);
    }
    this.isRunning = false;
    stateMachine.reset(reason);
    telemetry.log('info', 'ORCH', 'Task aborted by user', { reason });
  }
}

const orchestrator = new Orchestrator();

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 8: MESSAGE ROUTING — Cross-Layer Communication
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Central message router handling all chrome.runtime.onMessage traffic.
 * Routes commands from SidePanel → Background → Content Script and vice versa.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Must return true for async sendResponse
  (async () => {
    try {
      const { type, payload } = message;

      switch (type) {
        // ─── SidePanel → Background Commands ───

        case 'START_TASK': {
          const { task, tabId } = payload;
          await orchestrator.startTask(task, tabId);
          sendResponse({ success: true, state: stateMachine.getState() });
          break;
        }

        case 'ABORT_TASK': {
          orchestrator.abort(payload?.reason || 'User abort');
          sendResponse({ success: true, state: AgentState.IDLE });
          break;
        }

        case 'GET_STATE': {
          sendResponse({
            success: true,
            state: stateMachine.getState(),
            plan: stateMachine.plan,
            planIndex: stateMachine.planIndex,
            history: stateMachine.getHistory(),
          });
          break;
        }

        case 'GET_TELEMETRY': {
          const result = await chrome.storage.local.get(StorageKeys.TELEMETRY);
          sendResponse({ success: true, logs: result[StorageKeys.TELEMETRY] || [] });
          break;
        }

        case 'CLEAR_MEMORY': {
          const { memoryType } = payload || {};
          if (!memoryType || memoryType === 'web_cache') {
            await chrome.storage.local.remove(StorageKeys.WEB_CACHE);
          }
          if (!memoryType || memoryType === 'action_memory') {
            await chrome.storage.local.remove(StorageKeys.ACTION_MEMORY);
          }
          if (!memoryType || memoryType === 'telemetry') {
            await chrome.storage.local.remove(StorageKeys.TELEMETRY);
          }
          sendResponse({ success: true });
          break;
        }

        case 'UPDATE_SETTINGS': {
          const current = await chrome.storage.local.get(StorageKeys.SETTINGS);
          const updated = { ...(current[StorageKeys.SETTINGS] || {}), ...payload };
          await chrome.storage.local.set({ [StorageKeys.SETTINGS]: updated });

          // Update active provider if changed
          if (payload.aiProvider) {
            aiRegistry.activeProviderName = payload.aiProvider;
          }
          if (payload.fallbackChain) {
            aiRegistry.fallbackChain = payload.fallbackChain;
          }

          sendResponse({ success: true, settings: updated });
          break;
        }

        case 'GET_SETTINGS': {
          const result = await chrome.storage.local.get(StorageKeys.SETTINGS);
          sendResponse({ success: true, settings: result[StorageKeys.SETTINGS] || {} });
          break;
        }

        // ─── SidePanel → Background Risk Responses ───

        case 'RISK_CONFIRMATION_RESPONSE': {
          const { correlationId, approved, userNote } = payload;
          riskEngine.handleUserResponse(correlationId, approved, userNote);
          sendResponse({ success: true });
          break;
        }

        // ─── Content Script → Background Reports ───

        case 'DOM_STATE_REPORT': {
          // Content script reporting DOM mutations or state changes
          telemetry.log('debug', 'DOM', 'State report from content script', payload);
          sendResponse({ success: true });
          break;
        }

        case 'GRID_CLICK_REPORT': {
          // User manually clicked a grid cell (for debugging / training)
          telemetry.log('debug', 'DOM', 'Grid click report', payload);
          sendResponse({ success: true });
          break;
        }

        // ─── Content Script → Background: Screenshot ───

        case 'REQUEST_SCREENSHOT': {
          try {
            if (!sender.tab?.windowId) {
              throw new Error('No sender tab available for screenshot');
            }
            const dataUrl = await chrome.tabs.captureVisibleTab(sender.tab.windowId, {
              format: 'png',
              quality: 90,
            });
            sendResponse({ success: true, dataUrl });
          } catch (err) {
            telemetry.log('warn', 'MSG', 'Screenshot capture failed', { error: err.message });
            sendResponse({ success: false, error: err.message });
          }
          break;
        }

        // ─── Default ───

        default: {
          telemetry.log('warn', 'MSG', `Unknown message type: ${type}`, { sender: sender.id });
          sendResponse({ success: false, error: `Unknown message type: ${type}` });
        }
      }
    } catch (err) {
      telemetry.log('error', 'MSG', 'Message handler error', { 
        error: err.message, type: message.type 
      });
      sendResponse({ success: false, error: err.message });
    }
  })();

  return true; // Async response
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 9: SERVICE WORKER LIFECYCLE & INSTALLATION
// ═══════════════════════════════════════════════════════════════════════════════

chrome.runtime.onInstalled.addListener((details) => {
  telemetry.log('info', 'LIFECYCLE', 'Extension installed/updated', {
    reason: details.reason,
    previousVersion: details.previousVersion,
    currentVersion: chrome.runtime.getManifest().version,
  });

  // Make the toolbar icon open the side panel on click (MV3 requirement).
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((err) => telemetry.log('error', 'LIFECYCLE', 'setPanelBehavior failed', { error: err?.message }));
  }

  // Initialize default settings
  chrome.storage.local.set({
    [StorageKeys.SETTINGS]: {
      aiProvider: 'mock',
      fallbackChain: ['puter', 'openai', 'anthropic', 'mock'],
      providerConfigs: {
        puter: { model: 'ling-3.0-flash', baseUrl: 'https://api.puter.com' },
        openai: { model: 'gpt-4o', baseUrl: 'https://api.openai.com/v1' },
        anthropic: { model: 'claude-3-5-sonnet-20241022', baseUrl: 'https://api.anthropic.com/v1' },
        mock: {},
      },
      gridCols: 40,
      gridRows: 30,
      maxRetries: 3,
      enableTelemetry: true,
    },
  });

  // Set up alarm for periodic telemetry flush
  chrome.alarms.create('telemetryFlush', { periodInMinutes: 1 });
});

// Fallback: if the side-panel behavior isn't honored, open it manually.
chrome.action.onClicked.addListener(async (tab) => {
  try {
    if (chrome.sidePanel?.open) {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    }
  } catch (err) {
    telemetry.log('error', 'LIFECYCLE', 'sidePanel.open failed', { error: err?.message });
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'telemetryFlush') {
    telemetry.flush();
  }
});

chrome.runtime.onStartup.addListener(() => {
  telemetry.log('info', 'LIFECYCLE', 'Browser startup — service worker initialized');
});

// Keep-alive for Manifest V3: respond to periodic keep-alive pings
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'KEEP_ALIVE') {
    sendResponse({ alive: true, state: stateMachine.getState() });
  }
});

// SidePanel open/close tracking
if (chrome.sidePanel) {
  // Also set behavior at top level so it survives service-worker restarts,
  // not just fresh installs.
  chrome.sidePanel
    .setPanelBehavior?.({ openPanelOnActionClick: true })
    .catch(() => {});
  chrome.sidePanel.onShown?.addListener(() => {
    telemetry.log('info', 'LIFECYCLE', 'SidePanel shown');
  });
  chrome.sidePanel.onHidden?.addListener(() => {
    telemetry.log('info', 'LIFECYCLE', 'SidePanel hidden');
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 10: EXPORTS (for unit testing via import in test files)
// ═══════════════════════════════════════════════════════════════════════════════

export {
  AgentState,
  RiskTier,
  ActionType,
  VALID_TRANSITIONS,
  RISK_RULES,
  StorageKeys,
  TelemetryLogger,
  WebSiteCache,
  ActionMemory,
  AIProvider,
  PuterProvider,
  OpenAIProvider,
  AnthropicProvider,
  MockProvider,
  AIProviderRegistry,
  RiskEngine,
  StateMachine,
  Orchestrator,
  telemetry,
  webSiteCache,
  actionMemory,
  aiRegistry,
  riskEngine,
  stateMachine,
  orchestrator,
};
