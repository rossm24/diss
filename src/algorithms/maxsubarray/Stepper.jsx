import React from "react";
import { canDivide, canConquer, canCombine } from "./logic.js";

export default function MaxSubarrayStepper({ state, onDivide, onConquer, onCombine }) {
  const d = canDivide(state);
  const c = canConquer(state);
  const b = canCombine(state);

  const baseBtn = "px-4 py-2 rounded text-white disabled:opacity-50";

  return (
    <div className="flex flex-col gap-3 text-gray-900">
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
    </div>
  );
}

