import React, { useState } from 'react'
import { MergeSortStepper } from '../algorithms/mergesort/Stepper.js'


export default function MergeSort() {
  // Start with an empty input field
  const [inputStr, setInputStr] = useState("");
  // Stepper starts with an empty array (so nothing displayed until Reset)
  const [stepper, setStepper] = useState(() => new MergeSortStepper([]));
  const [writePulse, setWritePulse] = useState(new Set());

  const bump = () =>
    setStepper(Object.assign(Object.create(Object.getPrototypeOf(stepper)), stepper))

  const state = stepper.getState()
  const values = state.array
  const activeRange = state.active ? [state.active.l, state.active.r] : null
  const micro = state.micro
  const microOn = micro.active
  const topFrame = state.stack[state.stack.length - 1] || null
  const onLeaf = !!(topFrame && topFrame.phase === 'divide' && topFrame.l === topFrame.r)


  const max = Math.max(1, ...values.map(v => Math.abs(v)))
  const heightPx = v => 12 + Math.round((Math.abs(v) / max) * 160)

  const parse = () =>
    inputStr.split(',').map(s => s.trim()).filter(Boolean)
      .map(Number).filter(Number.isFinite)

  const reset = () => {
    const arr = parse()
    const s = new MergeSortStepper(arr)
    setStepper(s)
    setWritePulse(new Set())
  }

  // Actions
  const doDivide = () => {
    if (stepper.stepDivide()) { setWritePulse(new Set()); bump(); }
  };
  const doConquer = () => {
    if (stepper.stepConquer()) {
      const fresh = new Set(stepper.getState().lastWrites);
      setWritePulse(fresh); setTimeout(() => setWritePulse(new Set()), 160); bump();
    }
  };
  const doCombine = () => {
    if (stepper.stepCombine()) {
      const fresh = new Set(stepper.getState().lastWrites);
      setWritePulse(fresh); setTimeout(() => setWritePulse(new Set()), 220); bump();
    }
  };


  // Explain path
  const startExplain = () => { if (stepper.startMicro()) { setWritePulse(new Set()); bump() } }
  const nextMicro = () => {
    if (stepper.stepMicro()) {
      // During explain, pulse the two compared bars (handled in render), not target writes
      setWritePulse(new Set()); bump()
    }
  }
  const finishMicro = () => {
    if (stepper.exitMicroDiscard()) {
      const fresh = new Set(stepper.getState().lastWrites)
      setWritePulse(fresh); setTimeout(() => setWritePulse(new Set()), 220); bump()
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto space-y-5">
        <h1 className="text-2xl font-bold text-gray-900">Merge Sort</h1>

        <div className="flex gap-2">
          <input
            className="flex-1 border rounded px-3 py-2"
            value={inputStr}
            onChange={e => setInputStr(e.target.value)}
            placeholder="e.g. 38,27,43,3,9,42,10,21"
          />
          <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={reset}>
            Start
          </button>
        </div>

        <div className="text-sm text-gray-600">
          {state.done ? (
            'Status: Done (sorted)'
          ) : (
            <>
              Status: Working — last action: {state.lastAction ?? '—'}
              { !microOn && onLeaf && (
                <span className="ml-2 text-emerald-700">
                  • Minimum subproblem reached at index {topFrame.l}. Press <strong>Conquer</strong> to mark as a sub-solution.
                </span>
              )}
            </>
          )}
        </div>


        {/* Bars (frozen during explain) */}
        <div className="w-full h-56 flex items-end gap-1 rounded-md p-3 bg-white border">
          {values.map((v, i) => {
            const inActive = activeRange && i >= activeRange[0] && i <= activeRange[1]

            // During explain: pulse the TWO compared heads
            const isProbeLeftMain  =
              microOn && micro.i < micro.left.length  && i === (micro.l + micro.i)
            const isProbeRightMain =
              microOn && micro.j < micro.right.length && i === (micro.m + 1 + micro.j)

            // Outside explain: pulse the real write indices (combine and leaf-conquer feedback)
            const pulseWrite = !microOn && writePulse.has(i)

            const color = inActive ? 'bg-yellow-400' : 'bg-slate-700'
            const probeRing =
              isProbeLeftMain  ? 'ring-4 ring-blue-400 ring-offset-2 animate-pulse'
              : isProbeRightMain ? 'ring-4 ring-rose-400 ring-offset-2 animate-pulse'
              : ''
            const writeRing = pulseWrite ? 'ring-4 ring-purple-400 ring-offset-2' : ''

            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-end">
                <div
                  className={['w-full rounded-t transition-all duration-300 ease-out',
                              color, (probeRing || writeRing)].join(' ')}
                  style={{ height: heightPx(v) }}
                  title={`${v}`}
                />
                <div className="text-[11px] text-gray-700 mt-1">{v}</div>
              </div>
            )
          })}
        </div>

        {/* Controls: Divide / Conquer (leaf) / Combine (merge) */}
        {!microOn ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="px-4 py-2 rounded bg-emerald-600 text-white disabled:opacity-50"
              onClick={doDivide}
              disabled={!stepper.canDivide() || state.done}
            >
              Divide
            </button>

            <button
              className="px-4 py-2 rounded bg-teal-600 text-white disabled:opacity-50"
              onClick={doConquer}
              disabled={!stepper.canConquer() || state.done}
              title="Mark a size-1 subproblem as a sub-solution"
            >
              Conquer
            </button>

            <button
              className="px-4 py-2 rounded bg-purple-600 text-white disabled:opacity-50"
              onClick={doCombine}
              disabled={!stepper.canCombine() || state.done}
              title="Combine (merge) two solved halves"
            >
              Combine
            </button>

            {/* Explain appears only when current combine is a 2v2 */}
            {!state.done && stepper.canExplainMerge() && (
              <button
                className="px-4 py-2 rounded bg-amber-600 text-white"
                onClick={startExplain}
                title="Explain this specific merge step by step"
              >
                Explain this merge
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-gray-700">
              Explaining merge of [{micro.l}..{micro.m}] and [{micro.m + 1}..{micro.r}]
            </span>
            <button
              className="px-4 py-2 rounded bg-indigo-600 text-white disabled:opacity-50"
              onClick={nextMicro}
              disabled={micro.done}
            >
              Next step
            </button>
            <button
              className="px-4 py-2 rounded bg-gray-800 text-white"
              onClick={finishMicro}
              title="Skip the staged steps and finish this merge now"
            >
              Finish merge
            </button>
          </div>
        )}

        {/* Explain panel */}
        {microOn && (
          <div className="rounded-md border bg-white p-3 space-y-3">
            <div className="text-sm text-gray-700">
              {micro.done
                ? 'Staged result complete. “Finish merge” will now apply it instantly.'
                : (() => {
                    const leftVal  = micro.i < micro.left.length  ? micro.left[micro.i]  : '—'
                    const rightVal = micro.j < micro.right.length ? micro.right[micro.j] : '—'
                    return `Compare ${leftVal} (left) vs ${rightVal} (right) → place the smaller next.`
                  })()}
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-1">Left run</div>
              <div className="flex gap-2">
                {micro.left.map((v, idx) => {
                  const isHead = idx === micro.i
                  return (
                    <div key={idx}
                         className={['px-3 py-1 rounded border text-gray-900',
                                     isHead ? 'outline outline-2 outline-blue-500' : ''].join(' ')}>
                      {v}
                    </div>
                  )
                })}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-1">Right run</div>
              <div className="flex gap-2">
                {micro.right.map((v, idx) => {
                  const isHead = idx === micro.j
                  return (
                    <div key={idx}
                         className={['px-3 py-1 rounded border text-gray-900',
                                     isHead ? 'outline outline-2 outline-rose-500' : ''].join(' ')}>
                      {v}
                    </div>
                  )
                })}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-1">Staged output</div>
              <div className="flex gap-2">
                {Array.from({ length: micro.r - micro.l + 1 }).map((_, idx) => {
                  const filled = idx < micro.out.length
                  const val = filled ? micro.out[idx] : '·'
                  return (
                    <div key={idx}
                         className={['px-3 py-1 rounded border min-w-10 text-center',
                                     filled ? 'bg-emerald-50 border-emerald-400 text-gray-900'
                                            : 'bg-gray-50 text-gray-500'].join(' ')}>
                      {val}
                    </div>
                  )
                })}
              </div>
              <div className="text-[11px] text-gray-500 mt-1">
                Will write to array indices [{micro.l}..{micro.r}] when finished.
              </div>
            </div>
          </div>
        )}

        <details>
          <summary className="cursor-pointer font-semibold">Debug stack</summary>
          <pre className="mt-2 p-3 rounded bg-slate-100 text-slate-800 text-sm overflow-auto">
{JSON.stringify(stepper.getState().stack, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  )
}

