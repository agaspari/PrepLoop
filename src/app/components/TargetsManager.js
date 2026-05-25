"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, Briefcase, Save, X, FileText, Sparkles, Loader2, Target } from "lucide-react";
import { loadTargetsAction, saveTargetAction, deleteTargetAction } from "../actions";

export default function TargetsManager({ onTargetsChange }) {
  const [targets, setTargets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTarget, setEditingTarget] = useState(null); // { filename, title, content } or null
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingFilename, setIsDeletingFilename] = useState("");

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
    setFormTitle("");
    setFormContent("");
    setIsEditing(true);
  }

  function handleEditClick(target) {
    setEditingTarget(target);
    setFormTitle(target.title);
    setFormContent(target.content);
    setIsEditing(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!formTitle.trim() || !formContent.trim() || isSaving) return;

    setIsSaving(true);
    const filename = editingTarget ? editingTarget.filename : `${formTitle.toLowerCase().replace(/\s+/g, "-")}.md`;
    const result = await saveTargetAction(filename, formContent);
    setIsSaving(false);

    if (result.success) {
      setIsEditing(false);
      fetchTargets();
    } else {
      alert("Error saving target document: " + (result.error || "Unknown error"));
    }
  }

  async function handleDelete(filename) {
    if (!confirm("Are you sure you want to delete this target reference?")) return;

    setIsDeletingFilename(filename);
    const result = await deleteTargetAction(filename);
    setIsDeletingFilename("");

    if (result.success) {
      fetchTargets();
    } else {
      alert("Error deleting target document: " + (result.error || "Unknown error"));
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
            Configure 1-N reference roles, company constraints, or job specs. Gemini will synthesize these to tailor daily question decks.
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

      {/* Grid of Targets */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 size={32} className="text-purple-500 animate-spin" />
          <span className="text-sm text-zinc-400">Loading reference documents...</span>
        </div>
      ) : targets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {targets.map((t) => (
            <div 
              key={t.filename}
              className="group relative glass-card rounded-xl p-5 border border-white/5 flex flex-col justify-between min-h-[160px] overflow-hidden"
            >
              {/* Card background glow */}
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 shrink-0">
                    <Briefcase size={14} />
                  </div>
                  <h3 className="text-sm font-bold text-white tracking-tight truncate flex-1 leading-none">
                    {t.title}
                  </h3>
                </div>
                <p className="text-xs text-zinc-400 line-clamp-3 leading-relaxed mb-4 whitespace-pre-wrap">
                  {t.content}
                </p>
              </div>

              <div className="border-t border-white/5 pt-3 flex items-center justify-between text-[11px] font-mono text-zinc-500 shrink-0">
                <span className="truncate max-w-[50%]">#{t.filename}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEditClick(t)}
                    className="p-1.5 rounded bg-white/5 hover:bg-white/10 hover:text-white transition-colors cursor-pointer text-zinc-400"
                    title="Edit target info"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    onClick={() => handleDelete(t.filename)}
                    disabled={isDeletingFilename === t.filename}
                    className="p-1.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 disabled:opacity-50 transition-colors cursor-pointer"
                    title="Delete target"
                  >
                    {isDeletingFilename === t.filename ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Trash2 size={12} />
                    )}
                  </button>
                </div>
              </div>

            </div>
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="flex flex-col items-center justify-center border border-dashed border-white/10 rounded-3xl py-20 text-center px-6">
          <div className="h-14 w-14 rounded-full bg-white/5 border border-white/5 flex items-center justify-center mb-4">
            <FileText size={24} className="text-zinc-600" />
          </div>
          <h3 className="text-base font-bold text-white mb-1.5">No Targets Configured</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed mb-5">
            By default, questions are tailored to your main resume profile. Add specific job descriptions or target company specs to receive hyper-focused preparation questions.
          </p>
          <button
            onClick={handleAddClick}
            className="glow-btn cursor-pointer py-2 px-4 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-purple-600/10 transition-colors"
          >
            <Plus size={12} />
            Configure Your First Target
          </button>
        </div>
      )}

      {/* Editor Modal / Drawer */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
            onClick={() => setIsEditing(false)}
          />
          
          {/* Editor Container */}
          <div className="relative z-10 w-full max-w-lg glass rounded-2xl border border-white/10 shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 overflow-hidden">
            
            {/* Header */}
            <div className="p-5 border-b border-white/10 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-purple-400" />
                <h3 className="text-base font-bold text-white tracking-tight">
                  {editingTarget ? "Edit Target Reference" : "Create Target Reference"}
                </h3>
              </div>
              <button 
                onClick={() => setIsEditing(false)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-full hover:bg-white/5 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSave} className="flex-1 flex flex-col min-h-0">
              
              {/* Scrollable inputs wrapper */}
              <div className="p-5 space-y-4 overflow-y-auto flex-1">
                
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">
                    Role / Company / Document Title
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Staff Full Stack Engineer - Stripe"
                    disabled={!!editingTarget} // file renaming is disabled for simplicity, but content is editable
                    className="w-full px-4 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all font-sans disabled:opacity-50"
                  />
                  {editingTarget && (
                    <p className="text-[10px] text-zinc-500 font-mono">
                      File mapping is fixed at <code>{editingTarget.filename}</code>.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5 flex-1 flex flex-col min-h-[250px]">
                  <label className="text-xs font-semibold text-zinc-300">
                    Job Description / Notes Content
                  </label>
                  <textarea
                    required
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    placeholder="Paste the full job description, specific engineering stack requirements, target architecture outlines, scaling criteria, or core competencies to focus on..."
                    className="flex-1 w-full p-4 bg-white/5 border border-white/10 rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all text-xs font-sans resize-none leading-relaxed min-h-[200px]"
                  />
                </div>

              </div>

              {/* Actions Footer */}
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
                  disabled={isSaving || !formTitle.trim() || !formContent.trim()}
                  className="glow-btn cursor-pointer flex items-center justify-center gap-1.5 px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl text-xs shadow-lg shadow-purple-600/10 leading-none transition-colors"
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      Saving Reference...
                    </>
                  ) : (
                    <>
                      <Save size={12} />
                      Save Target
                    </>
                  )}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
