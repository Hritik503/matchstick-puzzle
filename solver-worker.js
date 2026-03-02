// solver-worker.js
// 2-phase 7-segment matchstick solver (Web Worker)
// Phase A: digit-level planning — accounts for ALL start positions
// Phase B: constrained BFS — realizes the plan

const DIGIT_SEGMENTS_LIST = {
  0: ['a','b','c','d','e','f'],
  1: ['b','c'],
  2: ['a','b','d','e','g'],
  3: ['a','b','c','d','g'],
  4: ['b','c','f','g'],
  5: ['a','c','d','f','g'],
  6: ['a','c','d','e','f','g'],
  7: ['a','b','c'],
  8: ['a','b','c','d','e','f','g'],
  9: ['a','b','c','d','f','g']
};

const SEG_LETTERS = ['a','b','c','d','e','f','g'];
const MIN_SEGS = 2;
const MAX_SEGS = 7;

// MOVE_COST[a][b] = segments that must LEAVE digit a to become digit b
const MOVE_COST = [
  [0,4,2,2,3,2,1,3,0,1],
  [0,0,1,0,0,1,1,0,0,0],
  [1,4,0,1,3,2,1,3,0,1],
  [1,3,1,0,2,1,1,2,0,0],
  [1,2,2,1,0,1,1,2,0,0],
  [1,4,2,1,2,0,0,3,0,0],
  [1,5,2,2,3,1,0,4,0,1],
  [0,1,1,0,1,1,1,0,0,0],
  [1,5,2,2,3,2,1,4,0,1],
  [1,4,2,1,2,1,1,3,0,0]
];

// ─── Helpers ─────────────────────────────────────────────────
function segCount(d) { return DIGIT_SEGMENTS_LIST[d].length; }

function removeCost(from, to) {
  const a = new Set(DIGIT_SEGMENTS_LIST[from]);
  const b = new Set(DIGIT_SEGMENTS_LIST[to]);
  return [...a].filter(s => !b.has(s)).length;
}

function addCost(from, to) {
  const a = new Set(DIGIT_SEGMENTS_LIST[from]);
  const b = new Set(DIGIT_SEGMENTS_LIST[to]);
  return [...b].filter(s => !a.has(s)).length;
}

function getDigitFromSet(segSet) {
  if (!segSet || segSet.size === 0) return -1;
  for (let d = 0; d <= 9; d++) {
    const ref = DIGIT_SEGMENTS_LIST[d];
    if (ref.length !== segSet.size) continue;
    if (ref.every(s => segSet.has(s))) return d;
  }
  return -1;
}

function encodeState(state) {
  let last = state.length - 1;
  while (last > 0 && state[last].size === 0) last--;
  return state.slice(0, last + 1)
    .map(s => SEG_LETTERS.filter(x => s.has(x)).join(''))
    .join('|');
}

function buildStateFromDigits(digits, extraSlots) {
  const state = digits.map(d => new Set(DIGIT_SEGMENTS_LIST[d]));
  for (let i = 0; i < extraSlots; i++) state.push(new Set());
  return state;
}

function canFormNDigits(totalSegs, n) {
  return totalSegs >= n * MIN_SEGS && totalSegs <= n * MAX_SEGS;
}

// ─── Phase A: digit-level planning ───────────────────────────
// KEY FIX: all startDigits positions are accounted for,
// even positions that get eliminated (n → n-1) or added (n → n+2)
//
// Segment balance rule:
//   sum of segments REMOVED from all start positions
//   must equal
//   sum of segments ADDED to all target positions
//   AND both sums must equal the number of moves used
//
// For positions that disappear (start has more digits than target):
//   ALL their segments must be donated → counted as removals
// For new empty positions (target has more digits than start):
//   ALL their segments must be received → counted as additions

function planDigits(startDigits, maxMoves, mode) {
  const n = startDigits.length;
  const totalSegs = startDigits.reduce((s, d) => s + segCount(d), 0);

  let bestPlan = null;

  const tryLength = (targetLen) => {
    if (targetLen < 1 || targetLen > 6) return;
    if (!canFormNDigits(totalSegs, targetLen)) return;

    const digOrder = mode === 'largest'
      ? [9,8,7,6,5,4,3,2,1,0]
      : [0,1,2,3,4,5,6,7,8,9];

    const current = new Array(targetLen);

    // Pre-compute: segments that MUST be removed from positions
    // that won't exist in the target (positions targetLen..n-1)
    // These are fixed costs regardless of what target digits we pick
    let fixedRemove = 0;
    for (let i = targetLen; i < n; i++) {
      fixedRemove += segCount(startDigits[i]); // all segs must leave
    }

    function dfs(pos, removedSoFar, addedSoFar) {
      if (removedSoFar + fixedRemove > maxMoves) return; // prune early

      if (pos === targetLen) {
        const totalRemoved = removedSoFar + fixedRemove;
        if (totalRemoved !== addedSoFar) return;   // segments don't balance
        if (totalRemoved > maxMoves) return;        // over budget
        if (current[0] === 0 && targetLen > 1) return; // no leading zero

        const val = parseInt(current.join(''), 10);
        const better = !bestPlan ||
          (mode === 'largest' ? val > bestPlan.value : val < bestPlan.value);
        if (better) {
          bestPlan = { targetDigits: current.slice(), cost: totalRemoved, value: val };
        }
        return;
      }

      for (const d of digOrder) {
        let remove, add;
        if (pos < n) {
          // existing position: cost = segments it must donate or receive
          remove = removeCost(startDigits[pos], d);
          add    = addCost(startDigits[pos], d);
        } else {
          // new empty slot: receives all segments of target digit
          remove = 0;
          add    = segCount(d);
        }

        // prune: already over budget
        if (removedSoFar + fixedRemove + remove > maxMoves) continue;

        current[pos] = d;
        dfs(pos + 1, removedSoFar + remove, addedSoFar + add);
      }
    }

    dfs(0, 0, 0);
  };

  if (mode === 'largest') {
    tryLength(Math.min(n + 1, 6));
    tryLength(Math.min(n + 2, 6));
    // also try same length in case adding digits isn't possible
    tryLength(n);
  } else {
    // try reducing by 1, then 2 if budget allows
    if (n > 1) tryLength(n - 1);
    if (n > 2) tryLength(n - 2);
    tryLength(n); // fallback: minimize within same length
  }

  return bestPlan;
}

// ─── Phase B: constrained BFS to realize digit plan ──────────
// Only allows moves that place segments into slots the target WANTS
// This keeps the search space tiny

function realizePlan(startDigits, targetDigits, maxMoves) {
  const nStart  = startDigits.length;
  const tLen    = targetDigits.length;
  const extra   = Math.max(0, tLen - nStart);

  // Build start state: include ALL original positions
  // Positions that must disappear start with their segments, will donate them
  const startState = buildStateFromDigits(startDigits, extra);

  // Pad to max(nStart, tLen) for uniform indexing
  const totalSlots = Math.max(nStart, tLen);
  while (startState.length < totalSlots) startState.push(new Set());

  // Build target state: targetLen positions filled, rest empty
  const targetState = [];
  for (let i = 0; i < totalSlots; i++) {
    if (i < tLen) targetState.push(new Set(DIGIT_SEGMENTS_LIST[targetDigits[i]]));
    else targetState.push(new Set());
  }

  const visited = new Map();
  const startKey = encodeState(startState);
  visited.set(startKey, true);
  let frontier = [{ state: startState, path: [] }];

  // Check if start state already matches target
  if (statesMatch(startState, targetState, totalSlots)) {
    return { digits: targetDigits.slice(), path: [] };
  }

  for (let depth = 1; depth <= maxMoves; depth++) {
    const nextFrontier = [];

    for (const { state, path } of frontier) {
      for (let fp = 0; fp < totalSlots; fp++) {
        for (const fs of state[fp]) {
          // skip: target wants this seg here AND this pos has right count
          if (targetState[fp].has(fs) &&
              countCorrectSegs(state[fp], targetState[fp]) === targetState[fp].size) continue;

          for (let tp = 0; tp < totalSlots; tp++) {
            for (const ts of SEG_LETTERS) {
              if (fp === tp && fs === ts) continue;
              if (state[tp].has(ts)) continue;
              // KEY CONSTRAINT: only place ts if target at tp actually needs ts
              if (!targetState[tp].has(ts)) continue;

              const next = state.map(s => new Set(s));
              next[fp].delete(fs);
              next[tp].add(ts);

              const key = encodeState(next);
              if (visited.has(key)) continue;
              visited.set(key, true);

              const newPath = [...path, { fromPos: fp, fromSeg: fs, toPos: tp, toSeg: ts }];

              if (statesMatch(next, targetState, totalSlots)) {
                return { digits: targetDigits.slice(), path: newPath };
              }

              nextFrontier.push({ state: next, path: newPath });
            }
          }
        }
      }
    }

    frontier = nextFrontier;
    if (!frontier.length) break;
  }

  return null; // plan was valid but routing failed — should not happen
}

function countCorrectSegs(actual, target) {
  let count = 0;
  for (const s of actual) if (target.has(s)) count++;
  return count;
}

function statesMatch(a, b, len) {
  for (let i = 0; i < len; i++) {
    const ai = a[i] || new Set();
    const bi = b[i] || new Set();
    if (ai.size !== bi.size) return false;
    for (const s of ai) if (!bi.has(s)) return false;
  }
  return true;
}

// ─── Top-level solve ─────────────────────────────────────────
function solve(startDigits, maxMoves, mode) {
  const plan = planDigits(startDigits, maxMoves, mode);
  if (!plan) return { digits: startDigits.slice(), path: [] };

  const realized = realizePlan(startDigits, plan.targetDigits, maxMoves);
  if (realized) return realized;

  // realizePlan failed: return plan digits with empty path
  // (shows correct answer even if move sequence is missing)
  return { digits: plan.targetDigits.slice(), path: [] };
}

// ─── Worker handler ───────────────────────────────────────────
self.onmessage = function(e) {
  const { startDigits, maxMoves, mode } = e.data;
  try {
    const result = solve(startDigits, maxMoves, mode);
    self.postMessage({ ok: true, result });
  } catch (err) {
    self.postMessage({ ok: false, error: err.message || String(err) });
  }
};
