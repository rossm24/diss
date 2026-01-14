// src/algorithms/cpop/logic.js

// ---------- geometry helpers ----------
export function dist2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function bruteForceBest(points, ids) {
  let best = null;
  const comparisons = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const A = points[ids[i]];
      const B = points[ids[j]];
      const d2 = dist2(A, B);
      comparisons.push({ a: ids[i], b: ids[j], d2 });
      if (!best || d2 < best.d2) best = { a: ids[i], b: ids[j], d2 };
    }
  }
  return { best, comparisons };
}

function pickMedianX(points, ids) {
  const sorted = [...ids].sort((i, j) => points[i].x - points[j].x);
  const midIdx = Math.floor(sorted.length / 2);
  const midId = sorted[midIdx];
  const midX = points[midId].x;
  return { midX, sortedByX: sorted, midId };
}

function buildStrip(points, ids, midX, d2) {
  if (!Number.isFinite(d2)) return [];
  const d = Math.sqrt(d2);
  const strip = ids.filter((pid) => Math.abs(points[pid].x - midX) < d);
  strip.sort((i, j) => points[i].y - points[j].y);
  return strip;
}

/**
 * Classic strip check:
 * for each strip[i], compare to next up to 7 points by y-order.
 * Returns best crossing pair (or null).
 */
function stripBest(points, stripIds, currentBestD2) {
  let best = null;
  let bestD2 = currentBestD2;

  const comparisons = [];
  for (let i = 0; i < stripIds.length; i++) {
    for (let j = i + 1; j < stripIds.length && j <= i + 7; j++) {
      const a = stripIds[i];
      const b = stripIds[j];
      const d2 = dist2(points[a], points[b]);
      comparisons.push({ a, b, d2 });
      if (d2 < bestD2) {
        bestD2 = d2;
        best = { a, b, d2 };
      }
    }
  }
  return { best, comparisons };
}

// ---------- solver state ----------
/**
 * points: array of {id, x, y}
 * We store points in a map-like array indexed by id for speed:
 * pointsById[id] = {id,x,y}
 */
export function makeInitialState(rawPoints = []) {
  const pointsById = [];
  for (const p of rawPoints) pointsById[p.id] = p;

  const ids = rawPoints.map((p) => p.id);

  const root = {
    id: 0,
    parent: null,
    ids, // point IDs in this subproblem
    midX: null,
    left: null,
    right: null,

    phase: "idle", // idle | divided | leftDone | rightDone | combined | done

    // results
    best: null, // {a,b,d2}
    // visuals
    stripIds: [],
    stripD2: Infinity,

    // step visuals
    baseComparisons: [], // pair comparisons in base case
    stripComparisons: [], // comparisons during combine
    lastCompared: null, // {a,b} to highlight a comparison
  };

  return {
    pointsById,
    nextNodeId: 1,
    nodes: [root],
    activeNodeId: 0,
    globalBest: null,
    // UI toggles
    micro: true,
  };
}

export function getNode(state, nodeId = state.activeNodeId) {
  return state.nodes[nodeId];
}

function isLeaf(node) {
  return node.left == null && node.right == null;
}

function isDivided(node) {
  return node.left != null && node.right != null;
}

// DFS order for a deterministic "next"
function dfsOrder(nodes, startId = 0) {
  const out = [];
  const stack = [startId];
  while (stack.length) {
    const id = stack.pop();
    const n = nodes[id];
    if (!n) continue;
    out.push(id);
    // push right then left so left is visited first
    if (n.right != null) stack.push(n.right);
    if (n.left != null) stack.push(n.left);
  }
  return out;
}

// Next segment to divide: first leaf with >3 points (in DFS order)
function findNextDivideTarget(state) {
  const order = dfsOrder(state.nodes, 0);
  for (const id of order) {
    const n = state.nodes[id];
    if (!n) continue;
    if (isLeaf(n) && n.ids.length > 3) return id;
  }
  return null;
}

// Next segment to conquer: first leaf with <=3 points and not solved
function findNextConquerTarget(state) {
  const order = dfsOrder(state.nodes, 0);
  for (const id of order) {
    const n = state.nodes[id];
    if (!n) continue;
    if (isLeaf(n) && n.ids.length <= 3 && n.phase !== "done") return id;
  }
  return null;
}

// Next segment to combine: deepest parent whose children are done but it isn't
function findNextCombineTarget(state) {
  const order = dfsOrder(state.nodes, 0);
  // reverse so we combine bottom-up
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i];
    const n = state.nodes[id];
    if (!n) continue;
    if (!isDivided(n)) continue;
    if (n.phase === "done") continue;

    const L = state.nodes[n.left];
    const R = state.nodes[n.right];
    if (L?.phase === "done" && R?.phase === "done") return id;
  }
  return null;
}


function setGlobalBest(state, candidate) {
  if (!candidate) return;
  if (!state.globalBest || candidate.d2 < state.globalBest.d2) {
    state.globalBest = candidate;
  }
}

// ---------- actions: Divide / Conquer / Combine ----------
export function canDivide(state) {
  return findNextDivideTarget(state) != null;
}

export function stepDivide(state) {
  const s = structuredClone(state);

  const targetId = findNextDivideTarget(s);
  if (targetId == null) return s;

  const node = getNode(s, targetId);

  const { midX, sortedByX } = pickMedianX(s.pointsById, node.ids);
  const mid = Math.floor(sortedByX.length / 2);

  const leftIds = sortedByX.slice(0, mid);
  const rightIds = sortedByX.slice(mid);

  const leftId = s.nextNodeId++;
  const rightId = s.nextNodeId++;

  s.nodes[leftId] = {
    id: leftId,
    parent: node.id,
    ids: leftIds,
    midX: null,
    left: null,
    right: null,
    phase: "idle",
    best: null,
    stripIds: [],
    stripD2: Infinity,
    baseComparisons: [],
    stripComparisons: [],
    lastCompared: null,
  };

  s.nodes[rightId] = {
    id: rightId,
    parent: node.id,
    ids: rightIds,
    midX: null,
    left: null,
    right: null,
    phase: "idle",
    best: null,
    stripIds: [],
    stripD2: Infinity,
    baseComparisons: [],
    stripComparisons: [],
    lastCompared: null,
  };

  node.midX = midX;
  node.left = leftId;
  node.right = rightId;
  node.phase = "divided";
  node.best = null;
  node.stripIds = [];
  node.stripComparisons = [];
  node.lastCompared = null;

  // focus the node we just divided (or left child if you prefer)
  s.activeNodeId = node.id;

  return s;
}


export function canConquer(state) {
  return findNextConquerTarget(state) != null;
}

export function stepConquer(state) {
  const s = structuredClone(state);

  const targetId = findNextConquerTarget(s);
  if (targetId == null) return s;

  const node = getNode(s, targetId);

  const { best, comparisons } = bruteForceBest(s.pointsById, node.ids);
  node.baseComparisons = comparisons;
  node.lastCompared = comparisons.length ? { a: comparisons[0].a, b: comparisons[0].b } : null;
  node.best = best;
  node.phase = "done";
  setGlobalBest(s, best);

  s.activeNodeId = node.id;
  return s;
}


export function canCombine(state) {
  return findNextCombineTarget(state) != null;
}

export function stepCombine(state) {
  const s = structuredClone(state);

  const targetId = findNextCombineTarget(s);
  if (targetId == null) return s;

  const node = getNode(s, targetId);
  const L = getNode(s, node.left);
  const R = getNode(s, node.right);

  const bestLR =
    !L.best ? R.best : !R.best ? L.best : (L.best.d2 <= R.best.d2 ? L.best : R.best);

  const d2 = bestLR ? bestLR.d2 : Infinity;

  node.stripD2 = d2;
  node.stripIds = buildStrip(s.pointsById, node.ids, node.midX, d2);

  const { best: bestStrip, comparisons: stripComparisons } = stripBest(
    s.pointsById,
    node.stripIds,
    d2
  );

  node.stripComparisons = stripComparisons;
  node.lastCompared = stripComparisons.length
    ? { a: stripComparisons[0].a, b: stripComparisons[0].b }
    : null;

  node.best = bestStrip && bestStrip.d2 < d2 ? bestStrip : bestLR;
  node.phase = "done";
  setGlobalBest(s, node.best);

  s.activeNodeId = node.id;
  return s;
}


// ---------- utility: reset solver focus without deleting points ----------
export function resetSolverKeepingPoints(state) {
  const rawPoints = Object.values(state.pointsById).filter(Boolean);
  return makeInitialState(rawPoints);
}
