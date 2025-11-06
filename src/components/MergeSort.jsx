import React, { useMemo, useRef, useState } from 'react'
import { MergeSortStepper } from '../algorithms/mergesort/Stepper.js'

const DEFAULT = []


export default function MergeSort() {
  const [inputStr, setInputStr] = useState(DEFAULT.join(','))
  const [stepper, setStepper] = useState(() => new MergeSortStepper(DEFAULT))
  const [writePulse, setWritePulse] = useState(new Set()) // indices to flash
  const state = stepper.getState()

  const activeRange = state.active ? [state.active.l, state.active.r] : null

  const values = state.array
  const max = Math.max(1, ...values.map(v => Math.abs(v)))
  const heightPx = (v) => 12 + Math.round((Math.abs(v) / max) * 160) 

  const parse = () =>
    inputStr.split(',').map(s => s.trim()).filter(Boolean)
      .map(Number).filter(Number.isFinite)

  const reset = () => {
    const arr = parse()
    const s = new MergeSortStepper(arr)
    setStepper(s)
    setWritePulse(new Set())
  }

  // mutate stepper, then force React to see changes by re-wrapping the instance
  const bump = () =>
    setStepper(Object.assign(Object.create(Object.getPrototypeOf(stepper)), stepper))

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
          {state.done ? 'Current Phase: Sorted!'
            : `Current Phase: ${state.lastAction ?? '—'}`}
        </div>

        {/* Bars */}
        <div className="w-full h-56 flex items-end gap-1 rounded-md p-3 bg-white border">
          {values.map((v, i) => {
            const inActive = activeRange && i >= activeRange[0] && i <= activeRange[1]
            const pulse = writePulse.has(i)
            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-end">
                <div
                  className={[
                    // base bar
                    "w-full rounded-t transition-all duration-300 ease-out",
                    // colour
                    inActive ? "bg-yellow-400" : "bg-slate-700",
                    // flash when written
                    pulse ? "ring-4 ring-purple-400 ring-offset-2" : "ring-0",
                  ].join(' ')}
                  style={{ height: heightPx(v) }}
                  title={`${v}`}
                />
                <div className="text-[11px] text-gray-500 mt-1">{v}</div>
              </div>
            )
          })}
        </div>

        {/* Controls */}
        <div className="flex gap-3">
          <button
            className="px-4 py-2 rounded bg-emerald-600 text-white disabled:opacity-50"
            onClick={doDivide}
            disabled={!stepper.canDivide() || state.done}
            title="Split the next segment into subproblems"
          >
            Divide
          </button>
          <button
            className="px-4 py-2 rounded bg-purple-600 text-white disabled:opacity-50"
            onClick={doConquer}
            disabled={!stepper.canConquer() || state.done}
            title="Merge the next ready pair"
          >
            Conquer
          </button>
        </div>

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


