"use client";
import { use, useEffect, useState } from "react";
import { useProgressStore } from "@/store/progress";
import { MODULES } from "@/lib/moduleContent";
import ReactMarkdown from "react-markdown";
import clsx from "clsx";
import {
  BookOpen, FlaskConical, CheckCircle2, XCircle, Loader2,
  PlayCircle, StopCircle, ChevronDown, ChevronUp, Lightbulb, Lock
} from "lucide-react";
import QuizView from "@/components/modules/QuizView";
import DragDropView from "@/components/modules/DragDropView";

type Tab = "tutorial" | "lab" | "challenges";

export default function ModulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const moduleId = parseInt(id, 10);
  const content = MODULES[moduleId];

  const {
    modules, challenges, activeSessions,
    fetchModules, fetchChallenges, startLab, stopLab, validateChallenge
  } = useProgressStore();

  const [tab, setTab] = useState<Tab>("tutorial");
  const [labLoading, setLabLoading] = useState(false);
  const [validating, setValidating] = useState<Record<number, boolean>>({});
  const [results, setResults] = useState<Record<number, { passed: boolean; message: string }>>({});
  const [expandedHints, setExpandedHints] = useState<Record<number, boolean>>({});

  const progress = modules.find((m) => m.module_id === moduleId);
  const session = activeSessions[moduleId];
  const moduleChallenges = challenges[moduleId] || [];

  useEffect(() => {
    fetchModules();
    fetchChallenges(moduleId);
  }, [moduleId, fetchModules, fetchChallenges]);

  if (!content) return <div className="p-8 text-red-400">Module {moduleId} not found</div>;

  const isLocked = !progress || progress.status === "locked";
  if (isLocked) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-96">
        <Lock className="w-12 h-12 text-slate-600 mb-4" />
        <h2 className="text-xl font-semibold text-slate-400">Module Locked</h2>
        <p className="text-slate-500 mt-2">Complete the previous module to unlock this one.</p>
      </div>
    );
  }

  const handleStartLab = async () => {
    setLabLoading(true);
    try {
      await startLab(moduleId);
      setTab("lab");
    } catch (e) {
      console.error(e);
    } finally {
      setLabLoading(false);
    }
  };

  const handleStopLab = async () => {
    setLabLoading(true);
    try {
      await stopLab(moduleId);
    } finally {
      setLabLoading(false);
    }
  };

  const handleValidate = async (challengeId: number, payload?: Record<string, unknown>) => {
    setValidating((v) => ({ ...v, [challengeId]: true }));
    try {
      const result = await validateChallenge(moduleId, challengeId, payload);
      setResults((r) => ({ ...r, [challengeId]: result }));
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Validation failed";
      setResults((r) => ({ ...r, [challengeId]: { passed: false, message: msg } }));
    } finally {
      setValidating((v) => ({ ...v, [challengeId]: false }));
    }
  };

  const toggleHints = (id: number) =>
    setExpandedHints((h) => ({ ...h, [id]: !h[id] }));

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="text-xs text-slate-500 mb-1">Module {moduleId}</div>
        <h1 className="text-3xl font-bold text-white mb-2">{content.name}</h1>
        <p className="text-slate-400">{content.description}</p>
        <div className="flex items-center gap-2 mt-3">
          <span className={clsx("badge", {
            "badge-available": progress?.status === "available",
            "badge-in_progress": progress?.status === "in_progress",
            "badge-completed": progress?.status === "completed",
          })}>
            {progress?.status?.replace("_", " ")}
          </span>
          <span className="text-xs text-slate-500">Tool: {content.tool}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-surface-800">
        {(["tutorial", "lab", "challenges"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              "px-4 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors",
              tab === t
                ? "border-brand-500 text-brand-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            )}
          >
            {t === "tutorial" && <BookOpen className="inline w-4 h-4 mr-1.5" />}
            {t === "lab" && <FlaskConical className="inline w-4 h-4 mr-1.5" />}
            {t === "challenges" && <CheckCircle2 className="inline w-4 h-4 mr-1.5" />}
            {t}
          </button>
        ))}
      </div>

      {/* Tutorial */}
      {tab === "tutorial" && (
        <div className="card prose prose-invert prose-sm max-w-none">
          {content.videoPlaceholder && (
            <div className="aspect-video bg-surface-800 rounded-lg flex items-center justify-center mb-6 border border-surface-700">
              <div className="text-center text-slate-500">
                <PlayCircle className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <div className="text-sm">Video tutorial placeholder</div>
              </div>
            </div>
          )}
          <ReactMarkdown>{content.tutorial}</ReactMarkdown>
        </div>
      )}

      {/* Lab environment */}
      {tab === "lab" && (
        <div className="space-y-4">
          {content.labType === "quiz" ? (
            <QuizView onComplete={() => { fetchModules(); fetchChallenges(moduleId); }} />
          ) : content.labType === "none" ? (
            <div className="card text-slate-400">No lab environment for this module.</div>
          ) : (
            <>
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-white">Lab Environment</h3>
                  <div className={clsx("flex items-center gap-2 text-sm", session ? "text-green-400" : "text-slate-500")}>
                    <div className={clsx("w-2 h-2 rounded-full", session ? "bg-green-400 animate-pulse" : "bg-slate-600")} />
                    {session ? "Running" : "Stopped"}
                  </div>
                </div>

                {session && (
                  <div className="bg-surface-800 rounded-lg p-4 mb-4 text-sm font-mono space-y-1">
                    {session.container_name && (
                      <div><span className="text-slate-500">Container:</span> <span className="text-slate-200">{session.container_name}</span></div>
                    )}
                    {session.container_port && (
                      <div><span className="text-slate-500">Port:</span> <span className="text-green-300">{session.container_port}</span></div>
                    )}
                  </div>
                )}

                <div className="flex gap-3">
                  {!session ? (
                    <button
                      onClick={handleStartLab}
                      disabled={labLoading}
                      className="btn-primary flex items-center gap-2"
                    >
                      {labLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                      {labLoading ? "Starting..." : "Start Lab"}
                    </button>
                  ) : (
                    <button
                      onClick={handleStopLab}
                      disabled={labLoading}
                      className="btn-danger flex items-center gap-2"
                    >
                      {labLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <StopCircle className="w-4 h-4" />}
                      {labLoading ? "Stopping..." : "Stop Lab"}
                    </button>
                  )}
                </div>
              </div>

              {/* Module-specific lab UI notes */}
              <div className="card text-sm text-slate-400">
                <p>Use the Challenges tab to validate your work once you&apos;ve completed each task in the lab environment.</p>
                {moduleId === 8 && session && (
                  <p className="mt-2">
                    Juice Shop target: <code className="text-brand-400 bg-surface-800 px-1 rounded">http://juice-shop:3000</code>
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Challenges */}
      {tab === "challenges" && content.labType !== "quiz" && (
        <div className="space-y-4">
          {content.challenges.map((challenge) => {
            const attempt = moduleChallenges.find((c) => c.challenge_id === challenge.id);
            const result = results[challenge.id];
            const isPassed = attempt?.status === "passed";
            const isBusy = validating[challenge.id];

            return (
              <div key={challenge.id} className={clsx("card border", isPassed ? "border-green-800" : "border-surface-800")}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Challenge {challenge.id}</div>
                    <h3 className="font-semibold text-white">{challenge.title}</h3>
                  </div>
                  {isPassed && <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />}
                </div>

                <p className="text-sm text-slate-300 mb-4">{challenge.description}</p>

                {/* Hints */}
                {challenge.hints && challenge.hints.length > 0 && (
                  <div className="mb-4">
                    <button
                      onClick={() => toggleHints(challenge.id)}
                      className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      <Lightbulb className="w-3.5 h-3.5" />
                      {expandedHints[challenge.id] ? "Hide hints" : "Show hints"}
                      {expandedHints[challenge.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                    {expandedHints[challenge.id] && (
                      <ul className="mt-2 space-y-1.5 pl-4">
                        {challenge.hints.map((hint, i) => (
                          <li key={i} className="text-xs text-slate-400 flex gap-2">
                            <span className="text-brand-500 flex-shrink-0">→</span>
                            <span>{hint}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Validation result */}
                {result && (
                  <div className={clsx(
                    "rounded-lg p-3 mb-4 text-sm border",
                    result.passed
                      ? "bg-green-900/30 border-green-800 text-green-300"
                      : "bg-red-900/30 border-red-800 text-red-300"
                  )}>
                    <div className="flex items-center gap-2 mb-1">
                      {result.passed
                        ? <CheckCircle2 className="w-4 h-4" />
                        : <XCircle className="w-4 h-4" />}
                      <span className="font-medium">{result.passed ? "Passed!" : "Not yet"}</span>
                    </div>
                    <p>{result.message}</p>
                  </div>
                )}

                {/* Previous attempt info */}
                {attempt && !result && (
                  <div className="text-xs text-slate-500 mb-3">
                    Attempts: {attempt.attempt_count} · Status: {attempt.status}
                  </div>
                )}

                {/* Validation hint */}
                {challenge.validationHint && (
                  <p className="text-xs text-slate-600 mb-4 italic">{challenge.validationHint}</p>
                )}

                {!isPassed && (
                  <button
                    onClick={() => handleValidate(challenge.id)}
                    disabled={isBusy}
                    className="btn-primary flex items-center gap-2 text-sm"
                  >
                    {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    {isBusy ? "Validating..." : "Validate Challenge"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Quiz challenges */}
      {tab === "challenges" && content.labType === "quiz" && (
        <QuizView onComplete={() => { fetchModules(); fetchChallenges(moduleId); }} />
      )}
    </div>
  );
}
