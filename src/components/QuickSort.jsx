import React, { useMemo, useState } from 'react'
import { QuickSortStepper } from '../algorithms/quicksort/Stepper.js'

// teaching mode helpers
function classifyLastAction(lastAction) {
  if (!lastAction || typeof lastAction !== 'string') return null;
  if (lastAction.startsWith('divide: start partition')) return 'QS_PARTITION_START';
  if (lastAction.startsWith('divide: compare index')) return 'QS_SCANNING_STEP';
  if (lastAction.startsWith('divide: place pivot')) return 'QS_PARTITION_DONE';
  return null;
}

function pickRandomN(arr, n) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

const QS_QUESTIONS = [
  {
    id: 'q1_partition_guarantee',
    triggerAction: 'QS_PARTITION_START',
    prompt: 'We are now in the partition step. After partitioning around the pivot, what can we guarantee about the elements?',
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
  {
    id: 'q4_pivot_final_spot',
    triggerAction: 'QS_PARTITION_DONE',
    prompt: 'Once the partition is finished and the pivot is in its new spot, what happens to that pivot element?',
    options: [
      'It stays in that spot because it is now in its final sorted position',
      'It moves back to the end of the array to be used again',
      'It is swapped with the largest element in the array',
    ],
    correctIndex: 0,
    hint: 'Does the pivot need to move again if everything to its left is smaller and everything to its right is larger?',
    why: 'A key feature of Quick Sort is that each partition step places at least one element (the pivot) into its permanent, sorted position.'
  },
  {
    id: 'q5_scanning_logic',
    triggerAction: 'QS_SCANNING_STEP',
    prompt: 'As the scanner function moves through the array, what is it looking for in relation to the pivot?',
    options: [
      'Numbers that are equal to the first element',
      'Numbers that are smaller than the pivot, so it can move them to the left side',
      'The largest number in the entire array',
    ],
    correctIndex: 1,
    hint: 'The goal of this step is to separate the "small" numbers from the "big" numbers.',
    why: 'The algorithm scans the array to find elements that belong on the left side (smaller) or right side (larger) of the pivot point.'
  }
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
  const [wrongCount, setWrongCount] = useState(0);

  const bump = () =>
    setStepper(Object.assign(Object.create(Object.getPrototypeOf(stepper)), stepper));

  const state = stepper.getState();
  const values = state.array;
  const activeRange = state.active ? [state.active.l, state.active.r] : null;
  const micro = state.micro;

  const topFrame = state.stack[state.stack.length - 1] || null;
  const phase = topFrame ? topFrame.phase : null;

  const [runQuestions, setRunQuestions] = useState([]); // the 3 chosen for THIS run
  const totalQuestions = teachingEnabled ? runQuestions.length : QS_QUESTIONS.length;
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

  const startNewQuizRun = () => {
    const chosen = pickRandomN(QS_QUESTIONS, 3);
    setRunQuestions(chosen);
    setAskedIds(new Set());
    setActiveQ(null);
    setShowHint(false);
    setCorrectCount(0);
    setWrongCount(0); 
  };

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

    if (teachingEnabled) {
      startNewQuizRun();
    } else {
      // teaching reset (existing)
      setAskedIds(new Set());
      setActiveQ(null);
      setShowHint(false);
      setCorrectCount(0);
      setWrongCount(0);
    }
  };

  // randomise helpers
  const randomArray = (n = 10, max = 100) => {
    const pool = Array.from({ length: max }, (_, i) => i + 1);

    // Shuffle pool
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    // Take first n elements
    return pool.slice(0, n);
  };



  const randomise = () => {
    const arr = randomArray(8, 50);
    const s = new QuickSortStepper(arr);
    setStepper(s);
    setWritePulse(new Set());
    setInputStr(arr.join(','));

    if (teachingEnabled) {
      startNewQuizRun();
    }
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

    // If runQuestions isn't initialised yet (e.g. they enabled quiz mid-run), initialise it
    const pool = (runQuestions && runQuestions.length > 0) ? runQuestions : QS_QUESTIONS;

    // Done-trigger questions
    if (prevState?.done === false && nextState?.done === true) {
      const q = pool.find(x => x.triggerDone && !askedIds.has(x.id));
      if (q) {
        setAskedIds(prev => new Set(prev).add(q.id));
        setActiveQ({ ...q, status: 'unanswered', chosenIndex: null });
        setShowHint(false);
      }
      return;
    }

    const actionType = classifyLastAction(nextState?.lastAction);
    if (!actionType) return;

    // Pick ANY matching question that hasn't been asked yet (important for QS_PARTITION_DONE)
    const candidates = pool.filter(
      x => x.triggerAction === actionType && !askedIds.has(x.id)
    );

    if (candidates.length === 0) return;

    // If there are multiple (e.g. q2 & q4), pick one at random for extra variety
    const q = candidates[Math.floor(Math.random() * candidates.length)];

    setAskedIds(prev => new Set(prev).add(q.id));
    setActiveQ({ ...q, status: 'unanswered', chosenIndex: null });
    setShowHint(false);
  };

  

  const answerQuestion = (idx) => {
    if (!activeQ || activeQ.status !== 'unanswered') return;

    const correct = idx === activeQ.correctIndex;
    if (correct) setCorrectCount(c => c + 1);
    else setWrongCount(w => w + 1);

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

  const answeredCount = askedIds.size;;

  return (
    <div className="min-h-screen bg-grey-500">
      <div className="max-w-5xl mx-auto space-y-5">
        <h1 className="text-2xl font-bold text-gray-900">Quick Sort</h1>

        <div className="flex items-center gap-2">
          <input
            className="flex-1 border rounded px-3 py-2"
            value={inputStr}
            onChange={e => setInputStr(e.target.value)}
            placeholder="e.g. 38,27,43,3,9,42,10,21"
          />

          <button
            className="px-3 py-2 rounded bg-blue-600 text-white"
            onClick={reset}
          >
            Start
          </button>

          <button
            className="px-3 py-2 rounded bg-white text-gray-800 border"
            onClick={randomise}
            title="Generate a random array"
          >
            Randomise
          </button>

          {/* Quiz mode toggle (switch) */}
            <div className="flex items-center gap-3 px-3 py-2">
              {/* Left side: score area (fixed width so layout doesn’t jump) */}
              <div className="w-40 flex justify-end">
                {teachingEnabled && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalQuestions }).map((_, i) => {
                        let color = "bg-gray-300";

                        if (i < answeredCount) {
                          // this dot represents an answered question
                          color = i < correctCount ? "bg-emerald-600" : "bg-red-500";
                        }

                        return (
                          <span
                            key={i}
                            className={`h-2.5 w-2.5 rounded-full ${color}`}
                          />
                        );
                      })}
                    </div>
                    <div className="text-xs text-gray-600">
                      {correctCount}/{totalQuestions}
                    </div>
                  </div>
                )}
              </div>

              {/* Right side: label + toggle (stays put) */}
              <span className="text-sm text-gray-800">Quiz Mode</span>

              <button
                type="button"
                role="switch"
                aria-checked={teachingEnabled}
                onClick={() => {
                  const on = !teachingEnabled;
                  setTeachingEnabled(on);
                  if (!on) {
                    setActiveQ(null);
                    setShowHint(false);
                  } else {
                    startNewQuizRun();
                  }
                }}
                className={[
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  teachingEnabled ? "bg-indigo-600" : "bg-gray-300",
                  "focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2",
                ].join(" ")}
                title={teachingEnabled ? "Quiz Mode is ON" : "Quiz Mode is OFF"}
              >
                <span
                  className={[
                    "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
                    teachingEnabled ? "translate-x-5" : "translate-x-1",
                  ].join(" ")}
                />
              </button>
            </div>
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
