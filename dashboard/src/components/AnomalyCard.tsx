"use client";

import { useState } from "react";
import { AlertTriangle, X, Loader2 } from "lucide-react";
import { resolveAnomaly } from "../app/actions";

export function AnomalyCard({ report }: { report: any }) {
  const [isResolveOpen, setIsResolveOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const time = formData.get("time") as string;
    
    await resolveAnomaly(report.id, time);
    
    setIsSubmitting(false);
    setIsResolveOpen(false);
  };

  return (
    <>
      <div className="p-6 flex items-start sm:items-center flex-col sm:flex-row gap-4 hover:bg-surface-hover/30 transition-colors">
        <div className="w-12 h-12 rounded-full bg-danger/10 text-danger flex items-center justify-center flex-shrink-0">
          <AlertTriangle size={24} />
        </div>
        
        <div className="flex-1">
          <h3 className="text-lg font-bold text-white mb-1">
            {report.user.firstName} {report.user.lastName} <span className="text-sm font-normal text-foreground/50 ml-2">ID: {report.user.zktecoUserId}</span>
          </h3>
          <p className="text-sm text-danger/90">
            Missing Punch-Out detected for {new Date(report.date).toLocaleDateString()}. The shift exceeded 16 hours or was never closed.
          </p>
        </div>
        
        <div className="flex gap-3 w-full sm:w-auto mt-4 sm:mt-0">
          <button className="flex-1 sm:flex-none px-4 py-2 bg-surface-hover hover:bg-white/10 text-white text-sm font-medium rounded-lg transition-colors">
            View Punches
          </button>
          <button 
            onClick={() => setIsResolveOpen(true)}
            className="flex-1 sm:flex-none px-4 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg transition-colors shadow-[0_0_15px_var(--primary-glow)]"
          >
            Resolve
          </button>
        </div>
      </div>

      {isResolveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm text-left">
          <div className="bg-surface border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-white/5">
              <h2 className="text-xl font-bold text-white">Resolve Anomaly</h2>
              <button onClick={() => setIsResolveOpen(false)} className="text-foreground/50 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <p className="text-sm text-foreground/70">
                Please enter the correct Punch-Out time for {report.user.firstName} on {new Date(report.date).toLocaleDateString()}. The system will recalculate their hours.
              </p>
              <div>
                <label className="block text-sm font-medium text-foreground/70 mb-1">Manual Punch-Out Time</label>
                <input 
                  required 
                  name="time"
                  type="time" 
                  defaultValue="17:00"
                  className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsResolveOpen(false)}
                  className="px-4 py-2 rounded-lg font-medium text-foreground/70 hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-medium py-2 px-6 rounded-lg transition-all flex items-center"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Resolve
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
