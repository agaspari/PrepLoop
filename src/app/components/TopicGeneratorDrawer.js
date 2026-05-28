"use client";

import { useState, useEffect } from "react";
import { X, Search, Sparkles, Loader2, Check, BookOpen, Target, FileText, ChevronRight } from "lucide-react";
import { generateTopicQuestionsAction, saveTopicQuestionsAction, loadTargetsAction } from "../actions";

/**
 * Drawer/modal for topic-based question generation.
 * User types a topic, optionally selects context sources, and previews generated questions.
 *
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - onSaved: (count) => void
 */
export default function TopicGeneratorDrawer({ isOpen, onClose, onSaved }) {
  const [topic, setTopic] = useState("");
  const [useResume, setUseResume] = useState(true);
  const [selectedTargetId, setSelectedTargetId] = useState("");
  const [targets, setTargets] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewQuestions, setPreviewQuestions] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [error, setError] = useState("");
  const [step, setStep] = useState("input"); // "input" | "preview"

  useEffect(() => {
    if (isOpen) {
      loadTargetsAction().then(result => {
        if (result.success) setTargets(result.targets);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  function reset() {
    setTopic("");
    setUseResume(true);
    setSelectedTargetId("");
    setPreviewQuestions([]);
    setSelectedIds(new Set());
    setError("");
    setStep("input");
  }

  async function handleGenerate(e) {
    e.preventDefault();
    if (!topic.trim()) return;

    setIsGenerating(true);
    setError("");

    const result = await generateTopicQuestionsAction(topic.trim(), {
      useResume,
      targetId: selectedTargetId || null,
    });

    setIsGenerating(false);

    if (result.success && result.questions.length > 0) {
      setPreviewQuestions(result.questions);
      // Select all by default
      setSelectedIds(new Set(result.questions.map(q => q.previewId)));
      setStep("preview");
    } else if (result.success && result.questions.length === 0) {
      setError("No questions were generated. Try a different topic or context.");
    } else {
      setError(result.error || "Failed to generate questions.");
    }
  }

  function toggleQuestion(previewId) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(previewId)) {
        next.delete(previewId);
      } else {
        next.add(previewId);
      }
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(previewQuestions.map(q => q.previewId)));
  }

  function deselectAll() {
    setSelectedIds(new Set());
  }

  async function handleSave() {
    const selectedQuestions = previewQuestions.filter(q => selectedIds.has(q.previewId));
    if (selectedQuestions.length === 0) return;

    setIsSaving(true);
    const result = await saveTopicQuestionsAction(selectedQuestions, topic.trim());
    setIsSaving(false);

    if (result.success) {
      if (onSaved) onSaved(result.count);
      reset();
      onClose();
    } else {
      setError(result.error || "Failed to save questions.");
    }
  }

  const categoryColors = {
    "system-design": "bg-blue-500/15 text-blue-400 border-blue-500/30",
    "conceptual-engineering": "bg-purple-500/15 text-purple-400 border-purple-500/30",
    "behavioral": "bg-amber-500/15 text-amber-400 border-amber-500/30",
    "systems-internals": "bg-rose-500/15 text-rose-400 border-rose-500/30",
  };

  const difficultyColors = {
    "easy": "text-emerald-400",
    "medium": "text-amber-400",
    "hard": "text-rose-400",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-hidden glass rounded-3xl border border-white/10 shadow-2xl shadow-purple-950/30 flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
              <Search size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Topic Generator</h2>
              <p className="text-[10px] text-zinc-500">Generate questions about any technical topic</p>
            </div>
          </div>
          <button
            onClick={() => { reset(); onClose(); }}
            className="p-2 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {step === "input" && (
            <form onSubmit={handleGenerate} className="space-y-5">
              
              {/* Topic Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
                  <Sparkles size={12} className="text-purple-400" />
                  What topic do you want to practice?
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., concurrency, distributed consensus, API rate limiting, caching strategies..."
                  autoFocus
                  required
                  className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                />
              </div>

              {/* Context Sources */}
              <div className="space-y-3">
                <label className="text-xs font-semibold text-zinc-400">Context Sources (optional)</label>
                <p className="text-[10px] text-zinc-500">Selecting context will anchor questions to your real experience and target roles.</p>
                
                {/* Resume toggle */}
                <button
                  type="button"
                  onClick={() => setUseResume(!useResume)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left cursor-pointer ${
                    useResume
                      ? "bg-purple-500/10 border-purple-500/30"
                      : "bg-white/5 border-white/5 hover:bg-white/10"
                  }`}
                >
                  <div className={`h-5 w-5 rounded-md border-2 flex items-center justify-center transition-all ${
                    useResume ? "bg-purple-500 border-purple-500" : "border-zinc-600"
                  }`}>
                    {useResume && <Check size={12} className="text-white" />}
                  </div>
                  <FileText size={14} className={useResume ? "text-purple-400" : "text-zinc-500"} />
                  <div>
                    <span className={`text-xs font-semibold ${useResume ? "text-purple-300" : "text-zinc-400"}`}>
                      My Resume
                    </span>
                    <p className="text-[10px] text-zinc-500">Anchor questions to your real projects and experience</p>
                  </div>
                </button>

                {/* Target selector */}
                {targets.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <Target size={12} className="text-indigo-400" />
                      <span className="font-semibold">Align to a target role</span>
                    </div>
                    <select
                      value={selectedTargetId}
                      onChange={(e) => setSelectedTargetId(e.target.value)}
                      className="w-full px-4 py-2.5 bg-zinc-900 border border-white/10 rounded-xl text-xs text-zinc-300 hover:text-white cursor-pointer focus:outline-none focus:border-purple-500 transition-all"
                    >
                      <option value="" className="bg-zinc-900 text-zinc-300">No target selected</option>
                      {targets.map(t => (
                        <option key={t.id} value={t.id} className="bg-zinc-900 text-zinc-300">
                          {t.company || t.title} — {t.role || ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs">
                  {error}
                </div>
              )}

              {/* Generate Button */}
              <button
                type="submit"
                disabled={isGenerating || !topic.trim()}
                className="w-full glow-btn cursor-pointer py-3.5 px-6 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/10 flex items-center justify-center gap-2 text-sm transition-all duration-300"
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Generating questions about &quot;{topic}&quot;...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Generate Questions
                    <ChevronRight size={14} />
                  </>
                )}
              </button>
            </form>
          )}

          {step === "preview" && (
            <div className="space-y-4">
              
              {/* Preview Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Generated {previewQuestions.length} questions about &quot;{topic}&quot;
                  </h3>
                  <p className="text-[10px] text-zinc-500">Select which questions to add to your bank</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={selectAll}
                    className="px-2.5 py-1 text-[10px] font-semibold text-purple-400 hover:text-purple-300 bg-purple-500/10 rounded-lg transition-colors cursor-pointer"
                  >
                    Select All
                  </button>
                  <button
                    onClick={deselectAll}
                    className="px-2.5 py-1 text-[10px] font-semibold text-zinc-400 hover:text-zinc-300 bg-white/5 rounded-lg transition-colors cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {/* Question Cards */}
              <div className="space-y-2">
                {previewQuestions.map(q => {
                  const isSelected = selectedIds.has(q.previewId);
                  return (
                    <button
                      key={q.previewId}
                      type="button"
                      onClick={() => toggleQuestion(q.previewId)}
                      className={`w-full p-4 rounded-xl border transition-all text-left cursor-pointer ${
                        isSelected
                          ? "bg-purple-500/10 border-purple-500/30"
                          : "bg-white/[0.02] border-white/5 hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                          isSelected ? "bg-purple-500 border-purple-500" : "border-zinc-600"
                        }`}>
                          {isSelected && <Check size={12} className="text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-sm font-semibold text-white">{q.title}</span>
                            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${categoryColors[q.category] || "bg-zinc-800 text-zinc-400 border-zinc-700"}`}>
                              {(q.category || "").replace("-", " ")}
                            </span>
                            <span className={`text-[9px] font-bold uppercase ${difficultyColors[q.difficulty] || "text-zinc-400"}`}>
                              {q.difficulty}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">
                            {q.question}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Error */}
              {error && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs">
                  {error}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setStep("input")}
                  className="flex-1 py-3 px-4 border border-white/10 rounded-xl text-sm text-zinc-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
                >
                  ← Back
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || selectedIds.size === 0}
                  className="flex-[2] glow-btn cursor-pointer py-3 px-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-600 text-white font-bold rounded-xl shadow-lg shadow-purple-600/10 flex items-center justify-center gap-2 text-sm transition-all duration-300"
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      Save {selectedIds.size} Question{selectedIds.size !== 1 ? "s" : ""}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
