"use client";

import { useState, useEffect } from "react";
import { FileText, Loader2, AlertTriangle, User, Copy, Check } from "lucide-react";
import { loadResumeSchemaAction } from "../actions";

export default function ProfileViewer() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const result = await loadResumeSchemaAction();
      if (result.success) {
        setData(result);
      }
      setIsLoading(false);
    })();
  }, []);

  async function handleCopyPath() {
    if (!data?.path) return;
    try {
      await navigator.clipboard.writeText(data.path);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — silently ignore
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 size={32} className="text-purple-500 animate-spin" />
        <span className="text-sm text-zinc-400">Loading resume schema...</span>
      </div>
    );
  }

  if (!data?.content) {
    return (
      <div className="flex flex-col items-center justify-center border border-dashed border-white/10 rounded-3xl py-20 text-center px-6">
        <div className="h-14 w-14 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4">
          <AlertTriangle size={24} className="text-rose-400" />
        </div>
        <h3 className="text-base font-bold text-white mb-1.5">No Schema Found</h3>
        <p className="text-xs text-zinc-500 max-w-md mx-auto leading-relaxed">
          Expected a <code className="text-zinc-300 bg-white/5 px-1.5 py-0.5 rounded">schema.yaml</code> file at
          {" "}
          <code className="text-zinc-300 bg-white/5 px-1.5 py-0.5 rounded break-all">{data?.path}</code>.
          This is the canonical profile Gemini uses to tailor questions.
        </p>
      </div>
    );
  }

  const lineCount = data.content.split("\n").length;
  const charCount = data.content.length;

  return (
    <div className="space-y-6">

      {/* Section Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <User size={18} className="text-purple-400" />
            Resume Profile Schema
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Read-only view of the YAML profile Gemini uses to tailor questions. Edit the file on disk to update it.
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-500">
          <span>Lines: <strong className="text-zinc-300">{lineCount}</strong></span>
          <span>Chars: <strong className="text-zinc-300">{charCount.toLocaleString()}</strong></span>
        </div>
      </div>

      {/* Schema viewer */}
      <div className="rounded-2xl border border-white/5 bg-zinc-950/60 overflow-hidden">
        <div className="px-4 py-2.5 bg-white/5 border-b border-white/5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={12} className="text-purple-400 shrink-0" />
            <code className="text-[11px] font-mono text-zinc-400 truncate">{data.path}</code>
          </div>
          <button
            onClick={handleCopyPath}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            title="Copy path"
          >
            {copied ? (
              <>
                <Check size={11} className="text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy size={11} />
                <span>Copy path</span>
              </>
            )}
          </button>
        </div>
        <pre className="p-5 text-xs leading-relaxed text-zinc-300 font-mono overflow-auto max-h-[70vh]">
{data.content}
        </pre>
      </div>

    </div>
  );
}
