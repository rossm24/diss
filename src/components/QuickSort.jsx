import React, { useMemo, useState } from 'react'
import { QuickSortStepper } from '../algorithms/quicksort/Stepper.js'

// teaching mode helpers
function classifyLastAction(lastAction) {
  if (!lastAction || typeof lastAction !== 'string') return null;
  if (lastAction.startsWith('divide: start partition')) return 'QS_PARTITION_START';
  if (lastAction.startsWith('divide: place pivot')) return 'QS_PARTITION_DONE';
  return null;
}

const QS_QUESTIONS = [
  {
    id: 'q1_partition_guarantee',
    triggerAction: 'QS_PARTITION_START',
    prompt: 'We are now in the parition step. After partitioning around the pivot, what can we guarantee about the elements?',
    options: [
      'Elements to the left of the pivot are less than the pivot, and right are greater',
      'Elements to the left of the pivot are fully sorted',
      'The pivot becomes the minimum element',
    ],
    correctIndex: 0,
    hint: 'Partition doesn’t fully sort both sides — it just splits around the pivot.',
    why: 'Partition places the pivot into its final position and splits elements around it.',
  },
  {
    id: 'q2_recurse_subproblems',
    triggerAction: 'QS_PARTITION_DONE',
    prompt: 'Now that we have partitioned around the pivot element, what subproblems do we recurse next?',
    options: [
      'The entire array again',
      'The larger of the two segments only',
      'The left segment and the right segment around the pivot',
    ],
    correctIndex: 2,
    hint: 'Once the pivot is fixed, the work becomes two smaller Quick Sort problems.',
    why: 'Quick Sort recursively sorts the two subarrays created by the pivot’s final position.',
  },
  {
    id: 'q3_worst_case',
    triggerDone: true,
    prompt:
      'Broader thinking: what would happen if the pivot is always the smallest or largest element?',
    options: ['Nothing would change', 'Quick Sort runtime would be worse', 'Quick Sort runtime would be better'],
    correctIndex: 1,
    hint: 'Think about whether partitions are balanced or extremely lopsided.',
    why: 'Extreme pivots create unbalanced partitions, increasing recursion depth and total comparisons.',
  },
];

export default function QuickSort() {
  const [inputStr, setInputStr] = useState("");
  const [stepper, setStepper] = useState(() => new QuickSortStepper([]));
  const [writePulse, setWritePulse] = useState(new Set());

  // teaching mode UI state (kept in component, not in algorithm stepper)
  const [teachingEnabled, setTeachingEnabled] = useState(false);
  const [askedIds, setAskedIds] = useState(() => new Set());
  const [activeQ, setActiveQ] = useState(null); // { ...q, status, chosenIndex }
  const [showHint, setShowHint] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);

  const bump = () =>
    setStepper(Object.assign(Object.create(Object.getPrototypeOf(stepper)), stepper));

  const state = stepper.getState();
  const values = state.array;
  const activeRange = state.active ? [state.active.l, state.active.r] : null;
  const micro = state.micro;

  const topFrame = state.stack[state.stack.length - 1] || null;
  const phase = topFrame ? topFrame.phase : null;

  const totalQuestions = QS_QUESTIONS.length;
  const teachingBlocked = teachingEnabled && !!activeQ;

  // decide which pivot index to highlight for the UI
  let pivotIndexUI = null;
  if (micro.active && micro.pivotIndex != null) {
    pivotIndexUI = micro.pivotIndex;
  } else if (
    topFrame &&
    (topFrame.phase === 'divide' || topFrame.phase === 'conquer') &&
    topFrame.pivotIndex != null
  ) {
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

    // teaching reset
    setAskedIds(new Set());
    setActiveQ(null);
    setShowHint(false);
    setCorrectCount(0);
  };

  const flashWritesFromStepper = () => {
    const fresh = new Set(stepper.getState().lastWrites);
    setWritePulse(fresh);
    if (fresh.size > 0) {
      setTimeout(() => setWritePulse(new Set()), 220);
    }
  };

  // central trigger function: call after each successful step (prevState -> nextState)
  const maybeActivateQuestion = (prevState, nextState) => {
    if (!teachingEnabled) return;
    if (activeQ) return;

    // Q3: end-of-algorithm reflection
    if (prevState?.done === false && nextState?.done === true) {
      const q = QS_QUESTIONS.find(x => x.triggerDone);
      if (q && !askedIds.has(q.id)) {
        setAskedIds(prev => new Set(prev).add(q.id));
        setActiveQ({ ...q, status: 'unanswered', chosenIndex: null });
        setShowHint(false);
      }
      return;
    }

    // Q1/Q2: based on lastAction string
    const actionType = classifyLastAction(nextState?.lastAction);
    if (!actionType) return;

    const q = QS_QUESTIONS.find(x => x.triggerAction === actionType);
    if (!q) return;
    if (askedIds.has(q.id)) return;

    setAskedIds(prev => new Set(prev).add(q.id));
    setActiveQ({ ...q, status: 'unanswered', chosenIndex: null });
    setShowHint(false);
  };

  const answerQuestion = (idx) => {
    if (!activeQ || activeQ.status !== 'unanswered') return;

    const correct = idx === activeQ.correctIndex;

    if (correct) {
      setCorrectCount((c) => c + 1);
    }

    setActiveQ({
      ...activeQ,
      chosenIndex: idx,
      status: correct ? 'correct' : 'incorrect',
    });

    setShowHint(false);
  };


  const skipQuestion = () => {
    setActiveQ(null);
    setShowHint(false);
  };

  const continueAfterAnswer = () => {
    setActiveQ(null);
    setShowHint(false);
  };

  const doDivide = () => {
    if (teachingBlocked) return;
    const prev = state;
    if (stepper.stepDivide()) {
      flashWritesFromStepper();
      bump();
      const next = stepper.getState();
      // trigger after state transition
      maybeActivateQuestion(prev, next);
    }
  };

  const doConquer = () => {
    if (teachingBlocked) return;
    const prev = state;
    if (stepper.stepConquer()) {
      flashWritesFromStepper();
      bump();
      const next = stepper.getState();
      maybeActivateQuestion(prev, next);
    }
  };

  const doCombine = () => {
    if (teachingBlocked) return;
    const prev = state;
    if (stepper.stepCombine()) {
      flashWritesFromStepper();
      bump();
      const next = stepper.getState();
      maybeActivateQuestion(prev, next);
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
            placeholder="e.g. 38,27,43,3,9,42,10,21"
          />
          <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={reset}>
            Start
          </button>
        </div>

        {/* Teaching mode toggle */}
        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-800">
            <input
              type="checkbox"
              checked={teachingEnabled}
              onChange={(e) => {
                const on = e.target.checked;
                setTeachingEnabled(on);
                // if turning off, stop blocking the UI
                if (!on) setActiveQ(null);
                setShowHint(false);
              }}
            />
            Teaching mode
          </label>

          {teachingEnabled && (
            <div className="text-xs text-gray-600">
              Score: {correctCount}/{totalQuestions}
            </div>
          )}
        </div>

        {/* Teaching question card */}
        {teachingEnabled && activeQ && (
          <div className="bg-white border rounded p-4">
            <div className="text-sm font-semibold text-gray-900">{activeQ.prompt}</div>

            <div className="mt-3 space-y-2">
              {activeQ.options.map((opt, idx) => {
                const isChosen = activeQ.chosenIndex === idx;
                const showResult = activeQ.status !== 'unanswered';
                const isCorrectOption = showResult && idx === activeQ.correctIndex;
                const isWrongChosen = showResult && activeQ.status === 'incorrect' && isChosen;

                return (
                  <button
                    key={`${activeQ.id}_${idx}`}
                    disabled={activeQ.status !== 'unanswered'}
                    onClick={() => answerQuestion(idx)}
                    className={[
                      'w-full text-left text-sm text-gray-900 border rounded-lg px-3 py-2 transition',
                      activeQ.status === 'unanswered' ? 'hover:bg-gray-50' : '',
                      isCorrectOption ? 'border-green-500 bg-green-50' : '',
                      isWrongChosen ? 'border-red-500 bg-red-50' : '',
                      activeQ.status === 'unanswered' && isChosen ? 'border-blue-400 bg-blue-50' : '',
                      !isCorrectOption && !isWrongChosen && !(activeQ.status === 'unanswered' && isChosen)
                        ? 'border-gray-200'
                        : '',
                      showResult && !isCorrectOption && !isWrongChosen ? 'opacity-80' : '',
                    ].join(' ')}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex items-center gap-2">
              {activeQ.status === 'unanswered' ? (
                <>
                  <button
                    className="text-xs px-3 py-1 border rounded-lg hover:bg-gray-50 text-gray-900"
                    onClick={() => setShowHint((v) => !v)}
                  >
                    {showHint ? 'Hint?' : 'Hint?'}
                  </button>

                  <button
                    className="text-xs px-3 py-1 border rounded-lg hover:bg-gray-50 text-gray-900"
                    onClick={skipQuestion}
                  >
                    Skip
                  </button>

                  <div className="ml-auto text-xs text-gray-500">Answer to continue</div>
                </>
              ) : (
                <>
                  <div className="text-xs text-gray-700">
                    {activeQ.status === 'correct' ? 'Correct!' : 'Not quite.'} {activeQ.why}
                  </div>
                  <button
                    className="ml-auto text-xs px-3 py-1 border rounded-lg hover:bg-gray-50 text-gray-900"
                    onClick={continueAfterAnswer}
                  >
                    Continue
                  </button>
                </>
              )}
            </div>

            {activeQ.status === 'unanswered' && showHint && (
              <div className="mt-2 text-xs text-gray-600 border-t pt-2">{activeQ.hint}</div>
            )}
          </div>
        )}

        <div className="text-sm text-gray-600">
          {state.done ? (
            'Status: Done (sorted)'
          ) : (
            <>
              Status: Working — last action: {state.lastAction ?? '—'}
              {phase === 'divide' && micro.active && (
                <span className="ml-2 text-indigo-700">
                  • Partition in progress: i = {micro.i}, j = {micro.j}, pivot index = {micro.pivotIndex}
                </span>
              )}
            </>
          )}
        </div>

        {/* Bars */}
        <div className="w-full h-56 flex items-end gap-1 rounded-md p-3 bg-white border">
          {values.map((v, i) => {
            const inActive = activeRange && i >= activeRange[0] && i <= activeRange[1];
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

            const pivotRing = isPivot ? 'ring-4 ring-green-400 ring-offset-2' : '';
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
            disabled={teachingBlocked || !stepper.canDivide() || state.done}
            title="Choose the pivot as the last element of the current active subarray."
          >
            Divide
          </button>

          <button
            className="px-4 py-2 rounded bg-teal-600 text-white disabled:opacity-50"
            onClick={doConquer}
            disabled={teachingBlocked || !stepper.canConquer() || state.done}
            title="Step through the partition: compare one element to the pivot, maybe swap, and eventually place the pivot."
          >
            Conquer
          </button>

          <button
            className="px-4 py-2 rounded bg-purple-600 text-white disabled:opacity-50"
            onClick={doCombine}
            disabled={teachingBlocked || !stepper.canCombine() || state.done}
            title="Visually mark this subarray as fully solved (no further work inside it)."
          >
            Combine
          </button>

          {teachingBlocked && (
            <span className="text-xs text-gray-500">
              Teaching mode: answer/skip the question to continue
            </span>
          )}
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
