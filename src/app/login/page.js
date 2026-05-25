"use client";

import { useState } from "react";
import { Lock, Loader2, ArrowRight, Sparkles } from "lucide-react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!password.trim() || isLoading) return;

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (data.success) {
        // Redirect to dashboard
        window.location.href = "/";
      } else {
        setError(data.error || "Incorrect password.");
        setShake(true);
        setTimeout(() => setShake(false), 600);
        setPassword("");
      }
    } catch {
      setError("Connection failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6 relative overflow-hidden">
      
      {/* Background blobs */}
      <div className="absolute top-[-15%] left-[-10%] w-[500px] h-[500px] bg-purple-900/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-indigo-900/10 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute top-[40%] left-[50%] w-[300px] h-[300px] bg-blue-900/10 rounded-full blur-[120px] pointer-events-none" />
      
      <div 
        className={`relative w-full max-w-sm transition-transform ${shake ? "animate-shake" : ""}`}
      >
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-2xl shadow-purple-600/30 border border-purple-400/20 mb-5">
            <span className="text-2xl font-black text-white italic tracking-tighter">PL</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight mb-1">
            PrepLoop
          </h1>
          <p className="text-xs text-zinc-500 flex items-center justify-center gap-1.5">
            <Sparkles size={11} className="text-purple-400" />
            Adaptive Interview Coach
          </p>
        </div>

        {/* Login Card */}
        <div className="glass rounded-2xl border border-white/10 shadow-2xl shadow-purple-950/20 overflow-hidden">
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
                  <Lock size={12} className="text-purple-400" />
                  Dashboard Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your passphrase"
                  autoFocus
                  required
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all font-mono"
                />
              </div>

              {/* Error message */}
              {error && (
                <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs flex items-center gap-2">
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !password.trim()}
                className="w-full cursor-pointer flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-600 text-white font-bold rounded-xl shadow-xl shadow-purple-600/10 text-sm transition-all duration-300"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    Unlock Dashboard
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="border-t border-white/5 px-6 py-3 bg-white/[0.02]">
            <p className="text-[10px] text-zinc-600 text-center">
              Secured with HMAC-SHA256 session authentication
            </p>
          </div>
        </div>
      </div>

      {/* Shake animation styles */}
      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
}
