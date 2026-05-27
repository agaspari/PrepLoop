"use client";

import { useState, useEffect } from "react";
import { X, Check, XCircle, Loader2, Key, Shield, LogOut, Info, Database, BarChart3 } from "lucide-react";
import { getConfigAction, clearSessionAction } from "../actions";

export default function SettingsDrawer({ isOpen, onClose }) {
  const [config, setConfig] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  async function loadConfig() {
    setIsLoading(true);
    const result = await getConfigAction();
    setIsLoading(false);
    if (result.success) {
      setConfig(result);
    }
  }

  async function handleLogout() {
    await clearSessionAction();
    window.location.href = "/login";
  }

  if (!isOpen) return null;

  const sourceLabels = {
    "resume-ingestion": "Resume",
    "target-ingestion": "Target Roles",
    "topic-generated": "Topics",
    "custom": "Custom",
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-md h-full glass shadow-2xl flex flex-col border-l border-white/10 animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">System Status</h2>
            <p className="text-xs text-zinc-400 mt-1">Configuration & question bank stats</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading || !config ? (
            <div className="flex flex-col items-center justify-center h-48 space-y-3">
              <Loader2 size={32} className="text-purple-500 animate-spin" />
              <span className="text-sm text-zinc-400">Reading system status...</span>
            </div>
          ) : (
            <div className="space-y-5">

              {/* Info Banner */}
              <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/20 text-indigo-300 text-xs flex items-start gap-2.5">
                <Info size={14} className="shrink-0 mt-0.5 text-indigo-400" />
                <span className="leading-relaxed">
                  Configuration is managed through environment variables. 
                  Data is stored in Firebase Firestore.
                </span>
              </div>

              {/* Question Bank Stats */}
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 size={16} className="text-purple-400" />
                  <span className="text-sm font-semibold text-zinc-300">Question Bank</span>
                  <span className="text-lg font-black font-mono text-white ml-auto">{config.totalQuestions || 0}</span>
                </div>
                {config.questionsBySource && Object.keys(config.questionsBySource).length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(config.questionsBySource).map(([source, count]) => (
                      <div key={source} className="flex items-center justify-between px-3 py-1.5 bg-white/5 rounded-lg">
                        <span className="text-[10px] text-zinc-400">{sourceLabels[source] || source}</span>
                        <span className="text-xs font-bold font-mono text-zinc-300">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Status Items */}
              <StatusItem
                icon={<Key size={16} />}
                label="Gemini API Key"
                isActive={config.hasApiKey}
                activeText="Configured"
                inactiveText="Not configured — set GEMINI_API_KEY"
              />

              <StatusItem
                icon={<Database size={16} />}
                label="Firebase Firestore"
                isActive={true}
                activeText="Connected"
                inactiveText="Not configured"
              />

              <StatusItem
                icon={<Shield size={16} />}
                label="Authentication"
                isActive={true}
                activeText="Firebase Auth (Google)"
                inactiveText="Not configured"
              />

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-rose-500/20 bg-rose-950/20 hover:bg-rose-950/40 text-rose-400 hover:text-rose-300 font-semibold rounded-xl text-sm cursor-pointer transition-colors"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>

      </div>
    </div>
  );
}

function StatusItem({ icon, label, isActive, activeText, inactiveText }) {
  return (
    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`shrink-0 ${isActive ? "text-purple-400" : "text-zinc-600"}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-300">{label}</p>
          <p className="text-[11px] text-zinc-500 truncate">
            {isActive ? activeText : inactiveText}
          </p>
        </div>
      </div>
      <div className="shrink-0">
        {isActive ? (
          <div className="h-7 w-7 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
            <Check size={13} className="text-emerald-400" />
          </div>
        ) : (
          <div className="h-7 w-7 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center">
            <XCircle size={13} className="text-zinc-600" />
          </div>
        )}
      </div>
    </div>
  );
}
