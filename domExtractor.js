/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * JARVIS — Semantic DOM Extraction (domExtractor.js)
 * Lightweight extraction of visible interactive elements for LLM consumption.
 * Extracts: tags, labels, types, bounds, accessibility attrs, visibility states.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

class SemanticDOMExtractor {
  constructor(options = {}) {
    this.maxElements = options.maxElements || 150;
    this.viewportOnly = options.viewportOnly !== false;
    this.textTruncateAt = options.textTruncateAt || 120;

    // Interactive element selectors
    this.interactiveSelectors = [
      'a[href]',
      'button',
      'input:not([type="hidden"])',
      'textarea',
      'select',
      '[role="button"]',
      '[role="link"]',
      '[role="checkbox"]',
      '[role="radio"]',
      '[role="tab"]',
      '[role="menuitem"]',
      '[role="searchbox"]',
      '[role="textbox"]',
      '[role="combobox"]',
      '[role="listbox"]',
      '[onclick]',
      '[contenteditable="true"]',
      'label',
      'summary',
    ];
  }

  /**
   * Main extraction entry point.
   * @returns {Object} Structured DOM snapshot
   */
  extract() {
    const startTime = performance.now();
    const elements = this.#queryInteractiveElements();
    const visibleElements = this.viewportOnly 
      ? elements.filter(el => this.#isInViewport(el))
      : elements;

    const processed = visibleElements
      .map(el => this.#processElement(el))
      .filter(Boolean)
      .slice(0, this.maxElements);

    const result = {
      url: window.location.href,
      title: document.title,
      timestamp: Date.now(),
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        dpr: window.devicePixelRatio || 1,
      },
      elementCount: processed.length,
      elements: processed,
      meta: {
        totalFound: elements.length,
        visibleInViewport: visibleElements.length,
        extractionTimeMs: Math.round(performance.now() - startTime),
      },
    };

    return result;
  }

  #queryInteractiveElements() {
    const selector = this.interactiveSelectors.join(', ');
    return Array.from(document.querySelectorAll(selector));
  }

  /**
   * Check if element's bounding rect intersects the viewport.
   */
  #isInViewport(el) {
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;

    return (
      rect.top < vh &&
      rect.bottom > 0 &&
      rect.left < vw &&
      rect.right > 0 &&
      rect.width > 0 &&
      rect.height > 0
    );
  }

  /**
   * Process a single element into a structured descriptor.
   */
  #processElement(el) {
    const rect = el.getBoundingClientRect();
    const styles = window.getComputedStyle(el);

    // Skip truly invisible elements
    if (styles.display === 'none' || styles.visibility === 'hidden') {
      return null;
    }
    if (parseFloat(styles.opacity) === 0) {
      return null;
    }
    if (rect.width === 0 || rect.height === 0) {
      return null;
    }

    // Skip elements hidden by clipping
    if (styles.clip === 'rect(0px, 0px, 0px, 0px)' || styles.clipPath === 'inset(100%)') {
      return null;
    }

    const tag = el.tagName.toLowerCase();
    const descriptor = {
      tag,
      type: el.type || null,
      text: this.#getElementText(el),
      ariaLabel: el.getAttribute('aria-label') || null,
      ariaRole: el.getAttribute('role') || null,
      placeholder: el.placeholder || null,
      title: el.title || null,
      name: el.name || null,
      id: el.id || null,
      className: el.className || null,
      href: el.href || null,
      bounds: {
        x: Math.round(rect.x + window.scrollX),
        y: Math.round(rect.y + window.scrollY),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        centerX: Math.round(rect.x + rect.width / 2 + window.scrollX),
        centerY: Math.round(rect.y + rect.height / 2 + window.scrollY),
      },
      state: {
        disabled: el.disabled === true,
        readonly: el.readOnly === true,
        required: el.required === true,
        checked: el.checked === true,
        selected: el.selected === true,
        hidden: el.hidden === true || styles.display === 'none',
        editable: el.isContentEditable || !el.readOnly && !el.disabled,
      },
      computed: {
        opacity: parseFloat(styles.opacity),
        visibility: styles.visibility,
        cursor: styles.cursor,
        zIndex: styles.zIndex,
      },
    };

    // Add form context if inside a form
    const form = el.closest('form');
    if (form) {
      descriptor.form = {
        action: form.action || null,
        method: form.method || 'get',
        id: form.id || null,
      };
    }

    return descriptor;
  }

  /**
   * Extract readable text from element, traversing children if needed.
   */
  #getElementText(el) {
    // Direct text for inputs
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      return (el.value || el.placeholder || '').substring(0, this.textTruncateAt);
    }

    // For buttons, links, etc. — get visible text
    let text = '';

    // Prefer aria-label for accessibility
    if (el.getAttribute('aria-label')) {
      text = el.getAttribute('aria-label');
    } else if (el.innerText) {
      text = el.innerText.trim();
    } else if (el.textContent) {
      text = el.textContent.trim();
    }

    // Truncate long text
    if (text.length > this.textTruncateAt) {
      text = text.substring(0, this.textTruncateAt) + '…';
    }

    return text || null;
  }

  /**
   * Quick summary for LLM prompt context optimization.
   * Returns a condensed string representation.
   */
  summarizeForPrompt(snapshot) {
    const lines = snapshot.elements.map((el, idx) => {
      const parts = [`[${idx}] <${el.tag}>`];
      if (el.type) parts.push(`type=${el.type}`);
      if (el.text) parts.push(`text="${el.text}"`);
      if (el.ariaLabel) parts.push(`aria="${el.ariaLabel}"`);
      if (el.state.disabled) parts.push('DISABLED');
      parts.push(`@(${el.bounds.centerX},${el.bounds.centerY})`);
      return parts.join(' ');
    });

    return `Page: ${snapshot.title}\nURL: ${snapshot.url}\nElements (${snapshot.elementCount}):\n${lines.join('\n')}`;
  }

  /**
   * Find elements matching a semantic description (for cache lookups).
   * @param {string} description — e.g., "search input", "login button"
   * @returns {Array} Matching element descriptors
   */
  findByDescription(snapshot, description) {
    const terms = description.toLowerCase().split(/\s+/);
    return snapshot.elements.filter(el => {
      const haystack = [
        el.text,
        el.ariaLabel,
        el.placeholder,
        el.title,
        el.name,
        el.id,
        el.className,
      ].filter(Boolean).join(' ').toLowerCase();

      return terms.every(term => haystack.includes(term));
    });
  }
}

// Expose globally
window.JarvisDOMExtractor = SemanticDOMExtractor;
