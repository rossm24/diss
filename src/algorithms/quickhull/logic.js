// contains algorithm logic and state management for quickhull 

// geometry helpers
export function orient(a, b, p) {
  // cross((b-a),(p-a))
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
}

export function isLeft(a, b, p, eps = 1e-12) {
  return orient(a, b, p) > eps;
}

// compute furthest distance from line AB to point P
export function lineDistanceAbs(a, b, p) {
  const cross = Math.abs(orient(a, b, p));
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const denom = Math.hypot(dx, dy) || 1;
  return cross / denom;
}

// store hull edges with a unique key to avoid duplicates
export function uniqueEdgeKey(aId, bId) {
  return aId < bId ? `${aId}-${bId}` : `${bId}-${aId}`;
}

// random point generation
export function makeRandomPoints(n = 25, seed = null) {
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

// find leftmost and rightmost points
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

// pick the point furthest from the line 
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

// once we have pivot P for edge A-B, split outside set into S1 and S2
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

// state init

// empty state is used when we have less than 2 points
function emptyState(points, pointsById, usedSeed = null) {
  return {
    points,
    pointsById,
    nextProblemId: 0,
    problems: [],
    activeProblemId: null,
    hullEdges: [],
    traceEdges: [],
    traceTriangles: [],
    removed: {},
    lastAction: null,
    finished: true,
    introPhase: "pre",
    meta: { nPoints: points.length, seed: usedSeed, minId: null, maxId: null },
  };
}

// create new state (used by randomise and clear)
export function makeInitialState({ nPoints = 25, seed = null } = {}) {
  const { points, seed: usedSeed } = makeRandomPoints(nPoints, seed);

  const pointsById = {};
  for (const p of points) pointsById[p.id] = p;

  if (points.length < 2) {
    return emptyState(points, pointsById, usedSeed);
  }

  // find the baseline points
  const { minId, maxId } = findMinMaxX(points);
  const allIds = points.map((p) => p.id);

  // two directed problems: upper and lower chain
  const upper = idsLeftOfDirected(pointsById, minId, maxId, allIds);
  const lower = idsLeftOfDirected(pointsById, maxId, minId, allIds);

  const problems = [
    { id: 0, aId: minId, bId: maxId, setIds: upper, pivotId: null, status: "todo", chain: "upper" },
    { id: 1, aId: maxId, bId: minId, setIds: lower, pivotId: null, status: "todo", chain: "lower" },
  ];

  return {
    points,
    pointsById,

    // start with no problems, first divide will create baseline split
    nextProblemId: 0,
    problems: [],
    activeProblemId: null,

    // baseline split sets are empty until first divide
    baselineUpper: [],
    baselineLower: [],

    // hull and trace edges start empty 
    hullEdges: [],
    traceEdges: [],
    traceTriangles: [],
    removed: {},
    lastAction: null,
    finished: false,
    didInitialSplit: false,

    // start with phase "pre" to indicate we haven't done baseline split yet
    // first divide will create the baseline split 
    introPhase: "pre",
    activeChain: null,

    // baseline endpoints stored here
    meta: { nPoints, seed: usedSeed, minId, maxId },
  };
}

// similar to the above function, but creates the state from a given set of points (randomise)
export function makeStateFromPoints(points) {
  // points: [{id,x,y}] in [0,1]
  const pointsById = {};
  for (const p of points) pointsById[p.id] = p;

  if (points.length < 2) {
    return emptyState(points, pointsById, null);
  }

  const { minId, maxId } = findMinMaxX(points);
  const allIds = points.map((p) => p.id);

  const upper = idsLeftOfDirected(pointsById, minId, maxId, allIds);
  const lower = idsLeftOfDirected(pointsById, maxId, minId, allIds);

  return {
    points,
    pointsById,
    nextProblemId: 2,
    problems: [
      { id: 0, aId: minId, bId: maxId, setIds: upper, pivotId: null, status: "todo", chain: "upper" },
      { id: 1, aId: maxId, bId: minId, setIds: lower, pivotId: null, status: "todo", chain: "lower" },
    ],
    activeProblemId: null,
    hullEdges: [],
    traceEdges: [],
    traceTriangles: [],
    baselineUpper: [],
    baselineLower: [],
    removed: {},
    lastAction: null,
    finished: false,
    didInitialSplit: false,
    introPhase: "pre",
    activeChain: null,
    meta: { nPoints: points.length, seed: null, minId, maxId },
  };
}


// step logic (Divide / Conquer / Combine) 

// pick the next subproblem to work on 
function findNextDividableProblem(state) {
  for (let i = state.problems.length - 1; i >= 0; i--) {
    const pr = state.problems[i];
    if (pr.status === "todo" && pr.setIds.length > 0) return pr.id;
  }
  return null;
}

// if active subproblem is pivoted, return it
function findActivePivotedProblem(state) {
  if (state.activeProblemId == null) return null;
  const pr = state.problems.find((p) => p.id === state.activeProblemId);
  if (!pr) return null;
  if (pr.status !== "pivoted") return null;
  return pr;
}

// combine step helper: add hull edge if not already present
function addHullEdge(state, aId, bId) {
  const key = uniqueEdgeKey(aId, bId);
  if (state.hullEdges.some((e) => e.key === key)) return state;
  return { ...state, hullEdges: [...state.hullEdges, { aId, bId, key }] };
}

/*
Divide button behaviour:
1. introPhase = "pre"
    - perform baseline split
    - split points into upper and lower sets
    - create two initial problems
    - set introPhase = "baseline"
2. otherwise
    - pick next dividable problem (todo with points)
    - if none, do nothing
    - for chosen problem, find furthest point from line AB
    - set pivotId and status = "pivoted"
    - set activeProblemId to conquer 
*/
export function stepDivide(state) {
  if (state.finished) return state;

  // first divide baseline split only 
  if ((state.introPhase ?? "pre") === "pre") {
    if (state.points.length < 2) {
      return { ...state, lastAction: { type: "DIVIDE_NONE", reason: "Need at least 2 points" } };
    }

    const { minId, maxId } = state.meta;
    const allIds = state.points.map((p) => p.id);

    const upper = idsLeftOfDirected(state.pointsById, minId, maxId, allIds);
    const lower = idsLeftOfDirected(state.pointsById, maxId, minId, allIds);

    const problems = [
      { id: 0, aId: minId, bId: maxId, setIds: upper, pivotId: null, status: "todo", chain: "upper" },
      { id: 1, aId: maxId, bId: minId, setIds: lower, pivotId: null, status: "todo", chain: "lower" },
    ];

    // adds baseline edge to trace edges
    const traceEdges = [
      ...(state.traceEdges ?? []),
      { aId: minId, bId: maxId, type: "base" },
    ];

    return {
      ...state,
      problems,
      nextProblemId: 2,
      baselineUpper: upper,
      baselineLower: lower,
      traceEdges,
      didInitialSplit: true,
      introPhase: "baseline",
      lastAction: { type: "DIVIDE_BASELINE", edge: [minId, maxId] },
    };
  }

  // further divides: choose furthest point for active problem

  // if we already have an active pivoted problem, skip (need to conquer first)
  if (findActivePivotedProblem(state)) {
    return { ...state, lastAction: { type: "DIVIDE_SKIPPED" } };
  }

  const targetId = findNextDividableProblem(state);
  if (targetId == null) {
    return { ...state, lastAction: { type: "DIVIDE_NONE" } };
  }

  // update the chosen problem with its pivot point
  const problems = state.problems.map((pr) => {
    if (pr.id !== targetId) return pr;

    const { bestId, bestD } = farthestPointFromLine(
      state.pointsById,
      pr.aId,
      pr.bId,
      pr.setIds
    );

    return { ...pr, pivotId: bestId, pivotDist: bestD, status: "pivoted" };
  });

  const chosen = problems.find((p) => p.id === targetId);

  // add a trace edge showing where we are measuring from 
  const traceEdges = [
    ...(state.traceEdges ?? []),
    { aId: chosen.aId, bId: chosen.bId, type: "active" },
  ];

  return {
    ...state,
    problems,
    traceEdges,
    activeProblemId: targetId,
    activeChain: chosen?.chain ?? null,
    introPhase: (state.introPhase ?? "pre") === "baseline" ? "pivot" : state.introPhase,
    lastAction: { type: "DIVIDE", problemId: targetId },
  };
}

/*
Conquer behaviour:

requires active pivoted problem
given active problem with edge A-B and pivot P:
- split outside set into S1 and S2
- discard points inside triangle A-P-B
- replace active problem with two new problems:
- add trace triangles and edges for visualisation 
*/
export function stepConquer(state) {
  if (state.finished) return state;

  const active = findActivePivotedProblem(state);
  if (!active) return { ...state, lastAction: { type: "CONQUER_NONE" } };

  const { aId, bId, pivotId, setIds } = active;
  if (pivotId == null) return { ...state, lastAction: { type: "CONQUER_ERROR" } };

  // split outside set into S1 and S2
  const { s1, s2 } = splitOutsideSets(state.pointsById, aId, pivotId, bId, setIds);

  // points not in s1 or s2 (and not the pivot) are inside triangle A-P-B, so discard
  const s1Set = new Set(s1);
  const s2Set = new Set(s2);

  const discarded = [];
  for (const id of setIds) {
  if (id === pivotId) continue;
  if (!s1Set.has(id) && !s2Set.has(id)) discarded.push(id);
  }

  const removed = { ...(state.removed ?? {}) };
  for (const id of discarded) removed[id] = true;

  // create two new child problems, same chain as parent 
  const leftProblem = {
    id: state.nextProblemId,
    aId,
    bId: pivotId,
    setIds: s1,
    pivotId: null,
    status: "todo",
    chain: active.chain,
  };

  const rightProblem = {
    id: state.nextProblemId + 1,
    aId: pivotId,
    bId,
    setIds: s2,
    pivotId: null,
    status: "todo",
    chain: active.chain,
  };

  // record triangle for visualisation
  const traceTriangles = [
    ...(state.traceTriangles ?? []),
    { aId, pId: pivotId, bId },
  ];

  const traceEdges = [
    ...(state.traceEdges ?? []),
    { aId, bId: pivotId, type: "split" },
    { aId: pivotId, bId, type: "split" },
  ];

  // replace parent problem with its two children 
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
    introPhase: "running",
    lastAction: { type: "CONQUER", problemId: active.id },
  };
}


/*
Combine behaviour:
- if a subproblem has no outside points, its edge A-B is part of the hull
- add edge to hullEdges and remove the problem from the todo list 
*/
export function stepCombine(state) {
  if (state.finished) return state;

  // find a problem with no outside points
  const idx = state.problems.findIndex((p) => p.status === "todo" && p.setIds.length === 0);

  // nothing to combine yet 
  if (idx === -1) {
    // if no remaining then we are done 
    const done = findNextDividableProblem(state) == null && state.activeProblemId == null;
    return { ...state, finished: done, lastAction: { type: "COMBINE_NONE", finished: done } };
  }

  const pr = state.problems[idx];

  // add hull edge and remove problem
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
  // allow first divide (baseline) if we have at least 2 points and haven't split yet
  if ((state.introPhase ?? "pre") === "pre") {
    return state.points.length >= 2;
  }

  if (state.finished) return false;
  // can divide if there exists a todo problem with points AND we are not holding a pivoted active problem
  const active = state.activeProblemId == null
    ? null
    : state.problems.find((p) => p.id === state.activeProblemId) || null;

  // if user already has an active pivoted problem, cannot divide again, need to conquer first
  if (active && active.status === "pivoted") return false;

  return state.problems.some((p) => p.status === "todo" && p.setIds.length > 0);
}

// can conquer only true if we have an active pivoted problem
export function canConquer(state) {
  if (state.finished) return false;
  const active = state.activeProblemId == null
    ? null
    : state.problems.find((p) => p.id === state.activeProblemId) || null;
  return !!(active && active.status === "pivoted" && active.pivotId != null);
}

// true when there exists a problem with no outside points
export function canCombine(state) {
  if (state.finished) return false;
  return state.problems.some((p) => p.status === "todo" && p.setIds.length === 0);
}

