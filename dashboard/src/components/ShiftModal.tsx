"use client";

import { useState } from "react";
import { Clock, X, Loader2 } from "lucide-react";
import { createShift } from "../app/actions";

export function ShiftModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    await createShift(formData);
    setIsSubmitting(false);
    setIsOpen(false);
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="bg-primary hover:bg-primary/90 text-white font-medium py-2 px-4 rounded-xl shadow-[0_0_15px_var(--primary-glow)] transition-all flex items-center"
      >
        <Clock className="w-5 h-5 mr-2" />
        Create New Shift
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface border border-white/10 rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-white/5">
              <h2 className="text-xl font-bold text-white">Create New Shift</h2>
              <button onClick={() => setIsOpen(false)} className="text-foreground/50 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground/70 mb-1">Shift Name</label>
                <input 
                  required 
                  name="name"
                  type="text" 
                  placeholder="e.g. Standard 8-Hour"
                  className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground/70 mb-1">Start Time</label>
                  <input 
                    required 
                    name="startTime"
                    type="time" 
                    defaultValue="08:00"
                    className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground/70 mb-1">End Time</label>
                  <input 
                    required 
                    name="endTime"
                    type="time" 
                    defaultValue="17:00"
                    className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground/70 mb-1">Base Hours (Before Overtime)</label>
                <input 
                  required 
                  name="baseHours"
                  type="number" 
                  step="0.5"
                  defaultValue="8"
                  className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsOpen(false)}
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
                  Save Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
