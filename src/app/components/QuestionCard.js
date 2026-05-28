"use client";

import { Calendar, Layers, Trash2, FileText, Target, Sparkles, BookOpen, Archive } from "lucide-react";

const sourceConfig = {
  "resume-ingestion": { label: "Resume", icon: FileText, color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  "target-ingestion": { label: "Target", icon: Target, color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  "topic-generated": { label: "Topic", icon: Sparkles, color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" },
  "custom": { label: "Custom", icon: BookOpen, color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
};

export default function QuestionCard({ question, onClick, onDelete, onArchive }) {
  const {
    title,
    category,
    subCategories,
    difficulty,
    srDue,
    srInterval,
    srReps,
    isDue,
    hasAnswer,
    source,
    sourceTopic,
  } = question;

  const categoryLabels = {
    "system-design": { label: "System Design", style: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20" },
    "conceptual-engineering": { label: "Conceptual", style: "bg-indigo-500/10 text-indigo-300 border-indigo-500/20" },
    "behavioral": { label: "Behavioral", style: "bg-amber-500/10 text-amber-300 border-amber-500/20" },
  };

  const difficultyStyles = {
    easy: "text-emerald-400 bg-emerald-950/40 border-emerald-900/50",
    medium: "text-amber-400 bg-amber-950/40 border-amber-900/50",
    hard: "text-rose-400 bg-rose-950/40 border-rose-900/50",
  };

  const catMeta = categoryLabels[category] || { label: category, style: "bg-zinc-500/10 text-zinc-300 border-zinc-500/20" };
  const srcMeta = sourceConfig[source] || sourceConfig["custom"];
  const SrcIcon = srcMeta.icon;

  function handleDelete(e) {
    e.stopPropagation();
    if (onDelete) onDelete(question.id);
  }

  function handleArchive(e) {
    e.stopPropagation();
    if (onArchive) onArchive(question.id);
  }

  return (
    <div 
      onClick={() => onClick(question)}
      className="group relative cursor-pointer glass-card rounded-xl p-5 border border-white/5 flex flex-col justify-between h-[200px] overflow-hidden"
    >
      {/* Glow highlight */}
      <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-blue-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      {/* Row 1: Badges */}
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {isDue ? (
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-purple-500"></span>
            </span>
          ) : null}
          
          <span className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border ${catMeta.style}`}>
            {catMeta.label}
          </span>
          <span className={`text-[9px] uppercase font-semibold px-1.5 py-0.5 rounded border ${difficultyStyles[difficulty] || "text-zinc-400 bg-zinc-950/40 border-zinc-900/50"}`}>
            {difficulty}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Source badge */}
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border flex items-center gap-1 ${srcMeta.color}`}>
            <SrcIcon size={9} />
            {srcMeta.label}{sourceTopic ? `: ${sourceTopic}` : ""}
          </span>
          
          {/* Answered indicator */}
          {hasAnswer ? (
            <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
              <span className="h-1 w-1 rounded-full bg-emerald-400" /> Done
            </span>
          ) : null}
        </div>
      </div>

      {/* Row 2: Title */}
      <div className="my-3 flex-1 flex items-start">
        <h3 className="text-sm font-semibold text-white leading-snug tracking-tight group-hover:text-purple-300 transition-colors line-clamp-2">
          {title}
        </h3>
      </div>

      {/* Row 3: Tags & SRS Stats */}
      <div className="border-t border-white/5 pt-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1 overflow-hidden max-w-[55%]">
          {subCategories.slice(0, 3).map((tag, idx) => (
            <span 
              key={idx} 
              className="text-[9px] font-mono text-zinc-400 bg-white/5 px-1.5 py-0.5 rounded shrink-0 border border-white/5"
            >
              #{tag}
            </span>
          ))}
          {subCategories.length > 3 && (
            <span className="text-[9px] font-mono text-zinc-500 px-1 py-0.5 shrink-0">
              +{subCategories.length - 3}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-medium">
          <div className="flex items-center gap-1">
            <Layers size={10} className="text-zinc-600" />
            <span>{srReps}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar size={10} className="text-zinc-600" />
            <span>{srInterval}d</span>
          </div>
          {onArchive && (
            <button
              onClick={handleArchive}
              className="p-1 rounded hover:bg-amber-500/20 text-zinc-600 hover:text-amber-400 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
              title="Archive question"
            >
              <Archive size={11} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={handleDelete}
              className="p-1 rounded hover:bg-rose-500/20 text-zinc-600 hover:text-rose-400 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
              title="Delete question"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
