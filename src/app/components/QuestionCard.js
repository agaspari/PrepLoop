"use client";

import { Calendar, HelpCircle, BookOpen, Layers } from "lucide-react";

export default function QuestionCard({ question, onClick }) {
  const {
    title,
    category,
    subCategories,
    difficulty,
    srDue,
    srInterval,
    srReps,
    isDue,
    hasAnswer
  } = question;

  // Formatting helpers
  const categoryLabels = {
    "system-design": { label: "System Design", style: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20" },
    "conceptual-engineering": { label: "Conceptual", style: "bg-indigo-500/10 text-indigo-300 border-indigo-500/20" },
    "behavioral": { label: "Behavioral", style: "bg-amber-500/10 text-amber-300 border-amber-500/20" }
  };

  const difficultyStyles = {
    easy: "text-emerald-400 bg-emerald-950/40 border-emerald-900/50",
    medium: "text-amber-400 bg-amber-950/40 border-amber-900/50",
    hard: "text-rose-400 bg-rose-950/40 border-rose-900/50"
  };

  const catMeta = categoryLabels[category] || { label: category, style: "bg-zinc-500/10 text-zinc-300 border-zinc-500/20" };

  return (
    <div 
      onClick={() => onClick(question)}
      className="group relative cursor-pointer glass-card rounded-xl p-5 border border-white/5 flex flex-col justify-between h-[180px] overflow-hidden"
    >
      {/* Glow highlight */}
      <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-blue-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      {/* Row 1: Badges */}
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          {/* Due status */}
          {isDue ? (
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-purple-500"></span>
            </span>
          ) : null}
          
          <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${catMeta.style}`}>
            {catMeta.label}
          </span>
          <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded border ${difficultyStyles[difficulty] || "text-zinc-400 bg-zinc-950/40 border-zinc-900/50"}`}>
            {difficulty}
          </span>
        </div>

        {/* Answered indicator */}
        {hasAnswer ? (
          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
            <span className="h-1 w-1 rounded-full bg-emerald-400" /> Answered
          </span>
        ) : (
          <span className="text-[10px] font-bold text-zinc-400 bg-zinc-500/5 px-2 py-0.5 rounded-full border border-zinc-500/10 flex items-center gap-1">
            <span className="h-1 w-1 rounded-full bg-zinc-500" /> New Question
          </span>
        )}
      </div>

      {/* Row 2: Title */}
      <div className="my-3 flex-1 flex items-start">
        <h3 className="text-sm font-semibold text-white leading-snug tracking-tight group-hover:text-purple-300 transition-colors line-clamp-2">
          {title}
        </h3>
      </div>

      {/* Row 3: Tags & Spaced Repetition Stats */}
      <div className="border-t border-white/5 pt-3 flex items-center justify-between shrink-0">
        {/* Left: Tags */}
        <div className="flex items-center gap-1 overflow-hidden max-w-[65%] mask-gradient-r">
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

        {/* Right: SRS interval */}
        <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-medium">
          <div className="flex items-center gap-1">
            <Layers size={10} className="text-zinc-600" />
            <span>Reps: {srReps}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar size={10} className="text-zinc-600" />
            <span>Int: {srInterval}d</span>
          </div>
        </div>
      </div>

    </div>
  );
}
