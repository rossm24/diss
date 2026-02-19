import React, { useEffect, useMemo, useRef, useState } from "react";
import QuickhullStepper from "../algorithms/quickhull/Stepper.jsx";
import {
  makeInitialState,
  makeStateFromPoints,
  stepDivide,
  stepConquer,
  stepCombine,
  canDivide,
  canConquer,
  canCombine,
} from "../algorithms/quickhull/logic.js";

/* quiz helpers */

function classifyLastAction(lastAction) {
  // Quickhull lastAction is an object { type: "DIVIDE_BASELINE" | "DIVIDE" | "CONQUER" | ... }
  if (!lastAction || typeof lastAction !== "object") return null;
  if (lastAction.type === "DIVIDE_BASELINE") return "QH_BASELINE_DONE";
  if (lastAction.type === "DIVIDE") return "QH_PIVOT_CHOSEN";
  if (lastAction.type === "CONQUER") return "QH_CONQUER_DONE";
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

const QH_QUESTIONS = [
  {
    id: "qh_q1_extremes_on_hull",
    triggerAction: "QH_BASELINE_DONE",
    prompt: "Why must the leftmost and rightmost points always lie on the convex hull?",
    options: [
      "Because they are furthest apart",
      "Because no other point can lie further left or further right than them",
      "Because they minimise the area of the hull",
    ],
    correctIndex: 1,
    hint: "Think about what ‘extreme’ means in the x-direction.",
    why: "An extreme point in a direction cannot be inside the convex hull; it must appear on the boundary.",
  },
  {
    id: "qh_q2_baseline_splits",
    triggerAction: "QH_BASELINE_DONE",
    prompt: "What does the baseline between the extreme points achieve?",
    options: [
      "It sorts the points by x-coordinate",
      "It splits the problem into two independent subproblems",
      "It finds the centre of the point set",
    ],
    correctIndex: 1,
    hint: "The baseline separates points by which side they lie on.",
    why: "Points on opposite sides of the baseline can be solved as two independent hull chains.",
  },
  {
    id: "qh_q3_farthest_point",
    triggerAction: "QH_PIVOT_CHOSEN",
    prompt: "Why do we always choose the point furthest from the current edge?",
    options: [
      "It guarantees the largest triangle",
      "It must be part of the convex hull",
      "It minimises recursion depth",
    ],
    correctIndex: 1,
    hint: "If a point is the furthest outside an edge, it can’t be inside the final hull.",
    why: "The furthest outside point is an extreme point for that edge direction, so it must be a hull vertex.",
  },
  {
    id: "qh_q4_discard_interior",
    triggerAction: "QH_CONQUER_DONE",
    prompt: "Why can points inside triangle be safely discarded?",
    options: ["They are closer to the centre", "They lie inside the convex hull boundary", "They are duplicates"],
    correctIndex: 1,
    hint: "Interior points can’t lie on the boundary.",
    why: "Interior points cannot become hull vertices because the hull is the outer boundary.",
  },
  {
    id: "qh_q6_empty_outside_set",
    triggerCombineReady: true,
    prompt: "What does it mean when a subproblem has no outside points left?",
    options: ["The edge is part of the convex hull", "The recursion failed", "The point is of no use to us"],
    correctIndex: 0,
    hint: "No outside points means nothing can ‘bulge’ outward past that edge.",
    why: "If no points lie outside an edge, that edge is confirmed as part of the hull boundary.",
  },
];

export default function Quickhull() {
  const [state, setState] = useState(() => makeInitialState({ nPoints: 0 }));
  const [editMode, setEditMode] = useState(false);

  // teaching mode UI state
  const [teachingEnabled, setTeachingEnabled] = useState(false);
  const [runQuestions, setRunQuestions] = useState([]); // exactly 3
  const [askedIds, setAskedIds] = useState(() => new Set());
  const [activeQ, setActiveQ] = useState(null);
  const [showHint, setShowHint] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);

  // refs to avoid async-state timing bugs in the question trigger logic (max 3 per run, no doubles, etc.)
  const askedIdsRef = useRef(new Set());
  const runQuestionsRef = useRef([]);
  const activeQRef = useRef(null);
  const teachingEnabledRef = useRef(false);

  useEffect(() => {
    askedIdsRef.current = askedIds;
  }, [askedIds]);

  useEffect(() => {
    runQuestionsRef.current = runQuestions;
  }, [runQuestions]);

  useEffect(() => {
    activeQRef.current = activeQ;
  }, [activeQ]);

  useEffect(() => {
    teachingEnabledRef.current = teachingEnabled;
  }, [teachingEnabled]);

  const pool = teachingEnabled && runQuestions.length > 0 ? runQuestions : QH_QUESTIONS;
  const totalQuestions = teachingEnabled ? pool.length : QH_QUESTIONS.length;
  const answeredCount = askedIds.size;
  const teachingBlocked = teachingEnabled && !!activeQ;

  const dOk = useMemo(() => canDivide(state), [state]);
  const cOk = useMemo(() => canConquer(state), [state]);
  const bOk = useMemo(() => canCombine(state), [state]);

  const startNewQuizRun = () => {
    const chosen = pickRandomN(QH_QUESTIONS, 3);

    // update state
    setRunQuestions(chosen);
    setAskedIds(new Set());
    setActiveQ(null);
    setShowHint(false);
    setCorrectCount(0);
    setWrongCount(0);

    // update refs immediately (prevents “ghost leftovers”)
    runQuestionsRef.current = chosen;
    askedIdsRef.current = new Set();
    activeQRef.current = null;
  };

  // trigger function MUST use refs so the "max 3" cap is real-time.
  const maybeActivateQuestion = (prevState, nextState) => {
    // if quiz mode off or question already active, do nothing
    if (!teachingEnabledRef.current) return;
    if (activeQRef.current) return;

    // determine question pool
    const poolNow = (runQuestionsRef.current && runQuestionsRef.current.length > 0)
      ? runQuestionsRef.current
      : QH_QUESTIONS;

    // HARD CAP: never exceed 3 for the run
    if (askedIdsRef.current.size >= poolNow.length) return;

    // combine-ready transition (false -> true)
    const prevCombine = canCombine(prevState);
    const nextCombine = canCombine(nextState);
    if (!prevCombine && nextCombine) {
      // look for a question designed to trigger now
      const q = poolNow.find((x) => x.triggerCombineReady && !askedIdsRef.current.has(x.id));
      if (q) {
        const nextAsked = new Set(askedIdsRef.current);
        nextAsked.add(q.id);

        askedIdsRef.current = nextAsked; // immediate
        setAskedIds(nextAsked);
        setActiveQ({ ...q, status: "unanswered", chosenIndex: null });
        setShowHint(false);
      }
      return;
    }

    // convert last action into question trigger type
    const actionType = classifyLastAction(nextState?.lastAction);
    if (!actionType) return;

    // find all questions matching this trigger that haven’t been asked yet, pick one at random if multiple
    const candidates = poolNow.filter(
      (x) => x.triggerAction === actionType && !askedIdsRef.current.has(x.id)
    );
    if (candidates.length === 0) return;

    // ask exactly ONE per event, avoids back to back questions if two have the same trigger
    const q = candidates[Math.floor(Math.random() * candidates.length)];

    const nextAsked = new Set(askedIdsRef.current);
    nextAsked.add(q.id);

    // activate question UI
    askedIdsRef.current = nextAsked; // immediate
    setAskedIds(nextAsked);
    setActiveQ({ ...q, status: "unanswered", chosenIndex: null });
    setShowHint(false);
  };

  const answerQuestion = (idx) => {
    if (!activeQ || activeQ.status !== "unanswered") return;

    const correct = idx === activeQ.correctIndex;
    if (correct) setCorrectCount((c) => c + 1);
    else setWrongCount((w) => w + 1);

    setActiveQ({
      ...activeQ,
      chosenIndex: idx,
      status: correct ? "correct" : "incorrect",
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

  function addPoint({ x, y }) {
    setState((s) => {
      const nextId = s.points.length ? Math.max(...s.points.map((p) => p.id)) + 1 : 0;
      const pts = [...s.points, { id: nextId, x, y }];
      return makeStateFromPoints(pts);
    });

    // adding points resets algorithm -> reset quiz run too
    if (teachingEnabledRef.current) startNewQuizRun();
  }

  // steppers
  const doDivide = () => {
    if (teachingBlocked) return;
    const prev = state;
    const next = stepDivide(prev);
    if (next !== prev) {
      setState(next);
      maybeActivateQuestion(prev, next);
    }
  };

  const doConquer = () => {
    if (teachingBlocked) return;
    const prev = state;
    const next = stepConquer(prev);
    if (next !== prev) {
      setState(next);
      maybeActivateQuestion(prev, next);
    }
  };

  const doCombine = () => {
    if (teachingBlocked) return;
    const prev = state;
    const next = stepCombine(prev);
    if (next !== prev) {
      setState(next);
      maybeActivateQuestion(prev, next);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">Quickhull</h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT: canvas + quiz card + controls */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <QuickhullStepper state={state} editable={editMode} onAddPoint={addPoint} />

          {/* Teaching question card */}
          {teachingEnabled && activeQ && (
            <div className="bg-white border rounded p-4">
              <div className="text-sm font-semibold text-gray-900">{activeQ.prompt}</div>

              <div className="mt-3 space-y-2">
                {activeQ.options.map((opt, idx) => {
                  const isChosen = activeQ.chosenIndex === idx;
                  const showResult = activeQ.status !== "unanswered";
                  const isCorrectOption = showResult && idx === activeQ.correctIndex;
                  const isWrongChosen = showResult && activeQ.status === "incorrect" && isChosen;

                  return (
                    <button
                      key={`${activeQ.id}_${idx}`}
                      disabled={activeQ.status !== "unanswered"}
                      onClick={() => answerQuestion(idx)}
                      className={[
                        "w-full text-left text-sm text-gray-900 border rounded-lg px-3 py-2 transition",
                        activeQ.status === "unanswered" ? "hover:bg-gray-50" : "",
                        isCorrectOption ? "border-green-500 bg-green-50" : "",
                        isWrongChosen ? "border-red-500 bg-red-50" : "",
                        activeQ.status === "unanswered" && isChosen ? "border-blue-400 bg-blue-50" : "",
                        !isCorrectOption && !isWrongChosen && !(activeQ.status === "unanswered" && isChosen)
                          ? "border-gray-200"
                          : "",
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
                      className="text-xs px-3 py-1 border rounded-lg hover:bg-gray-50 text-gray-900"
                      onClick={() => setShowHint((v) => !v)}
                    >
                      Hint?
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
                      {activeQ.status === "correct" ? "Correct!" : "Not quite."} {activeQ.why}
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

              {activeQ.status === "unanswered" && showHint && (
                <div className="mt-2 text-xs text-gray-600 border-t pt-2">{activeQ.hint}</div>
              )}
            </div>
          )}

          {/* Controls row (buttons left, quiz toggle right) */}
          <div className="mt-auto flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <button
                className="px-4 py-2 rounded bg-emerald-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={teachingBlocked || !dOk}
                onClick={doDivide}
              >
                Divide
              </button>

              <button
                className="px-4 py-2 rounded bg-teal-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={teachingBlocked || !cOk}
                onClick={doConquer}
              >
                Conquer
              </button>

              <button
                className="px-4 py-2 rounded bg-purple-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={teachingBlocked || !bOk}
                onClick={doCombine}
              >
                Combine
              </button>

              <button
                className="px-4 py-2 rounded bg-white border text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                disabled={teachingBlocked}
                onClick={() => {
                  setState(makeInitialState({ nPoints: 30 }));
                  if (teachingEnabledRef.current) startNewQuizRun();
                }}
              >
                Randomise
              </button>

              <button
                className="px-4 py-2 rounded bg-white border text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                disabled={teachingBlocked}
                onClick={() => setEditMode((v) => !v)}
              >
                {editMode ? "Stop Placing Points" : "Place Points"}
              </button>

              <button
                className="px-4 py-2 rounded bg-white border text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                disabled={teachingBlocked}
                onClick={() => {
                  setState(makeInitialState({ nPoints: 0 }));
                  if (teachingEnabledRef.current) startNewQuizRun();
                }}
              >
                Clear
              </button>
            </div>

            {/* right side: quiz toggle */}
            <div className="ml-auto flex items-center gap-3 px-3 py-2">
              <div className="w-40 flex justify-end">
                {teachingEnabled && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalQuestions }).map((_, i) => {
                        let color = "bg-gray-300";
                        if (i < answeredCount) {
                          color = i < correctCount ? "bg-emerald-600" : "bg-red-500";
                        }
                        return <span key={i} className={`h-2.5 w-2.5 rounded-full ${color}`} />;
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
                    setRunQuestions([]);
                    setAskedIds(new Set());

                    // sync refs
                    runQuestionsRef.current = [];
                    askedIdsRef.current = new Set();
                    activeQRef.current = null;
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

            {teachingBlocked && (
              <span className="w-full text-xs text-gray-500">
                Teaching mode: answer/skip the question to continue
              </span>
            )}
          </div>
        </div>

        {/* RIGHT: side notes (hidden in quiz mode so it doesn’t give answers away) */}
        {!teachingEnabled && (
          <div className="space-y-4">
            {state.introPhase === "baseline" && (
              <div className="bg-white border rounded-xl p-4">
                <h2 className="text-sm font-semibold text-gray-900">First Divide: Baseline split</h2>
                <p className="mt-2 text-sm text-gray-700">
                  Quickhull begins by selecting the <span className="font-medium">leftmost</span> and{" "}
                  <span className="font-medium">rightmost</span> points. These are guaranteed to be on the{" "}
                  <span className="font-medium">convex hull</span>.
                </p>
                <p className="mt-2 text-sm text-gray-700">
                  The line between is called the baseline and it splits the points into two independent subproblems.
                </p>
              </div>
            )}

            {state.introPhase === "pivot" && (
              <div className="bg-white border rounded-xl p-4">
                <h2 className="text-sm font-semibold text-gray-900">Second Divide: The Furthest Point</h2>
                <p className="mt-2 text-sm text-gray-700">
                  For the active edge, Quickhull finds the <span className="font-medium">furthest</span> point from the line.
                </p>
              </div>
            )}

            {state.introPhase === "running" && (
              <div className="bg-white border rounded-xl p-4">
                <h2 className="text-sm font-semibold text-gray-900">Conquer</h2>
                <p className="mt-2 text-sm text-gray-700">
                  Points inside triangle A–P–B cannot be on the hull, so they are removed.
                </p>
              </div>
            )}

            <div className="text-sm text-gray-700 bg-white border rounded-xl p-3 space-y-1">
              <div>
                <span className="font-semibold">Hull edges:</span> {state.hullEdges.length}
              </div>
              <div>
                <span className="font-semibold">Finished:</span> {state.finished ? "Yes" : "No"}
              </div>
              <div>
                <span className="font-semibold">Edit mode:</span> {editMode ? "On" : "Off"}
              </div>
              <div className="pt-1">
                <span className="font-semibold">Last action:</span>{" "}
                {state.lastAction ? JSON.stringify(state.lastAction) : "None"}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}