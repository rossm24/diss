// src/algorithms/cpop/Stepper.jsx
import React, { useMemo, useState } from "react";
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

function primaryBtn(enabled, colorClass) {
  return [
    "px-3 py-2 rounded text-sm font-semibold text-white",
    "transition shadow-sm",
    colorClass,
    enabled
      ? "hover:brightness-110 active:brightness-95"
      : "opacity-50 cursor-not-allowed",
  ].join(" ");
}


function secondaryBtn() {
  return [
    "px-3 py-1.5 rounded border",
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

export default function CPoPStepper() {
  const [state, setState] = useState(() => makeInitialState([]));

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

  const splitLines = useMemo(() => {
    const out = [];
    for (const n of state.nodes) {
      if (!n) continue;
      if (n.midX == null) continue;          // only nodes that have been divided
      if (n.left == null || n.right == null) continue; // sanity

      out.push({
        id: n.id,
        x: n.midX,
        depth: getDepth(state.nodes, n.id),
        isActive: n.id === state.activeNodeId,
        isAncestor: ancestorSet.has(n.id),
      });
    }

    // optional: draw shallow (higher) lines on top or bottom
    out.sort((a, b) => a.depth - b.depth);
    return out;
  }, [state.nodes, state.activeNodeId, ancestorSet]);


  function addPointFromClick(evt) {
    const svg = evt.currentTarget.getBoundingClientRect();
    const x = evt.clientX - svg.left;
    const y = evt.clientY - svg.top;

    const id = (points.length ? Math.max(...points.map((p) => p.id)) : -1) + 1;

    const p = {
      id,
      x: Math.round(x),
      y: Math.round(y),
    };

    setState((s) => {
      const ns = structuredClone(s);
      ns.pointsById[id] = p;
      return ns;
    });
  }

  function randomPoints(n = 20) {
    setState((s) => {
      const ns = structuredClone(s);
      const existing = Object.values(ns.pointsById).filter(Boolean);
      let nextId =
        existing.length ? Math.max(...existing.map((p) => p.id)) + 1 : 0;

      for (let i = 0; i < n; i++) {
        const id = nextId++;
        ns.pointsById[id] = {
          id,
          x: Math.round(view.pad + Math.random() * (view.w - 2 * view.pad)),
          y: Math.round(view.pad + Math.random() * (view.h - 2 * view.pad)),
        };
      }
      return ns;
    });
  }

  function clearPoints() {
    setState(makeInitialState([]));
  }

  function resetSolver() {
    setState((s) => resetSolverKeepingPoints(s));
  }

  function doDivide() {
    setState((s) => stepDivide(s));
  }
  function doConquer() {
    setState((s) => stepConquer(s));
  }
  function doCombine() {
    setState((s) => stepCombine(s));
  }

  const midX = active?.midX;
  const showMidLine = active?.left != null && active?.midX != null;

  const showStrip = active?.stripIds?.length > 0 && Number.isFinite(active.stripD2);

  const stripHalfWidth = showStrip ? Math.sqrt(active.stripD2) : 0;

  return (
    <div className="grid grid-cols-12 gap-4">
      {/* LEFT: canvas */}
      <div className="col-span-8">
        <div className="p-3 rounded-2xl border bg-white">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <div className="font-semibold text-black">Closest Pair of Points</div>
              <div className="text-xs text-black opacity-70">
                Click to add points, or Randomise for a random set of points.
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => randomPoints(20)} className={`${secondaryBtn()} text-black px-3 py-2 rounded`}>
                    Randomise
                </button>
                <button onClick={clearPoints} className={`${secondaryBtn()} text-black px-3 py-2 rounded`}>
                    Clear
                </button>
                <button onClick={resetSolver} className={`${secondaryBtn()} text-white bg-blue-600 px-3 py-2 rounded`}>
                    Start
                </button>
            </div>
          </div>

          <svg
            width={view.w}
            height={view.h}
            className="w-full rounded-xl border bg-white cursor-crosshair"
            onClick={addPointFromClick}
          >
            {/* strip band */}
            {showStrip && showMidLine && (
              <rect
                x={midX - stripHalfWidth}
                y={0}
                width={2 * stripHalfWidth}
                height={view.h}
                opacity={0.08}
              />
            )}

            {/* all median split lines */}
            {splitLines.map((ln) => {
              // Make active line strongest, ancestors medium, others faint.
              const opacity = ln.isActive ? 0.85 : ln.isAncestor ? 0.35 : 0.15;
              const strokeWidth = ln.isActive ? 4 : ln.isAncestor ? 2.5 : 2;

              // If you want depth to matter visually, slightly reduce opacity with depth:
              const depthFade = Math.max(0.06, 1 - ln.depth * 0.08);

              return (
                <line
                  key={ln.id}
                  x1={ln.x}
                  x2={ln.x}
                  y1={0}
                  y2={view.h}
                  stroke="rgb(15, 23, 42)" // slate-900-ish (dark)
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
                strokeWidth={2}
                opacity={0.75}
                strokeDasharray="6 4"
              />
            )}

            {/* points */}
            {points.map((p) => {
              const inActive = activeSet.has(p.id);
              const inStrip = active?.stripIds?.includes(p.id);
              const r = inActive ? 5 : 4;
              const op = inActive ? 1 : 0.35;

              return (
                <g key={p.id}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={r}
                    opacity={op}
                  />
                  {inStrip && (
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={r + 3}
                      opacity={0.12}
                    />
                  )}
                </g>
              );
            })}
          </svg>

          <div className="mt-3 flex items-center gap-2 disabled:opacity-50">
            <button
                onClick={doDivide}
                disabled={!canDivide(state)}
                className={primaryBtn(canDivide(state), "bg-emerald-600")}
            >
                Divide
            </button>

            <button
                onClick={doConquer}
                disabled={!canConquer(state)}
                className={primaryBtn(canConquer(state), "bg-teal-600")}
            >
                Conquer
            </button>

            <button
                onClick={doCombine}
                disabled={!canCombine(state)}
                className={primaryBtn(canCombine(state), "bg-purple-600")}
            >
                Combine
            </button>


            <div className="ml-auto text-sm opacity-80">
              Active node: <span className="font-semibold">{state.activeNodeId}</span>{" "}
              | Global best:{" "}
              <span className="font-semibold">
                {state.globalBest ? fmtD2(state.globalBest.d2) : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* comparisons panel */}
        <div className="mt-4 p-3 rounded-2xl border bg-white">
          <div className="font-semibold mb-2">Active Node Details</div>

          {!active ? (
            <div className="text-sm opacity-70">No active node.</div>
          ) : (
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="p-3 rounded-xl border">
                <div className="font-semibold mb-1">Subproblem</div>
                <div>n = {active.ids.length}</div>
                <div>phase = {active.phase}</div>
                <div>midX = {active.midX == null ? "—" : Math.round(active.midX)}</div>
              </div>

              <div className="p-3 rounded-xl border">
                <div className="font-semibold mb-1">Best in Node</div>
                {active.best ? (
                  <>
                    <div>
                      pair = ({active.best.a}, {active.best.b})
                    </div>
                    <div>d = {fmtD2(active.best.d2)}</div>
                  </>
                ) : (
                  <div className="opacity-70">—</div>
                )}
              </div>

              <div className="p-3 rounded-xl border">
                <div className="font-semibold mb-1">Strip</div>
                {showStrip ? (
                  <>
                    <div>d = {fmtD2(active.stripD2)}</div>
                    <div>strip size = {active.stripIds.length}</div>
                    <div className="opacity-70">(within |x-midX| &lt; d)</div>
                  </>
                ) : (
                  <div className="opacity-70">—</div>
                )}
              </div>

              <div className="col-span-3 p-3 rounded-xl border">
                <div className="font-semibold mb-2">Comparisons (most recent)</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-xs opacity-70 mb-1">Base-case</div>
                    <div className="text-xs">
                      {active.baseComparisons.length
                        ? active.baseComparisons.slice(0, 8).map((c, i) => (
                            <div key={i}>
                              ({c.a},{c.b}) d={fmtD2(c.d2)}
                            </div>
                          ))
                        : <div className="opacity-60">—</div>}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs opacity-70 mb-1">Strip</div>
                    <div className="text-xs">
                      {active.stripComparisons.length
                        ? active.stripComparisons.slice(0, 8).map((c, i) => (
                            <div key={i}>
                              ({c.a},{c.b}) d={fmtD2(c.d2)}
                            </div>
                          ))
                        : <div className="opacity-60">—</div>}
                    </div>
                  </div>
                </div>

                <div className="mt-2 text-xs opacity-70">
                  Tip: If Divide/Conquer/Combine are disabled, check you pressed “Reset Solver”
                  after adding points.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: recursion tree */}
      <div className="col-span-4">
        <div className="p-3 rounded-2xl border bg-white">
          <div className="font-semibold mb-2">Recursion Tree</div>
          <div className="text-xs opacity-70 mb-3">
            Click a node to focus. Divide splits a node. Conquer solves leaves (≤3). Combine merges.
          </div>

          <div className="space-y-3">
            {treeRows.map((row, depth) => (
              <div key={depth} className="space-y-2">
                <div className="text-xs font-semibold opacity-70">
                  Depth {depth}
                </div>
                <div className="space-y-2">
                  {row.map((nid) => {
                    const node = state.nodes[nid];
                    return (
                      <NodeBadge
                        key={nid}
                        node={node}
                        isActive={nid === state.activeNodeId}
                        onClick={() =>
                          setState((s) => ({ ...s, activeNodeId: nid }))
                        }
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 text-xs opacity-70">
            Workflow: add points → Reset Solver → Divide until leaves → Conquer (solves leaves) → Combine upward.
          </div>
        </div>
      </div>
    </div>
  );
}
