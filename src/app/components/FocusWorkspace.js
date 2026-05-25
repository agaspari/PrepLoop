"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, BookOpen, AlertCircle, Sparkles, Loader2 } from "lucide-react";
import { submitAnswerAction } from "../actions";
import FeedbackPanel from "./FeedbackPanel";

export default function FocusWorkspace({ question, onClose, onRefresh }) {
  const [answerText, setAnswerText] = useState(question.answer || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [evaluation, setEvaluation] = useState(null);
  const [loadingTip, setLoadingTip] = useState("Analyzing your trade-offs...");

  // Loading quotes to cycle through for rich aesthetics
  const loadingTips = [
    "Analyzing your architectural trade-offs...",
    "Retrieving expert evaluation criteria for Senior Engineers...",
    "Scanning for edge cases, scaling bottlenecks, and consistency guarantees...",
    "Generating perfect senior rubrics from your resume profile...",
    "Scoring compliance, data modeling, and performance vectors..."
  ];

  useEffect(() => {
    let interval;
    if (isSubmitting) {
      let idx = 0;
      interval = setInterval(() => {
        idx = (idx + 1) % loadingTips.length;
        setLoadingTip(loadingTips[idx]);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isSubmitting]);

  // Load existing evaluation if already answered
  useEffect(() => {
    if (question.hasAnswer) {
      setEvaluation({
        evaluationMarkdown: question.feedback,
        recommendedRating: question.srFactor, // fallback placeholder
        appliedRating: question.srFactor,
        srs: {
          interval: question.srInterval,
          repetitions: question.srReps,
          easeFactor: question.srFactor,
          nextReviewDate: question.srDue
        }
      });
    } else {
      setEvaluation(null);
    }
  }, [question]);

  const wordCount = answerText.trim() ? answerText.trim().split(/\s+/).length : 0;
  const charCount = answerText.length;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!answerText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    const result = await submitAnswerAction(question.id, answerText);
    setIsSubmitting(false);

    if (result.success) {
      setEvaluation({
        evaluationMarkdown: result.evaluationMarkdown,
        recommendedRating: result.recommendedRating,
        appliedRating: result.appliedRating,
        srs: result.srs
      });
      if (onRefresh) onRefresh();
    } else {
      alert("Error grading answer: " + (result.error || "Unknown error"));
    }
  }

  return (
    <div className="fixed inset-0 z-40 bg-zinc-950 flex flex-col animate-in fade-in duration-200">
      
      {/* Workspace Header */}
      <div className="h-16 border-b border-white/5 px-6 flex items-center justify-between shrink-0 glass">
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>Dashboard</span>
          </button>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
              {question.category.replace("-", " ")}
            </span>
            <span className="text-xs uppercase font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
              {question.difficulty}
            </span>
          </div>
        </div>

        <div className="text-sm font-mono text-zinc-500">
          PrepLoop Interactive Sandbox v2.0
        </div>
      </div>

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Pane: Question Description & Resume Context */}
        <div className="w-1/2 overflow-y-auto p-8 border-r border-white/5 flex flex-col space-y-6 bg-zinc-950/20">
          
          <div className="space-y-4">
            <h1 className="text-2xl font-bold text-white tracking-tight glow-text leading-tight">
              {question.title}
            </h1>
            
            {/* The Detailed Question */}
            <div className="p-5 bg-white/5 rounded-xl border border-white/5 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-2">
                <BookOpen size={12} />
                Interview Question Details
              </h3>
              <p className="text-zinc-200 text-sm leading-relaxed whitespace-pre-wrap">
                {question.questionText || question.title}
              </p>
            </div>
          </div>

          {/* Resume Context card */}
          {question.resumeContext && (
            <div className="shrink-0 p-5 bg-purple-950/25 border border-purple-500/25 rounded-xl relative overflow-hidden space-y-3">
              <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none">
                <Sparkles size={48} className="text-purple-400" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-2">
                <Sparkles size={12} />
                Resume Tailoring Rationale
              </h3>
              <p className="text-zinc-200 text-sm leading-relaxed whitespace-pre-wrap">
                {question.resumeContext}
              </p>
            </div>
          )}

          {/* Standard Prep Guide */}
          <div className="p-5 bg-zinc-900/50 border border-white/5 rounded-xl space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <AlertCircle size={12} />
              Preparation Strategy
            </h3>
            <ul className="text-xs text-zinc-400 space-y-2 list-disc list-inside leading-relaxed">
              <li>Structure your answer cleanly (e.g. use the STAR method for behavioral, or components/interfaces for system design).</li>
              <li>Address explicit scaling trade-offs, consistency models, and database tuning constraints.</li>
              <li>Highlight failures or concrete production edge cases from your Capital One/IB/Amazon experience.</li>
            </ul>
          </div>

        </div>

        {/* Right Pane: Interactive Answer Input or Dynamic Feedback Visualizer */}
        <div className="w-1/2 overflow-y-auto flex flex-col bg-zinc-950/40 relative">
          
          {isSubmitting && (
            <div className="absolute inset-0 z-10 bg-zinc-950/80 backdrop-blur-md flex flex-col items-center justify-center p-8 space-y-4 animate-in fade-in duration-300">
              <div className="relative flex items-center justify-center">
                <div className="h-16 w-16 rounded-full border-t-2 border-r-2 border-purple-500 animate-spin" />
                <div className="absolute h-10 w-10 rounded-full border-b-2 border-l-2 border-blue-500 animate-spin animate-reverse" />
              </div>
              <p className="text-white font-semibold text-lg tracking-tight animate-pulse text-center">
                Evaluating Answer
              </p>
              <p className="text-zinc-400 text-xs text-center max-w-sm">
                {loadingTip}
              </p>
            </div>
          )}

          {evaluation ? (
            <FeedbackPanel 
              questionId={question.id}
              evaluation={evaluation}
              onBack={() => setEvaluation(null)}
              onRefresh={onRefresh}
            />
          ) : (
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col p-8 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white tracking-tight">Your Long-Form Solution</h2>
                <div className="flex gap-4 text-xs font-mono text-zinc-500">
                  <span>Words: {wordCount}</span>
                  <span>Chars: {charCount}</span>
                </div>
              </div>

              <textarea 
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                placeholder="Write your comprehensive technical defense here... Use standard Markdown headers, code snippets, or bullet points to structure your response."
                className="flex-1 w-full p-5 bg-white/5 border border-white/10 rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-purple-500 resize-none leading-relaxed text-sm font-sans"
                required
              />

              <button
                type="submit"
                disabled={isSubmitting || !answerText.trim()}
                className="glow-btn cursor-pointer py-4 px-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-500 text-white font-bold rounded-xl shadow-lg shadow-purple-600/20 text-center tracking-tight transition-all duration-300"
              >
                Submit Answer for AI Evaluation
              </button>
            </form>
          )}

        </div>

      </div>

    </div>
  );
}
