/**
 * Slot Machine Widget - Self-contained Web Component with Shadow DOM.
 * Embeddable via <script src="...slot-machine-widget.js" data-...></script>
 * Saves state in localStorage or sessionStorage.
 *
 * Author: GitHub Copilot
 * Usage:
 *   <script src="https://yourserver.com/slot-machine-widget.js"
 *           data-credits="200"
 *           data-storage="local"
 *           data-storage-key="slot-v1"
 *           data-target="#slot-host"
 *           data-theme="dark"
 *           data-bets="1,2,5,10"></script>
 *   <div id="slot-host"></div>
 */
(() => {
  const DEFAULTS = {
    credits: 100,
    storage: 'local', // 'local' or 'session'
    storageKey: null, // default computed from hostname
    theme: 'light',   // 'light' or 'dark'
    bets: [1, 2, 5, 10],
  };

  const SYMBOLS = [
    { id: 'cherry', emoji: '🍒', weight: 5, payout3: 10, payout2: 3 },
    { id: 'lemon',  emoji: '🍋', weight: 6, payout3: 8,  payout2: 2 },
    { id: 'orange', emoji: '🍊', weight: 6, payout3: 7,  payout2: 2 },
    { id: 'grape',  emoji: '🍇', weight: 4, payout3: 12, payout2: 4 },
    { id: 'bell',   emoji: '🔔', weight: 3, payout3: 18, payout2: 6 },
    { id: 'star',   emoji: '⭐', weight: 2, payout3: 25, payout2: 8 },
    { id: 'seven',  emoji: '7️⃣',weight: 1, payout3: 50, payout2: 12 },
  ];

  function weightedRandomSymbol() {
    const totalWeight = SYMBOLS.reduce((sum, s) => sum + s.weight, 0);
    let r = Math.random() * totalWeight;
    for (const s of SYMBOLS) {
      if (r < s.weight) return s;
      r -= s.weight;
    }
    return SYMBOLS[SYMBOLS.length - 1];
  }

  function computePayout(reelSyms, bet) {
    const [a,b,c] = reelSyms;
    if (a.id === b.id && b.id === c.id) {
      return bet * a.payout3;
    }
    if (a.id === b.id || a.id === c.id) return bet * a.payout2;
    if (b.id === c.id) return bet * b.payout2;
    return 0;
  }

  class SlotMachineWidget extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.state = {
        credits: DEFAULTS.credits,
        bet: DEFAULTS.bets[0],
        totalSpins: 0,
        totalWon: 0,
        totalLost: 0,
        lastResult: null,
        lastPlayedAt: null,
      };
      this.config = { ...DEFAULTS };
      this.storage = window.localStorage;
      this.storageKey = '';

      this._render();
    }

    static get observedAttributes() {
      return ['theme'];
    }

    attributeChangedCallback(name, oldVal, newVal) {
      if (name === 'theme' && oldVal !== newVal) {
        this._applyTheme(newVal);
      }
    }

    connectedCallback() {
      this._initFromAttributes();
      this._initStorage();
      this._loadState();
      this._updateUI();
      this._applyTheme(this.config.theme);
      this._bindEvents();
    }

    _initFromAttributes() {
      const attrCredits = this.getAttribute('credits') || this.dataset.credits;
      const attrStorage = this.getAttribute('storage') || this.dataset.storage;
      const attrStorageKey = this.getAttribute('storage-key') || this.dataset.storageKey;
      const attrTheme = this.getAttribute('theme') || this.dataset.theme;
      const attrBets = this.getAttribute('bets') || this.dataset.bets;

      if (attrCredits && !isNaN(parseInt(attrCredits, 10))) {
        this.config.credits = parseInt(attrCredits, 10);
      }
      if (attrStorage && (attrStorage === 'local' || attrStorage === 'session')) {
        this.config.storage = attrStorage;
      }
      if (attrStorageKey) {
        this.config.storageKey = attrStorageKey;
      }
      if (attrTheme && (attrTheme === 'light' || attrTheme === 'dark')) {
        this.config.theme = attrTheme;
      }
      if (attrBets) {
        const bets = attrBets.split(',').map(v => parseInt(v.trim(), 10)).filter(v => !isNaN(v) && v > 0);
        if (bets.length) this.config.bets = bets;
      }

      this.storage = this.config.storage === 'session' ? window.sessionStorage : window.localStorage;
      this.storageKey = (this.config.storageKey || `slotmachine-${location.hostname}`);

      // Initialize starting credits into state (may be overridden by storage later)
      this.state.credits = this.config.credits;
      this.state.bet = this.config.bets[0];
    }

    _initStorage() {
      try {
        const testKey = `${this.storageKey}-test`;
        this.storage.setItem(testKey, '1');
        this.storage.removeItem(testKey);
      } catch (e) {
        console.warn('Storage unavailable; progressing without persistence.', e);
        this.storage = {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        };
      }
    }

    _loadState() {
      const raw = this.storage.getItem(this.storageKey);
      if (!raw) {
        // Persist initial state
        this._saveState();
        return;
      }
      try {
        const data = JSON.parse(raw);
        // Merge persisted data into current state
        Object.assign(this.state, {
          credits: typeof data.credits === 'number' ? data.credits : this.config.credits,
          totalSpins: data.totalSpins || 0,
          totalWon: data.totalWon || 0,
          totalLost: data.totalLost || 0,
          lastResult: data.lastResult || null,
          lastPlayedAt: data.lastPlayedAt || null,
        });
      } catch (e) {
        console.warn('Failed to parse storage, resetting.', e);
        this._saveState();
      }
    }

    _saveState() {
      const payload = JSON.stringify({
        credits: this.state.credits,
        totalSpins: this.state.totalSpins,
        totalWon: this.state.totalWon,
        totalLost: this.state.totalLost,
        lastResult: this.state.lastResult,
        lastPlayedAt: this.state.lastPlayedAt,
      });
      try {
        this.storage.setItem(this.storageKey, payload);
      } catch (e) {
        console.warn('Failed to save state.', e);
      }
    }

    _render() {
      const style = `
        :host {
          all: initial;
        }
        .wrap {
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Arial, 'Apple Color Emoji', 'Segoe UI Emoji';
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 16px;
          max-width: 380px;
          background: var(--bg);
          color: var(--fg);
          box-shadow: 0 6px 20px rgba(0,0,0,0.12);
        }
        .top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }
        .credits {
          font-weight: 700;
          font-size: 18px;
        }
        .controls {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        select, button {
          font: inherit;
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 8px 10px;
          background: var(--control-bg);
          color: var(--fg);
          cursor: pointer;
        }
        button.spin {
          background: var(--accent);
          color: var(--accent-fg);
          border: none;
        }
        button.spin:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .reels {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin: 12px 0;
        }
        .reel {
          height: 72px;
          border: 2px solid var(--border);
          border-radius: 10px;
          display: grid;
          place-items: center;
          font-size: 40px;
          background: var(--reel-bg);
          overflow: hidden;
          position: relative;
        }
        .reel .slot {
          transition: transform 0.15s ease;
          will-change: transform;
        }
        .msg {
          min-height: 24px;
          margin-top: 8px;
          font-weight: 600;
        }
        .stats {
          margin-top: 10px;
          font-size: 13px;
          opacity: 0.85;
        }

        /* Light theme (default) */
        :host([theme="light"]) {
          --bg: #ffffff;
          --fg: #111827;
          --border: #e5e7eb;
          --control-bg: #f9fafb;
          --reel-bg: #f3f4f6;
          --accent: #2563eb;
          --accent-fg: #ffffff;
        }
        /* Dark theme */
        :host([theme="dark"]) {
          --bg: #0b0f1a;
          --fg: #e5e7eb;
          --border: #1f2937;
          --control-bg: #0f172a;
          --reel-bg: #111827;
          --accent: #22c55e;
          --accent-fg: #0b0f1a;
        }
      `;

      const html = `
        <div class="wrap">
          <div class="top">
            <div class="credits" id="credits"></div>
            <div class="controls">
              <label>
                Bet
                <select id="bet"></select>
              </label>
              <button class="spin" id="spin">Spin</button>
              <button id="reset" title="Reset credits">↺</button>
            </div>
          </div>
          <div class="reels">
            <div class="reel"><div class="slot" id="r0">🍒</div></div>
            <div class="reel"><div class="slot" id="r1">🍋</div></div>
            <div class="reel"><div class="slot" id="r2">🍊</div></div>
          </div>
          <div class="msg" id="msg"></div>
          <div class="stats" id="stats"></div>
        </div>
      `;

      const root = this.shadowRoot;
      const sheet = document.createElement('style');
      sheet.textContent = style;
      root.appendChild(sheet);

      const container = document.createElement('div');
      container.innerHTML = html;
      root.appendChild(container);

      // refs
      this.$credits = root.getElementById('credits');
      this.$bet = root.getElementById('bet');
      this.$spin = root.getElementById('spin');
      this.$reset = root.getElementById('reset');
      this.$msg = root.getElementById('msg');
      this.$stats = root.getElementById('stats');
      this.$reels = [root.getElementById('r0'), root.getElementById('r1'), root.getElementById('r2')];
    }

    _applyTheme(theme) {
      this.setAttribute('theme', theme === 'dark' ? 'dark' : 'light');
    }

    _bindEvents() {
      this.$spin.addEventListener('click', () => this._spin());
      this.$reset.addEventListener('click', () => this._resetCredits());
      this.$bet.addEventListener('change', () => {
        const val = parseInt(this.$bet.value, 10);
        if (!isNaN(val)) this.state.bet = val;
      });
    }

    _updateUI() {
      this.$credits.textContent = `Credits: ${this.state.credits}`;
      this._populateBets();
      this.$bet.value = String(this.state.bet);
      this.$msg.textContent = this._formatLastResult();
      this.$stats.textContent = `Spins: ${this.state.totalSpins} • Won: ${this.state.totalWon} • Lost: ${this.state.totalLost}`;
      this.$spin.disabled = this.state.credits < this.state.bet;
    }

    _populateBets() {
      this.$bet.innerHTML = '';
      for (const b of this.config.bets) {
        const opt = document.createElement('option');
        opt.value = String(b);
        opt.textContent = b;
        this.$bet.appendChild(opt);
      }
    }

    _formatLastResult() {
      const r = this.state.lastResult;
      if (!r) return '';
      const symbols = r.symbols.map(s => s.emoji).join(' ');
      const wonStr = r.win > 0 ? `Won ${r.win}` : `No win`;
      return `${symbols} — Bet ${r.bet}. ${wonStr}.`;
    }

    async _spin() {
      const bet = this.state.bet;
      if (this.state.credits < bet) return;

      this.state.credits -= bet;
      this.$spin.disabled = true;
      this._updateUI();

      const reelResults = [];
      const spinDurationMs = [900, 1200, 1500]; // staggered stop times
      const tickMs = 90;

      // Animate each reel
      await Promise.all(this.$reels.map((el, idx) => new Promise(resolve => {
        let t = 0;
        const timer = setInterval(() => {
          const sym = weightedRandomSymbol();
          el.textContent = sym.emoji;
          el.style.transform = `translateY(${(t % 2) ? '-6px' : '0'})`;
          t++;
        }, tickMs);

        setTimeout(() => {
          clearInterval(timer);
          const finalSym = weightedRandomSymbol();
          el.textContent = finalSym.emoji;
          el.style.transform = 'translateY(0)';
          reelResults[idx] = finalSym;
          resolve();
        }, spinDurationMs[idx]);
      })));

      const win = computePayout(reelResults, bet);
      this.state.totalSpins += 1;
      if (win > 0) {
        this.state.totalWon += win;
        this.state.credits += win;
        this.$msg.textContent = `You won ${win}!`;
      } else {
        this.state.totalLost += bet;
        this.$msg.textContent = `Better luck next time.`;
      }
      this.state.lastResult = { symbols: reelResults, bet, win };
      this.state.lastPlayedAt = Date.now();

      this._saveState();
      this._updateUI();
      this.$spin.disabled = this.state.credits < this.state.bet;
    }

    _resetCredits() {
      this.state.credits = this.config.credits;
      this.state.totalSpins = 0;
      this.state.totalWon = 0;
      this.state.totalLost = 0;
      this.state.lastResult = null;
      this.state.lastPlayedAt = null;
      this._saveState();
      this._updateUI();
      this.$msg.textContent = 'Credits reset.';
    }
  }

  // Define the custom element
  if (!customElements.get('slot-machine-widget')) {
    customElements.define('slot-machine-widget', SlotMachineWidget);
  }

  // Helper to mount widget programmatically
  function mountWidget(options = {}) {
    const el = document.createElement('slot-machine-widget');
    if (options.credits) el.setAttribute('credits', String(options.credits));
    if (options.storage) el.setAttribute('storage', options.storage);
    if (options.storageKey) el.setAttribute('storage-key', options.storageKey);
    if (options.theme) el.setAttribute('theme', options.theme);
    if (options.bets && Array.isArray(options.bets)) {
      el.setAttribute('bets', options.bets.join(','));
    }
    const target = options.target instanceof Element
      ? options.target
      : (typeof options.target === 'string' ? document.querySelector(options.target) : null);
    if (target) {
      target.appendChild(el);
    } else {
      document.body.appendChild(el);
    }
    return el;
  }

  // Auto-mount when loaded via <script ...>
  const currentScript = document.currentScript;
  if (currentScript) {
    const dataset = currentScript.dataset || {};
    const opts = {
      credits: dataset.credits ? parseInt(dataset.credits, 10) : undefined,
      storage: dataset.storage,
      storageKey: dataset.storageKey,
      theme: dataset.theme,
      bets: dataset.bets ? dataset.bets.split(',').map(v => parseInt(v.trim(), 10)).filter(v => !isNaN(v) && v > 0) : undefined,
    };

    const targetSelector = dataset.target;
    let target = null;
    if (targetSelector) {
      target = document.querySelector(targetSelector);
    }
    // If no target, insert right after the script tag
    const widget = document.createElement('slot-machine-widget');
    if (opts.credits) widget.setAttribute('credits', String(opts.credits));
    if (opts.storage) widget.setAttribute('storage', opts.storage);
    if (opts.storageKey) widget.setAttribute('storage-key', opts.storageKey);
    if (opts.theme) widget.setAttribute('theme', opts.theme);
    if (opts.bets) widget.setAttribute('bets', opts.bets.join(','));

    if (target) {
      target.appendChild(widget);
    } else {
      currentScript.insertAdjacentElement('afterend', widget);
    }

    // Expose a global for optional imperative control
    window.SlotMachineWidget = window.SlotMachineWidget || { mount: mountWidget };
  }
})();