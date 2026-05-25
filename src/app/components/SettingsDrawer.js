"use client";

import { useState, useEffect } from "react";
import { X, Check, XCircle, Loader2, Folder, Key, Send, Shield, LogOut, Info } from "lucide-react";
import { getConfigAction } from "../actions";

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

  function handleLogout() {
    window.location.href = "/api/auth/logout";
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-md h-full glass shadow-2xl flex flex-col border-l border-white/10 animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">System Status</h2>
            <p className="text-xs text-zinc-400 mt-1">Read-only configuration overview</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-white/5 transition-colors"
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
                  All configuration is managed through environment variables. 
                  Update your <code className="text-indigo-300 bg-indigo-500/15 px-1 py-0.5 rounded text-[10px]">.env</code> file 
                  or platform settings to change these values.
                </span>
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
                icon={<Send size={16} />}
                label="Webhook Notifications"
                isActive={config.hasWebhook}
                activeText="Configured"
                inactiveText="Not configured — set WEBHOOK_URL (optional)"
              />

              <StatusItem
                icon={<Shield size={16} />}
                label="Cron Secret"
                isActive={config.hasCronSecret}
                activeText="Custom secret configured"
                inactiveText="Using default — set CRON_SECRET for production"
              />

              {/* Vault Path */}
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <Folder size={16} className="text-purple-400" />
                  <span className="text-sm font-semibold text-zinc-300">Vault Path</span>
                </div>
                <code className="text-xs text-zinc-400 font-mono break-all">
                  {config.vaultPath || "Not configured"}
                </code>
              </div>

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
