// component for visuals of the Quickhull algorithm 
// takes current state from logic and draws using svg 

import React from "react";

// internal svg coordinate system used by the main canvas 
const W = 720;
const H = 460;

// colours used to distinguish subproblems (upper vs lower)
const CHAIN_COLOR = {
  upper: "#2563eb", // blue
  lower: "#f97316", // orange
};

// normal coords to pixel coords 
function toPx(p, pad = 20) {
  return {
    x: pad + p.x * (W - 2 * pad),
    y: pad + (1 - p.y) * (H - 2 * pad),
  };
}

export default function QuickhullStepper({
  state,
  editable = false,
  onAddPoint = null,
}) {
  // safetyvvvv check 
  if (!state) return null;

  // step 1: identify active problem 
  const active =
    state.activeProblemId == null
      ? null
      : state.problems.find((p) => p.id === state.activeProblemId) || null;

  // endpoints of active edge 
  const activeA = active ? state.pointsById[active.aId] : null;
  const activeB = active ? state.pointsById[active.bId] : null;
  const pivot = active && active.pivotId != null ? state.pointsById[active.pivotId] : null;

  const activeSet = new Set(active?.setIds ?? []);

  // step 2: gather hull point ids for rendering
  const hullPointIds = new Set();
  for (const e of state.hullEdges) {
    hullPointIds.add(e.aId);
    hullPointIds.add(e.bId);
  }

  // step 3: determine chain colour depending on which half we are in 
  const chain = active?.chain ?? state.activeChain ?? null;
  const chainFill = CHAIN_COLOR[chain] ?? "black";

  return (
    <div className="bg-white border rounded-xl p-0 overflow-hidden">
      {/* aspect ratio wrapper so SVG stays proportional */}
      <div className="w-full" style={{ aspectRatio: `${W} / ${H}` }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className={"w-full h-full block " + (editable ? "cursor-crosshair" : "")}
          onClick={(e) => {
            if (!editable || !onAddPoint) return;

            // convert mouse click into coordinates 
            const rect = e.currentTarget.getBoundingClientRect();
            const sx = e.clientX - rect.left;
            const sy = e.clientY - rect.top;

            // convert from screen px to internal svg coords
            const ux = (sx / rect.width) * W;
            const uy = (sy / rect.height) * H;

            const pad = 20;

            const x = (ux - pad) / (W - 2 * pad);
            const y = 1 - (uy - pad) / (H - 2 * pad);

            if (x < 0 || x > 1 || y < 0 || y > 1) return;
            onAddPoint({ x, y });
          }}
        >
          {/* Trace triangles (history) shows where the algorithm has already been, drawn faintly to not clutter view */}
          {(state.traceTriangles ?? []).map((t, i) => {
            const a = state.pointsById[t.aId];
            const b = state.pointsById[t.bId];
            const p = state.pointsById[t.pId];
            if (!a || !b || !p) return null;

            const A = toPx(a);
            const B = toPx(b);
            const P = toPx(p);

            return (
              <polygon
                key={`tt-${i}-${t.aId}-${t.pId}-${t.bId}`}
                points={`${A.x},${A.y} ${P.x},${P.y} ${B.x},${B.y}`}
                fill="none"
                stroke="black"
                strokeWidth={1}
                opacity={0.1}
              />
            );
          })}

          {/* Trace edges (history) baseline edge, active edge and split edge  */}
          {(state.traceEdges ?? []).map((ed, i) => {
            const a = state.pointsById[ed.aId];
            const b = state.pointsById[ed.bId];
            if (!a || !b) return null;

            const A = toPx(a);
            const B = toPx(b);

            // active = dashed line, else solid but faint
            const dash = ed.type === "active" ? "4 6" : undefined;
            const op = ed.type === "active" ? 0.22 : 0.15;

            return (
              <line
                key={`te-${i}-${ed.aId}-${ed.bId}`}
                x1={A.x}
                y1={A.y}
                x2={B.x}
                y2={B.y}
                stroke="black"
                strokeWidth={1.5}
                strokeDasharray={dash}
                opacity={op}
              />
            );
          })}

          {/* Final hull edges */}
          {state.hullEdges.map((ed) => {
            const a = state.pointsById[ed.aId];
            const b = state.pointsById[ed.bId];
            if (!a || !b) return null;
            const A = toPx(a);
            const B = toPx(b);
            return (
              <line
                key={ed.key}
                x1={A.x}
                y1={A.y}
                x2={B.x}
                y2={B.y}
                stroke="black"
                strokeWidth={3}
                opacity={0.85}
              />
            );
          })}

          {/* Active edge: when a current problem is active, draw its boundary edge */}
          {activeA && activeB && (() => {
            const A = toPx(activeA);
            const B = toPx(activeB);
            return (
              <line
                x1={A.x}
                y1={A.y}
                x2={B.x}
                y2={B.y}
                stroke="black"
                strokeWidth={2}
                strokeDasharray="7 5"
                opacity={0.55}
              />
            );
          })()}

          {/* Current triangle A-P-B : when pivot exists, draw the triangle */}
          {activeA && activeB && pivot && (() => {
            const A = toPx(activeA);
            const B = toPx(activeB);
            const P = toPx(pivot);
            return (
              <polygon
                points={`${A.x},${A.y} ${P.x},${P.y} ${B.x},${B.y}`}
                fill="none"
                stroke="black"
                strokeWidth={1.5}
                opacity={0.25}
              />
            );
          })()}

          {/* Points: draw all points, with special styling for active endpoints, pivot, active set, and hull points */}
          {state.points.map((p) => {
            if (state.removed?.[p.id]) return null;

            const P = toPx(p);

            const isEndpoint = active && (p.id === active.aId || p.id === active.bId);
            const isPivot = pivot && p.id === pivot.id;
            const isInActiveSet = activeSet.has(p.id);
            const isHullPoint = hullPointIds.has(p.id);

            let r = 4;
            let opacity = 0.9;
            let fill = "black";

            if (active) opacity = isInActiveSet ? 1 : 0.18;
            if (isInActiveSet && chain) fill = chainFill;

            if (isHullPoint) {
              r = 6;
              fill = "#10b981"; // emerald hull
              opacity = 1;
            }

            if (isEndpoint) {
              r = 7;
              fill = "#0f172a";
              opacity = 1;
            }

            if (isPivot) {
              r = 8;
              fill = "#dc2626";
              opacity = 1;
            }

            return <circle key={p.id} cx={P.x} cy={P.y} r={r} fill={fill} opacity={opacity} />;
          })}
        </svg>
      </div>

      {editable && (
        <div className="px-3 py-2 text-xs text-slate-600 border-t bg-white">
          Click inside the canvas to add points. Adding a point resets the algorithm.
        </div>
      )}
    </div>
  );
}
