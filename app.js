'use strict';

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  purchasePrice: '',
  shares: '',
  currentPrice: '',
  ticker: '',
};

// ── Profit targets ─────────────────────────────────────────────────────────
const TARGETS = [
  { pct: 100,  label: '2×',  sublabel: 'Double',         mult: 2.0  },
  { pct: 300,  label: '4×',  sublabel: 'Quadruple',      mult: 4.0  },
  { pct: 500,  label: '6×',  sublabel: 'Six-bagger',     mult: 6.0  },
  { pct: 700,  label: '8×',  sublabel: 'Eight-bagger',   mult: 8.0  },
  { pct: 900,  label: '10×', sublabel: 'Ten-bagger',     mult: 10.0 },
  { pct: 1100, label: '12×', sublabel: 'Twelve-bagger',  mult: 12.0 },
  { pct: 1500, label: '16×', sublabel: 'Sixteen-bagger', mult: 16.0 },
];

// ── Formatters ─────────────────────────────────────────────────────────────
const fmt$ = v => '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const fmt$k = v => {
  const n = Number(v);
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + 'M';
  if (n >= 1_000)     return '$' + (n / 1_000).toLocaleString('en-US',     { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + 'K';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmtPct = v => (v >= 0 ? '+' : '') + Number(v).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
const fmtShares = v => Number(v).toLocaleString('en-US', { maximumFractionDigits: 4 });

// ── Core calculations ──────────────────────────────────────────────────────
function calculate(purchasePrice, shares, currentPrice) {
  const pp = parseFloat(purchasePrice);
  const sh = parseFloat(shares);
  const cp = currentPrice ? parseFloat(currentPrice) : null;

  if (isNaN(pp) || pp <= 0 || isNaN(sh) || sh <= 0) return null;

  const totalInvested = pp * sh;

  // Target results
  const targets = TARGETS.map(t => {
    const targetPrice = pp * t.mult;           // price needed
    const targetValue = targetPrice * sh;      // total portfolio value
    const grossProfit = targetValue - totalInvested;

    // How many shares to SELL at target to realise exactly that profit tier
    // while keeping remaining shares at cost basis
    // sell_qty * targetPrice = grossProfit  →  sell_qty = grossProfit / targetPrice
    // Simplified: sell just enough to recover invested capital + profit
    // Alternative framing: shares to sell = (totalInvested * t.mult - totalInvested) / targetPrice
    //   = totalInvested / targetPrice  to recover cost
    //   = grossProfit / targetPrice    to take all profit
    const sharesToSellForFullProfit = grossProfit / targetPrice;
    const sharesToSellToRecoverCost = totalInvested / targetPrice;

    return {
      ...t,
      targetPrice,
      targetValue,
      grossProfit,
      sharesToSellForFullProfit,
      sharesToSellToRecoverCost,
      remainingAfterCostRecovery: sh - sharesToSellToRecoverCost,
    };
  });

  // Current position (if current price provided)
  let current = null;
  if (cp !== null && !isNaN(cp) && cp > 0) {
    const currentValue = cp * sh;
    const unrealisedPL  = currentValue - totalInvested;
    const unrealisedPct = (unrealisedPL / totalInvested) * 100;
    current = { price: cp, value: currentValue, pl: unrealisedPL, pct: unrealisedPct };
  }

  return { pp, sh, totalInvested, targets, current };
}

// ── Render ────────────────────────────────────────────────────────────────
function render() {
  const result = calculate(state.purchasePrice, state.shares, state.currentPrice);
  const resultsEl  = document.getElementById('results');
  const emptyEl    = document.getElementById('empty-state');
  const currentEl  = document.getElementById('current-position');
  const tickerEl   = document.getElementById('ticker-display');

  // Ticker
  if (tickerEl) tickerEl.textContent = state.ticker ? state.ticker.toUpperCase() : '';

  if (!result) {
    resultsEl.classList.add('hidden');
    emptyEl.classList.remove('hidden');
    currentEl.classList.add('hidden');
    return;
  }

  emptyEl.classList.add('hidden');
  resultsEl.classList.remove('hidden');

  // Summary bar
  document.getElementById('summary-invested').textContent = fmt$k(result.totalInvested);
  document.getElementById('summary-shares').textContent   = fmtShares(result.sh);
  document.getElementById('summary-cost').textContent     = fmt$(result.pp);

  // Current position card
  if (result.current) {
    currentEl.classList.remove('hidden');
    const pl = result.current.pl;
    const pct = result.current.pct;
    const isUp = pl >= 0;
    document.getElementById('cur-price').textContent  = fmt$(result.current.price);
    document.getElementById('cur-value').textContent  = fmt$k(result.current.value);
    document.getElementById('cur-pl').textContent     = (isUp ? '+' : '') + fmt$k(Math.abs(pl));
    document.getElementById('cur-pct').textContent    = fmtPct(pct);
    document.getElementById('cur-pl').className       = 'cur-pl ' + (isUp ? 'up' : 'down');
    document.getElementById('cur-pct').className      = 'cur-pct ' + (isUp ? 'up' : 'down');
    document.getElementById('cur-arrow').textContent  = isUp ? '▲' : '▼';
    document.getElementById('cur-arrow').className    = 'cur-arrow ' + (isUp ? 'up' : 'down');

    // Break-even: shares to sell at current price to recover total invested
    const possibleEl   = document.getElementById('breakeven-possible');
    const impossibleEl = document.getElementById('breakeven-impossible');
    const curPrice = result.current.price;
    if (curPrice >= result.pp) {
      // Can recover investment — sharesToSellForBreakEven = totalInvested / currentPrice
      const beShares = result.totalInvested / curPrice;
      document.getElementById('breakeven-qty').textContent = fmtShares(beShares);
      document.getElementById('breakeven-proceeds').textContent =
        'recovers ' + fmt$k(result.totalInvested) + ' · ' + fmtShares(result.sh - beShares) + ' shares remain free';
      possibleEl.classList.remove('hidden');
      impossibleEl.classList.add('hidden');
    } else {
      possibleEl.classList.add('hidden');
      impossibleEl.classList.remove('hidden');
    }

    // Progress toward each target
    result.targets.forEach((t, i) => {
      const progressEl = document.getElementById(`progress-${i}`);
      if (!progressEl) return;
      const pricePct = Math.min(100, Math.max(0, ((result.current.price - result.pp) / (t.targetPrice - result.pp)) * 100));
      const fill = progressEl.querySelector('.prog-fill');
      const label = progressEl.querySelector('.prog-label');
      if (fill) fill.style.width = pricePct.toFixed(1) + '%';
      if (label) label.textContent = pricePct.toFixed(0) + '% of the way to ' + t.pct + '% profit';
    });
  } else {
    currentEl.classList.add('hidden');
  }

  // Target cards
  result.targets.forEach((t, i) => {
    const card = document.getElementById(`target-${i}`);
    if (!card) return;

    card.querySelector('.target-price').textContent       = fmt$(t.targetPrice);
    card.querySelector('.target-total-val').textContent   = fmt$k(t.targetValue);
    card.querySelector('.target-gross-profit').textContent= fmt$k(t.grossProfit);

    // Sell strategies
    card.querySelector('.sell-full-qty').textContent      = fmtShares(t.sharesToSellForFullProfit) + ' shares';
    card.querySelector('.sell-full-val').textContent      = '= ' + fmt$k(t.grossProfit);
    card.querySelector('.sell-cost-qty').textContent      = fmtShares(t.sharesToSellToRecoverCost) + ' shares';
    card.querySelector('.sell-cost-val').textContent      = '= ' + fmt$k(result.totalInvested) + ' recovered';
    card.querySelector('.sell-remain').textContent        = fmtShares(t.remainingAfterCostRecovery) + ' shares held "free"';

    // Glow intensity based on profit tier
    card.style.setProperty('--glow-opacity', (0.2 + i * 0.12).toFixed(2));
  });
}

// ── Input handler ──────────────────────────────────────────────────────────
function onInput(field, value) {
  state[field] = value;
  render();
}

// ── Clear all ─────────────────────────────────────────────────────────────
function clearAll() {
  state.purchasePrice = '';
  state.shares        = '';
  state.currentPrice  = '';
  state.ticker        = '';
  document.querySelectorAll('.field-input').forEach(el => { el.value = ''; });
  render();

  // Brief flash on clear
  const btn = document.getElementById('clear-btn');
  btn.textContent = 'Cleared ✓';
  setTimeout(() => { btn.textContent = 'Clear'; }, 1200);
}

// ── Build HTML ─────────────────────────────────────────────────────────────
function buildTargetCard(t, i) {
  const colors = [
    { accent: '#22c55e', glow: '#22c55e', label: 'green'  },
    { accent: '#f59e0b', glow: '#f59e0b', label: 'amber'  },
    { accent: '#ef4444', glow: '#ef4444', label: 'red'    },
    { accent: '#a855f7', glow: '#a855f7', label: 'purple' },
    { accent: '#06b6d4', glow: '#06b6d4', label: 'cyan'   },
    { accent: '#f472b6', glow: '#f472b6', label: 'pink'   },
    { accent: '#fbbf24', glow: '#fbbf24', label: 'gold'   },
  ];
  const c = colors[i];

  return `
    <div class="target-card" id="target-${i}" style="--accent:${c.accent};--glow:${c.glow};--glow-opacity:0.2">
      <div class="target-header">
        <div class="target-badge">
          <span class="target-pct">${t.pct}%</span>
          <span class="target-profit-label">profit</span>
        </div>
        <div class="target-mult-wrap">
          <span class="target-mult">${t.label}</span>
          <span class="target-sublabel">${t.sublabel}</span>
        </div>
      </div>

      <div class="target-price-display">
        <span class="target-price-label">TARGET PRICE</span>
        <span class="target-price">—</span>
      </div>

      <div class="target-divider"></div>

      <div class="target-stats">
        <div class="stat-row">
          <span class="stat-label">Total portfolio value</span>
          <span class="stat-val target-total-val">—</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Gross profit</span>
          <span class="stat-val target-gross-profit up">—</span>
        </div>
      </div>

      <div class="target-divider"></div>

      <div class="sell-section">
        <p class="sell-heading">SELL STRATEGIES</p>

        <div class="sell-strategy">
          <div class="sell-icon">💰</div>
          <div class="sell-info">
            <span class="sell-strategy-label">Take all profit</span>
            <span class="sell-sub">Sell <strong class="sell-full-qty">—</strong> <span class="sell-full-val">—</span></span>
          </div>
        </div>

        <div class="sell-strategy">
          <div class="sell-icon">🔄</div>
          <div class="sell-info">
            <span class="sell-strategy-label">Recover cost basis only</span>
            <span class="sell-sub">Sell <strong class="sell-cost-qty">—</strong> <span class="sell-cost-val">—</span></span>
            <span class="sell-remain-line"><span class="sell-remain">—</span></span>
          </div>
        </div>
      </div>

      <div id="progress-${i}" class="progress-wrap">
        <div class="prog-track">
          <div class="prog-fill" style="width:0%"></div>
        </div>
        <span class="prog-label">Enter current price to see progress</span>
      </div>
    </div>
  `;
}

function init() {
  const app = document.getElementById('app');

  app.innerHTML = `
    <div class="grid-bg"></div>

    <header class="app-header">
      <div class="logo-wrap">
        <div class="logo-icon">
          <svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="22" cy="22" r="21" stroke="url(#lg)" stroke-width="1.5"/>
            <polyline points="6,32 14,20 20,26 28,12 38,18" stroke="url(#lg)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            <circle cx="38" cy="18" r="3" fill="url(#lg)"/>
            <defs>
              <linearGradient id="lg" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#22c55e"/>
                <stop offset="100%" stop-color="#16a34a"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div class="logo-text">
          <span class="logo-title">Stock<span class="logo-accent">Target</span></span>
          <span class="logo-sub">Profit Calculator</span>
        </div>
      </div>
      <button id="clear-btn" class="clear-btn" onclick="clearAll()">Clear</button>
    </header>

    <main class="main">

      <!-- INPUT PANEL -->
      <section class="input-panel">
        <div class="input-grid">

          <div class="field-wrap full-width">
            <label class="field-label" for="f-ticker">Ticker Symbol <span class="optional">(optional)</span></label>
            <input id="f-ticker" class="field-input ticker-input" type="text"
              inputmode="text" placeholder="e.g. AAPL"
              autocomplete="off" autocorrect="off" autocapitalize="characters" spellcheck="false"
              maxlength="6"
              oninput="onInput('ticker', this.value)" />
          </div>

          <div class="field-wrap">
            <label class="field-label" for="f-price">Purchase Price</label>
            <div class="input-adorn">
              <span class="adorn-pre">$</span>
              <input id="f-price" class="field-input has-pre" type="number"
                inputmode="decimal" placeholder="0.00" min="0" step="any"
                oninput="onInput('purchasePrice', this.value)" />
            </div>
            <span class="field-hint">Price paid per share</span>
          </div>

          <div class="field-wrap">
            <label class="field-label" for="f-shares">Shares Purchased</label>
            <input id="f-shares" class="field-input" type="number"
              inputmode="decimal" placeholder="0" min="0" step="any"
              oninput="onInput('shares', this.value)" />
            <span class="field-hint">Number of shares you hold</span>
          </div>

          <div class="field-wrap full-width">
            <label class="field-label" for="f-current">Current Price <span class="optional">(optional)</span></label>
            <div class="input-adorn">
              <span class="adorn-pre">$</span>
              <input id="f-current" class="field-input has-pre" type="number"
                inputmode="decimal" placeholder="0.00" min="0" step="any"
                oninput="onInput('currentPrice', this.value)" />
            </div>
            <span class="field-hint">Shows your live P&L and progress toward targets</span>
          </div>

        </div>
      </section>

      <!-- SUMMARY BAR -->
      <div id="results" class="hidden">
        <div class="summary-bar">
          <div class="summary-item">
            <span class="summary-label">Total Invested</span>
            <span class="summary-val" id="summary-invested">—</span>
          </div>
          <div class="summary-divider"></div>
          <div class="summary-item">
            <span class="summary-label">Shares</span>
            <span class="summary-val" id="summary-shares">—</span>
          </div>
          <div class="summary-divider"></div>
          <div class="summary-item">
            <span class="summary-label">Cost / Share</span>
            <span class="summary-val" id="summary-cost">—</span>
          </div>
          <div class="ticker-badge" id="ticker-display"></div>
        </div>

        <!-- CURRENT POSITION -->
        <div id="current-position" class="current-card hidden">
          <div class="current-header">
            <span class="current-title">CURRENT POSITION</span>
            <span class="cur-arrow" id="cur-arrow">▲</span>
          </div>
          <div class="current-body">
            <div class="cur-block">
              <span class="cur-label">Price</span>
              <span class="cur-val" id="cur-price">—</span>
            </div>
            <div class="cur-block">
              <span class="cur-label">Value</span>
              <span class="cur-val" id="cur-value">—</span>
            </div>
            <div class="cur-block">
              <span class="cur-label">Unrealised P&L</span>
              <span class="cur-pl up" id="cur-pl">—</span>
            </div>
            <div class="cur-block">
              <span class="cur-label">Return</span>
              <span class="cur-pct up" id="cur-pct">—</span>
            </div>
          </div>

          <!-- BREAK-EVEN SELL -->
          <div class="breakeven-section">
            <p class="breakeven-label">Break-Even Sell</p>
            <div id="breakeven-possible" class="breakeven-row">
              <div class="breakeven-icon">🎯</div>
              <div class="breakeven-info">
                <span class="breakeven-title">Shares to sell now</span>
                <span class="breakeven-sub" id="breakeven-proceeds">to recover full investment</span>
              </div>
              <div>
                <span class="breakeven-qty" id="breakeven-qty">—</span>
                <span class="breakeven-qty-label">shares</span>
              </div>
            </div>
            <div id="breakeven-impossible" class="breakeven-impossible hidden">
              ⚠️ Current price is below purchase price — selling now would not recover your investment
            </div>
          </div>
        </div>

        <!-- TARGET CARDS -->
        <div class="targets-heading">
          <span class="targets-heading-line"></span>
          <span class="targets-heading-text">PROFIT TARGETS</span>
          <span class="targets-heading-line"></span>
        </div>

        <div class="targets-grid">
          ${TARGETS.map((t, i) => buildTargetCard(t, i)).join('')}
        </div>

        <!-- DISCLAIMER -->
        <p class="disclaimer">
          ⚠️ For informational purposes only. Not financial advice.
          Past performance does not guarantee future results.
          Always consult a licensed financial adviser before making investment decisions.
        </p>
      </div>

      <!-- EMPTY STATE -->
      <div id="empty-state" class="empty-state">
        <div class="empty-icon">
          <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" width="80" height="80">
            <circle cx="40" cy="40" r="38" stroke="#1e3a2e" stroke-width="2"/>
            <polyline points="12,58 24,38 34,46 46,24 68,32" stroke="#22c55e" stroke-width="2.5"
              stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.5"/>
            <circle cx="68" cy="32" r="5" fill="#22c55e" opacity="0.4"/>
          </svg>
        </div>
        <p class="empty-title">Enter your position</p>
        <p class="empty-sub">Fill in your purchase price and number of shares<br>to calculate your profit targets</p>
      </div>

    </main>

    <footer class="app-footer">
      <p>Stock Target Calculator</p>
    </footer>
  `;

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  render();
}

document.addEventListener('DOMContentLoaded', init);
