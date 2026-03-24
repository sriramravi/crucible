"use client";
import { useState } from "react";
import clsx from "clsx";
import { CheckCircle2 } from "lucide-react";

const AWS_SERVICES = ["S3", "EC2", "Lambda", "RDS", "IAM", "EKS", "CloudFront"];
const AZURE_SERVICES = ["Blob Storage", "Virtual Machines", "Azure Functions", "Azure SQL", "Azure AD / Entra ID", "AKS", "Azure Front Door"];

const CORRECT_MAPPING: Record<string, string> = {
  "S3": "Blob Storage",
  "EC2": "Virtual Machines",
  "Lambda": "Azure Functions",
  "RDS": "Azure SQL",
  "IAM": "Azure AD / Entra ID",
  "EKS": "AKS",
  "CloudFront": "Azure Front Door",
};

export default function DragDropView({ onComplete }: { onComplete: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const handleAwsClick = (svc: string) => {
    if (submitted || matches[svc]) return;
    setSelected(svc);
  };

  const handleAzureClick = (azure: string) => {
    if (!selected || submitted) return;
    const alreadyMatched = Object.values(matches).includes(azure);
    if (alreadyMatched) return;
    setMatches((m) => ({ ...m, [selected]: azure }));
    setSelected(null);
  };

  const handleSubmit = () => {
    setSubmitted(true);
    const allCorrect = Object.entries(matches).every(([aws, az]) => CORRECT_MAPPING[aws] === az);
    if (allCorrect) onComplete();
  };

  const score = Object.entries(matches).filter(([aws, az]) => CORRECT_MAPPING[aws] === az).length;

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-lg font-semibold text-white mb-1">AWS ↔ Azure Service Mapping</h2>
        <p className="text-sm text-slate-400">
          Click an AWS service, then click its Azure equivalent to create a match.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* AWS column */}
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase mb-3">AWS Services</h3>
          <div className="space-y-2">
            {AWS_SERVICES.map((svc) => {
              const matched = matches[svc];
              const isCorrect = submitted && matched === CORRECT_MAPPING[svc];
              const isWrong = submitted && matched && matched !== CORRECT_MAPPING[svc];
              return (
                <button
                  key={svc}
                  onClick={() => handleAwsClick(svc)}
                  disabled={!!matched || submitted}
                  className={clsx(
                    "w-full text-left px-3 py-2.5 rounded-lg border text-sm font-medium transition-all",
                    selected === svc ? "border-brand-500 bg-brand-900/40 text-brand-300" :
                    isCorrect ? "border-green-700 bg-green-900/20 text-green-300" :
                    isWrong ? "border-red-700 bg-red-900/20 text-red-300" :
                    matched ? "border-surface-700 bg-surface-800 text-slate-400" :
                    "border-surface-700 text-slate-300 hover:border-brand-600 cursor-pointer"
                  )}
                >
                  <div className="flex justify-between items-center">
                    <span>{svc}</span>
                    {matched && <span className="text-xs text-slate-500">{matched}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Azure column */}
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase mb-3">Azure Services</h3>
          <div className="space-y-2">
            {AZURE_SERVICES.map((svc) => {
              const alreadyUsed = Object.values(matches).includes(svc);
              return (
                <button
                  key={svc}
                  onClick={() => handleAzureClick(svc)}
                  disabled={alreadyUsed || !selected || submitted}
                  className={clsx(
                    "w-full text-left px-3 py-2.5 rounded-lg border text-sm font-medium transition-all",
                    alreadyUsed
                      ? "border-surface-700 bg-surface-800 text-slate-500 opacity-50"
                      : selected
                      ? "border-brand-600 text-slate-200 hover:bg-brand-900/30 cursor-pointer"
                      : "border-surface-700 text-slate-400"
                  )}
                >
                  {svc}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {selected && (
        <div className="text-sm text-brand-400 text-center">
          Now click the Azure equivalent of <strong>{selected}</strong>
        </div>
      )}

      {Object.keys(matches).length > 0 && !submitted && (
        <button
          onClick={handleSubmit}
          disabled={Object.keys(matches).length < AWS_SERVICES.length}
          className="btn-primary"
        >
          Submit Matches ({Object.keys(matches).length}/{AWS_SERVICES.length} matched)
        </button>
      )}

      {submitted && (
        <div className={clsx("card border text-center", score === AWS_SERVICES.length ? "border-green-700" : "border-yellow-700")}>
          <div className="mb-2">
            {score === AWS_SERVICES.length
              ? <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto" />
              : null}
          </div>
          <p className="font-bold text-white text-xl">{score}/{AWS_SERVICES.length} correct</p>
          {score < AWS_SERVICES.length && (
            <button className="btn-secondary mt-3 text-sm" onClick={() => { setMatches({}); setSubmitted(false); }}>
              Try Again
            </button>
          )}
        </div>
      )}
    </div>
  );
}
