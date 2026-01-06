import React from "react";
import { canDivide, canConquer, canCombine } from "./logic.js";

export default function MaxSubarrayStepper({ state, onDivide, onConquer, onCombine }) {
  const d = canDivide(state);
  const c = canConquer(state);
  const b = canCombine(state);

  const a = state.lastAction;

  const baseBtn = "px-4 py-2 rounded text-white disabled:opacity-50";

  return (
    <div className="flex flex-col gap-3 p-4 rounded-2xl shadow-sm border text-gray-900">
      <div className="flex flex-wrap gap-2 items-center">
        <button
          className={`${baseBtn} bg-emerald-600`}
          disabled={!d}
          onClick={onDivide}
        >
          Divide
        </button>

        <button
          className={`${baseBtn} bg-teal-600`}
          disabled={!c}
          onClick={onConquer}
        >
          Conquer
        </button>

        <button
          className={`${baseBtn} bg-purple-600`}
          disabled={!b}
          onClick={onCombine}
        >
          Combine
        </button>
      </div>

      <div className="text-sm text-gray-700">
        <div className="font-medium">Status</div>
        <div className="mt-1">
          Next:
          <span className="ml-2">
            {state.phase === "divide"
              ? "Divide"
              : state.phase === "conquer"
              ? "Conquer"
              : state.phase === "combine"
              ? "Combine"
              : "Done"}
          </span>
        </div>

        {a && (
          <div className="mt-2 text-xs text-gray-600">
            <span className="font-semibold">{a.type}</span>
            <span className="ml-2">node #{a.nodeId}</span>
            {a.type === "CONQUER" && <span className="ml-2">(x = {a.details.x})</span>}
            {a.type === "DIVIDE" && <span className="ml-2">(mid = {a.details.mid})</span>}
            {a.type === "COMBINE" && (
              <span className="ml-2">
                (chosen: {a.details.chosen}, cross = {a.details.crossVal})
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

