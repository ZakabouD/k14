"use client";

import { useState } from "react";
import { Lock, Loader2 } from "lucide-react";
import { loginAdmin } from "../actions";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    
    const formData = new FormData(e.currentTarget);
    const result = await loginAdmin(formData);
    
    if (result.success) {
      window.location.href = "/";
    } else {
      setError(result.error || "Login failed");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center animate-in fade-in duration-500">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="glass-panel p-8 w-full max-w-md relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-4 shadow-[0_0_20px_var(--primary-glow)]">
            <span className="font-bold text-white text-2xl">Z</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">ZKTeco<span className="text-primary font-medium">Sync</span></h1>
          <p className="text-foreground/50 text-sm mt-1">Sign in to your workshop dashboard</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-foreground/70 mb-1">Email Address</label>
            <input 
              required
              name="email"
              type="email" 
              placeholder="e.g. admin@workshop.com"
              className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-foreground/70 mb-1">Password</label>
            <div className="relative">
              <input 
                required
                name="password"
                type="password" 
                placeholder="Enter password"
                className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:border-primary transition-colors"
              />
              <Lock className="w-4 h-4 text-foreground/50 absolute left-4 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div className="pt-2">
            <button 
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-medium py-3 rounded-lg shadow-[0_0_15px_var(--primary-glow)] transition-all flex items-center justify-center"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Secure Login"}
            </button>
          </div>
        </form>
      </div>
      
      <p className="absolute bottom-8 text-xs text-foreground/40 font-medium">
        &copy; 2026 Professional ZKTeco Architecture
      </p>
    </div>
  );
}
