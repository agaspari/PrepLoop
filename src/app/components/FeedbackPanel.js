"use client";

import { useState } from "react";
import { Award, Calendar, RotateCcw, AlertTriangle, Check, Loader2 } from "lucide-react";
import { saveCustomRatingAction } from "../actions";

export default function FeedbackPanel({ questionId, evaluation, onBack, onRefresh }) {
  const { evaluationMarkdown, recommendedRating, appliedRating, srs } = evaluation;
  const [activeRating, setActiveRating] = useState(appliedRating !== undefined ? Math.round(appliedRating) : 3);
  const [srsMetrics, setSrsMetrics] = useState(srs);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);

  // Extract score/grade from markdown for high visual impact
  function parseScoreAndGrade(mdText) {
    const scoreMatch = mdText.match(/(\d{1,3})\s*\/\s*100/);
    const gradeMatch = mdText.match(/Grade:\s*([A-F][+-]?)/i);
    
    return {
      score: scoreMatch ? scoreMatch[1] : null,
      grade: gradeMatch ? gradeMatch[1] : null
    };
  }

  const { score, grade } = parseScoreAndGrade(evaluationMarkdown);

  // Parse markdown lines to rich JSX to avoid requiring extra node modules
  function renderMarkdown(md) {
    if (!md) return null;
    const lines = md.split("\n");
    let inList = false;
    let listItems = [];
    const elements = [];

    const flushList = (key) => {
      if (inList && listItems.length > 0) {
        elements.push(
          <ul key={`ul-${key}`} className="list-disc list-inside ml-5 mb-4 text-sm text-zinc-300 space-y-1.5">
            {listItems}
          </ul>
        );
        listItems = [];
        inList = false;
      }
    };

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      // Horizontal rules
      if (trimmed === "---") {
        flushList(index);
        elements.push(<hr key={index} className="border-white/10 my-4" />);
        return;
      }

      // Headers
      if (trimmed.startsWith("### ")) {
        flushList(index);
        elements.push(
          <h3 key={index} className="text-md font-bold text-purple-300 mt-5 mb-2.5 flex items-center gap-2 border-b border-white/5 pb-1">
            {trimmed.slice(4)}
          </h3>
        );
        return;
      }
      if (trimmed.startsWith("## ")) {
        flushList(index);
        elements.push(
          <h2 key={index} className="text-lg font-bold text-white mt-6 mb-3">
            {trimmed.slice(3)}
          </h2>
        );
        return;
      }
      if (trimmed.startsWith("# ")) {
        flushList(index);
        elements.push(
          <h1 key={index} className="text-xl font-bold text-white mt-8 mb-4 tracking-tight border-b border-purple-500/20 pb-2">
            {trimmed.slice(2)}
          </h1>
        );
        return;
      }

      // List Items
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        inList = true;
        let content = trimmed.slice(2);
        
        // Parse bold text inline **text** -> strong
        const boldRegex = /\*\*(.*?)\*\*/g;
        let formattedContent = [];
        let lastIdx = 0;
        let match;
        
        while ((match = boldRegex.exec(content)) !== null) {
          if (match.index > lastIdx) {
            formattedContent.push(content.slice(lastIdx, match.index));
          }
          formattedContent.push(<strong key={match.index} className="text-white font-semibold">{match[1]}</strong>);
          lastIdx = boldRegex.lastIndex;
        }
        if (lastIdx < content.length) {
          formattedContent.push(content.slice(lastIdx));
        }

        listItems.push(
          <li key={`li-${index}`} className="leading-relaxed">
            {formattedContent.length > 0 ? formattedContent : content}
          </li>
        );
        return;
      }

      // Empty lines
      if (!trimmed) {
        flushList(index);
        return;
      }

      // Standard paragraphs
      flushList(index);

      // Parse bold text in paragraphs
      const boldRegex = /\*\*(.*?)\*\*/g;
      let formattedParagraph = [];
      let lastIdx = 0;
      let match;
      
      while ((match = boldRegex.exec(trimmed)) !== null) {
        if (match.index > lastIdx) {
          formattedParagraph.push(trimmed.slice(lastIdx, match.index));
        }
        formattedParagraph.push(<strong key={match.index} className="text-white font-semibold">{match[1]}</strong>);
        lastIdx = boldRegex.lastIndex;
      }
      if (lastIdx < trimmed.length) {
        formattedParagraph.push(trimmed.slice(lastIdx));
      }

      elements.push(
        <p key={index} className="text-sm text-zinc-300 leading-relaxed mb-3.5">
          {formattedParagraph.length > 0 ? formattedParagraph : trimmed}
        </p>
      );
    });

    flushList("end");
    return elements;
  }

  async function handleRatingChange(rating) {
    if (isUpdating) return;
    setIsUpdating(true);
    setUpdateSuccess(false);
    setActiveRating(rating);

    const result = await saveCustomRatingAction(questionId, rating);
    setIsUpdating(false);

    if (result.success) {
      setSrsMetrics(result.srs);
      setUpdateSuccess(true);
      if (onRefresh) onRefresh();
      setTimeout(() => setUpdateSuccess(false), 2000);
    } else {
      alert("Failed to adjust schedule: " + result.error);
    }
  }

  return (
    <div className="flex-1 flex flex-col p-8 space-y-6">
      
      {/* Top Banner: Score Indicator & Actions */}
      <div className="flex items-center justify-between p-6 bg-gradient-to-r from-purple-950/30 to-indigo-950/20 border border-purple-500/10 rounded-2xl relative overflow-hidden shrink-0">
        <div className="flex items-center gap-4">
          
          {/* Radial score gauge */}
          <div className="h-16 w-16 rounded-full bg-purple-500/10 border-2 border-purple-500 flex items-center justify-center shadow-lg shadow-purple-500/10">
            {score ? (
              <span className="text-lg font-bold text-white tracking-tight">{score}</span>
            ) : grade ? (
              <span className="text-lg font-bold text-white tracking-tight">{grade}</span>
            ) : (
              <Award size={24} className="text-purple-400" />
            )}
          </div>
          
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-1.5">
              Evaluation Result
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Grade and core strength vectors parsed by Gemini 1.5
            </p>
          </div>
        </div>

        <button 
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-1.5 border border-white/10 hover:border-white/20 rounded-lg text-xs text-zinc-400 hover:text-white bg-white/5 transition-all cursor-pointer"
        >
          <RotateCcw size={12} />
          <span>Revise Answer</span>
        </button>
      </div>

      {/* Spaced Repetition Panel */}
      <div className="p-5 bg-zinc-900/60 border border-white/5 rounded-2xl space-y-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
              <Calendar size={12} />
              Spaced Repetition Scheduler (SM-2)
            </h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Rate your ease of recall to reschedule. AI recommended: <strong className="text-purple-300 font-semibold">{recommendedRating}/5</strong>.
            </p>
          </div>
          
          {/* Schedule update states */}
          {isUpdating ? (
            <span className="text-[10px] text-zinc-400 flex items-center gap-1">
              <Loader2 size={10} className="animate-spin text-purple-400" /> Rescheduling...
            </span>
          ) : updateSuccess ? (
            <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
              <Check size={10} /> Saved & Rescheduled!
            </span>
          ) : (
            <span className="text-[10px] text-zinc-500 font-medium">
              Next review due: <strong className="text-zinc-300">{srsMetrics?.nextReviewDate || "Tomorrow"}</strong>
            </span>
          )}
        </div>

        {/* 0-5 buttons */}
        <div className="grid grid-cols-6 gap-2">
          {[0, 1, 2, 3, 4, 5].map((val) => {
            const labels = ["Blackout", "Incorrect", "Incorrect+", "Difficult", "Good", "Perfect"];
            const isActive = activeRating === val;
            
            return (
              <button
                key={val}
                type="button"
                onClick={() => handleRatingChange(val)}
                className={`py-2 px-1 text-center rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                  isActive 
                    ? "bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-600/10"
                    : "bg-white/5 border-white/5 text-zinc-400 hover:text-white hover:bg-white/10 hover:border-white/10"
                }`}
              >
                <div className="text-sm font-bold">{val}</div>
                <div className="text-[8px] opacity-75 font-mono truncate">{labels[val]}</div>
              </button>
            );
          })}
        </div>

        {/* SRS properties row */}
        <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono border-t border-white/5 pt-3">
          <span>Interval: <strong className="text-zinc-300">{srsMetrics?.interval || 1}d</strong></span>
          <span>Reps: <strong className="text-zinc-300">{srsMetrics?.repetitions || 0}</strong></span>
          <span>Ease Factor: <strong className="text-zinc-300">{srsMetrics?.easeFactor || 2.5}</strong></span>
        </div>
      </div>

      {/* Main feedback body */}
      <div className="flex-1 p-6 bg-white/5 border border-white/5 rounded-2xl overflow-y-auto max-h-[500px]">
        <div className="prose-custom font-sans">
          {renderMarkdown(evaluationMarkdown)}
        </div>
      </div>

    </div>
  );
}
