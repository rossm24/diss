export function makeInitialState(arr) {
  const rootId = 0;
  const root = makeNode(rootId, 0, arr.length - 1);

  return {
    arr,
    nodes: { [rootId]: root },
    rootId,
    nextId: 1,
    activeId: rootId,     // what we focus in UI
    lastAction: null,     // { type, nodeId, details }
  };
}

function makeNode(id, l, r) {
  return {
    id,
    l,
    r,
    mid: null,
    leftId: null,
    rightId: null,
    status: "unsplit", // "unsplit" | "split" | "solved"
    summary: null,
  };
}

// helpers for what to get next

export function findNextDivideTarget(state) {
  // preorder: smallest interval first 
  const ids = Object.keys(state.nodes).map(Number).sort((a, b) => a - b);
  for (const id of ids) {
    const n = state.nodes[id];
    if (n.status === "unsplit" && n.l < n.r) return id;
  }
  return null;
}

export function findNextConquerTarget(state) {
  // leaf nodes that are unsolved
  const ids = Object.keys(state.nodes).map(Number).sort((a, b) => a - b);
  for (const id of ids) {
    const n = state.nodes[id];
    if (isLeaf(n) && n.status !== "solved") return id;
  }
  return null;
}

export function findNextCombineTarget(state) {
  // internal nodes with children solved but itself not solved
  const ids = Object.keys(state.nodes).map(Number).sort((a, b) => a - b);
  for (const id of ids) {
    const n = state.nodes[id];
    if (n.status === "split" && n.leftId != null && n.rightId != null) {
      const L = state.nodes[n.leftId];
      const R = state.nodes[n.rightId];
      if (L?.status === "solved" && R?.status === "solved" && n.status !== "solved") {
        return id;
      }
    }
  }
  return null;
}

function isLeaf(n) {
  return n.l === n.r;
}

// steps

export function stepDivide(state) {
  const targetId = findNextDivideTarget(state);
  if (targetId == null) return state;

  const nodes = { ...state.nodes };
  const n = nodes[targetId];

  const mid = Math.floor((n.l + n.r) / 2);
  const leftId = state.nextId;
  const rightId = state.nextId + 1;

  nodes[leftId] = makeNode(leftId, n.l, mid);
  nodes[rightId] = makeNode(rightId, mid + 1, n.r);

  nodes[targetId] = {
    ...n,
    mid,
    leftId,
    rightId,
    status: "split",
  };

  return {
    ...state,
    nodes,
    nextId: state.nextId + 2,
    activeId: targetId,
    lastAction: { type: "DIVIDE", nodeId: targetId, details: { mid, leftId, rightId } },
  };
}

export function stepConquer(state) {
  const targetId = findNextConquerTarget(state);
  if (targetId == null) return state;

  const nodes = { ...state.nodes };
  const n = nodes[targetId];
  const x = state.arr[n.l];

  const summary = {
    sum: x,
    pref: x,
    suff: x,
    best: x,
    prefRange: [n.l, n.l],
    suffRange: [n.l, n.l],
    bestRange: [n.l, n.l],
  };

  nodes[targetId] = {
    ...n,
    status: "solved",
    summary,
  };

  return {
    ...state,
    nodes,
    activeId: targetId,
    lastAction: { type: "CONQUER", nodeId: targetId, details: { x } },
  };
}

export function stepCombine(state) {
  const targetId = findNextCombineTarget(state);
  if (targetId == null) return state;

  const nodes = { ...state.nodes };
  const n = nodes[targetId];
  const L = nodes[n.leftId];
  const R = nodes[n.rightId];

  const A = L.summary;
  const B = R.summary;

  // combine formulas
  const sum = A.sum + B.sum;

  // pref
  let pref, prefRange;
  if (A.pref >= A.sum + B.pref) {
    pref = A.pref;
    prefRange = A.prefRange;
  } else {
    pref = A.sum + B.pref;
    prefRange = [A.prefRange[0], B.prefRange[1]];
  }

  // suff
  let suff, suffRange;
  if (B.suff >= B.sum + A.suff) {
    suff = B.suff;
    suffRange = B.suffRange;
  } else {
    suff = B.sum + A.suff;
    suffRange = [A.suffRange[0], B.suffRange[1]];
  }

  // best: max(A.best, B.best, A.suff + B.pref)
  const crossVal = A.suff + B.pref;
  let best = A.best;
  let bestRange = A.bestRange;
  let bestCase = "LEFT";

  if (B.best > best) {
    best = B.best;
    bestRange = B.bestRange;
    bestCase = "RIGHT";
  }
  if (crossVal > best) {
    best = crossVal;
    bestRange = [A.suffRange[0], B.prefRange[1]];
    bestCase = "CROSS";
  }

  const summary = {
    sum,
    pref,
    suff,
    best,
    prefRange,
    suffRange,
    bestRange,
  };

  nodes[targetId] = {
    ...n,
    status: "solved",
    summary,
  };

  // animation helper details
  const details = {
    leftId: n.leftId,
    rightId: n.rightId,
    crossVal,
    crossLeftRange: A.suffRange,
    crossRightRange: B.prefRange,
    chosen: bestCase,
  };

  return {
    ...state,
    nodes,
    activeId: targetId,
    lastAction: { type: "COMBINE", nodeId: targetId, details },
  };
}

// convenience for UI buttons
export function canDivide(state) {
  return findNextDivideTarget(state) != null;
}
export function canConquer(state) {
  return findNextConquerTarget(state) != null;
}
export function canCombine(state) {
  return findNextCombineTarget(state) != null;
}
