// ============================================================
// segment-solver-hints.js
// Smart hint tables for BFS solver — largest & smallest modes
// Precomputed from 7-segment definitions. No runtime cost.
// Load AFTER segment-hints.js, BEFORE logic.js
// ============================================================

const MIN_SEGS_PER_DIGIT = 2;
const MAX_SEGS_PER_DIGIT = 7;
const DIGIT_SEG_COUNT = { 0:6, 1:2, 2:5, 3:5, 4:4, 5:5, 6:6, 7:3, 8:7, 9:6 };

// ─── ZERO_REMOVE_UPGRADES ────────────────────────────────────────────────────
// For LARGEST: digit can become a bigger digit by ONLY receiving — never donates.
// Sorted by: result digit DESC, then cost ASC
const ZERO_REMOVE_UPGRADES = {
  0: [{ to:8, add:['g'],                  cost:1 }],
  1: [{ to:7, add:['a'],                  cost:1 },
      { to:4, add:['f','g'],              cost:2 },
      { to:3, add:['a','d','g'],          cost:3 },
      { to:9, add:['a','d','f','g'],      cost:4 },
      { to:0, add:['a','d','e','f'],      cost:4 },
      { to:8, add:['a','d','e','f','g'],  cost:5 }],
  2: [{ to:8, add:['c','f'],              cost:2 }],
  3: [{ to:9, add:['f'],                  cost:1 },
      { to:8, add:['e','f'],              cost:2 }],
  4: [{ to:9, add:['a','d'],              cost:2 },
      { to:8, add:['a','d','e'],          cost:3 }],
  5: [{ to:9, add:['b'],                  cost:1 },
      { to:6, add:['e'],                  cost:1 },
      { to:8, add:['b','e'],              cost:2 }],
  6: [{ to:8, add:['b'],                  cost:1 }],
  7: [{ to:3, add:['d','g'],              cost:2 },
      { to:9, add:['d','f','g'],          cost:3 },
      { to:0, add:['d','e','f'],          cost:3 },
      { to:8, add:['d','e','f','g'],      cost:4 }],
  9: [{ to:8, add:['e'],                  cost:1 }],
};

// ─── PURE_DONOR_UPGRADES ─────────────────────────────────────────────────────
// For LARGEST: digit is SUPERSET of target — it only donates, never receives.
// These are ideal SEGMENT SOURCES during BFS.
const PURE_DONOR_UPGRADES = {
  7: [{ to:1, remove:['a'],                   cost:1 }],
  6: [{ to:5, remove:['e'],                   cost:1 }],
  8: [{ to:9, remove:['e'],                   cost:1 },
      { to:0, remove:['g'],                   cost:1 },
      { to:6, remove:['b'],                   cost:1 },
      { to:2, remove:['c','f'],               cost:2 },
      { to:3, remove:['e','f'],               cost:2 },
      { to:5, remove:['b','e'],               cost:2 },
      { to:4, remove:['a','d','e'],           cost:3 },
      { to:7, remove:['d','e','f','g'],       cost:4 },
      { to:1, remove:['a','d','e','f','g'],   cost:5 }],
  9: [{ to:5, remove:['b'],                   cost:1 },
      { to:3, remove:['f'],                   cost:1 },
      { to:4, remove:['a','d'],               cost:2 },
      { to:7, remove:['d','f','g'],           cost:3 },
      { to:1, remove:['a','d','f','g'],       cost:4 }],
  3: [{ to:7, remove:['d','g'],               cost:2 },
      { to:1, remove:['a','d','g'],           cost:3 }],
  4: [{ to:1, remove:['f','g'],               cost:2 }],
  0: [{ to:7, remove:['d','e','f'],           cost:3 },
      { to:1, remove:['a','d','e','f'],       cost:4 }],
};

// ─── PURE_DONOR_DOWNGRADES ───────────────────────────────────────────────────
// For SMALLEST: digit shrinks by donating segments — still lands on valid digit.
const PURE_DONOR_DOWNGRADES = {
  2: [{ to:0, remove:['g'],           cost:1 }],
  3: [{ to:0, remove:['e'],           cost:1 }],
  4: [{ to:3, remove:['f'],           cost:1 },
      { to:0, remove:['e'],           cost:1 }],
  5: [{ to:3, remove:['f'],           cost:1 },
      { to:0, remove:['e'],           cost:1 }],
  6: [{ to:5, remove:['e'],           cost:1 },
      { to:0, remove:['g'],           cost:1 }],
  7: [{ to:1, remove:['a'],           cost:1 },
      { to:3, remove:['g'],           cost:1 }],
  8: [{ to:9, remove:['e'],           cost:1 },
      { to:6, remove:['b'],           cost:1 },
      { to:0, remove:['g'],           cost:1 }],
  9: [{ to:5, remove:['b'],           cost:1 },
      { to:3, remove:['f'],           cost:1 }],
};

// ─── SEGMENT BUDGET CHECKER ──────────────────────────────────────────────────
// Segments are INVARIANT — 1 removed + 1 placed per move = total never changes.
// If totalSegs can't form n digits, prune that entire branch immediately.
function canFormNDigits(totalSegs, n) {
  return totalSegs >= n * MIN_SEGS_PER_DIGIT && totalSegs <= n * MAX_SEGS_PER_DIGIT;
}

// ─── QUICK REACHABILITY CHECK ────────────────────────────────────────────────
// Can digit `from` become digit `to` within `budget` moves, in isolation?
// (Per-position only — BFS handles cross-position balancing)
function canReachDigit(from, to, budget) {
  if (from === to) return true;
  const fromSegs = new Set(DIGIT_SEGMENTS_LIST[from]);
  const toSegs   = new Set(DIGIT_SEGMENTS_LIST[to]);
  const removeCost = [...fromSegs].filter(s => !toSegs.has(s)).length;
  return removeCost <= budget;
}

// ─── BEST REACHABLE DIGIT (greedy hint) ─────────────────────────────────────
// Quick estimate: what's the best digit this position can aim for?
// For largest: highest reachable. For smallest: lowest reachable.
function bestReachableDigit(current, budget, mode) {
  const range = mode === 'largest'
    ? [9,8,7,6,5,4,3,2,1,0]
    : [0,1,2,3,4,5,6,7,8,9];
  for (const target of range) {
    if (canReachDigit(current, target, budget)) return target;
  }
  return current;
}

// ─── MOVE WEIGHT SCORER ──────────────────────────────────────────────────────
// Scores a candidate move so BFS can prioritize high-value moves within
// the same depth level — finds best answer faster without skipping anything.
// fromDigit / toDigit = current digit at those positions (-1 if empty/invalid)
function getMoveWeight(fromDigit, fromSeg, toDigit, toSeg, mode) {
  let w = 0;
  if (mode === 'largest') {
    if (fromDigit !== -1 && PURE_DONOR_UPGRADES[fromDigit]) {
      const d = PURE_DONOR_UPGRADES[fromDigit].find(x => x.remove.includes(fromSeg));
      if (d) w += d.to >= 8 ? 10 : d.to >= 6 ? 7 : 4;
    }
    if (toDigit !== -1 && ZERO_REMOVE_UPGRADES[toDigit]) {
      const r = ZERO_REMOVE_UPGRADES[toDigit].find(x => x.add.includes(toSeg));
      if (r) w += r.to >= 8 ? 8 : r.to >= 6 ? 5 : 3;
    }
  } else {
    if (fromDigit !== -1 && PURE_DONOR_DOWNGRADES[fromDigit]) {
      const d = PURE_DONOR_DOWNGRADES[fromDigit].find(x => x.remove.includes(fromSeg));
      if (d) w += d.to <= 1 ? 10 : d.to <= 3 ? 7 : 4;
    }
  }
  return w;
}
