"use client";

import { useState, useEffect, startTransition } from "react";
import { Sliders, Sparkles, AlertTriangle, Layers, Calendar, CheckSquare, Search, ChevronDown, Check, Loader2, HelpCircle, Target, User } from "lucide-react";
import { loadQuestionsAction, generateDailyQuestionsAction, getConfigAction, loadTargetsAction } from "./actions";
import SettingsDrawer from "./components/SettingsDrawer";
import QuestionCard from "./components/QuestionCard";
import FocusWorkspace from "./components/FocusWorkspace";
import TargetsManager from "./components/TargetsManager";
import ProfileViewer from "./components/ProfileViewer";

export default function Home() {
  const [questions, setQuestions] = useState([]);
  const [filteredQuestions, setFilteredQuestions] = useState([]);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [config, setConfig] = useState({ hasApiKey: false, vaultPath: "" });
  
  // Dashboard states
  const [activeTab, setActiveTab] = useState("due"); // due, answered, all, targets
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState("all");
  const [targetsCount, setTargetsCount] = useState(0);
  
  // Dynamic alerts
  const [generationAlert, setGenerationAlert] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    // 1. Load config
    const confResult = await getConfigAction();
    if (confResult.success) {
      setConfig({
        hasApiKey: confResult.hasApiKey,
        vaultPath: confResult.vaultPath
      });
    }

    // 2. Load questions
    const qResult = await loadQuestionsAction();
    if (qResult.success) {
      setQuestions(qResult.questions);
    }

    // 3. Load targets count
    const tResult = await loadTargetsAction();
    if (tResult.success) {
      setTargetsCount(tResult.targets.length);
    }
    
    setIsLoading(false);
  }

  // Filter questions dynamically
  useEffect(() => {
    let result = [...questions];

    // Filter by tab
    if (activeTab === "due") {
      result = result.filter(q => q.isDue && !q.hasAnswer);
    } else if (activeTab === "answered") {
      result = result.filter(q => q.hasAnswer);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(q => 
        q.title.toLowerCase().includes(query) || 
        q.questionText.toLowerCase().includes(query) ||
        q.subCategories.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Filter by category
    if (selectedCategory !== "all") {
      result = result.filter(q => q.category === selectedCategory);
    }

    // Filter by difficulty
    if (selectedDifficulty !== "all") {
      result = result.filter(q => q.difficulty === selectedDifficulty);
    }

    setFilteredQuestions(result);
  }, [questions, activeTab, searchQuery, selectedCategory, selectedDifficulty]);

  async function handleGenerateDeck() {
    if (!config.hasApiKey) {
      setIsSettingsOpen(true);
      return;
    }

    setIsGenerating(true);
    setGenerationAlert(null);
    
    const result = await generateDailyQuestionsAction();
    setIsGenerating(false);

    if (result.success) {
      setGenerationAlert({
        type: "success",
        message: `Success! Generated ${result.count} challenging questions in your Obsidian vault.`
      });
      loadData();
      // Auto-clear alert after 4 seconds
      setTimeout(() => setGenerationAlert(null), 4000);
    } else {
      setGenerationAlert({
        type: "error",
        message: result.error || "Failed to generate deck. Please check your config."
      });
    }
  }

  // Compute counters
  const totalCount = questions.length;
  const dueCount = questions.filter(q => q.isDue && !q.hasAnswer).length;
  const answeredCount = questions.filter(q => q.hasAnswer).length;

  return (
    <div className="flex-1 w-full min-h-screen bg-zinc-950 flex flex-col font-sans text-zinc-100 pb-20 relative overflow-x-hidden">
      
      {/* Background neon blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-900/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[600px] h-[600px] bg-blue-900/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Main Header / Top Navigation */}
      <header className="h-20 border-b border-white/5 px-8 flex items-center justify-between shrink-0 glass relative z-10">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-600/30 border border-purple-400/20">
            <span className="text-lg font-black text-white italic tracking-tighter">PL</span>
          </div>
          <div>
            <h1 className="text-lg font-black text-white tracking-tight flex items-center gap-1.5">
              PrepLoop <span className="text-[10px] text-purple-400 font-mono tracking-normal bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">PRO v2.0</span>
            </h1>
            <p className="text-[10px] text-zinc-500">Adaptive Spaced Repetition Engineering Coach</p>
          </div>
        </div>

        {/* Global Statistics counters */}
        <div className="hidden md:flex items-center gap-6 bg-white/5 border border-white/5 rounded-full px-6 py-2">
          <div className="flex items-center gap-2">
            <Calendar size={13} className="text-purple-400" />
            <span className="text-xs font-semibold text-zinc-400">Due Today:</span>
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
            <span className="text-xs font-semibold text-zinc-400">Total Cards:</span>
            <span className="text-xs font-bold text-white font-mono">{totalCount}</span>
          </div>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-2">
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

      {/* Global API Key Config Warning Banner */}
      {!config.hasApiKey && !isLoading && (
        <div 
          className="mx-8 mt-6 p-4 rounded-xl border border-rose-500/20 bg-rose-950/20 text-rose-300 text-xs flex items-center gap-2 z-10"
        >
          <AlertTriangle size={16} className="text-rose-400 shrink-0" />
          <span>
            <strong>Gemini API Key is not configured.</strong> Set the <code className="bg-rose-500/15 px-1 py-0.5 rounded text-[10px]">GEMINI_API_KEY</code> environment variable to enable Tailored Question Generation and AI Grading.
          </span>
        </div>
      )}

      {/* Central Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-8 mt-8 flex flex-col space-y-8 z-10">

        {/* Glow Action Banner — only relevant on question tabs */}
        {activeTab !== "profile" && activeTab !== "targets" && (
        <div className="relative overflow-hidden p-8 rounded-3xl bg-gradient-to-r from-purple-900/40 via-indigo-950/30 to-zinc-900 border border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-2xl shadow-purple-950/20">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-purple-400 flex items-center gap-1.5">
                <Sparkles size={12} /> Daily Prep Deck
              </span>
              {targetsCount > 0 && (
                <span className="text-[9px] font-bold text-indigo-300 bg-indigo-500/15 border border-indigo-400/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Target size={9} className="text-indigo-400" /> {targetsCount} Target {targetsCount === 1 ? "Role" : "Roles"} Configured
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Adaptive Interview Generation
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Based on your resume profile schema (Capital One, Interactive Brokers, Amazon), generate 3 to 5 highly customized, scenario-driven interview questions mapping directly to your historical engineering experiences.
            </p>
          </div>

          <div className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            <button
              onClick={handleGenerateDeck}
              disabled={isGenerating}
              className="glow-btn cursor-pointer py-3.5 px-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-600 text-white font-bold rounded-2xl shadow-xl shadow-purple-600/10 flex items-center justify-center gap-2 text-sm leading-none transition-all duration-300"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Generating Challenging Decks...
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Generate Fresh Deck
                </>
              )}
            </button>
          </div>
        </div>
        )}

        {/* Dynamic Alerts */}
        {generationAlert && (
          <div className={`p-4 rounded-xl text-xs border flex items-center gap-2 animate-in slide-in-from-top-4 duration-300 ${
            generationAlert.type === "success" 
              ? "bg-emerald-950/40 border-emerald-800/50 text-emerald-300"
              : "bg-rose-950/40 border-rose-800/50 text-rose-300"
          }`}>
            <Check size={14} className="shrink-0" />
            <span>{generationAlert.message}</span>
          </div>
        )}

        {/* Dashboard Workspace */}
        <div className="flex flex-col space-y-6">

          {/* Filters and Tabs Header — only on question views */}
          {activeTab !== "profile" && activeTab !== "targets" && (
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 border-b border-white/5 pb-4">

            {/* Tabs selection */}
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
                All Questions ({totalCount})
              </button>
            </div>

            {/* Filter controls: Search and selection selectors */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 md:justify-end">

              {/* Search bar */}
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

              {/* Category Dropdown */}
              <div className="relative">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="appearance-none w-full sm:w-[150px] pl-4 pr-10 py-2 bg-white/5 border border-white/5 rounded-xl text-xs text-zinc-300 hover:text-white cursor-pointer focus:outline-none focus:border-purple-500 transition-all"
                >
                  <option value="all" className="bg-zinc-900 text-zinc-100">All Categories</option>
                  <option value="system-design" className="bg-zinc-900 text-zinc-100">System Design</option>
                  <option value="conceptual-engineering" className="bg-zinc-900 text-zinc-100">Conceptual</option>
                  <option value="behavioral" className="bg-zinc-900 text-zinc-100">Behavioral</option>
                </select>
                <ChevronDown size={12} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
              </div>

              {/* Difficulty Dropdown */}
              <div className="relative">
                <select
                  value={selectedDifficulty}
                  onChange={(e) => setSelectedDifficulty(e.target.value)}
                  className="appearance-none w-full sm:w-[160px] pl-4 pr-10 py-2 bg-white/5 border border-white/5 rounded-xl text-xs text-zinc-300 hover:text-white cursor-pointer focus:outline-none focus:border-purple-500 transition-all"
                >
                  <option value="all" className="bg-zinc-900 text-zinc-100">All Difficulties</option>
                  <option value="easy" className="bg-zinc-900 text-zinc-100">Easy</option>
                  <option value="medium" className="bg-zinc-900 text-zinc-100">Medium</option>
                  <option value="hard" className="bg-zinc-900 text-zinc-100">Hard</option>
                </select>
                <ChevronDown size={12} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
              </div>

            </div>

          </div>
          )}

          {/* Cards Grid */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <Loader2 size={36} className="text-purple-500 animate-spin" />
              <span className="text-sm text-zinc-400">Loading PrepLoop Vault...</span>
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
                />
              ))}
            </div>
          ) : (
            /* Empty State */
            <div className="flex flex-col items-center justify-center border border-dashed border-white/10 rounded-3xl py-24 text-center px-6">
              <div className="h-16 w-16 rounded-full bg-white/5 border border-white/5 flex items-center justify-center mb-6">
                <HelpCircle size={28} className="text-zinc-600" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">No Questions Found</h3>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed mb-6">
                {activeTab === "due" 
                  ? "Outstanding reviews are fully cleared! Generate a fresh adaptive deck to keep learning."
                  : "No questions match your currently selected filters. Clear your search query or dropdown variables."}
              </p>
              {activeTab === "due" && (
                <button
                  onClick={handleGenerateDeck}
                  disabled={isGenerating}
                  className="glow-btn cursor-pointer py-2.5 px-5 bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-purple-600/10 leading-none transition-colors"
                >
                  {isGenerating ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Sparkles size={12} />
                  )}
                  Generate New Deck
                </button>
              )}
            </div>
          )}

        </div>

      </main>

      {/* Focus Mode Sandbox Workspace Modal */}
      {selectedQuestion && (
        <FocusWorkspace
          question={selectedQuestion}
          onClose={() => {
            setSelectedQuestion(null);
            loadData(); // reload dashboard stats
          }}
          onRefresh={loadData}
        />
      )}

      {/* System Settings drawer */}
      <SettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => {
          setIsSettingsOpen(false);
          loadData(); // reload config values
        }}
      />

    </div>
  );
}

