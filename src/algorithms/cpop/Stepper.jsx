import React, { useMemo, useState, forwardRef, useImperativeHandle } from "react";
import {
  makeInitialState,
  stepDivide,
  stepConquer,
  stepCombine,
  canDivide,
  canConquer,
  canCombine,
  resetSolverKeepingPoints,
  dist2,
} from "./logic.js";

/* quiz helpers */

function pickRandomN(arr, n) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}


const CPOP_QUESTIONS = [
  {
    id: "cpop_q1_split_by_median_x",
    trigger: "DIVIDE_FIRST",
    prompt: "Why does the algorithm split the points by the median x-coordinate instead of splitting the plane into equal-width columns?",
    options: [
      "To ensure each recursive subproblem has roughly the same number of points",
      "To minimise the physical width of each region",
      "To guarantee the closest pair lies entirely in one half",
    ],
    correctIndex: 0,
    hint: "Divide-and-conquer efficiency depends on balanced subproblem sizes by count.",
    why: "Splitting by x-order keeps the recursion balanced (roughly half the points each side).",
  },
  {
    id: "cpop_q2_stop_at_2_3",
    trigger: "DIVIDE_FIRST",
    prompt: "Why do we stop dividing at 2–3 points in this algorithm instead of going down to 1 point like in many other algorithms?",
    options: [
      "Because a single point has no distance to compare, so the algorithm would fail",
      "Because with 2–3 points we can compute the closest pair in constant time, so further recursion is unnecessary",
      "Because splitting further would break the balance of the recursion tree",
    ],
    correctIndex: 1,
    hint: "Think about constant work at the base case.",
    why: "For 2–3 points, brute force is O(1), so recursion beyond that doesn’t help.",
  },
  {
    id: "cpop_q3_strip_useful",
    trigger: "COMBINE_READY",
    prompt: "When combining 2 segments, why is the column around the section line useful?",
    options: [
      "Because only points within that distance can produce a closer pair than we already have",
      "Because cross-border pairs will never be closer than an in-segment pair",
      "Because every point in the left segment must be compared with every point in the right segment",
    ],
    correctIndex: 0,
    hint: "The strip width is tied to the best distance found in the two halves.",
    why: "If a point is farther than d from the boundary, it can’t beat the best in-half distance d.",
  },
  {
    id: "cpop_q4_strip_width",
    trigger: "STRIP_SHOWN",
    prompt: "The width of the shaded strip during the combine step is determined by:",
    options: [
      "The total width of the two segments",
      "The smallest distance found in the two halves",
      "The number of points near the boundary",
    ],
    correctIndex: 1,
    hint: "The strip is ±d from the midline, where d is the current best distance from the halves.",
    why: "We only need to search within distance d of the boundary because anything beyond can’t beat d.",
  },
  {
    id: "cpop_q5_not_all_strip_pairs",
    trigger: "STRIP_SHOWN",
    prompt: "After building the strip, why do we not compare every pair of points inside it?",
    options: [
      "Because geometry guarantees each point only needs to be compared to a small constant number of nearby points",
      "Because recursion has already eliminated all cross-border pairs",
      "Because sorting by x means the nearest pair must be adjacent",
    ],
    correctIndex: 0,
    hint: "Sorting strip points by y limits how many neighbours each point needs to check.",
    why: "In the strip, each point only needs to check a constant number of subsequent points in y-order.",
  },
  {
    id: "cpop_q6_purpose_of_combine",
    trigger: "COMBINE_FIRST",
    prompt: "What is the main purpose of the combine step in the Closest Pair algorithm?",
    options: [
      "To merge two sorted lists of points",
      "To check whether a closer pair exists across the dividing line",
      "To reorder the points for the next recursion",
    ],
    correctIndex: 1,
    hint: "Combine is about cross-border candidates.",
    why: "Combine checks for a potentially closer pair that crosses the boundary between the two halves.",
  },
];

function primaryBtn(enabled, colorClass) {
  return [
    "px-4 py-2 rounded text-white disabled:opacity-50 disabled:cursor-not-allowed",
    "transition shadow-sm",
    colorClass,
    enabled
      ? "hover:brightness-110 active:brightness-95"
      : "opacity-50 cursor-not-allowed",
  ].join(" ");
}


function secondaryBtn() {
  return [
    "px-4 py-2 rounded bg-white border text-slate-800 hover:bg-slate-50",
    "transition",
  ].join(" ");
}

function getAncestors(nodes, nodeId) {
  const set = new Set();
  let cur = nodes[nodeId];
  while (cur && cur.parent != null) {
    set.add(cur.parent);
    cur = nodes[cur.parent];
  }
  return set;
}

function getDepth(nodes, nodeId) {
  let d = 0;
  let cur = nodes[nodeId];
  while (cur && cur.parent != null) {
    d++;
    cur = nodes[cur.parent];
  }
  return d;
}



function fmtD2(d2) {
  if (!Number.isFinite(d2)) return "∞";
  return Math.sqrt(d2).toFixed(2);
}

function NodeBadge({ node, isActive, onClick }) {
  const phase =
    node.ids.length <= 3
      ? (node.best ? "base✓" : "base")
      : node.left == null
      ? "unsplit"
      : node.best
      ? "done✓"
      : "split";

  return (
    <button
      onClick={onClick}
      className={
        "w-full text-left px-3 py-2 rounded text-sm border " +
        (isActive ? "bg-black text-white" : "bg-white")
      }
    >
      <div className="flex items-center justify-between">
        <div className="font-semibold">Node {node.id}</div>
        <div className="opacity-80">{phase}</div>
      </div>
      <div className="mt-1 opacity-90 flex justify-between">
        <div>n={node.ids.length}</div>
        <div>d={node.best ? fmtD2(node.best.d2) : "—"}</div>
      </div>
    </button>
  );
}

function buildTreeRows(nodes) {
  // simple BFS grouping by depth
  const rows = [];
  if (!nodes[0]) return rows;

  const q = [{ id: 0, depth: 0 }];
  const seen = new Set();

  while (q.length) {
    const { id, depth } = q.shift();
    if (seen.has(id) || !nodes[id]) continue;
    seen.add(id);

    if (!rows[depth]) rows[depth] = [];
    rows[depth].push(id);

    const n = nodes[id];
    if (n.left != null) q.push({ id: n.left, depth: depth + 1 });
    if (n.right != null) q.push({ id: n.right, depth: depth + 1 });
  }
  return rows;
}

function computeNodeBounds(nodes, nodeId, viewW) {
  let xL = 0;
  let xR = viewW;

  let cur = nodes[nodeId];
  while (cur && cur.parent != null) {
    const parent = nodes[cur.parent];
    if (!parent || parent.midX == null) break;

    if (parent.left === cur.id) {
      // cur is left child => right boundary is parent's split line
      xR = Math.min(xR, parent.midX);
    } else if (parent.right === cur.id) {
      // cur is right child => left boundary is parent's split line
      xL = Math.max(xL, parent.midX);
    }

    cur = parent;
  }

  return { xL, xR };
}


export default function CPoPStepper() {
  const [state, setState] = useState(() => makeInitialState([]));

  // quiz mode state 
  const [teachingEnabled, setTeachingEnabled] = useState(false);
  const [runQuestions, setRunQuestions] = useState([]); // exactly 3 chosen per run

  // shown vs answered
  const [shownIds, setShownIds] = useState(() => new Set());
  const [answeredIds, setAnsweredIds] = useState(() => new Set());

  const [activeQ, setActiveQ] = useState(null);
  const [showHint, setShowHint] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);

  // refs
  const shownIdsRef = React.useRef(new Set());
  const answeredIdsRef = React.useRef(new Set());
  const runQuestionsRef = React.useRef([]);
  const activeQRef = React.useRef(null);
  const teachingEnabledRef = React.useRef(false);

  React.useEffect(() => { shownIdsRef.current = shownIds; }, [shownIds]);
  React.useEffect(() => { answeredIdsRef.current = answeredIds; }, [answeredIds]);
  React.useEffect(() => { runQuestionsRef.current = runQuestions; }, [runQuestions]);
  React.useEffect(() => { activeQRef.current = activeQ; }, [activeQ]);
  React.useEffect(() => { teachingEnabledRef.current = teachingEnabled; }, [teachingEnabled]);

  const pool = teachingEnabled && runQuestions.length > 0 ? runQuestions : CPOP_QUESTIONS;
  const totalQuestions = teachingEnabled ? pool.length : CPOP_QUESTIONS.length;

  const answeredCount = answeredIds.size;

  const teachingBlocked = teachingEnabled && !!activeQ;

  const active = state.nodes[state.activeNodeId];

  const points = useMemo(
    () => Object.values(state.pointsById).filter(Boolean),
    [state.pointsById]
  );

  const view = {
    w: 720,
    h: 420,
    pad: 14,
  };

  const activeIds = active?.ids ?? [];
  const activeSet = useMemo(() => new Set(activeIds), [activeIds]);

  const globalBestSeg = useMemo(() => {
    const gb = state.globalBest;
    if (!gb) return null;
    const A = state.pointsById[gb.a];
    const B = state.pointsById[gb.b];
    if (!A || !B) return null;
    return { A, B, d2: gb.d2 };
  }, [state.globalBest, state.pointsById]);

  const nodeBestSeg = useMemo(() => {
    if (!active?.best) return null;
    const A = state.pointsById[active.best.a];
    const B = state.pointsById[active.best.b];
    if (!A || !B) return null;
    return { A, B, d2: active.best.d2 };
  }, [active, state.pointsById]);

  const lastComparedSeg = useMemo(() => {
    if (!active?.lastCompared) return null;
    const A = state.pointsById[active.lastCompared.a];
    const B = state.pointsById[active.lastCompared.b];
    if (!A || !B) return null;
    return { A, B, d2: dist2(A, B) };
  }, [active, state.pointsById]);

  const treeRows = useMemo(() => buildTreeRows(state.nodes), [state.nodes]);

  const ancestorSet = useMemo(
    () => getAncestors(state.nodes, state.activeNodeId),
    [state.nodes, state.activeNodeId]
  );

  const activeBestSet = useMemo(() => {
    const n = state.nodes[state.activeNodeId];
    if (!n?.best) return new Set();
    return new Set([n.best.a, n.best.b]);
  }, [state.nodes, state.activeNodeId]);

  const globalBestSet = useMemo(() => {
    if (!state.globalBest) return new Set();
    return new Set([state.globalBest.a, state.globalBest.b]);
  }, [state.globalBest]);

  const activeBounds = useMemo(() => {
    return computeNodeBounds(state.nodes, state.activeNodeId, view.w);
  }, [state.nodes, state.activeNodeId, view.w]);



  const splitLines = useMemo(() => {
    const out = [];
    for (const n of state.nodes) {
      if (!n) continue;
      if (n.midX == null) continue;          // only nodes that have been divided
      if (n.left == null || n.right == null) continue; // quick check for valid split 

      out.push({
        id: n.id,
        x: n.midX,
        depth: getDepth(state.nodes, n.id),
        isActive: n.id === state.activeNodeId,
        isAncestor: ancestorSet.has(n.id),
      });
    }

    // draw shallow (higher) lines on top or bottom
    out.sort((a, b) => a.depth - b.depth);
    return out;
  }, [state.nodes, state.activeNodeId, ancestorSet]);

  const combineShading = useMemo(() => {
    const n = state.nodes[state.activeNodeId];
    if (!n || n.left == null || n.right == null) return null;

    const L = state.nodes[n.left];
    const R = state.nodes[n.right];
    if (!L || !R) return null;

    const leftPts = L.ids.map((id) => state.pointsById[id]).filter(Boolean);
    const rightPts = R.ids.map((id) => state.pointsById[id]).filter(Boolean);
    if (!leftPts.length || !rightPts.length) return null;

    const minXLeft = Math.min(...leftPts.map((p) => p.x));
    const maxXLeft = Math.max(...leftPts.map((p) => p.x));
    const minXRight = Math.min(...rightPts.map((p) => p.x));
    const maxXRight = Math.max(...rightPts.map((p) => p.x));

    return { minXLeft, maxXLeft, minXRight, maxXRight };
  }, [state.nodes, state.activeNodeId, state.pointsById]);

  const activeSegmentBounds = useMemo(() => {
    const n = state.nodes[state.activeNodeId];
    if (!n) return null;

    const pts = n.ids.map((id) => state.pointsById[id]).filter(Boolean);
    if (!pts.length) return null;

    const minX = Math.min(...pts.map((p) => p.x));
    const maxX = Math.max(...pts.map((p) => p.x));
    return { minX, maxX };
  }, [state.nodes, state.activeNodeId, state.pointsById]);




  function addPointFromClick(evt) {
    const svg = evt.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;

    const ctm = svg.getScreenCTM();
    if (!ctm) return;

    const svgP = pt.matrixTransform(ctm.inverse());

    setState((s) => {
      const points = Object.values(s.pointsById).filter(Boolean);
      const nextId = points.length ? Math.max(...points.map((p) => p.id)) + 1 : 0;

      if (teachingEnabledRef.current) startNewQuizRun();

      const ns = structuredClone(s);
      ns.pointsById[nextId] = {
        id: nextId,
        x: Math.round(svgP.x),
        y: Math.round(svgP.y),
      };

      return resetSolverKeepingPoints(ns);
    });
  }



  function randomPoints(n = 20) {
    setState((s) => {
      const ns = structuredClone(s);

      if (teachingEnabledRef.current) startNewQuizRun();

      const existing = Object.values(ns.pointsById).filter(Boolean);
      let nextId = existing.length ? Math.max(...existing.map((p) => p.id)) + 1 : 0;

      for (let i = 0; i < n; i++) {
        const id = nextId++;
        ns.pointsById[id] = {
          id,
          x: Math.round(view.pad + Math.random() * (view.w - 2 * view.pad)),
          y: Math.round(view.pad + Math.random() * (view.h - 2 * view.pad)),
        };
      }

      return resetSolverKeepingPoints(ns);
    });
  }

  function clearPoints() {
    setState(makeInitialState([]));
    if (teachingEnabledRef.current) startNewQuizRun();
  }

  function resetSolver() {
    setState((s) => resetSolverKeepingPoints(s));
  }

  function doDivide() {
    if (teachingBlocked) return;

    const prev = state;
    const next = stepDivide(prev);

    if (next !== prev) {
      setState(next);

      // trigger DIVIDE_FIRST the first time root gets a midline
      const prevHadSplit = prev.nodes?.[0]?.midX != null;
      const nextHadSplit = next.nodes?.[0]?.midX != null;
      if (!prevHadSplit && nextHadSplit) {
        maybeActivateQuestion(prev, next, "DIVIDE_FIRST");
      }
    }
  }
  
  function doConquer() {
    if (teachingBlocked) return;

    const prev = state;
    const next = stepConquer(prev);

    if (next !== prev) {
      setState(next);

      // When a leaf first gains a best pair -> Conquer leaf
      const prevActive = prev.nodes[prev.activeNodeId];
      const nextActive = next.nodes[next.activeNodeId];

      const prevLeafSolved = !!prevActive?.best && (prevActive?.ids?.length ?? 99) <= 3;
      const nextLeafSolved = !!nextActive?.best && (nextActive?.ids?.length ?? 99) <= 3;

      if (!prevLeafSolved && nextLeafSolved) {
        maybeActivateQuestion(prev, next, "CONQUER_LEAF");
      }
    }
  }
  
  function doCombine() {
    if (teachingBlocked) return;

    const prev = state;

    // combine-ready transition BEFORE we step
    const prevCombineReady = canCombine(prev);

    const next = stepCombine(prev);

    if (next !== prev) {
      setState(next);

      const nextCombineReady = canCombine(next);

      // first time combine becomes available
      if (!prevCombineReady && nextCombineReady) {
        maybeActivateQuestion(prev, next, "COMBINE_READY");
        return;
      }

      // first time we actually combine at the root (or first combine in run)
      if (!prev.nodes?.[0]?.best && next.nodes?.[0]?.best) {
        maybeActivateQuestion(prev, next, "COMBINE_FIRST");
      }

      // show strip question once we have strip info on active node
      const prevActive = prev.nodes[prev.activeNodeId];
      const nextActive = next.nodes[next.activeNodeId];
      const prevStrip = Number.isFinite(prevActive?.stripD2) && prevActive.stripD2 < Infinity;
      const nextStrip = Number.isFinite(nextActive?.stripD2) && nextActive.stripD2 < Infinity;
      if (!prevStrip && nextStrip) {
        maybeActivateQuestion(prev, next, "STRIP_SHOWN");
      }
    }
  }

  const answerQuestion = (idx) => {
    if (!activeQ || activeQ.status !== "unanswered") return;

    const correct = idx === activeQ.correctIndex;
    if (correct) setCorrectCount((c) => c + 1);

    // mark as answered 
    const nextAnswered = new Set(answeredIdsRef.current);
    nextAnswered.add(activeQ.id);
    answeredIdsRef.current = nextAnswered;
    setAnsweredIds(nextAnswered);

    setActiveQ({
      ...activeQ,
      chosenIndex: idx,
      status: correct ? "correct" : "incorrect",
    });

    setShowHint(false);
  };

  const skipQuestion = () => {
    if (activeQ) {
      const nextAnswered = new Set(answeredIdsRef.current);
      nextAnswered.add(activeQ.id);
      answeredIdsRef.current = nextAnswered;
      setAnsweredIds(nextAnswered);
    }
    setActiveQ(null);
    setShowHint(false);
  };

  const continueAfterAnswer = () => {
    setActiveQ(null);
    setShowHint(false);
  };

  const startNewQuizRun = () => {
    const chosen = pickRandomN(CPOP_QUESTIONS, 3);

    setRunQuestions(chosen);
    setShownIds(new Set());
    setAnsweredIds(new Set());
    setActiveQ(null);
    setShowHint(false);
    setCorrectCount(0);

    runQuestionsRef.current = chosen;
    shownIdsRef.current = new Set();
    answeredIdsRef.current = new Set();
    activeQRef.current = null;
  };

  const maybeActivateQuestion = (prevState, nextState, eventTag) => {
    if (!teachingEnabledRef.current) return;
    if (activeQRef.current) return;

    const poolNow =
      (runQuestionsRef.current && runQuestionsRef.current.length > 0)
        ? runQuestionsRef.current
        : CPOP_QUESTIONS;

    // cap by ANSWERED, not SHOWN
    if (answeredIdsRef.current.size >= poolNow.length) return;

    const candidates = poolNow.filter(
      (q) => q.trigger === eventTag && !shownIdsRef.current.has(q.id)
    );
    if (candidates.length === 0) return;

    // ask exactly ONE per event
    const q = candidates[Math.floor(Math.random() * candidates.length)];

    const nextShown = new Set(shownIdsRef.current);
    nextShown.add(q.id);

    shownIdsRef.current = nextShown;
    setShownIds(nextShown);

    setActiveQ({ ...q, status: "unanswered", chosenIndex: null });
    setShowHint(false);
  };

  const midX = active?.midX;
  const showMidLine = active?.left != null && active?.midX != null;

  //const showStrip = active?.stripIds?.length > 0 && Number.isFinite(active.stripD2);

  const childrenDone =
    active?.left != null &&
    active?.right != null &&
    state.nodes[active.left]?.phase === "done" &&
    state.nodes[active.right]?.phase === "done";

  const showStrip = childrenDone && Number.isFinite(active?.stripD2) && active.stripD2 < Infinity;


  const stripHalfWidth = showStrip ? Math.sqrt(active.stripD2) : 0;

    return (
    <div className="text-slate-900">
      {/* Header row (page-native, no card wrapper) */}
      <div className="flex items-start justify-between gap-3 mb-3 max-w-3xl">
        <div>
          <div className="text-2xl font-bold text-gray-900">Closest Pair of Points</div>
          <div className="text-sm text-slate-600">
            Click to add points, or Randomise for a random set of points.
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => randomPoints(10)} className={secondaryBtn()}>
            Randomise
          </button>
          <button onClick={clearPoints} className={secondaryBtn()}>
            Clear
          </button>
          <button onClick={resetSolver} className={primaryBtn(true, "bg-blue-600")}>
            Start
          </button>
        </div>
      </div>

      {/* Canvas (this is the only bordered “panel”, like your other algos) */}
      
      <svg
        viewBox={`0 0 ${view.w} ${view.h}`}
        preserveAspectRatio="xMidYMid meet"
        className="block w-full max-w-3xl aspect-[12/7] rounded-xl border bg-white cursor-crosshair"
        onClick={addPointFromClick}
      >
        {/* Shade halves being combined (fills to segment bounds via activeBounds) */}
        {childrenDone && active?.midX != null && (
          <>
            <rect
              x={activeBounds.xL}
              y={0}
              width={Math.max(0, active.midX - activeBounds.xL)}
              height={view.h}
              fill="rgb(99,102,241)"   // indigo (left half)
              opacity={0.1}
            />
            <rect
              x={active.midX}
              y={0}
              width={Math.max(0, activeBounds.xR - active.midX)}
              height={view.h}
              fill="rgb(99,102,241)"   // indigo (right half)
              opacity={0.1}
            />
          </>
        )}

        {/* strip band (search region within d of the boundary) */}
        {showStrip && (
          <rect
            x={active.midX - stripHalfWidth}
            y={0}
            width={2 * stripHalfWidth}
            height={view.h}
            fill="rgb(99,102,241)" // indigo
            opacity={0.15}
          />
        )}

        {/* all median split lines */}
        {splitLines.map((ln) => {
          const opacity = ln.isActive ? 0.85 : ln.isAncestor ? 0.35 : 0.15;
          const strokeWidth = ln.isActive ? 4 : ln.isAncestor ? 2.5 : 2;
          const depthFade = Math.max(0.06, 1 - ln.depth * 0.08);

          return (
            <line
              key={ln.id}
              x1={ln.x}
              x2={ln.x}
              y1={0}
              y2={view.h}
              stroke="rgb(15, 23, 42)"
              strokeWidth={strokeWidth}
              opacity={opacity * depthFade}
            />
          );
        })}

        {/* global best (faint) */}
        {globalBestSeg && (
          <line
            x1={globalBestSeg.A.x}
            y1={globalBestSeg.A.y}
            x2={globalBestSeg.B.x}
            y2={globalBestSeg.B.y}
            stroke="rgb(124,58,237)"
            strokeWidth={4}
            opacity={0.15}
          />
        )}

        {/* node best */}
        {nodeBestSeg && (
          <line
            x1={nodeBestSeg.A.x}
            y1={nodeBestSeg.A.y}
            x2={nodeBestSeg.B.x}
            y2={nodeBestSeg.B.y}
            stroke="rgb(16,185,129)"
            strokeWidth={4}
            opacity={0.5}
          />
        )}

        {/* last compared */}
        {lastComparedSeg && (
          <line
            x1={lastComparedSeg.A.x}
            y1={lastComparedSeg.A.y}
            x2={lastComparedSeg.B.x}
            y2={lastComparedSeg.B.y}
            stroke="rgb(15,23,42)"
            strokeWidth={2}
            opacity={0.0}
            strokeDasharray="6 4"
          />
        )}

        {/* points */}
        {points.map((p) => {
          const inActive = activeSet.has(p.id);
          const inStrip = active?.stripIds?.includes(p.id);

          const isActiveBest = activeBestSet.has(p.id);
          const isGlobalBest = globalBestSet.has(p.id);

          const r = isActiveBest ? 7 : inActive ? 5 : 4;
          const op = inActive ? 1 : 0.35;

          return (
            <g key={p.id}>
              <circle
                cx={p.x}
                cy={p.y}
                r={r}
                opacity={op}
                fill={isActiveBest ? "rgb(16,185,129)" : "black"}
                stroke={isGlobalBest ? "rgb(124,58,237)" : "none"}
                strokeWidth={isGlobalBest ? 3 : 0}
              />
              {inStrip && (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={r + 3}
                  fill="rgb(99,102,241)"
                  opacity={0.20}
                />
              )}
            </g>
          );
        })}
      </svg>

      {teachingEnabled && activeQ && (
        <div className="bg-white border rounded p-4 max-w-3xl">
          <div className="text-sm font-semibold text-gray-900">{activeQ.prompt}</div>

          <div className="mt-3 space-y-2">
            {activeQ.options.map((opt, idx) => {
              const isChosen = activeQ.chosenIndex === idx;
              const showResult = activeQ.status !== "unanswered";
              const isCorrectOption = showResult && idx === activeQ.correctIndex;
              const isWrongChosen = showResult && activeQ.status === "incorrect" && isChosen;

              return (
                <button
                  key={`${activeQ.id}_${idx}`}
                  disabled={activeQ.status !== "unanswered"}
                  onClick={() => answerQuestion(idx)}
                  className={[
                    "w-full text-left text-sm text-gray-900 border rounded-lg px-3 py-2 transition",
                    activeQ.status === "unanswered" ? "hover:bg-gray-50" : "",
                    isCorrectOption ? "border-green-500 bg-green-50" : "",
                    isWrongChosen ? "border-red-500 bg-red-50" : "",
                    activeQ.status === "unanswered" && isChosen ? "border-blue-400 bg-blue-50" : "",
                    !isCorrectOption && !isWrongChosen && !(activeQ.status === "unanswered" && isChosen)
                      ? "border-gray-200"
                      : "",
                    showResult && !isCorrectOption && !isWrongChosen ? "opacity-80" : "",
                  ].join(" ")}
                >
                  {opt}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center gap-2">
            {activeQ.status === "unanswered" ? (
              <>
                <button
                  className="text-xs px-3 py-1 border rounded-lg hover:bg-gray-50 text-gray-900"
                  onClick={() => setShowHint((v) => !v)}
                >
                  Hint?
                </button>

                <button
                  className="text-xs px-3 py-1 border rounded-lg hover:bg-gray-50 text-gray-900"
                  onClick={skipQuestion}
                >
                  Skip
                </button>

                <div className="ml-auto text-xs text-gray-500">Answer to continue</div>
              </>
            ) : (
              <>
                <div className="text-xs text-gray-700">
                  {activeQ.status === "correct" ? "Correct!" : "Not quite."} {activeQ.why}
                </div>
                <button
                  className="ml-auto text-xs px-3 py-1 border rounded-lg hover:bg-gray-50 text-gray-900"
                  onClick={continueAfterAnswer}
                >
                  Continue
                </button>
              </>
            )}
          </div>

          {activeQ.status === "unanswered" && showHint && (
            <div className="mt-2 text-xs text-gray-600 border-t pt-2">{activeQ.hint}</div>
          )}
        </div>
      )}

      {/* Controls row underneath (uniform with your other algos) */}
        <div className="mt-3 flex flex-wrap items-center gap-2 max-w-5xl mx-auto">
          <button
            onClick={doDivide}
            disabled={teachingBlocked || !canDivide(state)}
            className={primaryBtn(canDivide(state), "bg-emerald-600")}
          >
            Divide
          </button>

          <button
            onClick={doConquer}
            disabled={teachingBlocked || !canConquer(state)}
            className={primaryBtn(canConquer(state), "bg-teal-600")}
          >
            Conquer
          </button>

          <button
            onClick={doCombine}
            disabled={teachingBlocked || !canCombine(state)}
            className={primaryBtn(canCombine(state), "bg-purple-600")}
          >
            Combine
          </button>

          {/* right side: quiz toggle */}
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="min-w-[335px] flex justify-end">
              {teachingEnabled && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalQuestions }).map((_, i) => {
                      let color = "bg-gray-300";
                      if (i < answeredCount) {
                        color = i < correctCount ? "bg-emerald-600" : "bg-red-500";
                      }
                      return <span key={i} className={`h-2.5 w-2.5 rounded-full ${color}`} />;
                    })}
                  </div>
                  <div className="text-xs text-gray-600">
                    {correctCount}/{totalQuestions}
                  </div>
                </div>
              )}
            </div>

            <span className="text-sm text-gray-800">Quiz Mode</span>

            <button
              type="button"
              role="switch"
              aria-checked={teachingEnabled}
              onClick={() => {
                const on = !teachingEnabled;
                setTeachingEnabled(on);
                if (!on) {
                  setActiveQ(null);
                  setShowHint(false);
                  setRunQuestions([]);

                  setShownIds(new Set());
                  setAnsweredIds(new Set());
                  shownIdsRef.current = new Set();
                  answeredIdsRef.current = new Set();

                  runQuestionsRef.current = [];
                  activeQRef.current = null;
                } else {
                  startNewQuizRun();
                }
              }}
              className={[
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                teachingEnabled ? "bg-indigo-600" : "bg-gray-300",
                "focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2",
              ].join(" ")}
              title={teachingEnabled ? "Quiz Mode is ON" : "Quiz Mode is OFF"}
            >
              <span
                className={[
                  "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
                  teachingEnabled ? "translate-x-5" : "translate-x-1",
                ].join(" ")}
              />
            </button>
          </div>

          {teachingBlocked && (
            <div className="w-full text-xs text-gray-500">
              Quiz mode: answer/skip the question to continue
            </div>
          )}
        </div>
    </div>
  );
}
