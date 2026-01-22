import React, { useState } from "react";
import QuickhullStepper from "../algorithms/quickhull/Stepper.jsx";
import {
  makeInitialState,
  makeStateFromPoints,
  stepDivide,
  stepConquer,
  stepCombine,
  canDivide,
  canConquer,
  canCombine,
} from "../algorithms/quickhull/logic.js";

function primaryBtn(enabled) {
  return (
    "px-4 py-2 rounded-md text-sm font-medium transition " +
    (enabled
      ? "bg-blue-600 text-white hover:bg-blue-700"
      : "bg-slate-200 text-slate-500 cursor-not-allowed")
  );
}

function secondaryBtn() {
  return "px-4 py-2 rounded-md text-sm font-medium bg-white border hover:bg-slate-50";
}

export default function Quickhull() {
  const [state, setState] = useState(() => makeInitialState({ nPoints: 0 }));
  const [editMode, setEditMode] = useState(false);

  const dOk = canDivide(state);
  const cOk = canConquer(state);
  const bOk = canCombine(state);

  function addPoint({ x, y }) {
    setState((s) => {
      const nextId = s.points.length ? Math.max(...s.points.map((p) => p.id)) + 1 : 0;
      const pts = [...s.points, { id: nextId, x, y }];
      return makeStateFromPoints(pts);
    });
  }

  return (
    <div className="space-y-4">
      {/* Title */}
      <h2 className="text-2xl font-bold text-gray-900">
        Quickhull
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT: canvas + controls */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <QuickhullStepper state={state} editable={editMode} onAddPoint={addPoint} />

            <div className="mt-auto flex flex-wrap items-center gap-3">
              {/* buttons */}
              <button
                className="px-4 py-2 rounded bg-emerald-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!dOk}
                onClick={() => setState((s) => stepDivide(s))}
                title="Pick the farthest point from the current edge"
              >
                Divide
              </button>

              <button
                className="px-4 py-2 rounded bg-teal-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!cOk}
                onClick={() => setState((s) => stepConquer(s))}
                title="Split into two subproblems using the pivot"
              >
                Conquer
              </button>

              <button
                className="px-4 py-2 rounded bg-purple-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!bOk}
                onClick={() => setState((s) => stepCombine(s))}
                title="Finalize an edge when its outside set is empty"
              >
                Combine
              </button>

              <button
                className="px-4 py-2 rounded bg-white border text-slate-800 hover:bg-slate-50"
                onClick={() => setState(makeInitialState({ nPoints: 30 }))}
                title="Generate a new random point set"
              >
                Randomise
              </button>

              <button
                className="px-4 py-2 rounded bg-white border text-slate-800 hover:bg-slate-50"
                onClick={() => setEditMode((v) => !v)}
                title="Click on the canvas to add points"
              >
                {editMode ? "Stop Placing Points" : "Place Points"}
              </button>

              <button
                className="px-4 py-2 rounded bg-white border text-slate-800 hover:bg-slate-50"
                onClick={() => setState(makeInitialState({ nPoints: 0 }))}
                title="Remove all points"
              >
                Clear
              </button>
            </div>
          </div>


        {/* RIGHT: callout (after first Divide) + info */}
        <div className="space-y-4">
          {state.introPhase === "baseline" && (
            <div className="bg-white border rounded-xl p-4">
              <h2 className="text-sm font-semibold text-gray-900">
                What this first Divide did
              </h2>

              <p className="mt-2 text-sm text-gray-700">
                Quickhull starts by finding the <span className="font-medium">leftmost</span> and{" "}
                <span className="font-medium">rightmost</span> points. These extremes must lie on the{" "}
                <span className="font-medium">convex hull</span>.
              </p>

              <p className="mt-2 text-sm text-gray-700">
                The line between them is the <span className="font-medium">baseline</span>. It splits all of the
                points into two independent subproblems:{" "}
                <span className="font-medium">upper hull</span> and{" "}
                <span className="font-medium">lower hull</span>.
              </p>

              <p className="mt-2 text-sm text-gray-700">
                Next, <span className="font-medium">Conquer</span> uses the furthest point from the active
                edge to split into smaller subproblems.
              </p>
            </div>
          )}

          <div className="text-sm text-gray-700 bg-white border rounded-xl p-3 space-y-1">
            <div>
              <span className="font-semibold">Hull edges:</span> {state.hullEdges.length}
            </div>
            <div>
              <span className="font-semibold">Finished:</span> {state.finished ? "Yes" : "No"}
            </div>
            <div>
              <span className="font-semibold">Edit mode:</span> {editMode ? "On" : "Off"}
            </div>
            <div className="pt-1">
              <span className="font-semibold">Last action:</span>{" "}
              {state.lastAction ? JSON.stringify(state.lastAction) : "None"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

}
