"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, Briefcase, Save, X, FileText, Sparkles, Loader2, Target, RefreshCw } from "lucide-react";
import { loadTargetsAction, saveTargetAction, deleteTargetAction, refreshTargetQuestionsAction } from "../actions";
import IngestionProgress from "./IngestionProgress";

export default function TargetsManager({ onTargetsChange }) {
  const [targets, setTargets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTarget, setEditingTarget] = useState(null);
  const [formCompany, setFormCompany] = useState("");
  const [formRole, setFormRole] = useState("");
  const [formContent, setFormContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState("");
  const [refreshingId, setRefreshingId] = useState("");
  const [ingestionStatus, setIngestionStatus] = useState({ status: "idle", message: "", count: 0 });
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    fetchTargets();
  }, []);

  async function fetchTargets() {
    setIsLoading(true);
    const result = await loadTargetsAction();
    setIsLoading(false);
    if (result.success) {
      setTargets(result.targets);
      if (onTargetsChange) onTargetsChange(result.targets.length);
    }
  }

  function handleAddClick() {
    setEditingTarget(null);
    setFormCompany("");
    setFormRole("");
    setFormContent("");
    setIsEditing(true);
  }

  function handleEditClick(target) {
    setEditingTarget(target);
    setFormCompany(target.company || "");
    setFormRole(target.role || "");
    setFormContent(target.content || "");
    setIsEditing(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!formCompany.trim() || !formContent.trim() || isSaving) return;

    setIsSaving(true);
    setIngestionStatus({ status: "generating", message: "Saving target and generating interview questions...", count: 0 });

    const targetData = {
      company: formCompany.trim(),
      role: formRole.trim(),
      title: `${formCompany.trim()} — ${formRole.trim()}`,
      content: formContent.trim(),
    };

    if (editingTarget) {
      targetData.id = editingTarget.id;
    }

    const result = await saveTargetAction(targetData);
    setIsSaving(false);

    if (result.success) {
      setIngestionStatus({
        status: "complete",
        message: result.message || `Generated ${result.questionsGenerated} questions`,
        count: result.questionsGenerated || 0,
      });
      setIsEditing(false);
      fetchTargets();
      
      setAlert({ type: "success", message: result.message });
      setTimeout(() => { setAlert(null); setIngestionStatus({ status: "idle" }); }, 5000);
    } else {
      setIngestionStatus({ status: "error", message: result.error || "Failed to save target." });
    }
  }

  async function handleRefresh(targetId) {
    setRefreshingId(targetId);
    const result = await refreshTargetQuestionsAction(targetId);
    setRefreshingId("");

    if (result.success) {
      setAlert({ type: "success", message: result.message });
      setTimeout(() => setAlert(null), 4000);
      fetchTargets();
    } else {
      setAlert({ type: "error", message: result.error || "Failed to refresh questions." });
      setTimeout(() => setAlert(null), 4000);
    }
  }

  async function handleDelete(targetId) {
    if (!confirm("Delete this target and all its generated questions?")) return;

    setIsDeletingId(targetId);
    const result = await deleteTargetAction(targetId, true);
    setIsDeletingId("");

    if (result.success) {
      fetchTargets();
    } else {
      alert("Error deleting target: " + (result.error || "Unknown error"));
    }
  }

  return (
    <div className="space-y-6">
      
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Target size={18} className="text-purple-400" />
            Target Roles & Job Descriptions
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Add target roles to auto-generate company-specific interview questions on submission.
          </p>
        </div>
        
        <button
          onClick={handleAddClick}
          className="glow-btn cursor-pointer flex items-center justify-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl text-xs shadow-lg shadow-purple-600/10 leading-none transition-colors"
        >
          <Plus size={14} />
          Add Target Role
        </button>
      </div>

      {/* Ingestion Progress */}
      <IngestionProgress
        status={ingestionStatus.status}
        message={ingestionStatus.message}
        count={ingestionStatus.count}
      />

      {/* Alert */}
      {alert && (
        <div className={`p-3 rounded-xl text-xs border flex items-center gap-2 ${
          alert.type === "success"
            ? "bg-emerald-950/40 border-emerald-800/50 text-emerald-300"
            : "bg-rose-950/40 border-rose-800/50 text-rose-300"
        }`}>
          <Sparkles size={12} />
          {alert.message}
        </div>
      )}

      {/* Grid of Targets */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 size={32} className="text-purple-500 animate-spin" />
          <span className="text-sm text-zinc-400">Loading targets...</span>
        </div>
      ) : targets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {targets.map((t) => (
            <div 
              key={t.id}
              className="group relative glass-card rounded-xl p-5 border border-white/5 flex flex-col justify-between min-h-[180px] overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 shrink-0">
                    <Briefcase size={14} />
                  </div>
                  <h3 className="text-sm font-bold text-white tracking-tight truncate flex-1 leading-none">
                    {t.company || t.title}
                  </h3>
                </div>
                {t.role && (
                  <p className="text-[11px] text-zinc-400 ml-9 mb-2">{t.role}</p>
                )}
                <p className="text-xs text-zinc-400 line-clamp-3 leading-relaxed mb-3 whitespace-pre-wrap">
                  {t.content}
                </p>
              </div>

              {/* Question count badge */}
              {t.questionCount > 0 && (
                <div className="mb-3 flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20 flex items-center gap-1">
                    <Sparkles size={9} />
                    {t.questionCount} questions generated
                  </span>
                </div>
              )}

              <div className="border-t border-white/5 pt-3 flex items-center justify-end gap-2 shrink-0">
                <button
                  onClick={() => handleRefresh(t.id)}
                  disabled={refreshingId === t.id}
                  className="p-1.5 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 disabled:opacity-50 transition-colors cursor-pointer"
                  title="Generate more questions"
                >
                  {refreshingId === t.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <RefreshCw size={12} />
                  )}
                </button>
                <button
                  onClick={() => handleEditClick(t)}
                  className="p-1.5 rounded bg-white/5 hover:bg-white/10 hover:text-white transition-colors cursor-pointer text-zinc-400"
                  title="Edit target"
                >
                  <Edit2 size={12} />
                </button>
                <button
                  onClick={() => handleDelete(t.id)}
                  disabled={isDeletingId === t.id}
                  className="p-1.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 disabled:opacity-50 transition-colors cursor-pointer"
                  title="Delete target and its questions"
                >
                  {isDeletingId === t.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Trash2 size={12} />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center border border-dashed border-white/10 rounded-3xl py-20 text-center px-6">
          <div className="h-14 w-14 rounded-full bg-white/5 border border-white/5 flex items-center justify-center mb-4">
            <FileText size={24} className="text-zinc-600" />
          </div>
          <h3 className="text-base font-bold text-white mb-1.5">No Targets Configured</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed mb-5">
            Add a target role with a company name and job description. Questions will be automatically generated when you save.
          </p>
          <button
            onClick={handleAddClick}
            className="glow-btn cursor-pointer py-2 px-4 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-purple-600/10 transition-colors"
          >
            <Plus size={12} />
            Add Your First Target
          </button>
        </div>
      )}

      {/* Editor Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
            onClick={() => setIsEditing(false)}
          />
          
          <div className="relative z-10 w-full max-w-lg glass rounded-2xl border border-white/10 shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 overflow-hidden">
            
            <div className="p-5 border-b border-white/10 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-purple-400" />
                <h3 className="text-base font-bold text-white tracking-tight">
                  {editingTarget ? "Edit Target" : "Add Target Role"}
                </h3>
              </div>
              <button 
                onClick={() => setIsEditing(false)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-full hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex-1 flex flex-col min-h-0">
              
              <div className="p-5 space-y-4 overflow-y-auto flex-1">
                
                {/* Company */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Company</label>
                  <input
                    type="text"
                    required
                    value={formCompany}
                    onChange={(e) => setFormCompany(e.target.value)}
                    placeholder="e.g. Stripe, Google, Netflix"
                    className="w-full px-4 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                  />
                </div>

                {/* Role */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Role Title</label>
                  <input
                    type="text"
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    placeholder="e.g. Staff Full Stack Engineer"
                    className="w-full px-4 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                  />
                </div>

                {/* JD Content */}
                <div className="space-y-1.5 flex-1 flex flex-col min-h-[200px]">
                  <label className="text-xs font-semibold text-zinc-300">
                    Job Description / Requirements
                  </label>
                  <textarea
                    required
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    placeholder="Paste the full job description, tech stack requirements, or key responsibilities..."
                    className="flex-1 w-full p-4 bg-white/5 border border-white/10 rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all text-xs resize-none leading-relaxed min-h-[200px]"
                  />
                </div>

              </div>

              <div className="p-5 border-t border-white/10 bg-zinc-950/20 flex items-center justify-between gap-3 shrink-0">
                <p className="text-[10px] text-zinc-500 flex items-center gap-1">
                  <Sparkles size={10} className="text-purple-400" />
                  Questions will be auto-generated on save
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 border border-white/10 rounded-xl text-xs text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || !formCompany.trim() || !formContent.trim()}
                    className="glow-btn cursor-pointer flex items-center justify-center gap-1.5 px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl text-xs shadow-lg shadow-purple-600/10 leading-none transition-colors"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Save size={12} />
                        Save & Generate
                      </>
                    )}
                  </button>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}
