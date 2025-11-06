import React, { useState } from 'react'
import { MergeSortStepper } from '../algorithms/mergesort/Stepper.js'

const DEFAULT = []

export default function MergeSort() {
  const [inputStr, setInputStr] = useState(DEFAULT.join(','))
  const [stepper, setStepper] = useState(() => new MergeSortStepper(DEFAULT))
  const [writePulse, setWritePulse] = useState(new Set()) // indices that flash

  const bump = () =>
    setStepper(Object.assign(Object.create(Object.getPrototypeOf(stepper)), stepper))

  const state = stepper.getState()
  const values = state.array
  const activeRange = state.active ? [state.active.l, state.active.r] : null
  const micro = state.micro
  const microOn = micro.active

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

  // Normal mode actions
  const doDivide = () => {
    if (stepper.stepDivide()) {
      setWritePulse(new Set())
      bump()
    }
  }

  const doConquer = () => {
    if (stepper.stepConquer()) {
      const fresh = new Set(stepper.getState().lastWrites)
      setWritePulse(fresh)
      setTimeout(() => setWritePulse(new Set()), 220)
      bump()
    }
  }

  // Micro (Explain) actions
  const startExplain = () => {
    if (stepper.startMicro()) {
      setWritePulse(new Set())
      bump()
    }
  }

  const nextMicro = () => {
    if (stepper.stepMicro()) {
      // staged: arr not changed yet; we still give a tiny pulse feedback on where it will write
      const fresh = new Set(stepper.getState().lastWrites)
      setWritePulse(fresh)
      setTimeout(() => setWritePulse(new Set()), 180)
      bump()
    }
  }

  const finishMicro = () => {
    // Skip the staged path and perform the real merge now
    if (stepper.exitMicroDiscard()) {
      const fresh = new Set(stepper.getState().lastWrites)
      setWritePulse(fresh)
      setTimeout(() => setWritePulse(new Set()), 220)
      bump()
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
            placeholder="e.g. 38,27,43,3,9,82,10"
          />
          <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={reset}>
            Start
          </button>
        </div>

        <div className="text-sm text-gray-600">
          {state.done ? 'Status: Done (sorted)'
            : `Status: Working — last action: ${state.lastAction ?? '—'}`}
        </div>

        {/* Main bar chart — FROZEN during micro. No opacity/height tricks. */}
        <div className="w-full h-56 flex items-end gap-1 rounded-md p-3 bg-white border">
          {values.map((v, i) => {
            const inActive = activeRange && i >= activeRange[0] && i <= activeRange[1]

            // During micro mode, identify the two head indices being compared
            const isProbeLeftMain  =
              microOn && micro.i < micro.left.length  && i === (micro.l + micro.i)
            const isProbeRightMain =
              microOn && micro.j < micro.right.length && i === (micro.m + 1 + micro.j)

            // We only use writePulse when NOT in micro mode (to avoid confusion)
            const pulseWrite = !microOn && writePulse.has(i)

            const color = inActive ? 'bg-yellow-400' : 'bg-slate-700'

            // Pulse both compared bars during micro; keep colors distinct
            const probeRing =
              isProbeLeftMain  ? 'ring-4 ring-blue-400 ring-offset-2 animate-pulse'
              : isProbeRightMain ? 'ring-4 ring-rose-400 ring-offset-2 animate-pulse'
              : ''

            // Normal (non-micro) write pulse for feedback on real merges
            const writeRing = pulseWrite ? 'ring-4 ring-purple-400 ring-offset-2' : ''
            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-end">
                <div
                  className={['w-full rounded-t transition-all duration-300 ease-out', color, probeRing || writeRing].join(' ')}
                  style={{ height: heightPx(v) }}
                  title={`${v}`}
                />
                <div className="text-[11px] text-gray-700 mt-1">{v}</div>
              </div>
            )
          })}
        </div>

        {/* Controls */}
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
              className="px-4 py-2 rounded bg-purple-600 text-white disabled:opacity-50"
              onClick={doConquer}
              disabled={!stepper.canConquer() || state.done}
            >
              Conquer
            </button>
            {/* Explain only appears when relevant */}
            {!state.done && stepper.canExplainMerge() && (
              <button
                className="px-4 py-2 rounded bg-amber-600 text-white"
                onClick={startExplain}
                title="Show a step-by-step of this particular merge"
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
              title="Skip the staged explanation and finish this merge now"
            >
              Finish merge
            </button>
          </div>
        )}

        {/* Explainer panel */}
        {microOn && (
          <div className="rounded-md border bg-white p-3 space-y-3">
            {/* Narration */}
            <div className="text-sm text-gray-700">
              {micro.done
                ? 'Merge complete! “Finish merge” will now apply it above.'
                : (() => {
                    const leftVal  = micro.i < micro.left.length  ? micro.left[micro.i]  : '—'
                    const rightVal = micro.j < micro.right.length ? micro.right[micro.j] : '—'
                    return `Compare ${leftVal} (left) vs ${rightVal} (right) → place the smaller into the output.`
                  })()}
            </div>

            {/* Left run */}
            <div>
              <div className="text-xs text-gray-500 mb-1">Left Subarray</div>
              <div className="flex gap-2">
                {micro.left.map((v, idx) => {
                  const isHead = idx === micro.i
                  return (
                    <div
                      key={idx}
                      className={[
                        "px-3 py-1 rounded border text-gray-900",
                        isHead ? "outline outline-2 outline-blue-500" : ""
                      ].join(" ")}
                    >
                      {v}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Right run */}
            <div>
              <div className="text-xs text-gray-500 mb-1">Right Subarray</div>
              <div className="flex gap-2">
                {micro.right.map((v, idx) => {
                  const isHead = idx === micro.j
                  return (
                    <div
                      key={idx}
                      className={[
                        "px-3 py-1 rounded border text-gray-900",
                        isHead ? "outline outline-2 outline-rose-500" : ""
                      ].join(" ")}
                    >
                      {v}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Staged output */}
            <div>
              <div className="text-xs text-gray-500 mb-1">Output</div>
              <div className="flex gap-2">
                {Array.from({ length: micro.r - micro.l + 1 }).map((_, idx) => {
                  const filled = idx < micro.out.length
                  const val = filled ? micro.out[idx] : '-'
                  return (
                    <div
                      key={idx}
                      className={[
                        "px-3 py-1 rounded border min-w-10 text-center",
                        filled ? "bg-emerald-50 border-emerald-400 text-gray-900" : "bg-gray-50 text-gray-500"
                      ].join(" ")}
                    >
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
