// src/algorithms/quickhull/logic.js

// ---------------- Geometry helpers ----------------

export function orient(a, b, p) {
  // cross((b-a),(p-a))
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
}

export function isLeft(a, b, p, eps = 1e-12) {
  return orient(a, b, p) > eps;
}

export function lineDistanceAbs(a, b, p) {
  const cross = Math.abs(orient(a, b, p));
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const denom = Math.hypot(dx, dy) || 1;
  return cross / denom;
}

export function uniqueEdgeKey(aId, bId) {
  return aId < bId ? `${aId}-${bId}` : `${bId}-${aId}`;
}

// ---------------- Random points ----------------

export function makeRandomPoints(n = 25, seed = null) {
  // simple deterministic LCG if seed supplied
  let s = seed == null ? Math.floor(Math.random() * 1e9) : seed >>> 0;

  const rand = () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 2 ** 32;
  };

  const points = [];
  for (let i = 0; i < n; i++) {
    const x = 0.06 + 0.88 * rand();
    const y = 0.06 + 0.88 * rand();
    points.push({ id: i, x, y });
  }
  return { points, seed: s };
}

export function findMinMaxX(points) {
  let min = points[0];
  let max = points[0];
  for (const p of points) {
    if (p.x < min.x) min = p;
    if (p.x > max.x) max = p;
  }
  return { minId: min.id, maxId: max.id };
}

export function idsLeftOfDirected(pointsById, aId, bId, candidateIds) {
  const a = pointsById[aId];
  const b = pointsById[bId];
  const out = [];
  for (const id of candidateIds) {
    if (id === aId || id === bId) continue;
    const p = pointsById[id];
    if (isLeft(a, b, p)) out.push(id);
  }
  return out;
}

export function farthestPointFromLine(pointsById, aId, bId, setIds) {
  const a = pointsById[aId];
  const b = pointsById[bId];
  let bestId = null;
  let bestD = -Infinity;

  for (const id of setIds) {
    const p = pointsById[id];
    const d = lineDistanceAbs(a, b, p);
    if (d > bestD) {
      bestD = d;
      bestId = id;
    }
  }
  return { bestId, bestD };
}

export function splitOutsideSets(pointsById, aId, pId, bId, setIds) {
  const a = pointsById[aId];
  const p = pointsById[pId];
  const b = pointsById[bId];

  const s1 = [];
  const s2 = [];

  for (const id of setIds) {
    if (id === pId) continue;
    const q = pointsById[id];

    if (isLeft(a, p, q)) s1.push(id);
    else if (isLeft(p, b, q)) s2.push(id);
    // else discard (inside triangle A-P-B)
  }

  return { s1, s2 };
}

// ---------------- State init ----------------

export function makeInitialState({ nPoints = 25, seed = null } = {}) {
  const { points, seed: usedSeed } = makeRandomPoints(nPoints, seed);

  const pointsById = {};
  for (const p of points) pointsById[p.id] = p;

  const { minId, maxId } = findMinMaxX(points);
  const allIds = points.map((p) => p.id);

  // Two directed problems: upper and lower chain
  const upper = idsLeftOfDirected(pointsById, minId, maxId, allIds);
  const lower = idsLeftOfDirected(pointsById, maxId, minId, allIds);

  const problems = [
    { id: 0, aId: minId, bId: maxId, setIds: upper, pivotId: null, status: "todo" },
    { id: 1, aId: maxId, bId: minId, setIds: lower, pivotId: null, status: "todo" },
  ];

  return {
    points,
    pointsById,
    nextProblemId: 2,
    problems,
    activeProblemId: null,
    hullEdges: [],
    traceEdges: [],
    traceTriangles: [],
    removed: {},
    lastAction: null,
    finished: false,
    meta: { nPoints, seed: usedSeed, minId, maxId },
  };
}

export function makeStateFromPoints(points) {
  // points: [{id,x,y}] in [0,1]
  const pointsById = {};
  for (const p of points) pointsById[p.id] = p;

  const { minId, maxId } = findMinMaxX(points);
  const allIds = points.map((p) => p.id);

  const upper = idsLeftOfDirected(pointsById, minId, maxId, allIds);
  const lower = idsLeftOfDirected(pointsById, maxId, minId, allIds);

  return {
    points,
    pointsById,
    nextProblemId: 2,
    problems: [
      { id: 0, aId: minId, bId: maxId, setIds: upper, pivotId: null, status: "todo" },
      { id: 1, aId: maxId, bId: minId, setIds: lower, pivotId: null, status: "todo" },
    ],
    activeProblemId: null,
    hullEdges: [],
    traceEdges: [],
    traceTriangles: [],
    removed: {},
    lastAction: null,
    finished: false,
    meta: { nPoints: points.length, seed: null, minId, maxId },
  };
}


// ---------------- Step logic (Divide / Conquer / Combine) ----------------

function findNextDividableProblem(state) {
  for (let i = state.problems.length - 1; i >= 0; i--) {
    const pr = state.problems[i];
    if (pr.status === "todo" && pr.setIds.length > 0) return pr.id;
  }
  return null;
}

function findActivePivotedProblem(state) {
  if (state.activeProblemId == null) return null;
  const pr = state.problems.find((p) => p.id === state.activeProblemId);
  if (!pr) return null;
  if (pr.status !== "pivoted") return null;
  return pr;
}

function addHullEdge(state, aId, bId) {
  const key = uniqueEdgeKey(aId, bId);
  if (state.hullEdges.some((e) => e.key === key)) return state;
  return { ...state, hullEdges: [...state.hullEdges, { aId, bId, key }] };
}

export function stepDivide(state) {
  if (state.finished) return state;

  if (findActivePivotedProblem(state)) {
    return { ...state, lastAction: { type: "DIVIDE_SKIPPED" } };
  }

  const targetId = findNextDividableProblem(state);
  if (targetId == null) {
    return { ...state, lastAction: { type: "DIVIDE_NONE" } };
  }

  const problems = state.problems.map((pr) => {
    if (pr.id !== targetId) return pr;

    const { bestId, bestD } = farthestPointFromLine(state.pointsById, pr.aId, pr.bId, pr.setIds);

    return { ...pr, pivotId: bestId, pivotDist: bestD, status: "pivoted" };
  });

  const chosen = problems.find((p) => p.id === targetId);
  const traceEdges = [
  ...(state.traceEdges ?? []),
  { aId: chosen.aId, bId: chosen.bId, type: "active" },    ];

  return {
    ...state,
    problems,
    traceEdges,
    activeProblemId: targetId,
    lastAction: { type: "DIVIDE", problemId: targetId },
  };
}

export function stepConquer(state) {
  if (state.finished) return state;

  const active = findActivePivotedProblem(state);
  if (!active) return { ...state, lastAction: { type: "CONQUER_NONE" } };

  const { aId, bId, pivotId, setIds } = active;
  if (pivotId == null) return { ...state, lastAction: { type: "CONQUER_ERROR" } };

  const { s1, s2 } = splitOutsideSets(state.pointsById, aId, pivotId, bId, setIds);

  // Points not in s1 or s2 (and not the pivot) are inside triangle A-P-B => discard
  const s1Set = new Set(s1);
  const s2Set = new Set(s2);

  const discarded = [];
  for (const id of setIds) {
  if (id === pivotId) continue;
  if (!s1Set.has(id) && !s2Set.has(id)) discarded.push(id);
  }

  const removed = { ...(state.removed ?? {}) };
  for (const id of discarded) removed[id] = true;


  const leftProblem = {
    id: state.nextProblemId,
    aId,
    bId: pivotId,
    setIds: s1,
    pivotId: null,
    status: "todo",
  };

  const rightProblem = {
    id: state.nextProblemId + 1,
    aId: pivotId,
    bId,
    setIds: s2,
    pivotId: null,
    status: "todo",
  };

  const traceTriangles = [
    ...(state.traceTriangles ?? []),
    { aId, pId: pivotId, bId },
  ];

  const traceEdges = [
    ...(state.traceEdges ?? []),
    { aId, bId: pivotId, type: "split" },
    { aId: pivotId, bId, type: "split" },
  ];

  const problems = state.problems
    .filter((p) => p.id !== active.id)
    .concat([leftProblem, rightProblem]);

  return {
    ...state,
    problems,
    traceTriangles,
    traceEdges,
    removed,
    nextProblemId: state.nextProblemId + 2,
    activeProblemId: null,
    lastAction: { type: "CONQUER", problemId: active.id },
  };
}

export function stepCombine(state) {
  if (state.finished) return state;

  const idx = state.problems.findIndex((p) => p.status === "todo" && p.setIds.length === 0);

  if (idx === -1) {
    const done = findNextDividableProblem(state) == null && state.activeProblemId == null;
    return { ...state, finished: done, lastAction: { type: "COMBINE_NONE", finished: done } };
  }

  const pr = state.problems[idx];
  let next = addHullEdge(state, pr.aId, pr.bId);

  const problems = next.problems.filter((p) => p.id !== pr.id);

  next = {
    ...next,
    problems,
    lastAction: { type: "COMBINE", problemId: pr.id, edge: [pr.aId, pr.bId] },
  };

  if (next.problems.length === 0 && next.activeProblemId == null) {
    next = { ...next, finished: true };
  }

  return next;
}

export function canDivide(state) {
  if (state.finished) return false;
  // can divide if there exists a todo problem with points AND we are not holding a pivoted active problem
  const active = state.activeProblemId == null
    ? null
    : state.problems.find((p) => p.id === state.activeProblemId) || null;

  if (active && active.status === "pivoted") return false;

  return state.problems.some((p) => p.status === "todo" && p.setIds.length > 0);
}

export function canConquer(state) {
  if (state.finished) return false;
  const active = state.activeProblemId == null
    ? null
    : state.problems.find((p) => p.id === state.activeProblemId) || null;
  return !!(active && active.status === "pivoted" && active.pivotId != null);
}

export function canCombine(state) {
  if (state.finished) return false;
  return state.problems.some((p) => p.status === "todo" && p.setIds.length === 0);
}

