import React, { useMemo, useState } from 'react'
import { MergeSortStepper } from '../algorithms/mergesort/Stepper.js'

// quiz mode question bank (id, trigger, prompt, options, correctIndex, hint, why)

const QUESTION_BANK = [
  {
    id: 'ms_q1_base_case',
    trigger: 'LEAF_CONQUER_ATTEMPT', // before conquer on leaf
    prompt: 'Why does Merge Sort stop dividing when subarrays reach size 1?',
    options: [
      'Because merging requires exactly one element',
      'Because a subarray of size one is fully sorted',
      'Because otherwise we would divide infinitely',
    ],
    correctIndex: 1,
    hint: 'Think: what property does a 1-element list already have?',
    why: 'A single element is already in sorted order, so it becomes a completed sub-solution.',
  },

  {
    id: 'ms_q2_merge_invariant',
    trigger: 'AFTER_FIRST_COMBINE', // after first combine
    prompt:
      'Why is it correct to build the merged array by repeatedly choosing the smallest front element from either subarray?',
    options: [
      'Because we need to compare every element',
      'Because each subarray is properly sorted',
      'Because all of the larger elements are already in the correct place',
    ],
    correctIndex: 1,
    hint: 'The key fact is about the two halves before merging starts.',
    why: 'Because each half is already sorted, the smallest remaining overall must be at the front of one half.',
  },

  {
    id: 'ms_q3_sorted_input_runtime',
    trigger: 'AT_END',
    prompt:
      'Suppose we give Merge Sort an array that is already fully sorted. How would this affect the runtime of the algorithm?',
    options: [
      'It will become slower',
      'It will become faster',
      'It will stay the same',
    ],
    correctIndex: 2,
    hint: 'Merge Sort still performs the same pattern of splitting and merging.',
    why: 'Merge Sort’s work is driven by the divide + merge structure, not by how sorted the input already is.',
  },

  {
    id: 'ms_q4_after_divide_finished',
    trigger: 'AFTER_DIVIDE_FINISHED', // after fully split into single elements
    prompt:
      'After we split everything down to single numbers, what is the next thing we will do to start building up the array again?',
    options: [
      'Merge leftmost pairs of single numbers into sorted groups of 2',
      'Select the largest number and merge it with the second largest number',
      'Merge the middle two numbers so they form a pair',
    ],
    correctIndex: 0,
    hint: 'We start combining the smallest sub-solutions first, left to right.',
    why: 'Merge Sort builds back up by merging neighbouring solved pieces (starting with size-1 → size-2).',
  },

  {
    id: 'ms_q5_one_side_done',
    trigger: 'ONE_SIDE_FULLY_SORTED', // when we move to process the other side
    prompt:
      'We just finished sorting and merging one side of the array, what do we do now?',
    options: [
      'We are done',
      'We start merging the left side with the right side immediately',
      'We sort the right-hand side, then we merge the two halves',
    ],
    correctIndex: 2,
    hint: 'Merge Sort fully solves both halves before doing the final merge.',
    why: 'Each half becomes fully solved first; then the algorithm merges the two solved halves.',
  },
];

// randomiser for picking questions 
function pickKRandom(arr, k) {
  const a = arr.slice();
  // Fisher–Yates shuffle
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, k);
}

function getRootMergeFrame(stack, n) {
  // root merge exists once the very first divide has happened
  return stack.find(f => f.phase === 'merge' && f.l === 0 && f.r === n - 1);
}

// core app state 
export default function MergeSort() {
  const [inputStr, setInputStr] = useState(''); // what user typed in the input box
  const [stepper, setStepper] = useState(() => new MergeSortStepper([])); // the main algorithm state machine
  const [writePulse, setWritePulse] = useState(new Set()); // which indices were just written to (for UI pulse effect)

  // teaching mode state
  const [teachingEnabled, setTeachingEnabled] = useState(false); // is quiz mode on?
  const [selectedIds, setSelectedIds] = useState(() => new Set()); // 3 chosen per run
  const [askedIds, setAskedIds] = useState(() => new Set()); // which ones have been asked already in this run (to avoid repeats if user skips)
  const [activeQ, setActiveQ] = useState(null); // { ...q, status, chosenIndex }
  const [showHint, setShowHint] = useState(false); // whether to show the hint for the active question
  const [score, setScore] = useState(0); // how many correct answers in this run
  const [wrongCount, setWrongCount] = useState(0); // how many wrong answers in this run
  const totalQuestions = 3; // how many questions to ask per run

  const teachingBlocked = teachingEnabled && !!activeQ; // whether user is currently blocked from taking algorithmic steps due to an active question

  // bump forces a re-render by creating a new object reference for the stepper (while keeping the same internal state)
  const bump = () =>
    setStepper(Object.assign(Object.create(Object.getPrototypeOf(stepper)), stepper));

  const state = stepper.getState();
  const values = state.array;
  const activeRange = state.active ? [state.active.l, state.active.r] : null;
  const micro = state.micro;
  const microOn = micro.active;

  // these 2 are used fr the minimum subproblem reached status message 
  const topFrame = state.stack[state.stack.length - 1] || null;
  const onLeaf = !!(topFrame && topFrame.phase === 'divide' && topFrame.l === topFrame.r);

  // bar height scaling for the bars visuals 
  const max = Math.max(1, ...values.map(v => Math.abs(v)));
  const heightPx = v => 12 + Math.round((Math.abs(v) / max) * 160);

  // need to convert "8,7,6" → [8,7,6] for the stepper
  const parse = () =>
    inputStr.split(',').map(s => s.trim()).filter(Boolean)
      .map(Number).filter(Number.isFinite);

  // question and quiz helpers
  // build a fast lookup map from questions id -> question object 
  const questionById = useMemo(() => {
    const m = new Map();
    for (const q of QUESTION_BANK) m.set(q.id, q);
    return m;
  }, []);

  const showQuestion = (qid) => {
    const q = questionById.get(qid);
    if (!q) return;
    setAskedIds(prev => {
      const next = new Set(prev);
      next.add(qid);
      return next;
    });
    setActiveQ({ ...q, status: 'unanswered', chosenIndex: null });
    setShowHint(false);
  };

  const answerQuestion = (idx) => {
    if (!activeQ || activeQ.status !== 'unanswered') return;

    const correct = idx === activeQ.correctIndex;
    if (correct) setScore(s => s + 1);
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

  const startNewQuizRun = () => {
    setAskedIds(new Set());
    setActiveQ(null);
    setShowHint(false);
    setScore(0);

    const picked = pickKRandom(QUESTION_BANK.map(q => q.id), totalQuestions);
    setSelectedIds(new Set(picked));
  };

  const startNewRunTeachingIfNeeded = () => {
    setAskedIds(new Set());
    setActiveQ(null);
    setShowHint(false);
    setScore(0);

    if (teachingEnabled) {
      const picked = pickKRandom(QUESTION_BANK.map(q => q.id), 3);
      setSelectedIds(new Set(picked));
    } else {
      setSelectedIds(new Set());
    }
  };

  const reset = () => {
    const arr = parse();
    const s = new MergeSortStepper(arr);
    setStepper(s);
    setWritePulse(new Set());
    startNewRunTeachingIfNeeded();
  };

  // randomise button helpers
  const makeRandomArray = (len = 8, min = 1, max = 99) => {
    const rangeSize = max - min + 1;
    if (len > rangeSize) throw new Error('Random array length exceeds unique value range');

    const pool = [];
    for (let v = min; v <= max; v++) pool.push(v);

    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, len);
  };

  const randomise = () => {
    const arr = makeRandomArray(8, 1, 50);
    setInputStr(arr.join(','));
    setStepper(new MergeSortStepper(arr));
    setWritePulse(new Set());
    startNewRunTeachingIfNeeded();
  };

  // trigger helpers 

  // ask a question only if...
  const shouldAsk = (qid) =>
    teachingEnabled &&
    selectedIds.has(qid) &&
    !askedIds.has(qid) &&
    !activeQ;

  // called after an action changes stepper state 
  const maybeTriggerAfterStep = (prevState, nextState) => {
    // Q3: end of algorithm
    if (shouldAsk('ms_q3_sorted_input_runtime') && !prevState.done && nextState.done) {
      showQuestion('ms_q3_sorted_input_runtime');
      return;
    }

    // Q5: one side fully sorted → about to start right half of ROOT
    if (shouldAsk('ms_q5_one_side_done')) {
      const n = nextState.array.length;
      if (n >= 2) {
        const rootMerge = getRootMergeFrame(nextState.stack, n);
        if (rootMerge) {
          const rightL = rootMerge.m + 1;
          const rightR = rootMerge.r;
          const top = nextState.stack[nextState.stack.length - 1];
          const isStartingRootRight =
            top &&
            top.phase === 'divide' &&
            top.l === rightL &&
            top.r === rightR;

          // Fire the first time we reach that exact state
          const prevRootMerge = getRootMergeFrame(prevState.stack, n);
          const prevTop = prevState.stack[prevState.stack.length - 1];
          const wasAlreadyStartingRootRight =
            prevRootMerge &&
            prevTop &&
            prevTop.phase === 'divide' &&
            prevTop.l === (prevRootMerge.m + 1) &&
            prevTop.r === prevRootMerge.r;

          if (isStartingRootRight && !wasAlreadyStartingRootRight) {
            showQuestion('ms_q5_one_side_done');
            return;
          }
        }
      }
    }
  };

  // algorithm actions divide conquer combine 

  const doDivide = () => {
    if (teachingBlocked) return;
    const prev = stepper.getState();

    if (stepper.stepDivide()) {
      setWritePulse(new Set());
      bump();

      const next = stepper.getState();
      maybeTriggerAfterStep(prev, next);
    }
  };

  const doConquer = () => {
    if (teachingBlocked) return;

    const prev = stepper.getState();
    const top = prev.stack[prev.stack.length - 1] || null;
    const isLeaf = !!(top && top.phase === 'divide' && top.l === top.r);

    // Leaf reached: base-case moment.
    // If either Q1 or Q4 is selected, ask them here (one at a time).
    if (isLeaf) {
      if (shouldAsk('ms_q1_base_case')) {
        showQuestion('ms_q1_base_case');
        return;
      }
      if (shouldAsk('ms_q4_after_divide_finished')) {
        showQuestion('ms_q4_after_divide_finished');
        return;
      }
    }

    if (stepper.stepConquer()) {
      const fresh = new Set(stepper.getState().lastWrites);
      setWritePulse(fresh);
      setTimeout(() => setWritePulse(new Set()), 160);
      bump();

      const next = stepper.getState();
      maybeTriggerAfterStep(prev, next);
    }
  };

  const doCombine = () => {
    if (teachingBlocked) return;

    const prev = stepper.getState();
    const prevTop = prev.stack[prev.stack.length - 1] || null;

    if (stepper.stepCombine()) {
      const fresh = new Set(stepper.getState().lastWrites);
      setWritePulse(fresh);
      setTimeout(() => setWritePulse(new Set()), 220);
      bump();

      const next = stepper.getState();

      // Q2: trigger when we just finished merging the ENTIRE LEFT HALF of the root
      // rootM = floor((n-1)/2). Left half segment is [0..rootM]
      if (shouldAsk('ms_q2_merge_invariant')) {
        const n = prev.array.length;
        if (n >= 2 && prevTop && prevTop.phase === 'merge') {
          const rootM = Math.floor((n - 1) / 2);
          const justMergedLeftHalf = (prevTop.l === 0 && prevTop.r === rootM);

          if (justMergedLeftHalf) {
            // fire after UI updates
            queueMicrotask(() => showQuestion('ms_q2_merge_invariant'));
          }
        }
      }

      // Keep other triggers
      maybeTriggerAfterStep(prev, next);
    }
  };

  // explain path (disabled/hidden in teaching mode)
  const startExplain = () => {
    if (teachingEnabled) return;
    if (stepper.startMicro()) { setWritePulse(new Set()); bump(); }
  };

  const nextMicro = () => {
    if (teachingEnabled) return;
    if (stepper.stepMicro()) {
      // in explain mode the compared bars pulse 
      // so we update writePulse on every micro step
      setWritePulse(new Set());
      bump();
    }
  };

  const finishMicro = () => {
    if (teachingEnabled) return;
    if (stepper.exitMicroDiscard()) {
      const fresh = new Set(stepper.getState().lastWrites);
      setWritePulse(fresh);
      setTimeout(() => setWritePulse(new Set()), 220);
      bump();
    }
  };

  const correctCount = score;

  const answeredCount = correctCount + wrongCount;

  // ui render
  return (
    <div className="min-h-screen bg-grey-500">
      <div className="max-w-5xl mx-auto space-y-5">
        <h1 className="text-2xl font-bold text-gray-900">Merge Sort</h1>

        <div className="flex gap-2 items-center">
          <input
            className="flex-1 border rounded px-3 py-2"
            value={inputStr}
            onChange={e => setInputStr(e.target.value)}
            placeholder="e.g. 38,27,43,3,9,42,10,21"
          />

          <button
            className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
            onClick={reset}
            disabled={inputStr.trim().length === 0 || teachingBlocked}
          >
            Start
          </button>

          <button
            className="px-3 py-2 rounded bg-white text-gray-800 border disabled:opacity-50"
            onClick={randomise}
            disabled={teachingBlocked}
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
                          color = i < score ? "bg-emerald-600" : "bg-red-500";
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
                      {score}/{totalQuestions}
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
                    // turning OFF: dismiss any active question and clear quiz state
                    setActiveQ(null);
                    setShowHint(false);
                    setSelectedIds(new Set());
                    setAskedIds(new Set());
                    setScore(0);
                  } else {
                    // turning ON: start a fresh quiz run (pick 3)
                    startNewQuizRun();
                  }
                }}
                className={[
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  teachingEnabled ? "bg-indigo-600" : "bg-gray-300",
                  "focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2",
                ].join(" ")}
                title={teachingEnabled ? "Quiz Mode is ON" : "Quiz Mode is OFF"}
                disabled={teachingBlocked} // optional
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
          <div className="bg-white border rounded-xl p-4">
            <div className="text-sm font-semibold text-gray-900">{activeQ.prompt}</div>

            <div className="mt-3 space-y-2">
              {activeQ.options.map((opt, idx) => {
                const showResult = activeQ.status !== 'unanswered';
                const isCorrectOption = showResult && idx === activeQ.correctIndex;
                const isWrongChosen =
                  showResult && activeQ.status === 'incorrect' && activeQ.chosenIndex === idx;

                return (
                  <button
                    key={`${activeQ.id}_${idx}`}
                    disabled={activeQ.status !== 'unanswered'}
                    onClick={() => answerQuestion(idx)}
                    className={[
                      'w-full text-left text-sm text-gray-900 bg-white border rounded-lg px-3 py-2 transition',
                      activeQ.status === 'unanswered' ? 'hover:bg-gray-50' : '',
                      isCorrectOption ? 'border-green-500 bg-green-50' : '',
                      isWrongChosen ? 'border-red-500 bg-red-50' : '',
                      !isCorrectOption && !isWrongChosen ? 'border-gray-200' : '',
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
                    className="text-xs px-3 py-1 border rounded-lg hover:bg-gray-50 text-gray-500"
                    onClick={() => setShowHint(v => !v)}
                  >
                    {showHint ? 'Hint?' : 'Hint?'}
                  </button>

                  <button
                    className="text-xs px-3 py-1 border rounded-lg hover:bg-gray-50 text-gray-500"
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
                    className="ml-auto text-xs px-3 py-1 border rounded-lg hover:bg-gray-50 text-gray-500"
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
              {!microOn && onLeaf && (
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
            const inActive = activeRange && i >= activeRange[0] && i <= activeRange[1];

            const isProbeLeftMain =
              microOn && micro.i < micro.left.length && i === (micro.l + micro.i);
            const isProbeRightMain =
              microOn && micro.j < micro.right.length && i === (micro.m + 1 + micro.j);

            const pulseWrite = !microOn && writePulse.has(i);

            const color = inActive ? 'bg-yellow-400' : 'bg-slate-700';
            const probeRing =
              isProbeLeftMain ? 'ring-4 ring-blue-400 ring-offset-2 animate-pulse'
                : isProbeRightMain ? 'ring-4 ring-rose-400 ring-offset-2 animate-pulse'
                  : '';
            const writeRing = pulseWrite ? 'ring-4 ring-purple-400 ring-offset-2' : '';

            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-end">
                <div
                  className={[
                    'w-full rounded-t transition-all duration-300 ease-out',
                    color,
                    (probeRing || writeRing),
                  ].join(' ')}
                  style={{ height: heightPx(v) }}
                  title={`${v}`}
                />
                <div className="text-[11px] text-gray-700 mt-1">{v}</div>
              </div>
            );
          })}
        </div>

        {/* Controls: Divide / Conquer (leaf) / Combine (merge) */}
        {!microOn ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="px-4 py-2 rounded bg-emerald-600 text-white disabled:opacity-50"
              onClick={doDivide}
              disabled={teachingBlocked || !stepper.canDivide() || state.done}
            >
              Divide
            </button>

            <button
              className="px-4 py-2 rounded bg-teal-600 text-white disabled:opacity-50"
              onClick={doConquer}
              disabled={teachingBlocked || !stepper.canConquer() || state.done}
              title="Mark a size-1 subproblem as a sub-solution"
            >
              Conquer
            </button>

            <button
              className="px-4 py-2 rounded bg-purple-600 text-white disabled:opacity-50"
              onClick={doCombine}
              disabled={teachingBlocked || !stepper.canCombine() || state.done}
              title="Combine (merge) two solved halves"
            >
              Combine
            </button>

            {/* Explain hidden in teaching mode */}
            {!teachingEnabled && !state.done && stepper.canExplainMerge() && (
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
          // Explain panel hidden in teaching mode
          !teachingEnabled && (
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
          )
        )}

        {/* Explain panel */}
        {!teachingEnabled && microOn && (
          <div className="rounded-md border bg-white p-3 space-y-3">
            <div className="text-sm text-gray-700">
              {micro.done
                ? 'Staged result complete. “Finish merge” will now apply it instantly.'
                : (() => {
                  const leftVal = micro.i < micro.left.length ? micro.left[micro.i] : '—';
                  const rightVal = micro.j < micro.right.length ? micro.right[micro.j] : '—';
                  return `Compare ${leftVal} (left) vs ${rightVal} (right) → place the smaller next.`;
                })()}
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-1">Left run</div>
              <div className="flex gap-2">
                {micro.left.map((v, idx) => {
                  const isHead = idx === micro.i;
                  return (
                    <div
                      key={idx}
                      className={[
                        'px-3 py-1 rounded border text-gray-900',
                        isHead ? 'outline outline-2 outline-blue-500' : '',
                      ].join(' ')}
                    >
                      {v}
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-1">Right run</div>
              <div className="flex gap-2">
                {micro.right.map((v, idx) => {
                  const isHead = idx === micro.j;
                  return (
                    <div
                      key={idx}
                      className={[
                        'px-3 py-1 rounded border text-gray-900',
                        isHead ? 'outline outline-2 outline-rose-500' : '',
                      ].join(' ')}
                    >
                      {v}
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-1">Staged output</div>
              <div className="flex gap-2">
                {Array.from({ length: micro.r - micro.l + 1 }).map((_, idx) => {
                  const filled = idx < micro.out.length;
                  const val = filled ? micro.out[idx] : '·';
                  return (
                    <div
                      key={idx}
                      className={[
                        'px-3 py-1 rounded border min-w-10 text-center',
                        filled ? 'bg-emerald-50 border-emerald-400 text-gray-900'
                          : 'bg-gray-50 text-gray-500',
                      ].join(' ')}
                    >
                      {val}
                    </div>
                  );
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
  );
}