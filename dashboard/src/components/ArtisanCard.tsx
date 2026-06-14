"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { updateArtisanShift } from "../app/actions";

export function ArtisanCard({ artisan, shifts }: { artisan: any, shifts: any[] }) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const shiftId = formData.get("shiftId") as string;
    
    await updateArtisanShift(artisan.id, shiftId);
    
    setIsSubmitting(false);
    setIsEditOpen(false);
  };

  const assignedShift = shifts.find(s => s.id === artisan.shiftId);

  return (
    <>
      <div className="glass-panel p-6 flex flex-col items-center text-center relative group hover:border-primary/50 transition-colors">
        {artisan.isActive ? (
          <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-success shadow-[0_0_8px_var(--color-success)]" />
        ) : (
          <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-danger" />
        )}
        
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-surface to-surface-hover flex items-center justify-center text-3xl font-bold text-white mb-4 border border-white/5 shadow-inner">
          {artisan.firstName.charAt(0)}
        </div>
        
        <h3 className="text-lg font-bold text-white mb-1">{artisan.firstName} {artisan.lastName}</h3>
        <p className="text-sm text-foreground/50 mb-1">Device ID: {artisan.zktecoUserId}</p>
        
        {assignedShift ? (
          <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary border border-primary/20 mb-4">
            {assignedShift.name}
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-warning/10 text-warning border border-warning/20 mb-4">
            No Shift Assigned
          </span>
        )}
        
        <div className="mt-auto w-full pt-4 border-t border-white/5 flex gap-2">
          <button 
            onClick={() => setIsEditOpen(true)}
            className="flex-1 py-2 rounded-lg bg-surface-hover hover:bg-white/10 text-sm font-medium transition-colors"
          >
            Edit
          </button>
          <button className="flex-1 py-2 rounded-lg bg-surface-hover hover:bg-white/10 text-sm font-medium transition-colors">
            History
          </button>
        </div>
      </div>

      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm text-left">
          <div className="bg-surface border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-white/5">
              <h2 className="text-xl font-bold text-white">Edit Artisan</h2>
              <button onClick={() => setIsEditOpen(false)} className="text-foreground/50 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground/70 mb-1">Assign Shift</label>
                <select 
                  name="shiftId"
                  defaultValue={artisan.shiftId || ""}
                  className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary transition-colors appearance-none"
                >
                  <option value="">-- No Shift (Default Overtime) --</option>
                  {shifts.map(shift => (
                    <option key={shift.id} value={shift.id}>{shift.name} ({shift.baseHours} hrs)</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsEditOpen(false)}
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
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
