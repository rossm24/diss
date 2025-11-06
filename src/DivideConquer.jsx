import React, { useMemo, useRef, useState, useEffect } from "react";

// =============================
// Divide & Conquer Lab (v1)
// - Single-file React component
// - Merge Sort visualiser with step-by-step generator
// - Built to be extensible: drop-in other algorithms later
// =============================

// ---------- Types ----------
/** @typedef {{
 *  type: string,
 *  payload?: any
 * }} Step
 */

/** Visual colours for states */
const COLORS = {
  idle: "",
  active: "ring-2 ring-blue-400",
  compare: "bg-yellow-300",
  write: "bg-emerald-300",
  left: "bg-blue-200",
  right: "bg-purple-200",
  sorted: "bg-emerald-400",
};

// ---------- Utilities ----------
function randArray(n = 16, min = 1, max = 99) {
  return Array.from({ length: n }, () =>
    Math.floor(Math.random() * (max - min + 1)) + min
  );
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------- Merge Sort Generator ----------
// Yields fine-grained steps to drive the UI.
// We keep a working copy of the array and an aux buffer
// to reflect writes as they happen.
function* mergeSortSteps(initial) {
  const a = initial.slice();
  const aux = Array(a.length).fill(0);

  function* sort(lo, hi) {
    yield /** @type {Step} */ ({ type: "divide", payload: { lo, hi } });
    if (lo === hi) {
      yield { type: "base", payload: { i: lo } };
      return;
    }
    const mid = Math.floor((lo + hi) / 2);
    yield* sort(lo, mid);
    yield* sort(mid + 1, hi);
    // Merge phase
    let i = lo,
      j = mid + 1,
      k = lo;
    yield { type: "merge_start", payload: { lo, mid, hi } };
    while (i <= mid && j <= hi) {
      yield { type: "compare", payload: { i, j, lo, mid, hi } };
      if (a[i] <= a[j]) {
        aux[k] = a[i];
        yield { type: "write", payload: { from: i, to: k, value: a[i] } };
        i++;
      } else {
        aux[k] = a[j];
        yield { type: "write", payload: { from: j, to: k, value: a[j] } };
        j++;
      }
      k++;
    }
    while (i <= mid) {
      aux[k] = a[i];
      yield { type: "write", payload: { from: i, to: k, value: a[i] } };
      i++;
      k++;
    }
    while (j <= hi) {
      aux[k] = a[j];
      yield { type: "write", payload: { from: j, to: k, value: a[j] } };
      j++;
      k++;
    }
    // Copy back into a
    for (let t = lo; t <= hi; t++) {
      a[t] = aux[t];
      yield { type: "array_update", payload: { index: t, value: a[t] } };
    }
    yield { type: "merge_done", payload: { lo, hi } };
  }

  if (a.length > 0) {
    yield* sort(0, a.length - 1);
  }
  yield { type: "sorted_all" };
}

// ---------- Algorithm registry (extensible) ----------
const ALGORITHMS = {
  mergesort: {
    id: "mergesort",
    name: "Merge Sort",
    makeSteps: mergeSortSteps,
    hint: "Divide the array, conquer subarrays, then combine by merging.",
    stable: true,
    complexity: "O(n log n)",
  },
  // In future: quicksort, closest-pair, karatsuba, etc.
};

// ---------- UI Component ----------
export default function DivideConquer() {
  const [algoId, setAlgoId] = useState("mergesort");
  const algo = ALGORITHMS[algoId];

  const [inputSize, setInputSize] = useState(14);
  const [array, setArray] = useState(() => randArray(14, 3, 99));
  const [speed, setSpeed] = useState(500); // ms per step when playing
  const [playing, setPlaying] = useState(false);

  const [focus, setFocus] = useState({ lo: -1, hi: -1, mid: -1 });
  const [compareIJ, setCompareIJ] = useState({ i: -1, j: -1 });
  const [writes, setWrites] = useState(new Set()); // indices recently written
  const [sortedRange, setSortedRange] = useState({ lo: -1, hi: -1 });
  const [isAllSorted, setIsAllSorted] = useState(false);

  const iterRef = useRef(null /** @type {Iterator<Step> | null} */);
  const playTimer = useRef(null /** @type {any} */);

  // Reset iteration when array or algorithm changes
  useEffect(() => {
    iterRef.current = algo.makeSteps(array);
    setFocus({ lo: -1, hi: -1, mid: -1 });
    setCompareIJ({ i: -1, j: -1 });
    setWrites(new Set());
    setSortedRange({ lo: -1, hi: -1 });
    setIsAllSorted(false);
    setPlaying(false);
    if (playTimer.current) {
      clearInterval(playTimer.current);
      playTimer.current = null;
    }
  }, [array, algoId]);

  // Handle a single step
  const stepOnce = () => {
    const it = iterRef.current;
    if (!it) return;
    const nxt = it.next();
    if (nxt.done) {
      setPlaying(false);
      if (playTimer.current) clearInterval(playTimer.current);
      return;
    }
    const { type, payload } = nxt.value || {};
    switch (type) {
      case "divide": {
        const { lo, hi } = payload;
        const mid = Math.floor((lo + hi) / 2);
        setFocus({ lo, hi, mid });
        setSortedRange({ lo: -1, hi: -1 });
        setCompareIJ({ i: -1, j: -1 });
        setWrites(new Set());
        break;
      }
      case "base": {
        const { i } = payload;
        setSortedRange({ lo: i, hi: i });
        break;
      }
      case "merge_start": {
        const { lo, mid, hi } = payload;
        setFocus({ lo, hi, mid });
        setCompareIJ({ i: -1, j: -1 });
        setWrites(new Set());
        break;
      }
      case "compare": {
        const { i, j, lo, mid, hi } = payload;
        setFocus({ lo, hi, mid });
        setCompareIJ({ i, j });
        break;
      }
      case "write": {
        const { to, value } = payload;
        setArray((prev) => {
          const next = prev.slice();
          next[to] = value;
          return next;
        });
        setWrites((prev) => new Set([...prev, payload.to]));
        break;
      }
      case "array_update": {
        const { index, value } = payload;
        setArray((prev) => {
          const next = prev.slice();
          next[index] = value;
          return next;
        });
        setWrites((prev) => new Set([...prev, index]));
        break;
      }
      case "merge_done": {
        const { lo, hi } = payload;
        setSortedRange({ lo, hi });
        setCompareIJ({ i: -1, j: -1 });
        setWrites(new Set());
        break;
      }
      case "sorted_all": {
        setIsAllSorted(true);
        setFocus({ lo: -1, hi: -1, mid: -1 });
        setCompareIJ({ i: -1, j: -1 });
        setSortedRange({ lo: 0, hi: array.length - 1 });
        break;
      }
      default:
        break;
    }
  };

  // Play/pause logic
  useEffect(() => {
    if (playing) {
      if (playTimer.current) clearInterval(playTimer.current);
      playTimer.current = setInterval(() => stepOnce(), clamp(speed, 50, 2000));
      return () => clearInterval(playTimer.current);
    }
  }, [playing, speed]);

  // Controls
  const togglePlay = () => setPlaying((p) => !p);
  const resetArray = (n = inputSize) => {
    setArray(randArray(n, 3, 99));
  };
  const setSize = (n) => {
    n = clamp(n, 2, 64);
    setInputSize(n);
    setArray(randArray(n, 3, 99));
  };

  // Visual helpers
  const maxVal = useMemo(() => Math.max(1, ...array), [array]);

  const isInFocus = (idx) => focus.lo !== -1 && idx >= focus.lo && idx <= focus.hi;
  const isLeft = (idx) => focus.lo !== -1 && idx >= focus.lo && idx <= focus.mid;
  const isRight = (idx) => focus.mid !== -1 && idx > focus.mid && idx <= focus.hi;
  const isCompared = (idx) => idx === compareIJ.i || idx === compareIJ.j;
  const isWritten = (idx) => writes.has(idx);
  const isSorted = (idx) =>
    sortedRange.lo !== -1 && idx >= sortedRange.lo && idx <= sortedRange.hi;

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Divide & Conquer Lab — <span className="text-emerald-300">{algo.name}</span>
          </h1>
          <a
            href="#"
            className="text-sm opacity-80 hover:opacity-100 underline decoration-dotted"
            onClick={(e) => e.preventDefault()}
            title="Single-file preview component"
          >
            v1.0
          </a>
        </header>

        {/* Controls */}
        <section className="grid md:grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-900/70 rounded-2xl p-4 shadow ring-1 ring-white/10">
            <div className="text-xs uppercase tracking-wider text-slate-300 mb-2">Algorithm</div>
            <select
              className="w-full bg-slate-800 rounded-xl p-2 outline-none"
              value={algoId}
              onChange={(e) => setAlgoId(e.target.value)}
            >
              {Object.values(ALGORITHMS).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <p className="text-sm mt-2 text-slate-300">
              {algo.hint} <span className="opacity-60">{algo.complexity}</span>
            </p>
          </div>

          <div className="bg-slate-900/70 rounded-2xl p-4 shadow ring-1 ring-white/10">
            <div className="text-xs uppercase tracking-wider text-slate-300 mb-2">Input</div>
            <div className="flex items-center gap-3">
              <label className="text-sm opacity-80">Size</label>
              <input
                type="range"
                min={2}
                max={64}
                value={inputSize}
                onChange={(e) => setSize(parseInt(e.target.value))}
              />
              <span className="text-sm tabular-nums w-8 text-center">{inputSize}</span>
              <button
                className="ml-auto px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700"
                onClick={() => resetArray(inputSize)}
              >
                Randomise
              </button>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <label className="text-sm opacity-80">Speed</label>
              <input
                type="range"
                min={50}
                max={1200}
                value={speed}
                onChange={(e) => setSpeed(parseInt(e.target.value))}
              />
              <span className="text-sm tabular-nums w-12 text-center">{speed}ms</span>
            </div>
          </div>

          <div className="bg-slate-900/70 rounded-2xl p-4 shadow ring-1 ring-white/10">
            <div className="text-xs uppercase tracking-wider text-slate-300 mb-2">Playback</div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500"
                onClick={togglePlay}
              >
                {playing ? "Pause" : "Play"}
              </button>
              <button
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700"
                onClick={stepOnce}
              >
                Step
              </button>
              <button
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700"
                onClick={() => setArray(array.slice())}
                title="Re-render"
              >
                Refresh
              </button>
              <button
                className="ml-auto px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700"
                onClick={() => setArray(array.slice().sort((x, y) => x - y))}
              >
                Sort Instantly
              </button>
            </div>
            <p className="text-xs mt-2 text-slate-400">
              Tip: Use <span className="font-semibold">Step</span> to inspect each divide/compare/write.
            </p>
          </div>
        </section>

        {/* Array Bars */}
        <section className="bg-slate-900/60 rounded-2xl p-4 ring-1 ring-white/10">
          <div className="text-xs uppercase tracking-wider text-slate-300 mb-3">Array</div>
          <div className="grid items-end gap-1"
               style={{ gridTemplateColumns: `repeat(${array.length}, minmax(0, 1fr))`, height: 220 }}>
            {array.map((v, idx) => {
              const h = Math.round((v / maxVal) * 200) + 10;
              const classes = [
                "rounded-t-md transition-all duration-150",
                isSorted(idx) ? COLORS.sorted : "bg-slate-600",
                isInFocus(idx) ? "ring-2 ring-blue-400" : "",
                isLeft(idx) ? "outline outline-1 outline-blue-300/60" : "",
                isRight(idx) ? "outline outline-1 outline-fuchsia-300/60" : "",
                isCompared(idx) ? COLORS.compare : "",
                isWritten(idx) ? COLORS.write : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <div key={idx} className="flex flex-col items-center gap-1">
                  <div className={classes} style={{ height: h }} />
                  <div className="text-[10px] opacity-80 tabular-nums">{v}</div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-300">
            <Legend swatch="bg-slate-600" label="value" />
            <Legend swatch="ring-2 ring-blue-400" label="focus range" />
            <Legend swatch="outline outline-1 outline-blue-300/60" label="left half" />
            <Legend swatch="outline outline-1 outline-fuchsia-300/60" label="right half" />
            <Legend swatch={COLORS.compare} label="compare" />
            <Legend swatch={COLORS.write} label="write" />
            <Legend swatch={COLORS.sorted} label="sorted" />
          </div>
        </section>

        {/* Status line */}
        <footer className="mt-6 text-sm text-slate-300 flex items-center gap-3 flex-wrap">
          <span className="opacity-80">Status:</span>
          {isAllSorted ? (
            <span className="text-emerald-300">Done — Array fully sorted.</span>
          ) : focus.lo !== -1 ? (
            <>
              <span className="bg-slate-800 px-2 py-0.5 rounded-md">lo={focus.lo}</span>
              <span className="bg-slate-800 px-2 py-0.5 rounded-md">mid={focus.mid}</span>
              <span className="bg-slate-800 px-2 py-0.5 rounded-md">hi={focus.hi}</span>
              {compareIJ.i !== -1 && (
                <span className="bg-slate-800 px-2 py-0.5 rounded-md">compare i={compareIJ.i}, j={compareIJ.j}</span>
              )}
            </>
          ) : (
            <span className="opacity-70">Idle</span>
          )}
        </footer>
      </div>
    </div>
  );
}

function Legend({ swatch, label }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`w-5 h-3 rounded ${swatch}`} />
      <span>{label}</span>
    </span>
  );
}
