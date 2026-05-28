"use client";

import { useState } from "react";
import { X, Plus, Sparkles, Loader2, Tag, BookOpen, AlertCircle } from "lucide-react";
import { createCustomQuestionAction } from "../actions";

/**
 * Modal for creating custom interview questions.
 * 
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - onCreated: (question) => void
 */
export default function AddQuestionModal({ isOpen, onClose, onCreated }) {
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [category, setCategory] = useState("conceptual-engineering");
  const [difficulty, setDifficulty] = useState("medium");
  const [tags, setTags] = useState("");
  const [resumeContext, setResumeContext] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  function resetForm() {
    setTitle("");
    setQuestion("");
    setCategory("conceptual-engineering");
    setDifficulty("medium");
    setTags("");
    setResumeContext("");
    setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim() || !question.trim()) {
      setError("Title and question text are required.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    const subCategories = tags
      .split(",")
      .map(t => t.trim().toLowerCase())
      .filter(Boolean);

    const result = await createCustomQuestionAction({
      title: title.trim(),
      question: question.trim(),
      category,
      subCategories,
      difficulty,
      resumeContext: resumeContext.trim(),
    });

    setIsSubmitting(false);

    if (result.success) {
      if (onCreated) onCreated(result.question);
      resetForm();
      onClose();
    } else {
      setError(result.error || "Failed to create question.");
    }
  }

  const categories = [
    { value: "system-design", label: "System Design", color: "text-blue-400" },
    { value: "conceptual-engineering", label: "Conceptual Engineering", color: "text-purple-400" },
    { value: "systems-internals", label: "Systems & Internals", color: "text-rose-400" },
    { value: "behavioral", label: "Behavioral", color: "text-amber-400" },
  ];

  const difficulties = [
    { value: "easy", label: "Easy", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
    { value: "medium", label: "Medium", color: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
    { value: "hard", label: "Hard", color: "bg-rose-500/15 text-rose-400 border-rose-500/30" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto glass rounded-3xl border border-white/10 shadow-2xl shadow-purple-950/30">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <Plus size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Custom Question</h2>
              <p className="text-[10px] text-zinc-500">Add your own interview question to the bank</p>
            </div>
          </div>
          <button
            onClick={() => { resetForm(); onClose(); }}
            className="p-2 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
              <BookOpen size={12} className="text-purple-400" />
              Question Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Designing a Rate Limiter for Distributed APIs"
              required
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
            />
          </div>

          {/* Full Question */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400">Full Question Text</label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Write the complete interview question here. Be specific — reference technologies, constraints, or scenarios..."
              required
              rows={4}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all resize-none leading-relaxed"
            />
          </div>

          {/* Category & Difficulty Row */}
          <div className="grid grid-cols-2 gap-4">
            
            {/* Category */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400">Category</label>
              <div className="flex flex-col gap-1.5">
                {categories.map(cat => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategory(cat.value)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all text-left cursor-pointer ${
                      category === cat.value
                        ? "bg-purple-500/15 border border-purple-500/30 text-purple-300"
                        : "bg-white/5 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400">Difficulty</label>
              <div className="flex flex-col gap-1.5">
                {difficulties.map(diff => (
                  <button
                    key={diff.value}
                    type="button"
                    onClick={() => setDifficulty(diff.value)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all text-left cursor-pointer ${
                      difficulty === diff.value
                        ? diff.color + " border"
                        : "bg-white/5 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {diff.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
              <Tag size={12} className="text-purple-400" />
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g., rate-limiting, distributed-systems, redis, api-design"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all font-mono text-xs"
            />
          </div>

          {/* Resume Context (optional) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
              <Sparkles size={12} className="text-purple-400" />
              Resume Context (optional)
            </label>
            <textarea
              value={resumeContext}
              onChange={(e) => setResumeContext(e.target.value)}
              placeholder="Optionally tie this question to a specific project or experience..."
              rows={2}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting || !title.trim() || !question.trim()}
            className="w-full glow-btn cursor-pointer py-3.5 px-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-600 text-white font-bold rounded-xl shadow-lg shadow-purple-600/10 flex items-center justify-center gap-2 text-sm transition-all duration-300"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus size={16} />
                Add Question to Bank
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
