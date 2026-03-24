"use client";
import { useState, useEffect } from "react";
import { labsApi } from "@/lib/api";
import clsx from "clsx";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface Question {
  index: number;
  question: string;
  options: string[];
}

interface QuizResult {
  score: number;
  max_score: number;
  passed: boolean;
  correct_answers: Record<number, string>;
}

export default function QuizView({ onComplete }: { onComplete: () => void }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingQ, setLoadingQ] = useState(true);

  useEffect(() => {
    labsApi.quizQuestions()
      .then((r) => setQuestions(r.data))
      .finally(() => setLoadingQ(false));
  }, []);

  const handleSubmit = async () => {
    if (Object.keys(answers).length < questions.length) {
      alert("Please answer all questions before submitting.");
      return;
    }
    setLoading(true);
    try {
      const r = await labsApi.submitQuiz(answers);
      setResult(r.data);
      if (r.data.passed) onComplete();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loadingQ) return <div className="text-slate-400">Loading questions...</div>;

  if (result) {
    return (
      <div className="space-y-4">
        <div className={clsx("card border text-center", result.passed ? "border-green-700" : "border-red-700")}>
          <div className="mb-3">
            {result.passed
              ? <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto" />
              : <XCircle className="w-12 h-12 text-red-400 mx-auto" />}
          </div>
          <h2 className="text-xl font-bold text-white">
            {result.passed ? "Passed!" : "Not Quite"}
          </h2>
          <p className="text-2xl font-bold mt-2 mb-1">
            <span className={result.passed ? "text-green-400" : "text-red-400"}>
              {result.score}
            </span>
            <span className="text-slate-500">/{result.max_score}</span>
          </p>
          <p className="text-slate-400 text-sm">
            {result.passed ? "Module 5 complete! Module 6 is now unlocked." : "Score 6/7 or higher to pass. Try again."}
          </p>
        </div>

        {!result.passed && (
          <div className="space-y-3">
            {questions.map((q) => {
              const userAnswer = answers[q.index];
              const correct = result.correct_answers[q.index];
              const isCorrect = userAnswer === correct;
              return (
                <div key={q.index} className={clsx("card border text-sm", isCorrect ? "border-green-800" : "border-red-800")}>
                  <p className="font-medium text-white mb-2">{q.question}</p>
                  <p className="text-slate-400">Your answer: <span className={isCorrect ? "text-green-400" : "text-red-400"}>{userAnswer}</span></p>
                  {!isCorrect && <p className="text-slate-400">Correct: <span className="text-green-400">{correct}</span></p>}
                </div>
              );
            })}
            <button className="btn-primary" onClick={() => { setResult(null); setAnswers({}); }}>
              Retry Quiz
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-lg font-semibold text-white mb-1">Cloud Knowledge Quiz</h2>
        <p className="text-sm text-slate-400">Answer all 7 questions. Score 6/7 to pass.</p>
      </div>

      {questions.map((q) => (
        <div key={q.index} className="card">
          <p className="font-medium text-white mb-4">
            <span className="text-slate-500 text-sm mr-2">Q{q.index + 1}.</span>
            {q.question}
          </p>
          <div className="space-y-2">
            {q.options.map((opt) => (
              <label
                key={opt}
                className={clsx(
                  "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                  answers[q.index] === opt
                    ? "border-brand-500 bg-brand-900/30 text-white"
                    : "border-surface-700 text-slate-300 hover:border-surface-600"
                )}
              >
                <input
                  type="radio"
                  name={`q-${q.index}`}
                  value={opt}
                  checked={answers[q.index] === opt}
                  onChange={() => setAnswers((a) => ({ ...a, [q.index]: opt }))}
                  className="accent-brand-500"
                />
                {opt}
              </label>
            ))}
          </div>
        </div>
      ))}

      <button
        onClick={handleSubmit}
        disabled={loading || Object.keys(answers).length < questions.length}
        className="btn-primary flex items-center gap-2"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {loading ? "Submitting..." : "Submit Quiz"}
      </button>
    </div>
  );
}
