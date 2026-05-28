"use client";

import { useState, useEffect } from "react";
import { Sliders, Sparkles, AlertTriangle, Layers, Calendar, CheckSquare, Search, ChevronDown, Check, Loader2, HelpCircle, Target, User, Plus, Compass, Home as HomeIcon } from "lucide-react";
import { loadQuestionsAction, getConfigAction, loadTargetsAction, deleteQuestionAction, archiveQuestionAction } from "./actions";
import SettingsDrawer from "./components/SettingsDrawer";
import QuestionCard from "./components/QuestionCard";
import FocusWorkspace from "./components/FocusWorkspace";
import TargetsManager from "./components/TargetsManager";
import ProfileViewer from "./components/ProfileViewer";
import AddQuestionModal from "./components/AddQuestionModal";
import TopicGeneratorDrawer from "./components/TopicGeneratorDrawer";

export default function Home() {
  const [questions, setQuestions] = useState([]);
  const [filteredQuestions, setFilteredQuestions] = useState([]);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [config, setConfig] = useState({ hasApiKey: false, totalQuestions: 0 });
  
  // Dashboard states
  const [activeTab, setActiveTab] = useState("due");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState("all");
  const [selectedSource, setSelectedSource] = useState("all");
  const [targetsCount, setTargetsCount] = useState(0);
  
  // Modals
  const [isAddQuestionOpen, setIsAddQuestionOpen] = useState(false);
  const [isTopicDrawerOpen, setIsTopicDrawerOpen] = useState(false);
  
  // Alerts
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    const confResult = await getConfigAction();
    if (confResult.success) {
      setConfig({
        hasApiKey: confResult.hasApiKey,
        totalQuestions: confResult.totalQuestions || 0,
      });
    }

    const qResult = await loadQuestionsAction();
    if (qResult.success) {
      setQuestions(qResult.questions);
    }

    const tResult = await loadTargetsAction();
    if (tResult.success) {
      setTargetsCount(tResult.targets.length);
    }
    
    setIsLoading(false);
  }

  // Filter questions dynamically
  useEffect(() => {
    let result = [...questions].filter(q => !q.archived);

    if (activeTab === "due") {
      const allDueNew = result.filter(q => q.isDue && !q.hasAnswer);
      const allDueReviews = result.filter(q => q.isDue && q.hasAnswer);

      // Cap reviews at 4 to prevent study burnout
      const visibleReviews = allDueReviews.slice(0, 4);
      // Fill the remaining slots with new questions (at least 2, up to 6 total)
      const remainingSlots = Math.max(0, 6 - visibleReviews.length);
      const newCap = Math.max(2, remainingSlots);
      const visibleNew = allDueNew.slice(0, newCap);

      // Combine and cap at exactly 6 total
      result = [...visibleReviews, ...visibleNew].slice(0, 6);
    } else if (activeTab === "answered") {
      result = result.filter(q => q.hasAnswer);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(q => 
        q.title.toLowerCase().includes(query) || 
        q.questionText.toLowerCase().includes(query) ||
        q.subCategories.some(tag => tag.toLowerCase().includes(query))
      );
    }

    if (selectedCategory !== "all") {
      result = result.filter(q => q.category === selectedCategory);
    }

    if (selectedDifficulty !== "all") {
      result = result.filter(q => q.difficulty === selectedDifficulty);
    }

    if (selectedSource !== "all") {
      result = result.filter(q => q.source === selectedSource);
    }

    setFilteredQuestions(result);
  }, [questions, activeTab, searchQuery, selectedCategory, selectedDifficulty, selectedSource]);

  async function handleDeleteQuestion(questionId) {
    if (!confirm("Delete this question permanently?")) return;
    const result = await deleteQuestionAction(questionId);
    if (result.success) {
      loadData();
    }
  }

  async function handleArchiveQuestion(questionId) {
    if (!confirm("Archive this question? It will be removed from your daily rotation but kept for deduplication.")) return;
    const result = await archiveQuestionAction(questionId);
    if (result.success) {
      showAlert("Question archived.");
      loadData();
    } else {
      showAlert("Error archiving question: " + (result.error || "Unknown error"), "error");
    }
  }

  function showAlert(message, type = "success") {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 4000);
  }

  // Compute counters
  const totalCount = questions.filter(q => !q.archived).length;
  const answeredCount = questions.filter(q => !q.archived && q.hasAnswer).length;

  // Calculate dynamic due count matching our allocation filter
  const allDueNew = questions.filter(q => !q.archived && q.isDue && !q.hasAnswer);
  const allDueReviews = questions.filter(q => !q.archived && q.isDue && q.hasAnswer);
  
  const visibleReviews = allDueReviews.slice(0, 4);
  const remainingSlots = Math.max(0, 6 - visibleReviews.length);
  const newCap = Math.max(2, remainingSlots);
  const visibleNew = allDueNew.slice(0, newCap);
  
  const dueCount = Math.min(6, visibleReviews.length + visibleNew.length);

  return (
    <div className="flex-1 w-full min-h-screen bg-zinc-950 flex flex-col font-sans text-zinc-100 pb-20 relative overflow-x-hidden">
      
      {/* Background neon blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-900/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[600px] h-[600px] bg-blue-900/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Main Header */}
      <header className="h-20 border-b border-white/5 px-8 flex items-center justify-between shrink-0 glass relative z-10">
        <div 
          onClick={() => setActiveTab("due")}
          className="flex items-center gap-3 cursor-pointer hover:opacity-85 active:scale-95 transition-all"
        >
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-600/30 border border-purple-400/20">
            <span className="text-lg font-black text-white italic tracking-tighter">PL</span>
          </div>
          <div>
            <h1 className="text-lg font-black text-white tracking-tight flex items-center gap-1.5">
              PrepLoop <span className="text-[10px] text-purple-400 font-mono tracking-normal bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">v3.0</span>
            </h1>
            <p className="text-[10px] text-zinc-500">Ingestion-Based Interview Prep Engine</p>
          </div>
        </div>

        {/* Global Statistics */}
        <div className="hidden md:flex items-center gap-6 bg-white/5 border border-white/5 rounded-full px-6 py-2">
          <div className="flex items-center gap-2">
            <Calendar size={13} className="text-purple-400" />
            <span className="text-xs font-semibold text-zinc-400">Due:</span>
            <span className={`text-xs font-bold font-mono ${dueCount > 0 ? "text-purple-300" : "text-zinc-500"}`}>
              {dueCount}
            </span>
          </div>
          <div className="h-3 w-px bg-white/10" />
          <div className="flex items-center gap-2">
            <CheckSquare size={13} className="text-emerald-400" />
            <span className="text-xs font-semibold text-zinc-400">Reviewed:</span>
            <span className="text-xs font-bold text-white font-mono">{answeredCount}</span>
          </div>
          <div className="h-3 w-px bg-white/10" />
          <div className="flex items-center gap-2">
            <Layers size={13} className="text-indigo-400" />
            <span className="text-xs font-semibold text-zinc-400">Bank:</span>
            <span className="text-xs font-bold text-white font-mono">{totalCount}</span>
          </div>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-2">
          {/* Home/Dashboard */}
          <button
            onClick={() => setActiveTab("due")}
            title="Back to Questions Dashboard"
            className={`flex items-center gap-2 px-3 py-2 border rounded-xl text-sm transition-all cursor-pointer ${
              activeTab === "due" || activeTab === "answered" || activeTab === "all"
                ? "border-purple-500/40 bg-purple-500/10 text-purple-200"
                : "border-white/10 text-zinc-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <HomeIcon size={15} />
            <span className="hidden sm:inline">Home</span>
          </button>

          {/* Topic Generator */}
          <button
            onClick={() => setIsTopicDrawerOpen(true)}
            title="Generate questions by topic"
            className="flex items-center gap-2 px-3 py-2 border border-white/10 rounded-xl text-sm text-zinc-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
          >
            <Compass size={15} />
            <span className="hidden sm:inline">Topic</span>
          </button>

          {/* Add Custom Question */}
          <button
            onClick={() => setIsAddQuestionOpen(true)}
            title="Add custom question"
            className="flex items-center gap-2 px-3 py-2 border border-white/10 rounded-xl text-sm text-zinc-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
          >
            <Plus size={15} />
            <span className="hidden sm:inline">Custom</span>
          </button>

          <button
            onClick={() => setActiveTab(activeTab === "targets" ? "due" : "targets")}
            title={activeTab === "targets" ? "Back to questions" : "Manage target roles"}
            className={`flex items-center gap-2 px-3 py-2 border rounded-xl text-sm transition-all cursor-pointer ${
              activeTab === "targets"
                ? "border-purple-500/40 bg-purple-500/10 text-purple-200"
                : "border-white/10 text-zinc-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Target size={15} />
            <span className="hidden sm:inline">Targets</span>
            {targetsCount > 0 && (
              <span className={`text-[10px] font-bold leading-none px-1.5 py-0.5 rounded-full ${
                activeTab === "targets" ? "bg-purple-500/30 text-purple-100" : "bg-white/10 text-zinc-400"
              }`}>
                {targetsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab(activeTab === "profile" ? "due" : "profile")}
            title={activeTab === "profile" ? "Back to questions" : "View resume schema"}
            className={`flex items-center gap-2 px-3 py-2 border rounded-xl text-sm transition-all cursor-pointer ${
              activeTab === "profile"
                ? "border-purple-500/40 bg-purple-500/10 text-purple-200"
                : "border-white/10 text-zinc-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <User size={15} />
            <span className="hidden sm:inline">Profile</span>
          </button>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-2 px-3 py-2 border border-white/10 rounded-xl text-sm text-zinc-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
          >
            <Sliders size={15} />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
      </header>

      {/* API Key Warning */}
      {!config.hasApiKey && !isLoading && (
        <div 
          className="mx-8 mt-6 p-4 rounded-xl border border-rose-500/20 bg-rose-950/20 text-rose-300 text-xs flex items-center gap-2 z-10"
        >
          <AlertTriangle size={16} className="text-rose-400 shrink-0" />
          <span>
            <strong>Gemini API Key is not configured.</strong> Set the <code className="bg-rose-500/15 px-1 py-0.5 rounded text-[10px]">GEMINI_API_KEY</code> environment variable.
          </span>
        </div>
      )}

      {/* Central Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-8 mt-8 flex flex-col space-y-8 z-10">

        {/* Hero Banner — only on question tabs */}
        {activeTab !== "profile" && activeTab !== "targets" && (
        <div className="relative overflow-hidden p-8 rounded-3xl bg-gradient-to-r from-purple-900/40 via-indigo-950/30 to-zinc-900 border border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-2xl shadow-purple-950/20">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-purple-400 flex items-center gap-1.5">
                <Sparkles size={12} /> Spaced Repetition Engine
              </span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Your Question Bank
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {totalCount === 0 
                ? "Upload your resume schema to generate ~150 personalized interview questions, or add targets for company-specific prep."
                : `${totalCount} questions in your bank. ${dueCount} due for review today. Questions are surfaced by the SM-2 spaced repetition algorithm.`
              }
            </p>
          </div>

          {totalCount === 0 && (
            <div className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
              <button
                onClick={() => setActiveTab("profile")}
                className="glow-btn cursor-pointer py-3.5 px-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-2xl shadow-xl shadow-purple-600/10 flex items-center justify-center gap-2 text-sm leading-none transition-all duration-300"
              >
                <Sparkles size={16} />
                Upload Resume Schema
              </button>
            </div>
          )}
        </div>
        )}

        {/* Dynamic Alert */}
        {alert && (
          <div className={`p-4 rounded-xl text-xs border flex items-center gap-2 ${
            alert.type === "success" 
              ? "bg-emerald-950/40 border-emerald-800/50 text-emerald-300"
              : "bg-rose-950/40 border-rose-800/50 text-rose-300"
          }`}>
            <Check size={14} className="shrink-0" />
            <span>{alert.message}</span>
          </div>
        )}

        {/* Dashboard */}
        <div className="flex flex-col space-y-6">

          {/* Filters & Tabs — question views only */}
          {activeTab !== "profile" && activeTab !== "targets" && (
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 border-b border-white/5 pb-4">

            {/* Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-white/5 border border-white/5 rounded-2xl max-w-max self-start">
              <button
                onClick={() => setActiveTab("due")}
                className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                  activeTab === "due"
                    ? "bg-purple-600 text-white shadow-lg shadow-purple-600/10"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Due for Review ({dueCount})
              </button>
              <button
                onClick={() => setActiveTab("answered")}
                className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                  activeTab === "answered"
                    ? "bg-purple-600 text-white shadow-lg shadow-purple-600/10"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Reviewed ({answeredCount})
              </button>
              <button
                onClick={() => setActiveTab("all")}
                className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                  activeTab === "all"
                    ? "bg-purple-600 text-white shadow-lg shadow-purple-600/10"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                All ({totalCount})
              </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 md:justify-end">

              {/* Search */}
              <div className="relative flex-1 max-w-xs">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search questions or tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/5 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all font-mono"
                />
              </div>

              {/* Source Filter */}
              <div className="relative">
                <select
                  value={selectedSource}
                  onChange={(e) => setSelectedSource(e.target.value)}
                  className="appearance-none w-full sm:w-[130px] pl-4 pr-10 py-2 bg-zinc-900 border border-white/10 rounded-xl text-xs text-zinc-300 hover:text-white cursor-pointer focus:outline-none focus:border-purple-500 transition-all"
                >
                  <option value="all" className="bg-zinc-900 text-zinc-300">All Sources</option>
                  <option value="resume-ingestion" className="bg-zinc-900 text-zinc-300">Resume</option>
                  <option value="target-ingestion" className="bg-zinc-900 text-zinc-300">Targets</option>
                  <option value="topic-generated" className="bg-zinc-900 text-zinc-300">Topics</option>
                  <option value="custom" className="bg-zinc-900 text-zinc-300">Custom</option>
                </select>
                <ChevronDown size={12} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
              </div>

              {/* Category */}
              <div className="relative">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="appearance-none w-full sm:w-[150px] pl-4 pr-10 py-2 bg-zinc-900 border border-white/10 rounded-xl text-xs text-zinc-300 hover:text-white cursor-pointer focus:outline-none focus:border-purple-500 transition-all"
                >
                  <option value="all" className="bg-zinc-900 text-zinc-300">All Categories</option>
                  <option value="system-design" className="bg-zinc-900 text-zinc-300">System Design</option>
                  <option value="conceptual-engineering" className="bg-zinc-900 text-zinc-300">Conceptual</option>
                  <option value="behavioral" className="bg-zinc-900 text-zinc-300">Behavioral</option>
                </select>
                <ChevronDown size={12} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
              </div>

              {/* Difficulty */}
              <div className="relative">
                <select
                  value={selectedDifficulty}
                  onChange={(e) => setSelectedDifficulty(e.target.value)}
                  className="appearance-none w-full sm:w-[120px] pl-4 pr-10 py-2 bg-zinc-900 border border-white/10 rounded-xl text-xs text-zinc-300 hover:text-white cursor-pointer focus:outline-none focus:border-purple-500 transition-all"
                >
                  <option value="all" className="bg-zinc-900 text-zinc-300">All Levels</option>
                  <option value="easy" className="bg-zinc-900 text-zinc-300">Easy</option>
                  <option value="medium" className="bg-zinc-900 text-zinc-300">Medium</option>
                  <option value="hard" className="bg-zinc-900 text-zinc-300">Hard</option>
                </select>
                <ChevronDown size={12} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
              </div>
            </div>
          </div>
          )}

          {/* Content Area */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <Loader2 size={36} className="text-purple-500 animate-spin" />
              <span className="text-sm text-zinc-400">Loading PrepLoop...</span>
            </div>
          ) : activeTab === "targets" ? (
            <TargetsManager onTargetsChange={setTargetsCount} />
          ) : activeTab === "profile" ? (
            <ProfileViewer />
          ) : filteredQuestions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredQuestions.map((q) => (
                <QuestionCard 
                  key={q.id}
                  question={q}
                  onClick={setSelectedQuestion}
                  onDelete={handleDeleteQuestion}
                  onArchive={handleArchiveQuestion}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center border border-dashed border-white/10 rounded-3xl py-24 text-center px-6">
              <div className="h-16 w-16 rounded-full bg-white/5 border border-white/5 flex items-center justify-center mb-6">
                <HelpCircle size={28} className="text-zinc-600" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">
                {totalCount === 0 ? "No Questions Yet" : "No Questions Found"}
              </h3>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed mb-6">
                {totalCount === 0
                  ? "Upload your resume schema to generate your first batch of personalized interview questions."
                  : activeTab === "due"
                    ? "All reviews are cleared! Check your question bank or generate more with the Topic generator."
                    : "No questions match your filters. Adjust your search or dropdown selections."}
              </p>
              {totalCount === 0 && (
                <button
                  onClick={() => setActiveTab("profile")}
                  className="glow-btn cursor-pointer py-2.5 px-5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-purple-600/10 leading-none transition-colors"
                >
                  <Sparkles size={12} />
                  Upload Resume Schema
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Focus Mode */}
      {selectedQuestion && (
        <FocusWorkspace
          question={selectedQuestion}
          onClose={() => {
            setSelectedQuestion(null);
            loadData();
          }}
          onRefresh={loadData}
        />
      )}

      {/* Settings Drawer */}
      <SettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => {
          setIsSettingsOpen(false);
          loadData();
        }}
      />

      {/* Add Custom Question Modal */}
      <AddQuestionModal
        isOpen={isAddQuestionOpen}
        onClose={() => setIsAddQuestionOpen(false)}
        onCreated={() => {
          showAlert("Custom question added to your bank!");
          loadData();
        }}
      />

      {/* Topic Generator Drawer */}
      <TopicGeneratorDrawer
        isOpen={isTopicDrawerOpen}
        onClose={() => setIsTopicDrawerOpen(false)}
        onSaved={(count) => {
          showAlert(`Saved ${count} topic questions to your bank!`);
          loadData();
        }}
      />
    </div>
  );
}
