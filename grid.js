/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * JARVIS — Adaptive Grid Overlay (grid.js)
 * HTML5 Canvas-based dynamic matrix (40×30)
 * Zoom, DPI, and resolution independent
 * ═══════════════════════════════════════════════════════════════════════════════
 */

class AdaptiveGrid {
  /**
   * @param {Object} options
   * @param {number} options.cols — Grid columns (default: 40)
   * @param {number} options.rows — Grid rows (default: 30)
   * @param {boolean} options.showLabels — Show cell ID labels
   * @param {string} options.containerId — DOM container ID for canvas
   */
  constructor(options = {}) {
    this.cols = options.cols || 40;
    this.rows = options.rows || 30;
    this.showLabels = options.showLabels !== false;
    this.containerId = options.containerId || 'jarvis-grid-canvas';

    this.canvas = null;
    this.ctx = null;
    this.dpr = window.devicePixelRatio || 1;
    this.cellWidth = 0;
    this.cellHeight = 0;
    this.viewportWidth = 0;
    this.viewportHeight = 0;

    // Cell cache: id → { id, col, row, centerX, centerY, x, y, width, height }
    this.cells = new Map();

    this.isVisible = false;
    this.resizeObserver = null;

    this.#init();
  }

  #init() {
    this.#createCanvas();
    this.#calculateDimensions();
    this.#buildCellCache();
    this.#draw();
    this.#attachListeners();
    this.hide();
  }

  #createCanvas() {
    // Remove existing canvas if present
    const existing = document.getElementById(this.containerId);
    if (existing) existing.remove();

    this.canvas = document.createElement('canvas');
    this.canvas.id = this.containerId;
    this.canvas.className = 'hidden';

    // Append to document root for full viewport coverage
    (document.body || document.documentElement).appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
  }

  /**
   * Calculate dimensions accounting for DPR, zoom, and visual viewport.
   * Uses visualViewport API when available for proper mobile/zoom handling.
   */
  #calculateDimensions() {
    const vv = window.visualViewport;
    this.viewportWidth = vv ? vv.width : window.innerWidth;
    this.viewportHeight = vv ? vv.height : window.innerHeight;

    // Account for device pixel ratio for crisp rendering
    this.dpr = window.devicePixelRatio || 1;

    this.canvas.width = Math.round(this.viewportWidth * this.dpr);
    this.canvas.height = Math.round(this.viewportHeight * this.dpr);
    this.canvas.style.width = `${this.viewportWidth}px`;
    this.canvas.style.height = `${this.viewportHeight}px`;

    // Scale context for DPR
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    this.cellWidth = this.viewportWidth / this.cols;
    this.cellHeight = this.viewportHeight / this.rows;
  }

  /**
   * Build the cell coordinate cache.
   * Cell IDs are row-major: id = row * cols + col
   */
  #buildCellCache() {
    this.cells.clear();
    const vv = window.visualViewport;
    const offsetX = vv ? vv.pageLeft : window.scrollX;
    const offsetY = vv ? vv.pageTop : window.scrollY;

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const id = row * this.cols + col;
        const x = col * this.cellWidth;
        const y = row * this.cellHeight;

        this.cells.set(id, {
          id,
          col,
          row,
          x,
          y,
          width: this.cellWidth,
          height: this.cellHeight,
          centerX: x + this.cellWidth / 2 + offsetX,
          centerY: y + this.cellHeight / 2 + offsetY,
        });
      }
    }
  }

  #draw() {
    if (!this.ctx) return;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, this.viewportWidth, this.viewportHeight);

    // Grid line styling
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.25)';
    ctx.lineWidth = 0.5;
    ctx.font = `${Math.max(8, Math.min(this.cellWidth, this.cellHeight) * 0.25)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Draw vertical lines
    for (let col = 0; col <= this.cols; col++) {
      const x = col * this.cellWidth;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.viewportHeight);
      ctx.stroke();
    }

    // Draw horizontal lines
    for (let row = 0; row <= this.rows; row++) {
      const y = row * this.cellHeight;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.viewportWidth, y);
      ctx.stroke();
    }

    // Draw cell labels
    if (this.showLabels && this.cellWidth > 20 && this.cellHeight > 20) {
      ctx.fillStyle = 'rgba(59, 130, 246, 0.5)';
      for (const cell of this.cells.values()) {
        ctx.fillText(String(cell.id), cell.x + cell.width / 2, cell.y + cell.height / 2);
      }
    }

    // Draw border
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0, 0, this.viewportWidth, this.viewportHeight);
  }

  #attachListeners() {
    // Handle resize, zoom, scroll, orientation change
    const debouncedRedraw = this.#debounce(() => {
      this.#calculateDimensions();
      this.#buildCellCache();
      if (this.isVisible) this.#draw();
    }, 150);

    window.addEventListener('resize', debouncedRedraw);

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', debouncedRedraw);
      window.visualViewport.addEventListener('scroll', debouncedRedraw);
    }

    window.addEventListener('scroll', debouncedRedraw, { passive: true });
    window.addEventListener('orientationchange', () => setTimeout(debouncedRedraw, 300));
  }

  #debounce(fn, ms) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  }

  // ─── Public API ───

  show() {
    this.isVisible = true;
    this.canvas.classList.remove('hidden');
    this.canvas.classList.add('active');
    this.#calculateDimensions();
    this.#buildCellCache();
    this.#draw();
  }

  hide() {
    this.isVisible = false;
    this.canvas.classList.remove('active');
    this.canvas.classList.add('hidden');
  }

  toggle() {
    this.isVisible ? this.hide() : this.show();
  }

  /**
   * Get cell data by ID.
   * @param {number} cellId
   * @returns {Object|null}
   */
  getCell(cellId) {
    return this.cells.get(cellId) || null;
  }

  /**
   * Get cell ID from viewport coordinates.
   * @param {number} x — viewport X
   * @param {number} y — viewport Y
   * @returns {number|null}
   */
  getCellIdAt(x, y) {
    const col = Math.floor(x / this.cellWidth);
    const row = Math.floor(y / this.cellHeight);
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return null;
    return row * this.cols + col;
  }

  /**
   * Get center coordinates for a cell (page-relative, scroll-aware).
   * @param {number} cellId
   * @returns {{x: number, y: number}|null}
   */
  getCellCenter(cellId) {
    const cell = this.cells.get(cellId);
    if (!cell) return null;
    return { x: cell.centerX, y: cell.centerY };
  }

  /**
   * Highlight a specific cell with a colored overlay.
   * @param {number} cellId
   * @param {string} color — CSS color
   * @param {number} durationMs — Auto-remove after ms (0 = persistent)
   */
  highlightCell(cellId, color = 'rgba(245, 158, 11, 0.3)', durationMs = 2000) {
    const cell = this.cells.get(cellId);
    if (!cell || !this.ctx) return;

    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = color;
    ctx.fillRect(cell.x + 1, cell.y + 1, cell.width - 2, cell.height - 2);
    ctx.restore();

    if (durationMs > 0) {
      setTimeout(() => {
        if (this.isVisible) this.#draw();
      }, durationMs);
    }
  }

  /**
   * Export grid data for the LLM prompt.
   * @returns {Object}
   */
  exportData() {
    return {
      cols: this.cols,
      rows: this.rows,
      viewport: { width: this.viewportWidth, height: this.viewportHeight },
      dpr: this.dpr,
      cells: Array.from(this.cells.values()).map(c => ({
        id: c.id,
        centerX: Math.round(c.centerX),
        centerY: Math.round(c.centerY),
      })),
    };
  }

  destroy() {
    if (this.canvas) {
      this.canvas.remove();
      this.canvas = null;
      this.ctx = null;
    }
    this.cells.clear();
  }
}

// Expose globally for content.js
window.JarvisAdaptiveGrid = AdaptiveGrid;
