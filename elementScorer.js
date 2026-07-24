/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * JARVIS — Advanced Element Scoring (elementScorer.js)
 * document.elementsFromPoint() resolution with weighted candidate scoring.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

class ElementScorer {
  constructor(options = {}) {
    // Scoring weights (per architectural specification)
    this.weights = {
      tag: {
        button: 10,
        input: 8,
        textarea: 8,
        select: 7,
        a: 6,
        label: 4,
        summary: 4,
        div: 1,
        span: 1,
        default: 2,
      },
      attribute: {
        ariaLabel: 6,
        placeholder: 5,
        title: 3,
        role: 4,
      },
      state: {
        visibleInViewport: 5,
        disabled: -20,
        opacityZero: -100,
        visibilityHidden: -100,
        displayNone: -100,
        pointerEventsNone: -15,
      },
      ...options.weights,
    };

    // Minimum score threshold to consider a candidate valid
    this.minScoreThreshold = options.minScoreThreshold ?? -50;
  }

  /**
   * Find the best element at given coordinates using elementsFromPoint + scoring.
   * @param {number} x — page X coordinate
   * @param {number} y — page Y coordinate
   * @param {Object} options
   * @param {string} options.preferredTag — Boost specific tag (e.g., 'button')
   * @param {string} options.preferredType — Boost specific input type (e.g., 'text')
   * @returns {{element: Element, score: number, details: Object}|null}
   */
  findBestElementAt(x, y, options = {}) {
    // Convert page coordinates to viewport coordinates
    const viewportX = x - window.scrollX;
    const viewportY = y - window.scrollY;

    // Get all elements at this point (top to bottom in z-order)
    const elements = document.elementsFromPoint(viewportX, viewportY);

    if (!elements || elements.length === 0) {
      return null;
    }

    const candidates = elements
      .map(el => this.#scoreElement(el, x, y, options))
      .filter(c => c.score > this.minScoreThreshold)
      .sort((a, b) => b.score - a.score);

    if (candidates.length === 0) {
      return null;
    }

    return candidates[0];
  }

  /**
   * Find best element for a grid cell.
   * @param {number} cellId
   * @param {AdaptiveGrid} grid
   * @param {Object} options
   */
  findBestElementForCell(cellId, grid, options = {}) {
    const center = grid.getCellCenter(cellId);
    if (!center) return null;
    return this.findBestElementAt(center.x, center.y, options);
  }

  /**
   * Score a single element.
   */
  #scoreElement(el, x, y, options = {}) {
    const tag = el.tagName.toLowerCase();
    const styles = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();

    let score = 0;
    const details = {
      tag,
      id: el.id || null,
      className: el.className || null,
      text: (el.innerText || el.textContent || '').substring(0, 60),
      reasons: [],
    };

    // ─── Tag-based scoring ───
    const tagScore = this.weights.tag[tag] || this.weights.tag.default;
    score += tagScore;
    if (tagScore !== 0) {
      details.reasons.push(`tag:${tag}(+${tagScore})`);
    }

    // Input type bonus
    if (tag === 'input' && options.preferredType && el.type === options.preferredType) {
      score += 5;
      details.reasons.push(`preferredType:${el.type}(+5)`);
    }

    // ─── Attribute scoring ───
    if (el.getAttribute('aria-label')) {
      score += this.weights.attribute.ariaLabel;
      details.reasons.push(`aria-label(+${this.weights.attribute.ariaLabel})`);
    }
    if (el.placeholder) {
      score += this.weights.attribute.placeholder;
      details.reasons.push(`placeholder(+${this.weights.attribute.placeholder})`);
    }
    if (el.title) {
      score += this.weights.attribute.title;
      details.reasons.push(`title(+${this.weights.attribute.title})`);
    }
    if (el.getAttribute('role')) {
      score += this.weights.attribute.role;
      details.reasons.push(`role(+${this.weights.attribute.role})`);
    }

    // ─── Visibility & State scoring ───
    const isInViewport = (
      rect.top >= 0 && rect.left >= 0 &&
      rect.bottom <= window.innerHeight &&
      rect.right <= window.innerWidth
    );

    if (isInViewport) {
      score += this.weights.state.visibleInViewport;
      details.reasons.push(`visible(+${this.weights.state.visibleInViewport})`);
    }

    if (el.disabled === true) {
      score += this.weights.state.disabled;
      details.reasons.push(`disabled(${this.weights.state.disabled})`);
    }

    const opacity = parseFloat(styles.opacity);
    if (opacity === 0) {
      score += this.weights.state.opacityZero;
      details.reasons.push(`opacity:0(${this.weights.state.opacityZero})`);
    }

    if (styles.visibility === 'hidden') {
      score += this.weights.state.visibilityHidden;
      details.reasons.push(`visibility:hidden(${this.weights.state.visibilityHidden})`);
    }

    if (styles.display === 'none') {
      score += this.weights.state.displayNone;
      details.reasons.push(`display:none(${this.weights.state.displayNone})`);
    }

    if (styles.pointerEvents === 'none') {
      score += this.weights.state.pointerEventsNone;
      details.reasons.push(`pointer-events:none(${this.weights.state.pointerEventsNone})`);
    }

    // ─── Proximity bonus ───
    // Elements whose center is closer to the query point get a small boost
    const elCenterX = rect.left + rect.width / 2 + window.scrollX;
    const elCenterY = rect.top + rect.height / 2 + window.scrollY;
    const distance = Math.sqrt((x - elCenterX) ** 2 + (y - elCenterY) ** 2);
    const proximityBonus = Math.max(0, 10 - distance / 10); // Up to +10 for very close
    score += proximityBonus;
    if (proximityBonus > 0.5) {
      details.reasons.push(`proximity(+${proximityBonus.toFixed(1)})`);
    }

    // ─── Preferred tag boost ───
    if (options.preferredTag && tag === options.preferredTag) {
      score += 8;
      details.reasons.push(`preferredTag(+8)`);
    }

    // ─── Interactivity heuristics ───
    if (typeof el.click === 'function' || el.onclick || el.getAttribute('onclick')) {
      score += 3;
      details.reasons.push(`clickable(+3)`);
    }

    if (el.tabIndex >= 0) {
      score += 2;
      details.reasons.push(`tabbable(+2)`);
    }

    details.finalScore = Math.round(score * 100) / 100;

    return { element: el, score: details.finalScore, details };
  }

  /**
   * Get all scored candidates at a point (for debugging / telemetry).
   */
  getAllCandidatesAt(x, y, options = {}) {
    const viewportX = x - window.scrollX;
    const viewportY = y - window.scrollY;
    const elements = document.elementsFromPoint(viewportX, viewportY);

    if (!elements) return [];

    return elements
      .map(el => this.#scoreElement(el, x, y, options))
      .filter(c => c.score > this.minScoreThreshold)
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Highlight the best candidate element on the page.
   */
  highlightElement(element, durationMs = 2000) {
    if (!element || !element.getBoundingClientRect) return;

    const rect = element.getBoundingClientRect();
    const highlight = document.createElement('div');
    highlight.className = 'jarvis-target-highlight';
    highlight.style.cssText = `
      position: fixed !important;
      top: ${rect.top}px !important;
      left: ${rect.left}px !important;
      width: ${rect.width}px !important;
      height: ${rect.height}px !important;
      z-index: 2147483645 !important;
      pointer-events: none !important;
    `;

    document.body.appendChild(highlight);

    if (durationMs > 0) {
      setTimeout(() => highlight.remove(), durationMs);
    }

    return highlight;
  }
}

// Expose globally
window.JarvisElementScorer = ElementScorer;
