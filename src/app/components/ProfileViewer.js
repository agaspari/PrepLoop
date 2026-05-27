"use client";

import { useState, useEffect } from "react";
import { FileText, Loader2, AlertTriangle, User, Upload, Sparkles, Check } from "lucide-react";
import { loadResumeSchemaAction, ingestResumeSchemaAction } from "../actions";
import IngestionProgress from "./IngestionProgress";

export default function ProfileViewer() {
  const [content, setContent] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestionResult, setIngestionResult] = useState(null);
  const [generationStatus, setGenerationStatus] = useState("none");

  useEffect(() => {
    loadSchema();
  }, []);

  async function loadSchema() {
    setIsLoading(true);
    const result = await loadResumeSchemaAction();
    setIsLoading(false);
    if (result.success) {
      setContent(result.content);
      setGenerationStatus(result.generationStatus);
    }
  }

  function handleEdit() {
    setEditContent(content || "");
    setIsEditing(true);
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!editContent.trim() || isIngesting) return;

    setIsIngesting(true);
    setIngestionResult(null);
    setIsEditing(false);
    setGenerationStatus("generating");

    const result = await ingestResumeSchemaAction(editContent.trim());
    
    setIsIngesting(false);
    setContent(editContent.trim());
    
    if (result.success) {
      setGenerationStatus("complete");
      setIngestionResult({
        status: "complete",
        message: result.message,
        count: result.count,
      });
    } else {
      setGenerationStatus("error");
      setIngestionResult({
        status: "error",
        message: result.error || "Failed to generate questions.",
      });
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

  const lineCount = content ? content.split("\n").length : 0;
  const charCount = content ? content.length : 0;

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
            Your YAML resume schema. Upload or update to auto-generate ~150 tailored interview questions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {content && (
            <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-500">
              <span>Lines: <strong className="text-zinc-300">{lineCount}</strong></span>
              <span>Chars: <strong className="text-zinc-300">{charCount.toLocaleString()}</strong></span>
            </div>
          )}
          <button
            onClick={handleEdit}
            disabled={isIngesting}
            className="glow-btn cursor-pointer flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-800 text-white font-semibold rounded-xl text-xs shadow-lg shadow-purple-600/10 transition-colors"
          >
            <Upload size={12} />
            {content ? "Update Schema" : "Upload Schema"}
          </button>
        </div>
      </div>

      {/* Ingestion Progress */}
      {(isIngesting || ingestionResult) && (
        <IngestionProgress
          status={ingestionResult?.status || (isIngesting ? "generating" : "idle")}
          message={ingestionResult?.message || "Parsing resume and generating interview questions..."}
          count={ingestionResult?.count || 0}
          total={150}
        />
      )}

      {/* Schema Viewer or Empty State */}
      {content ? (
        <div className="rounded-2xl border border-white/5 bg-zinc-950/60 overflow-hidden">
          <div className="px-4 py-2.5 bg-white/5 border-b border-white/5 flex items-center gap-2">
            <FileText size={12} className="text-purple-400 shrink-0" />
            <code className="text-[11px] font-mono text-zinc-400">schema.yaml</code>
            {generationStatus === "complete" && (
              <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1 ml-auto">
                <Check size={9} />
                Questions Generated
              </span>
            )}
          </div>
          <pre className="p-5 text-xs leading-relaxed text-zinc-300 font-mono overflow-auto max-h-[70vh]">
{content}
          </pre>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center border border-dashed border-white/10 rounded-3xl py-20 text-center px-6">
          <div className="h-14 w-14 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4">
            <Sparkles size={24} className="text-purple-400" />
          </div>
          <h3 className="text-base font-bold text-white mb-1.5">No Resume Schema Uploaded</h3>
          <p className="text-xs text-zinc-500 max-w-md mx-auto leading-relaxed mb-5">
            Upload your YAML resume schema to automatically generate ~150 personalized interview questions based on your experience, skills, and projects.
          </p>
          <button
            onClick={handleEdit}
            className="glow-btn cursor-pointer py-2.5 px-5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-purple-600/10 transition-colors"
          >
            <Upload size={12} />
            Upload Resume Schema
          </button>
        </div>
      )}

      {/* Editor Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setIsEditing(false)}
          />
          
          <div className="relative z-10 w-full max-w-3xl glass rounded-2xl border border-white/10 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            
            <div className="p-5 border-b border-white/10 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-purple-400" />
                <h3 className="text-base font-bold text-white tracking-tight">
                  {content ? "Update Resume Schema" : "Upload Resume Schema"}
                </h3>
              </div>
              <button 
                onClick={() => setIsEditing(false)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-full hover:bg-white/5 transition-colors cursor-pointer"
              >
                <span className="sr-only">Close</span>×
              </button>
            </div>

            <form onSubmit={handleUpload} className="flex-1 flex flex-col min-h-0">
              <div className="p-5 flex-1 flex flex-col min-h-0">
                <div className="mb-3 p-3 rounded-xl bg-purple-950/20 border border-purple-500/20 text-xs text-purple-300 flex items-start gap-2">
                  <Sparkles size={12} className="shrink-0 mt-0.5" />
                  <span>
                    Paste your full <code className="bg-purple-500/15 px-1 rounded">schema.yaml</code> content. 
                    On upload, Gemini will deep-parse every fact, skill, and project to generate ~150 tailored interview questions.
                  </span>
                </div>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="Paste your YAML resume schema here..."
                  required
                  className="flex-1 w-full p-4 bg-white/5 border border-white/10 rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all text-xs font-mono resize-none leading-relaxed min-h-[300px]"
                />
              </div>

              <div className="p-5 border-t border-white/10 bg-zinc-950/20 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 border border-white/10 rounded-xl text-xs text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!editContent.trim()}
                  className="glow-btn cursor-pointer flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-600 text-white font-semibold rounded-xl text-xs shadow-lg shadow-purple-600/10 transition-all"
                >
                  <Upload size={12} />
                  Upload & Generate Questions
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
