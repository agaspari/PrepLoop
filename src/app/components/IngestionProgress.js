"use client";

import { Loader2, Sparkles, CheckCircle2, AlertCircle, XCircle } from "lucide-react";

/**
 * Animated progress indicator for schema/target ingestion.
 * Shows step-by-step progress with status icons.
 * 
 * Props:
 * - status: "idle" | "generating" | "complete" | "error"
 * - message: string - current progress message
 * - count: number - questions generated so far (optional)
 * - total: number - estimated total (optional)
 */
export default function IngestionProgress({ status, message, count, total }) {
  if (status === "idle" || !status) return null;

  const isGenerating = status === "generating";
  const isComplete = status === "complete";
  const isError = status === "error";

  const progressPercent = total && total > 0 ? Math.min(100, Math.round((count / total) * 100)) : 0;

  return (
    <div className={`p-5 rounded-2xl border transition-all duration-500 ${
      isGenerating
        ? "bg-purple-950/30 border-purple-500/30 shadow-lg shadow-purple-950/20"
        : isComplete
          ? "bg-emerald-950/30 border-emerald-500/30"
          : isError
            ? "bg-rose-950/30 border-rose-500/30"
            : "bg-zinc-900/30 border-white/5"
    }`}>
      
      <div className="flex items-center gap-3 mb-3">
        {isGenerating && (
          <>
            <div className="relative flex items-center justify-center">
              <div className="h-8 w-8 rounded-full border-t-2 border-r-2 border-purple-500 animate-spin" />
              <Sparkles size={14} className="absolute text-purple-400" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Generating Questions...</h4>
              <p className="text-xs text-zinc-400">{message || "Analyzing your profile and generating tailored questions"}</p>
            </div>
          </>
        )}
        
        {isComplete && (
          <>
            <div className="h-8 w-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <CheckCircle2 size={16} className="text-emerald-400" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Generation Complete!</h4>
              <p className="text-xs text-zinc-400">{message || `Successfully generated ${count || 0} interview questions`}</p>
            </div>
          </>
        )}

        {isError && (
          <>
            <div className="h-8 w-8 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center">
              <XCircle size={16} className="text-rose-400" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Generation Failed</h4>
              <p className="text-xs text-rose-300">{message || "An error occurred during question generation"}</p>
            </div>
          </>
        )}
      </div>

      {/* Progress bar */}
      {isGenerating && (
        <div className="space-y-2">
          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
            {progressPercent > 0 ? (
              <div 
                className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-r from-purple-500/20 via-purple-500 to-purple-500/20 rounded-full animate-shimmer" />
            )}
          </div>
          {count > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-zinc-500">{count} questions generated</span>
              {total > 0 && (
                <span className="text-[10px] font-mono text-zinc-500">~{total} estimated</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Final count */}
      {isComplete && count > 0 && (
        <div className="flex items-center gap-4 mt-2 pt-2 border-t border-white/5">
          <div className="flex items-center gap-1.5">
            <span className="text-2xl font-black font-mono text-white">{count}</span>
            <span className="text-xs text-zinc-400">questions<br/>generated</span>
          </div>
        </div>
      )}
    </div>
  );
}
