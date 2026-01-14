// src/algorithms/quickhull/Stepper.jsx
import React from "react";

function toPx(p, w, h, pad = 20) {
  return {
    x: pad + p.x * (w - 2 * pad),
    y: pad + (1 - p.y) * (h - 2 * pad),
  };
}

export default function QuickhullStepper({
  state,
  width = 720,
  height = 460,
  editable = false,
  onAddPoint = null,
}) {
  if (!state) return null;

  const active =
    state.activeProblemId == null
      ? null
      : state.problems.find((p) => p.id === state.activeProblemId) || null;

  const activeA = active ? state.pointsById[active.aId] : null;
  const activeB = active ? state.pointsById[active.bId] : null;
  const pivot = active && active.pivotId != null ? state.pointsById[active.pivotId] : null;

  const activeSet = new Set(active?.setIds ?? []);

  const hullPointIds = new Set();
  for (const e of state.hullEdges) {
    hullPointIds.add(e.aId);
    hullPointIds.add(e.bId);
  }


  return (
    <div className="bg-white border rounded-xl p-0 inline-block overflow-hidden">
      <svg
        width={width}
        height={height}
        className={"block " + (editable ? "cursor-crosshair" : "")}
        onClick={(e) => {
          if (!editable || !onAddPoint) return;

          const rect = e.currentTarget.getBoundingClientRect();
          const pad = 20;

          const sx = e.clientX - rect.left;
          const sy = e.clientY - rect.top;

          const x = (sx - pad) / (width - 2 * pad);
          const y = 1 - (sy - pad) / (height - 2 * pad);

          if (x < 0 || x > 1 || y < 0 || y > 1) return;
          onAddPoint({ x, y });
        }}
      >

        {/* Trace triangles (history) */}
        {(state.traceTriangles ?? []).map((t, i) => {
          const a = state.pointsById[t.aId];
          const b = state.pointsById[t.bId];
          const p = state.pointsById[t.pId];
          if (!a || !b || !p) return null;

          const A = toPx(a, width, height);
          const B = toPx(b, width, height);
          const P = toPx(p, width, height);

          return (
            <polygon
              key={`tt-${i}-${t.aId}-${t.pId}-${t.bId}`}
              points={`${A.x},${A.y} ${P.x},${P.y} ${B.x},${B.y}`}
              fill="none"
              stroke="black"
              strokeWidth={1}
              opacity={0.10}
            />
          );
        })}

        {/* Trace edges (history) */}
        {(state.traceEdges ?? []).map((e, i) => {
          const a = state.pointsById[e.aId];
          const b = state.pointsById[e.bId];
          if (!a || !b) return null;

          const A = toPx(a, width, height);
          const B = toPx(b, width, height);

          const dash = e.type === "active" ? "4 6" : undefined;
          const op = e.type === "active" ? 0.22 : 0.15;

          return (
            <line
              key={`te-${i}-${e.aId}-${e.bId}`}
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
        {state.hullEdges.map((e) => {
          const a = state.pointsById[e.aId];
          const b = state.pointsById[e.bId];
          if (!a || !b) return null;
          const A = toPx(a, width, height);
          const B = toPx(b, width, height);
          return (
            <line
              key={e.key}
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

        {/* Active edge */}
        {activeA && activeB && (() => {
          const A = toPx(activeA, width, height);
          const B = toPx(activeB, width, height);
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

        {/* Triangle A-P-B if pivot chosen */}
        {activeA && activeB && pivot && (() => {
          const A = toPx(activeA, width, height);
          const B = toPx(activeB, width, height);
          const P = toPx(pivot, width, height);
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

        {/* Points */}
        {state.points.map((p) => {
          const P = toPx(p, width, height);

          if (state.removed?.[p.id]) return null;


          const isEndpoint = active && (p.id === active.aId || p.id === active.bId);
          const isPivot = pivot && p.id === pivot.id;
          const isInActiveSet = activeSet.has(p.id);

          const isHullPoint = hullPointIds.has(p.id);


          let r = 4;
          let opacity = 0.9;
          let fill = "black";

          if (active) opacity = isInActiveSet ? 1 : 0.25;

          if (isHullPoint) {
            r = 6;
            fill = "#2563eb"; // blue
            opacity = 1;
          }

          if (isEndpoint) {
            r = 7;
            fill = "#0f172a"; // dark
            opacity = 1;
          }

          if (isPivot) {
            r = 8;
            fill = "#dc2626"; // red
            opacity = 1;
          }

          return (
            <circle
              key={p.id}
              cx={P.x}
              cy={P.y}
              r={r}
              fill={fill}
              opacity={opacity}
            />
          );
        })}
      </svg>

      {editable && (
        <div className="mt-2 text-xs text-slate-600">
          Click inside the canvas to add points. Adding a point resets the algorithm.
        </div>
      )}
    </div>
  );
}
