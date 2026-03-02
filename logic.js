// logic.js
// UI layer — solver runs in solver-worker.js (Web Worker)
// Depends on: segment-hints.js, segment-solver-hints.js (for SVG only)
// Load order: segment-hints.js → segment-solver-hints.js → logic.js

const DIGIT_SEGMENTS = {
  0: new Set(['a','b','c','d','e','f']),
  1: new Set(['b','c']),
  2: new Set(['a','b','d','e','g']),
  3: new Set(['a','b','c','d','g']),
  4: new Set(['b','c','f','g']),
  5: new Set(['a','c','d','f','g']),
  6: new Set(['a','c','d','e','f','g']),
  7: new Set(['a','b','c']),
  8: new Set(['a','b','c','d','e','f','g']),
  9: new Set(['a','b','c','d','f','g'])
};

const SEG_COORDS = {
  a: { x:10, y:0,  w:40, h:8  },
  d: { x:10, y:62, w:40, h:8  },
  g: { x:10, y:31, w:40, h:8  },
  b: { x:52, y:5,  w:8,  h:25 },
  c: { x:52, y:35, w:8,  h:25 },
  e: { x:0,  y:35, w:8,  h:25 },
  f: { x:0,  y:5,  w:8,  h:25 }
};

// ─── SVG Rendering ────────────────────────────────────────────
function svgDigit(digit) {
  const segs = digit !== null ? [...DIGIT_SEGMENTS[digit]] : [];
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 60 70');
  svg.classList.add('digit-svg');
  for (const [name, box] of Object.entries(SEG_COORDS)) {
    const r = document.createElementNS(svgNS, 'rect');
    r.setAttribute('x', box.x);
    r.setAttribute('y', box.y);
    r.setAttribute('width', box.w);
    r.setAttribute('height', box.h);
    r.setAttribute('rx', '3');
    r.classList.add('seg');
    r.classList.add(segs.includes(name) ? 'on' : 'off');
    svg.appendChild(r);
  }
  return svg;
}

function renderDigits(containerId, digits) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  digits.forEach((d, idx) => {
    const wrap = document.createElement('div');
    wrap.classList.add('digit-wrap');
    wrap.appendChild(svgDigit(d));
    const label = document.createElement('div');
    label.classList.add('digit-label');
    label.textContent = `pos${idx}`;
    wrap.appendChild(label);
    container.appendChild(wrap);
  });
}

// ─── Loading Spinner ─────────────────────────────────────────
function showLoading() {
  const rb  = document.getElementById('result-box');
  const rt  = document.getElementById('result-text');
  const log = document.getElementById('move-log');
  const rd  = document.getElementById('result-display');
  const spinner = document.getElementById('solve-spinner');

  if (rb)  rb.style.display = 'block';
  if (rt)  { rt.textContent = ''; rt.style.color = ''; }
  if (log) log.innerHTML = '';
  if (rd)  rd.innerHTML = '';
  if (spinner) spinner.style.display = 'flex';
}

function hideLoading() {
  const spinner = document.getElementById('solve-spinner');
  if (spinner) spinner.style.display = 'none';
}

// ─── Result Renderer ─────────────────────────────────────────
function numStr(digits) {
  return digits.join('').replace(/^0+/, '') || '0';
}

function showResult(result, startDigits, maxMoves) {
  hideLoading();
  const rt  = document.getElementById('result-text');
  const log = document.getElementById('move-log');

  renderDigits('result-display', result.digits);

  const improved = numStr(result.digits) !== numStr(startDigits);
  if (rt) {
    rt.style.color = '';
    rt.textContent = !improved
      ? `${numStr(result.digits)} — already optimal, no improvement possible.`
      : `Best: ${numStr(result.digits)} (${result.path.length} of ${maxMoves} moves used)`;
  }

  if (log) {
    log.innerHTML = result.path.length === 0
      ? (improved ? 'No moves needed.' : 'No improving moves found within budget.')
      : result.path.map((m, i) =>
          `Move ${i+1}: pos${m.fromPos}(<strong>${m.fromSeg}</strong>) → pos${m.toPos}(<strong>${m.toSeg}</strong>)`
        ).join('<br>');
  }
}

// ─── Input Validation ─────────────────────────────────────────
function validateInputs() {
  const inputEl = document.getElementById('inputNum');
  const movesEl = document.getElementById('maxMoves');
  const errorEl = document.getElementById('error');
  if (errorEl) errorEl.textContent = '';

  const raw = (inputEl?.value || '').trim();
  if (!/^\d+$/.test(raw) || raw.length === 0) {
    if (errorEl) errorEl.textContent = 'Please enter a valid number.';
    return null;
  }
  const maxMoves = parseInt(movesEl?.value, 10);
  if (!Number.isInteger(maxMoves) || maxMoves < 1 || maxMoves > 6) {
    if (errorEl) errorEl.textContent = 'Please select moves between 1 and 6.';
    return null;
  }
  return { startDigits: raw.slice(0, 6).split('').map(Number), maxMoves };
}

// ─── Web Worker Manager ───────────────────────────────────────
let activeWorker = null;

function handleSolve() {
  const modeEl = document.getElementById('modeSelect');
  const mode   = modeEl?.value === 'min' ? 'smallest' : 'largest';

  const inputs = validateInputs();
  if (!inputs) return;

  const { startDigits, maxMoves } = inputs;

  renderDigits('orig-display', startDigits);
  const ob = document.getElementById('original-box');
  if (ob) ob.style.display = 'block';

  showLoading();

  // Kill any previous solve still running
  if (activeWorker) { activeWorker.terminate(); activeWorker = null; }

  const worker = new Worker('solver-worker.js');
  activeWorker = worker;

  worker.onmessage = function(e) {
    activeWorker = null;
    worker.terminate();
    if (e.data.ok) {
      showResult(e.data.result, startDigits, maxMoves);
    } else {
      hideLoading();
      const rt = document.getElementById('result-text');
      if (rt) rt.textContent = 'Solver error: ' + e.data.error;
    }
  };

  worker.onerror = function(err) {
    activeWorker = null;
    hideLoading();
    const rt = document.getElementById('result-text');
    if (rt) rt.textContent = 'Worker error. Check console.';
    console.error('Worker error:', err);
  };

  worker.postMessage({ startDigits, maxMoves, mode });
}

// ─── Boot ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('solveBtn');
  if (btn) btn.addEventListener('click', handleSolve);
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleSolve();
  });
});
