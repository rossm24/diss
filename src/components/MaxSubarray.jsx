import React, { useState } from "react";
import MaxSubarrayStepper from "../algorithms/maxsubarray/Stepper.jsx";
import { makeInitialState, stepDivide, stepConquer, stepCombine } from "../algorithms/maxsubarray/logic.js";

function SummaryCard({ title, s }) {
  if (!s) return null;
  return (
    <div className="p-3 rounded-xl border text-sm">
      <div className="font-semibold mb-2">{title}</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <div>sum</div><div className="text-right">{s.sum}</div>
        <div>pref</div><div className="text-right">{s.pref}</div>
        <div>suff</div><div className="text-right">{s.suff}</div>
        <div>best</div><div className="text-right font-semibold">{s.best}</div>
      </div>
      <div className="mt-2 text-xs text-gray-600">
        bestRange: [{s.bestRange[0]}, {s.bestRange[1]}]
      </div>
    </div>
  );
}

function rangeContains(i, [l, r]) {
  return i >= l && i <= r;
}

export default function MaxSubarray() {
  // Feel free to swap this with your usual random / input mechanism later.
  const [arr, setArr] = useState([]);

  const [state, setState] = useState(() => makeInitialState(arr));

  const [input, setInput] = useState(arr.join(", "));
  const [inputError, setInputError] = useState("");

  function parseArray(text) {
    // accept: "1 2 3", "1,2,3", "1, -2, 3", etc.
    const tokens = text
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean);

    const nums = tokens.map((t) => Number(t));
    if (tokens.length < 2) return { ok: false, error: "Please enter at least two numbers." };
    if (nums.some((n) => Number.isNaN(n))) return { ok: false, error: "Only numbers are allowed (use spaces/commas)." };

    return { ok: true, nums };
  }

  function applyInput() {
    const res = parseArray(input);
    if (!res.ok) {
      setInputError(res.error);
      return;
    }
    setInputError("");
    setArr(res.nums);
    resetTo(res.nums); // uses your existing resetTo helper
  }

  // Reset whenever arr changes
  function resetTo(newArr = arr) {
    setArr(newArr);                    
    setState(makeInitialState(newArr));
    setInput(newArr.join(", "));
    setInputError("");
    }

  function onDivide() {
    setState((s) => stepDivide(s));
  }
  function onConquer() {
    setState((s) => stepConquer(s));
  }
  function onCombine() {
    setState((s) => stepCombine(s));
  }

  const active = state.nodes[state.activeId];
  const root = state.nodes[state.rootId];
  const done = root?.status === "solved";

  // For combine highlighting
  const last = state.lastAction;
  const cross = last?.type === "COMBINE" ? last.details : null;

  

  return (
    <div className="w-full flex flex-col gap-4 text-gray-900">
      <div className="flex flex-col gap-2">
        <div className="text-2xl font-bold text-gray-900">Maximum Subarray</div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Left: array + active segment */}
        <div className="col-span-12 lg:col-span-8 p-4 rounded-2xl shadow-sm border">
          <div className="mb-3">
            

            <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                <input
                    className="flex-1 border rounded px-3 py-2 text-white"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                    if (e.key === "Enter") applyInput();
                    }}
                    placeholder="e.g. 2, -5, 3, 1, -2, 4, -3, -1"
                />

                <button
                    className="px-3 py-2 rounded border text-white bg-blue-600 "
                    onClick={applyInput}
                >
                    Start
                </button>

                <button
                    className="px-3 py-2 rounded border hover:bg-gray-50 text-gray-900"
                    onClick={() => {
                    const newArr = Array.from({ length: 8 }, () => Math.floor(Math.random() * 11) - 5);
                    setArr(newArr);
                    setInput(newArr.join(", "));
                    setInputError("");
                    resetTo(newArr);
                    }}
                >
                    Randomise
                </button>
                </div>

    {inputError && (
      <div className="text-sm text-red-600">
        {inputError}
      </div>
    )}

    <div className="text-xs text-gray-600">
      Tip: Negative numbers allowed.
    </div>
  </div>
</div>

          <div className="flex gap-2 flex-wrap">
            {state.arr.map((v, i) => {
              const inActive = active ? rangeContains(i, [active.l, active.r]) : false;

              const inCrossLeft = cross?.chosen === "CROSS" && rangeContains(i, cross.crossLeftRange);
              const inCrossRight = cross?.chosen === "CROSS" && rangeContains(i, cross.crossRightRange);

              const inBest =
                done && root.summary ? rangeContains(i, root.summary.bestRange) : false;

              return (
                <div
                  key={i}
                  className={[
                    "w-12 h-12 rounded-xl border flex items-center justify-center text-sm select-none",
                    inActive ? "ring-2 ring-black" : "",
                    inCrossLeft ? "bg-gray-100" : "",
                    inCrossRight ? "bg-gray-100" : "",
                    inBest ? "font-bold bg-yellow-200 border-yellow-400" : "",
                  ].join(" ")}
                  title={`i=${i}`}
                >
                  {v}
                </div>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <SummaryCard title={`Active node #${active?.id ?? "-"}`} s={active?.summary} />
            <SummaryCard title={`Root node #${root?.id ?? "-"}`} s={root?.summary} />
            <div className="p-3 rounded-xl border text-sm">
              <div className="font-semibold mb-2 text-gray-900">Active segment</div>
              {active ? (
                <>
                  <div>[{active.l}..{active.r}]</div>
                  <div className="mt-2 text-xs text-gray-600">
                    status: {active.status}
                    {active.status === "split" && (
                      <div className="mt-1">
                        children: #{active.leftId} [{state.nodes[active.leftId]?.l}..{state.nodes[active.leftId]?.r}]
                        {" · "}
                        #{active.rightId} [{state.nodes[active.rightId]?.l}..{state.nodes[active.rightId]?.r}]
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div>-</div>
              )}
            </div>
          </div>

          {done && root.summary && (
            <div className="mt-4 p-3 rounded-xl border">
              <div className="font-semibold">Answer</div>
              <div className="text-sm text-gray-700 mt-1">
                Maximum subarray sum = <span className="font-semibold">{root.summary.best}</span>{" "}
                on indices [{root.summary.bestRange[0]}, {root.summary.bestRange[1]}]
              </div>
            </div>
          )}
        </div>

        {/* Right: stepper + node list */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">
          <MaxSubarrayStepper
            state={state}
            onDivide={onDivide}
            onConquer={onConquer}
            onCombine={onCombine}
            onReset={() => resetTo(arr)}
          />

          
        </div>
      </div>
    </div>
  );
}
