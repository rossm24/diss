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
      <div className="mt-2 text-xs text-gray-500">
        bestRange: [{s.bestRange[0]}, {s.bestRange[1]}]
      </div>
    </div>
  );
}

function rangeContains(i, [l, r]) {
  return i >= l && i <= r;
}

/* teaching mode  */

const MS_QUESTIONS = {
  midpoint: {
    id: "ms_midpoint_prediction",
    prompt: "At this point, can we know whether the maximum subarray will cross the midpoint of the array?",
    options: [
      "Yes, it must cross the midpoint",
      "No, it cannot cross the midpoint",
      "No — we cannot know yet",
    ],
    correctIndex: 2,
    hint: "Before we compute the left, right, and crossing candidates, we can’t know which will win.",
    why: "At the start we haven’t computed enough information — the result could be left, right, or crossing.",
  },

  largestValue: {
    id: "ms_largest_value",
    prompt: "The largest value in this array guaranteed to be part of the maximum subarray",
    options: ["True", "False"],
    correctIndex: 1,
    hint: "Maximum subarray is about the best contiguous sum.",
    why: "The best contiguous sum may exclude the largest element if the best segment is elsewhere or contiguity forces trade-offs.",
  },

  doneYet: {
    id: "ms_done_yet",
    prompt:
      "Now that we know the maximum subarray in the left side of the array and in the right side of the array, we simply take the greater of the two and are done.",
    options: ["True", "False"],
    correctIndex: 1,
    hint: "Can you think of a third possibility besides left or right being the winner?",
    why: "The true maximum subarray can cross the midpoint, so we must also consider the crossing case.",
  },
};

export default function MaxSubarray() {
  const [arr, setArr] = useState([]);
  const [state, setState] = useState(() => makeInitialState(arr));

  const [input, setInput] = useState(arr.join(", "));
  const [inputError, setInputError] = useState("");

  // Teaching mode UI state (kept here, not inside logic.js)
  const [teachingEnabled, setTeachingEnabled] = useState(false);
  const [askedIds, setAskedIds] = useState(() => new Set());
  const [activeQ, setActiveQ] = useState(null); // { ...q, status, chosenIndex }
  const [showHint, setShowHint] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const totalQuestions = 3;
  const [answeredCount, setAnsweredCount] = useState(0);

  const teachingBlocked = teachingEnabled && !!activeQ;

  function parseArray(text) {
    const tokens = text
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean);

    const nums = tokens.map((t) => Number(t));
    if (tokens.length < 2) return { ok: false, error: "Please enter at least two numbers." };
    if (nums.some((n) => Number.isNaN(n))) return { ok: false, error: "Only numbers are allowed (use spaces/commas)." };

    return { ok: true, nums };
  }

  /* teaching mode helpers */

  const showQuestion = (q) => {
    setAskedIds((prev) => {
      const next = new Set(prev);
      next.add(q.id);
      return next;
    });
    setActiveQ({ ...q, status: "unanswered", chosenIndex: null });
    setShowHint(false);
  };

  const answerQuestion = (idx) => {
    if (!activeQ || activeQ.status !== "unanswered") return;

    const correct = idx === activeQ.correctIndex;
    if (correct) setCorrectCount((c) => c + 1);

    setActiveQ({
      ...activeQ,
      chosenIndex: idx,
      status: correct ? "correct" : "incorrect",
    });
    setShowHint(false);
    setAnsweredCount((n) => Math.min(totalQuestions, n + 1));
  };

  const skipQuestion = () => {
    setActiveQ(null);
    setShowHint(false);
    setAnsweredCount((n) => Math.min(totalQuestions, n + 1));
  };

  const continueAfterAnswer = () => {
    setActiveQ(null);
    setShowHint(false);
  };

  // decide whether to pop a question based on a state transition
  const maybeActivateQuestion = (prevState, nextState) => {
    if (!teachingEnabled) return;
    if (activeQ) return;

    // Q3: final combine on root (end-of-run checkpoint)
    if (
      nextState?.lastAction?.type === "COMBINE" &&
      nextState?.lastAction?.nodeId === nextState?.rootId &&
      !askedIds.has(MS_QUESTIONS.doneYet.id)
    ) {
      showQuestion(MS_QUESTIONS.doneYet);
      return;
    }

    // Q2: "largest element guaranteed?" after the FIRST split happens.
    // detect the moment active node becomes split, triggered by a DIVIDE action.
    if (nextState?.lastAction?.type === "DIVIDE" && !askedIds.has(MS_QUESTIONS.largestValue.id)) {
      const nid = nextState?.lastAction?.nodeId;
      const node = nid != null ? nextState?.nodes?.[nid] : null;
      // status === "split" indicates division finished for that node
      if (node?.status === "split") {
        showQuestion(MS_QUESTIONS.largestValue);
        return;
      }
    }
  };

  /* reset and start */

  function resetTo(newArr = arr) {
    setArr(newArr);
    setState(makeInitialState(newArr));
    setInput(newArr.join(", "));
    setInputError("");

    // teaching reset
    setAskedIds(new Set());
    setActiveQ(null);
    setShowHint(false);
    setCorrectCount(0);
    setAnsweredCount(0);

    // Q1: midpoint question right after starting a new run
    if (teachingEnabled) {
      showQuestion(MS_QUESTIONS.midpoint);
    }
  }

  function applyInput() {
    const res = parseArray(input);
    if (!res.ok) {
      setInputError(res.error);
      return;
    }
    setInputError("");
    setArr(res.nums);
    resetTo(res.nums);
  }

  /* step handlers */

  function allDividesDone(nodes) {
    // divide phase is "done" when every non-leaf node has been split (has children)
    return Object.values(nodes).every((n) => {
      if (!n) return true;
      if (n.l === n.r) return true; // leaf
      return n.leftId != null && n.rightId != null; // split created
    });
  }

  function rootBecomesSolved(prevState, nextState) {
    const prevRoot = prevState.nodes[prevState.rootId];
    const nextRoot = nextState.nodes[nextState.rootId];
    return prevRoot?.status !== "solved" && nextRoot?.status === "solved";
  }




  function onDivide() {
    if (teachingBlocked) return;
    setState(stepDivide(state));
  }

  function onConquer() {
    if (teachingBlocked) return;

    const next = stepConquer(state);

    if (
      teachingEnabled &&
      !activeQ &&
      !askedIds.has(MS_QUESTIONS.doneYet.id) &&
      rootBecomesSolved(state, next)
    ) {
      showQuestion(MS_QUESTIONS.doneYet);
      return; 
    }

    // q2 check here
    if (
      teachingEnabled &&
      !activeQ &&
      !askedIds.has(MS_QUESTIONS.largestValue.id) &&
      allDividesDone(state.nodes)
    ) {
      showQuestion(MS_QUESTIONS.largestValue);
      return;
    }

    setState(next);
  }



  function onCombine() {
    if (teachingBlocked) return;

    // Look-ahead: would this combine finish the algorithm?
    const next = stepCombine(state);

    if (
      teachingEnabled &&
      !activeQ &&
      !askedIds.has(MS_QUESTIONS.doneYet.id) &&
      rootBecomesSolved(state, next)
    ) {
      showQuestion(MS_QUESTIONS.doneYet);
      return; // do NOT apply the combine yet
    }

    setState(next);
  }



  const active = state.nodes[state.activeId];
  const root = state.nodes[state.rootId];
  const done = root?.status === "solved";

  // For combine highlighting
  const last = state.lastAction;
  const cross = last?.type === "COMBINE" ? last.details : null;

  return (
    <div className="w-full flex flex-col gap-4 text-gray-900">
      <div className="text-2xl font-bold">Maximum Subarray</div>

      <div className="grid grid-cols-12 gap-4">
        {/* Main content */}
        <div className="col-span-12">
          {/* Input row */}
            <div className="mb-3">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className="flex-1 border rounded px-3 py-2 bg-grey-900 text-white"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyInput();
                  }}
                  placeholder="e.g. 2, -5, 3, 1, -2, 4, -3, -1"
                />

                <button
                  className="px-3 py-2 rounded border text-white bg-blue-600"
                  onClick={applyInput}
                >
                  Start
                </button>

                <button
                  className="px-3 py-2 rounded border hover:bg-gray-50"
                  onClick={() => {
                    const newArr = Array.from({ length: 8 }, () =>
                      Math.floor(Math.random() * 11) - 5
                    );
                    setArr(newArr);
                    setInput(newArr.join(", "));
                    setInputError("");
                    resetTo(newArr);
                  }}
                >
                  Randomise
                </button>

                {/* Quiz mode toggle (switch) - INLINE with the row */}
                <div className="flex items-center gap-3 ml-auto">
                  {/* Left side: score area (fixed width so layout doesn’t jump) */}
                  <div className="w-40 flex justify-end">
                    {teachingEnabled && (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          {Array.from({ length: totalQuestions }).map((_, i) => {
                            let color = "bg-gray-300";
                            if (i < answeredCount) {
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
                        startNewQuizRun?.();
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

              {inputError && <div className="text-sm text-red-600 mt-1">{inputError}</div>}

              <div className="text-xs text-gray-500 mt-1">Tip: Negative numbers allowed.</div>
            </div>

            

          {/* Array tiles */}
          <div className="flex gap-2 flex-wrap">
            {state.arr.map((v, i) => {
              const inActive = active
                ? rangeContains(i, [active.l, active.r])
                : false;

              const inCrossLeft =
                cross?.chosen === "CROSS" &&
                rangeContains(i, cross.crossLeftRange);
              const inCrossRight =
                cross?.chosen === "CROSS" &&
                rangeContains(i, cross.crossRightRange);

              const inBest =
                done && root.summary
                  ? rangeContains(i, root.summary.bestRange)
                  : false;

              return (
                <div
                  key={i}
                  className={[
                    "w-12 h-12 rounded-xl border flex items-center justify-center text-sm select-none",
                    inActive ? "ring-2 ring-black" : "",
                    inCrossLeft ? "bg-gray-500" : "",
                    inCrossRight ? "bg-gray-500" : "",
                    inBest
                      ? "font-bold bg-yellow-200 border-yellow-400"
                      : "",
                  ].join(" ")}
                >
                  {v}
                </div>
              );
            })}
          </div>

          {/* Controls */}
          <div className="mt-4">
            <MaxSubarrayStepper
              state={state}
              onDivide={onDivide}
              onConquer={onConquer}
              onCombine={onCombine}
            />
          </div>

          {teachingEnabled && activeQ && (
            <div className="mt-4 p-4 rounded-2xl border bg-white">
              <div className="text-sm font-semibold text-gray-900">{activeQ.prompt}</div>

              <div className="mt-3 space-y-2">
                {activeQ.options.map((opt, idx) => {
                  const showResult = activeQ.status !== "unanswered";
                  const isCorrectOption = showResult && idx === activeQ.correctIndex;
                  const isWrongChosen =
                    showResult && activeQ.status === "incorrect" && activeQ.chosenIndex === idx;

                  return (
                    <button
                      key={`${activeQ.id}_${idx}`}
                      disabled={activeQ.status !== "unanswered"}
                      onClick={() => answerQuestion(idx)}
                      className={[
                        "w-full text-left text-sm text-gray-900 bg-white border rounded-lg px-3 py-2 transition",
                        activeQ.status === "unanswered" ? "hover:bg-gray-50" : "",
                        isCorrectOption ? "border-green-500 bg-green-50" : "",
                        isWrongChosen ? "border-red-500 bg-red-50" : "",
                        !isCorrectOption && !isWrongChosen ? "border-gray-200" : "",
                        showResult && !isCorrectOption && !isWrongChosen ? "opacity-80" : "",
                      ].join(" ")}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 flex items-center gap-2">
                {activeQ.status === "unanswered" ? (
                  <>
                    <button
                      className="text-xs px-3 py-1 border rounded-lg hover:bg-gray-50"
                      onClick={() => setShowHint((v) => !v)}
                    >
                      {showHint ? "Hide hint" : "Show hint"}
                    </button>

                    <button
                      className="text-xs px-3 py-1 border rounded-lg hover:bg-gray-50"
                      onClick={skipQuestion}
                    >
                      Skip
                    </button>

                    <div className="ml-auto text-xs text-gray-500">Answer to continue</div>
                  </>
                ) : (
                  <>
                    <div className="text-xs text-gray-700">
                      {activeQ.status === "correct" ? "Correct!" : "Not quite."} {activeQ.why}
                    </div>
                    <button
                      className="ml-auto text-xs px-3 py-1 border rounded-lg hover:bg-gray-50"
                      onClick={continueAfterAnswer}
                    >
                      Continue
                    </button>
                  </>
                )}
              </div>

              {activeQ.status === "unanswered" && showHint && (
                <div className="mt-2 text-xs text-gray-600 border-t pt-2">{activeQ.hint}</div>
              )}
            </div>
          )}

          {teachingEnabled && teachingBlocked && (
            <div className="mt-2 text-xs text-gray-500">
              Teaching mode: answer/skip to continue
            </div>
          )}

          {/* Summary cards */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 bg-whtie">
            <SummaryCard
              title={`Active node #${active?.id ?? "-"}`}
              s={active?.summary}
            />
            <SummaryCard
              title={`Root node #${root?.id ?? "-"}`}
              s={root?.summary}
            />
            <div className="p-3 rounded-xl border text-sm bg-whtie">
              <div className="font-semibold mb-2">Active segment</div>
              {active ? (
                <>
                  <div>
                    [{active.l}..{active.r}]
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    status: {active.status}
                  </div>
                </>
              ) : (
                <div>-</div>
              )}
            </div>
          </div>

          {/* Answer */}
          {done && root.summary && (
            <div className="mt-4 p-3 rounded-xl border">
              <div className="font-semibold">Answer</div>
              <div className="text-sm text-gray-700 mt-1">
                Maximum subarray sum ={" "}
                <span className="font-semibold">
                  {root.summary.best}
                </span>{" "}
                on indices [{root.summary.bestRange[0]},{" "}
                {root.summary.bestRange[1]}]
              </div>
            </div>
          )}

          {/* Final combine explanation (only if crossing) */}
          {!teachingEnabled &&
            state.lastAction?.type === "COMBINE" &&
            state.lastAction.nodeId === state.rootId &&
            state.lastAction.details?.chosen === "CROSS" && (
              <div className="mt-4 p-4 rounded-2xl border shadow-sm bg-white">
                <div className="font-semibold">
                  Final Combine: why we cross the midpoint
                </div>
                <div className="mt-2 text-sm text-gray-500 space-y-2">
                  <p>
                    The best subarray crosses the midpoint, so we take the
                    best suffix of the left half and the best prefix of the
                    right half:
                    <span className="font-medium">
                      {" "}
                      left.suff + right.pref
                    </span>
                    .
                  </p>
                  <p>
                    Crossing sum ={" "}
                    <span className="font-semibold">
                      {state.lastAction.details.crossVal}
                    </span>
                  </p>
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
