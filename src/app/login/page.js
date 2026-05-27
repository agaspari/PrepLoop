"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../../lib/firebase";
import { setSessionAction } from "../actions";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGoogleSignIn() {
    if (isLoading) return;

    setIsLoading(true);
    setError("");

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();

      // Set the session cookie via server action
      const sessionResult = await setSessionAction(idToken);

      if (sessionResult.success) {
        window.location.href = "/";
      } else {
        setError(sessionResult.error || "Failed to create session.");
      }
    } catch (err) {
      console.error("Google sign-in error:", err);
      if (err.code === "auth/popup-closed-by-user") {
        setError("");
      } else if (err.code === "auth/unauthorized-domain") {
        setError("This domain is not authorized for sign-in. Add it to Firebase Console → Authentication → Settings → Authorized domains.");
      } else {
        setError(err.message || "Sign-in failed. Please try again.");
      }
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
      
      <div className="relative w-full max-w-sm">
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
          <div className="p-6 space-y-4">
            
            <div className="text-center mb-2">
              <h2 className="text-sm font-semibold text-zinc-300 mb-1">Welcome Back</h2>
              <p className="text-xs text-zinc-500">Sign in to access your interview prep dashboard</p>
            </div>

            {/* Google Sign-In Button */}
            <button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full cursor-pointer flex items-center justify-center gap-3 py-3.5 px-4 bg-white hover:bg-zinc-100 disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-900 font-semibold rounded-xl shadow-lg text-sm transition-all duration-200"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin text-zinc-500" />
                  <span className="text-zinc-500">Signing in...</span>
                </>
              ) : (
                <>
                  {/* Google icon */}
                  <svg width="18" height="18" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  </svg>
                  Continue with Google
                </>
              )}
            </button>

            {/* Error message */}
            {error && (
              <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs">
                {error}
              </div>
            )}
          </div>

          <div className="border-t border-white/5 px-6 py-3 bg-white/[0.02]">
            <p className="text-[10px] text-zinc-600 text-center">
              Secured with Firebase Authentication
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
