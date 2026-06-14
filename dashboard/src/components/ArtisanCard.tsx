"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { updateArtisanShift, getArtisanHistory } from "../app/actions";

export function ArtisanCard({ artisan, shifts }: { artisan: any, shifts: any[] }) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // History modal states
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyPunches, setHistoryPunches] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const shiftId = formData.get("shiftId") as string;
    
    await updateArtisanShift(artisan.id, shiftId);
    
    setIsSubmitting(false);
    setIsEditOpen(false);
  };

  const handleViewHistory = async () => {
    setIsHistoryOpen(true);
    setIsLoadingHistory(true);
    setHistoryError("");
    try {
      const result = await getArtisanHistory(artisan.id);
      if (result.success && result.punches) {
        setHistoryPunches(result.punches);
      } else {
        setHistoryError(result.error || "Failed to load punch history.");
      }
    } catch (err) {
      setHistoryError("An error occurred while loading history.");
    } finally {
      setIsLoadingHistory(false);
    }
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
          <button 
            onClick={handleViewHistory}
            className="flex-1 py-2 rounded-lg bg-surface-hover hover:bg-white/10 text-sm font-medium transition-colors"
          >
            History
          </button>
        </div>
      </div>

      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm text-left animate-in fade-in duration-200">
          <div className="bg-surface border border-white/10 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-white/5">
              <div>
                <h2 className="text-xl font-bold text-white">Attendance History</h2>
                <p className="text-xs text-foreground/50 mt-0.5">
                  Last 50 records for {artisan.firstName} {artisan.lastName}
                </p>
              </div>
              <button onClick={() => setIsHistoryOpen(false)} className="text-foreground/50 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 max-h-[350px] overflow-y-auto space-y-4">
              {isLoadingHistory ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
                  <p className="text-sm text-foreground/50">Fetching logs from database...</p>
                </div>
              ) : historyError ? (
                <p className="text-sm text-danger text-center py-4">{historyError}</p>
              ) : historyPunches.length === 0 ? (
                <p className="text-sm text-foreground/50 text-center py-8">No attendance punches found for this artisan.</p>
              ) : (
                <div className="space-y-3">
                  {historyPunches.map((punch) => {
                    const dateObj = new Date(punch.recordTime);
                    const dateString = dateObj.toLocaleDateString();
                    const timeString = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    const isCheckIn = punch.type === 0;
                    return (
                      <div key={punch.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold ${
                            isCheckIn ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'
                          }`}>
                            {isCheckIn ? 'IN' : 'OUT'}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">{timeString}</p>
                            <p className="text-xs text-foreground/45">{dateString} • {punch.type === 0 ? 'Check-In' : punch.type === 1 ? 'Check-Out' : `State ${punch.type}`}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] bg-white/5 text-foreground/60 px-2 py-1 rounded-md border border-white/5">
                            IP: {punch.ip}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-white/5 flex justify-end">
              <button 
                onClick={() => setIsHistoryOpen(false)}
                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white font-medium text-sm rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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
