"use client";

import { Icon } from "./Icon";
import type { JobState } from "@/lib/types";

const STAGES = [
  { key: "fetching", label: "Fetch metadata" },
  { key: "transcribing", label: "Extract transcript" },
  { key: "scoring", label: "Detect viral hooks" },
  { key: "downloading", label: "Download source" },
];

export function ProcessingOverlay({
  job,
  onClose,
  onRetry,
}: {
  job: JobState;
  onClose: () => void;
  onRetry?: () => void;
}) {
  const stageIdx = STAGES.findIndex((s) => s.key === job.stage);
  return (
    <div className="fixed inset-0 z-[60] bg-background/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
      <div className="relative w-20 h-20 mb-4 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full border-4 border-surface-container-high" />
        <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <Icon name="auto_fix_high" fill className="text-primary" size={32} />
      </div>
      <h3 className="font-headline font-bold text-2xl text-on-surface mb-1">
        {job.stage === "error" ? "Generation Failed" : "Scanning Video Hooks…"}
      </h3>
      <p className="font-body text-sm text-on-surface-variant max-w-xs mb-4">
        {job.message}
      </p>
      {job.stage !== "error" && (
        <>
          <div className="w-64 h-2 rounded-full bg-surface-container-highest overflow-hidden mb-3">
            <div
              className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all duration-500"
              style={{ width: `${Math.max(4, job.progress)}%` }}
            />
          </div>
          <div className="flex items-center gap-2 mb-1">
            {STAGES.map((s, i) => (
              <div key={s.key} className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    i < stageIdx
                      ? "bg-secondary"
                      : i === stageIdx
                        ? "bg-primary animate-pulse"
                        : "bg-surface-container-highest"
                  }`}
                />
                {i < STAGES.length - 1 && (
                  <span className="w-4 h-px bg-surface-container-highest" />
                )}
              </div>
            ))}
          </div>
          <span className="text-xs font-semibold text-secondary">
            Step {Math.max(1, stageIdx + 1)} of 4: {STAGES[stageIdx]?.label ?? "Working"} ({job.progress}%)
          </span>
        </>
      )}
      {job.stage === "error" && (
        <div className="max-w-sm px-4 py-3 rounded-xl bg-error-container/30 border border-error/30 text-on-error-container text-sm mb-2">
          {job.error}
        </div>
      )}
      <div className="mt-6 flex items-center gap-2">
        {job.stage === "error" && onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-bold flex items-center gap-1.5 hover:brightness-110 active:scale-[0.98] transition-all"
          >
            <Icon name="refresh" size={14} />
            Retry generation
          </button>
        )}
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg bg-surface-variant text-on-surface text-xs font-semibold hover:bg-surface-bright transition-colors"
        >
          {job.stage === "error" ? "Close" : "Run in background"}
        </button>
      </div>
    </div>
  );
}