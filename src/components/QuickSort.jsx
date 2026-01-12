// src/components/QuickSort.jsx

import React, { useState } from 'react'
import { QuickSortStepper } from '../algorithms/quicksort/Stepper.js'

export default function QuickSort() {
  const [inputStr, setInputStr] = useState("");
  const [stepper, setStepper] = useState(() => new QuickSortStepper([]));
  const [writePulse, setWritePulse] = useState(new Set());

  const bump = () =>
    setStepper(Object.assign(Object.create(Object.getPrototypeOf(stepper)), stepper));

  const state = stepper.getState();
  const values = state.array;
  const activeRange = state.active ? [state.active.l, state.active.r] : null;
  const micro = state.micro;

  const topFrame = state.stack[state.stack.length - 1] || null;
  const phase = topFrame ? topFrame.phase : null;

  // Decide which pivot index to highlight for the UI
  let pivotIndexUI = null;
  if (micro.active && micro.pivotIndex != null) {
    // During partition steps, use the micro view of the pivot
    pivotIndexUI = micro.pivotIndex;
  } else if (
    topFrame &&
    (topFrame.phase === 'divide' || topFrame.phase === 'conquer') &&
    topFrame.pivotIndex != null
  ) {
    // Immediately after Divide (or before micro starts), use the frame pivot
    pivotIndexUI = topFrame.pivotIndex;
  }

  const max = Math.max(1, ...values.map(v => Math.abs(v)));
  const heightPx = v => 12 + Math.round((Math.abs(v) / max) * 160);

  const parse = () =>
    inputStr
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(Number)
      .filter(Number.isFinite);

  const reset = () => {
    const arr = parse();
    const s = new QuickSortStepper(arr);
    setStepper(s);
    setWritePulse(new Set());
  };

  const flashWritesFromState = () => {
    const fresh = new Set(stepper.getState().lastWrites);
    setWritePulse(fresh);
    if (fresh.size > 0) {
      setTimeout(() => setWritePulse(new Set()), 220);
    }
  };

  const doDivide = () => {
    if (stepper.stepDivide()) {
      const fresh = new Set(stepper.getState().lastWrites);
      setWritePulse(fresh);
      if (fresh.size > 0) setTimeout(() => setWritePulse(new Set()), 220);
      bump();
    }
  };

  const doConquer = () => {
    if (stepper.stepConquer()) {
      const fresh = new Set(stepper.getState().lastWrites);
      setWritePulse(fresh);
      setTimeout(() => setWritePulse(new Set()), 220);
      bump();
    }
  };

  const doCombine = () => {
    if (stepper.stepCombine()) {
      const fresh = new Set(stepper.getState().lastWrites);
      setWritePulse(fresh);
      setTimeout(() => setWritePulse(new Set()), 220);
      bump();
    }
  };


  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto space-y-5">
        <h1 className="text-2xl font-bold text-gray-900">Quick Sort</h1>

        <div className="flex gap-2">
          <input
            className="flex-1 border rounded px-3 py-2"
            value={inputStr}
            onChange={e => setInputStr(e.target.value)}
            placeholder="e.g. 38,27,43,3,9,82,10"
          />
          <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={reset}>
            Start
          </button>
        </div>

        <div className="text-sm text-gray-600">
          {state.done ? (
            'Status: Done (all subproblems solved)'
          ) : (
            <>
              Status: Working — last action: {state.lastAction ?? '—'}
              {phase === 'conquer' && micro.active && (
                <span className="ml-2 text-indigo-700">
                  • Conquer (partition) in progress: i = {micro.i}, j = {micro.j}, pivot index = {micro.pivotIndex}
                </span>
              )}
            </>
          )}
        </div>

        {/* Bars */}
        <div className="w-full h-56 flex items-end gap-1 rounded-md p-3 bg-white border">
          {values.map((v, i) => {
            const inActive =
              activeRange && i >= activeRange[0] && i <= activeRange[1];

            const pulseWrite = writePulse.has(i);

            const isPivot =
              pivotIndexUI != null &&
              i === pivotIndexUI &&
              inActive &&
              !state.done;
              
            const isI = micro.active && micro.i != null && i === micro.i && inActive;
            const isJ = micro.active && micro.j != null && i === micro.j && inActive;

            const baseColor = inActive ? 'bg-yellow-400' : 'bg-slate-700';

            const pointerRing =
              isI
                ? 'ring-4 ring-rose-400 ring-offset-2 animate-pulse'
                : isJ
                ? 'ring-4 ring-blue-400 ring-offset-2 animate-pulse'
                : '';

            const pivotRing = isPivot ? 'ring-4 ring-amber-400 ring-offset-2' : '';

            const writeRing = pulseWrite ? 'ring-4 ring-purple-400 ring-offset-2' : '';

            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-end">
                <div
                  className={[
                    'w-full rounded-t transition-all duration-300 ease-out',
                    baseColor,
                    pointerRing || pivotRing || writeRing,
                  ].join(' ')}
                  style={{ height: heightPx(v) }}
                  title={`${v}`}
                />
                <div className="text-[11px] text-gray-700 mt-1">{v}</div>
              </div>
            );
          })}
        </div>

        {/* Controls: Divide / Conquer / Combine */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            className="px-4 py-2 rounded bg-emerald-600 text-white disabled:opacity-50"
            onClick={doDivide}
            disabled={!stepper.canDivide() || state.done}
            title="Choose the pivot as the last element of the current active subarray."
          >
            Divide
          </button>

          <button
            className="px-4 py-2 rounded bg-teal-600 text-white disabled:opacity-50"
            onClick={doConquer}
            disabled={!stepper.canConquer() || state.done}
            title="Step through the partition: compare one element to the pivot, maybe swap, and eventually place the pivot."
          >
            Conquer
          </button>

          <button
            className="px-4 py-2 rounded bg-purple-600 text-white disabled:opacity-50"
            onClick={doCombine}
            disabled={!stepper.canCombine() || state.done}
            title="Visually mark this subarray as fully solved (no further work inside it)."
          >
            Combine
          </button>
        </div>

        <details>
          <summary className="cursor-pointer font-semibold">Debug stack</summary>
          <pre className="mt-2 p-3 rounded bg-slate-100 text-slate-800 text-sm overflow-auto">
{JSON.stringify(state.stack, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}
