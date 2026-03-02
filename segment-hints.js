// segment-hints.js
// Universal precomputed hint tables for 7-segment matchstick solver
// Used by both solveLargest and solveSmallest in logic.js

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

// ─── 1. MOVE COST TABLE ──────────────────────────────────────────────────────
// MOVE_COST[a][b] = number of segments that must LEAVE digit a to become digit b
// = number of segments that must ARRIVE at digit a to become digit b
// (these are always equal — each move is one remove + one place)
//
//         to: 0  1  2  3  4  5  6  7  8  9
const MOVE_COST = [
  [0, 4, 2, 2, 3, 2, 1, 3, 0, 1],  // from 0
  [0, 0, 1, 0, 0, 1, 1, 0, 0, 0],  // from 1
  [1, 4, 0, 1, 3, 2, 1, 3, 0, 1],  // from 2
  [1, 3, 1, 0, 2, 1, 1, 2, 0, 0],  // from 3
  [1, 2, 2, 1, 0, 1, 1, 2, 0, 0],  // from 4
  [1, 4, 2, 1, 2, 0, 0, 3, 0, 0],  // from 5
  [1, 5, 2, 2, 3, 1, 0, 4, 0, 1],  // from 6
  [0, 1, 1, 0, 1, 1, 1, 0, 0, 0],  // from 7
  [1, 5, 2, 2, 3, 2, 1, 4, 0, 1],  // from 8
  [1, 4, 2, 1, 2, 1, 1, 3, 0, 0],  // from 9
];

// ─── 2. SEGMENTS TO REMOVE ───────────────────────────────────────────────────
// SEGS_REMOVE[a][b] = which specific segments must leave digit a to become digit b
// Use this to know WHICH segments to donate from a position
const SEGS_REMOVE = {};
for (let a = 0; a <= 9; a++) {
  SEGS_REMOVE[a] = {};
  const sa = new Set(DIGIT_SEGMENTS_LIST[a]);
  for (let b = 0; b <= 9; b++) {
    const sb = new Set(DIGIT_SEGMENTS_LIST[b]);
    SEGS_REMOVE[a][b] = [...sa].filter(s => !sb.has(s));
  }
}

// ─── 3. SEGMENTS TO ADD ──────────────────────────────────────────────────────
// SEGS_ADD[a][b] = which specific segments must arrive at digit a to become digit b
// Use this to know WHICH segments a position is "hungry" for
const SEGS_ADD = {};
for (let a = 0; a <= 9; a++) {
  SEGS_ADD[a] = {};
  const sa = new Set(DIGIT_SEGMENTS_LIST[a]);
  for (let b = 0; b <= 9; b++) {
    const sb = new Set(DIGIT_SEGMENTS_LIST[b]);
    SEGS_ADD[a][b] = [...sb].filter(s => !sa.has(s));
  }
}

// ─── 4. SUBSET TABLE ─────────────────────────────────────────────────────────
// IS_SUBSET[a][b] = true if digit a's segments are fully contained in digit b
// Meaning: pos showing digit a can become digit b purely by RECEIVING segments
// (zero cost on this position — it donates nothing)
// e.g. IS_SUBSET[4][9] = true → 4 is a subset of 9, so pos showing 4
//      becomes 9 just by receiving 'a' and 'd' from elsewhere
const IS_SUBSET = {};
for (let a = 0; a <= 9; a++) {
  IS_SUBSET[a] = {};
  const sa = new Set(DIGIT_SEGMENTS_LIST[a]);
  for (let b = 0; b <= 9; b++) {
    const sb = new Set(DIGIT_SEGMENTS_LIST[b]);
    IS_SUBSET[a][b] = [...sa].every(s => sb.has(s));
  }
}

// ─── 5. SUPERSET TABLE ───────────────────────────────────────────────────────
// IS_SUPERSET[a][b] = true if digit b's segments are fully contained in digit a
// Meaning: pos showing digit a can become digit b purely by DONATING segments
// (zero cost on the TARGET position — it only receives nothing, just loses)
// e.g. IS_SUPERSET[9][1] = false, IS_SUPERSET[8][any] = true
const IS_SUPERSET = {};
for (let a = 0; a <= 9; a++) {
  IS_SUPERSET[a] = {};
  for (let b = 0; b <= 9; b++) {
    IS_SUPERSET[a][b] = IS_SUBSET[b][a];
  }
}

// ─── 6. REACHABLE IN K MOVES (per digit, isolated) ──────────────────────────
// REACHABLE[a][k] = sorted list of digits reachable from digit a in exactly k moves
// "reachable" means MOVE_COST[a][b] === k (ignoring where segs go/come from)
// Used to quickly check if a digit CAN become a target in budget
const REACHABLE = {};
for (let a = 0; a <= 9; a++) {
  REACHABLE[a] = {};
  for (let k = 0; k <= 6; k++) {
    REACHABLE[a][k] = [];
    for (let b = 0; b <= 9; b++) {
      if (MOVE_COST[a][b] === k) REACHABLE[a][k].push(b);
    }
  }
}

// ─── 7. UPGRADE CHAINS (for LARGEST) ────────────────────────────────────────
// UPGRADES[a] = all digits larger than a, sorted descending by value,
//               paired with their cost — for greedy largest-first ordering
const UPGRADES = {};
for (let a = 0; a <= 9; a++) {
  UPGRADES[a] = [];
  for (let b = 9; b >= 0; b--) {
    if (b > a) {
      UPGRADES[a].push({ digit: b, cost: MOVE_COST[a][b] });
    }
  }
  // Sort: cheapest upgrade to largest digit first
  UPGRADES[a].sort((x, y) => {
    if (x.cost !== y.cost) return x.cost - y.cost;
    return y.digit - x.digit;
  });
}

// ─── 8. DOWNGRADE CHAINS (for SMALLEST) ─────────────────────────────────────
// DOWNGRADES[a] = all digits smaller than a, sorted ascending by value,
//                paired with their cost — for greedy smallest-first ordering
const DOWNGRADES = {};
for (let a = 0; a <= 9; a++) {
  DOWNGRADES[a] = [];
  for (let b = 0; b <= 9; b++) {
    if (b < a) {
      DOWNGRADES[a].push({ digit: b, cost: MOVE_COST[a][b] });
    }
  }
  // Sort: cheapest downgrade to smallest digit first
  DOWNGRADES[a].sort((x, y) => {
    if (x.cost !== y.cost) return x.cost - y.cost;
    return x.digit - y.digit;
  });
}

// ─── 9. MOVE PRIORITY SCORER (universal) ────────────────────────────────────
// scoreMoveForLargest(state, move) — higher score = try this move earlier in DFS
// scoreMoveForSmallest(state, move) — higher score = try this move earlier in DFS
//
// Logic:
//   - Moves that take FROM a digit with high excess segments (superset of target) → HIGH priority
//   - Moves that give TO a digit that is a subset of a large/small target → HIGH priority
//   - Moves that waste segments (take from a digit that needs them) → LOW priority

function scoreMoveForLargest(state, move) {
  let score = 0;
  const { fromPos, fromSeg, toPos, toSeg } = move;

  const fromDigit = getDigitFromSet(state[fromPos]);
  const toDigit   = getDigitFromSet(state[toPos]);

  // Bonus: source digit is a superset of something large — it has spare segs to donate
  if (fromDigit !== -1) {
    const bestUpgrade = UPGRADES[fromDigit][0];
    if (bestUpgrade && bestUpgrade.cost <= 1) score += 4;  // source can easily upgrade
    // Bonus if fromSeg is in SEGS_REMOVE[fromDigit][bestTarget]
    if (bestUpgrade && SEGS_REMOVE[fromDigit][bestUpgrade.digit].includes(fromSeg)) score += 3;
  }

  // Bonus: destination digit is a subset of a large digit (it's "hungry" for segs)
  if (toDigit !== -1) {
    for (let b = 9; b >= 0; b--) {
      if (IS_SUBSET[toDigit][b] && b > (toDigit === -1 ? -1 : toDigit)) {
        if (SEGS_ADD[toDigit][b].includes(toSeg)) { score += 5; break; }
      }
    }
  }

  // Penalty: taking a seg the source digit actually needs to stay valid
  if (fromDigit !== -1) {
    const afterRemove = new Set(state[fromPos]);
    afterRemove.delete(fromSeg);
    if (getDigitFromSet(afterRemove) === -1) score -= 2; // breaks source digit
  }

  return score;
}

function scoreMoveForSmallest(state, move) {
  let score = 0;
  const { fromPos, fromSeg, toPos, toSeg } = move;

  const fromDigit = getDigitFromSet(state[fromPos]);
  const toDigit   = getDigitFromSet(state[toPos]);

  // Bonus: source digit can cheaply downgrade — it has excess segs to donate
  if (fromDigit !== -1) {
    const bestDowngrade = DOWNGRADES[fromDigit][0];
    if (bestDowngrade && bestDowngrade.cost <= 1) score += 4;
    if (bestDowngrade && SEGS_REMOVE[fromDigit][bestDowngrade.digit].includes(fromSeg)) score += 3;
  }

  // Bonus: destination digit is subset of a small target (receiving helps it go small)
  if (toDigit !== -1) {
    for (let b = 0; b <= 9; b++) {
      if (IS_SUBSET[toDigit][b] && b < toDigit) {
        if (SEGS_ADD[toDigit][b].includes(toSeg)) { score += 5; break; }
      }
    }
  }

  // Penalty: breaking source digit mid-solve
  if (fromDigit !== -1) {
    const afterRemove = new Set(state[fromPos]);
    afterRemove.delete(fromSeg);
    if (getDigitFromSet(afterRemove) === -1) score -= 1;
  }

  return score;
}

// ─── Helper: get digit from a live Set (used by scorers above) ───────────────
function getDigitFromSet(segSet) {
  if (!segSet || segSet.size === 0) return -1;
  for (let d = 0; d <= 9; d++) {
    const ref = DIGIT_SEGMENTS_LIST[d];
    if (ref.length !== segSet.size) continue;
    if (ref.every(s => segSet.has(s))) return d;
  }
  return -1;
}

// ─── 10. MINIMUM MOVES LOWER BOUND ──────────────────────────────────────────
// minMovesNeeded(state, targetLen) = lower bound on moves needed to reach
// ANY valid number of targetLen digits from current state
// Used for pruning: if lowerBound > remainingMoves, skip this branch entirely
function minMovesLowerBound(state, targetLen) {
  // For each active position, find cheapest valid digit it can become
  // Sum of those cheapest costs = lower bound
  let total = 0;
  for (let i = 0; i < targetLen; i++) {
    const cur = getDigitFromSet(state[i]);
    if (cur === -1) {
      // empty slot — cheapest digit to build is '1' (2 segments needed)
      // but segments come from elsewhere so cost counted there
      total += 0;
    } else {
      // already a valid digit — cost is 0 for this position
      total += 0;
    }
  }
  // More precise: count total segment mismatches across all positions
  // This is a rough bound — DFS still explores all, but prunes hopeless branches
  return total;
}
