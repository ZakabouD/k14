"use client";

import { useState } from "react";
import { AlertTriangle, X, Loader2, LogIn, LogOut } from "lucide-react";
import { resolveAnomaly, getPunchesForAnomaly } from "../app/actions";
import { formatDate } from "@/lib/utils";

export function AnomalyCard({ report }: { report: any }) {
  const [isResolveOpen, setIsResolveOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Punches modal states
  const [isPunchesOpen, setIsPunchesOpen] = useState(false);
  const [punches, setPunches] = useState<any[]>([]);
  const [isLoadingPunches, setIsLoadingPunches] = useState(false);
  const [punchesError, setPunchesError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const punchOutTime = formData.get("punchOutTime") as string;
    const punchInTime = formData.get("punchInTime") as string;
    
    await resolveAnomaly(report.id, punchOutTime, punchInTime);
    
    setIsSubmitting(false);
    setIsResolveOpen(false);
  };

  const handleViewPunches = async () => {
    setIsPunchesOpen(true);
    setIsLoadingPunches(true);
    setPunchesError("");
    try {
      const result = await getPunchesForAnomaly(report.id);
      if (result.success && result.punches) {
        setPunches(result.punches);
      } else {
        setPunchesError(result.error || "Failed to load punches.");
      }
    } catch (err) {
      setPunchesError("An error occurred while loading punches.");
    } finally {
      setIsLoadingPunches(false);
    }
  };

  const shiftStart = report.user?.shift?.startTime || "08:00";
  const shiftEnd = report.user?.shift?.endTime || "17:00";

  const defaultInTime = report.firstPunchIn
    ? new Date(report.firstPunchIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
    : shiftStart;

  const defaultOutTime = report.lastPunchOut
    ? new Date(report.lastPunchOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
    : shiftEnd;

  return (
    <>
      <div className="p-6 flex items-start sm:items-center flex-col sm:flex-row gap-4 hover:bg-surface-hover/30 transition-colors">
        <div className="w-12 h-12 rounded-full bg-danger/10 text-danger flex items-center justify-center flex-shrink-0">
          <AlertTriangle size={24} />
        </div>
        
        <div className="flex-1">
          <h3 className="text-lg font-bold text-foreground mb-1">
            {report.user.firstName} {report.user.lastName} <span className="text-sm font-normal text-foreground/50 ml-2">ID: {report.user.zktecoUserId}</span>
          </h3>
          <p className="text-sm text-danger/90">
            Pointage incomplet ou anomalie détectée pour le {formatDate(report.date)}. Durée de shift non valide ou pointage manquant.
          </p>
        </div>
        
        <div className="flex gap-3 w-full sm:w-auto mt-4 sm:mt-0">
          <button 
            onClick={handleViewPunches}
            className="flex-1 sm:flex-none px-4 py-2 bg-btn-sec-bg hover:bg-btn-sec-hover text-btn-sec-text text-sm font-medium rounded-lg transition-colors cursor-pointer"
          >
            Voir les pointages
          </button>
          <button 
            onClick={() => setIsResolveOpen(true)}
            className="flex-1 sm:flex-none px-4 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-bold rounded-lg transition-colors shadow-[0_0_15px_var(--primary-glow)] cursor-pointer"
          >
            Résoudre l'Anomalie
          </button>
        </div>
      </div>

      {isPunchesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm text-left animate-in fade-in duration-200">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-border">
              <div>
                <h2 className="text-xl font-bold text-foreground">Historique Brut ZKTeco</h2>
                <p className="text-xs text-foreground/50 mt-0.5">
                  {report.user.firstName} {report.user.lastName} le {formatDate(report.date)}
                </p>
              </div>
              <button onClick={() => setIsPunchesOpen(false)} className="text-foreground/50 hover:text-foreground transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 max-h-[350px] overflow-y-auto space-y-4">
              {isLoadingPunches ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
                  <p className="text-sm text-foreground/50">Récupération des pointages...</p>
                </div>
              ) : punchesError ? (
                <p className="text-sm text-danger text-center py-4">{punchesError}</p>
              ) : punches.length === 0 ? (
                <p className="text-sm text-foreground/50 text-center py-8">Aucun pointage brut enregistré pour ce jour.</p>
              ) : (
                <div className="space-y-3">
                  {punches.map((punch, index) => {
                    const timeString = new Date(punch.recordTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    const isAdminManual = punch.ip === "CORRECTION_ADMIN" || punch.ip === "ADMIN_MANUAL";
                    const isCheckIn = punch.type === 0 || punch.state === 0 || (index === 0 && punch.type !== 1);
                    return (
                      <div key={punch.id} className="flex items-center justify-between p-3 bg-btn-sec-bg rounded-xl border border-border">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold ${
                            isCheckIn ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}>
                            {isCheckIn ? 'IN' : 'OUT'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-foreground">{timeString}</p>
                              {isAdminManual && (
                                <span className="text-[10px] bg-primary/20 text-primary font-bold px-2 py-0.5 rounded-full border border-primary/30">
                                  Ajusté Admin ✏️
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-foreground/50 mt-0.5">
                              {isCheckIn ? 'Entrée' : 'Sortie'} <span className="text-[9px] text-foreground/40 font-mono">(ZK: {isAdminManual ? 'Correction Manuelle' : (punch.type === 0 ? 'Check-In' : 'Check-Out')})</span>
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] bg-background text-foreground/60 px-2 py-1 rounded-md border border-border font-mono">
                            {isAdminManual ? "Saisie Admin" : `IP: ${punch.ip}`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-border flex justify-end">
              <button 
                onClick={() => setIsPunchesOpen(false)}
                className="px-5 py-2.5 bg-btn-sec-bg hover:bg-btn-sec-hover text-btn-sec-text font-medium text-sm rounded-lg transition-colors cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {isResolveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm text-left">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-border">
              <div>
                <h2 className="text-xl font-bold text-foreground">Résoudre l'Anomalie</h2>
                <p className="text-xs text-foreground/50 mt-0.5">Ajustement des heures de pointage journalier</p>
              </div>
              <button onClick={() => setIsResolveOpen(false)} className="text-foreground/50 hover:text-foreground transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <p className="text-xs text-foreground/70">
                Ajustez l'heure d'entrée et/ou de sortie pour <strong className="text-foreground">{report.user.firstName} {report.user.lastName}</strong> le <strong className="text-foreground">{formatDate(report.date)}</strong>. Le système recalculera ses heures.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-btn-sec-bg/40 p-3.5 rounded-xl border border-border space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <LogIn className="w-3.5 h-3.5" /> Entrée (Check-In)
                  </label>
                  <input 
                    required 
                    name="punchInTime"
                    type="time" 
                    defaultValue={defaultInTime}
                    className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm font-bold text-foreground focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>

                <div className="bg-btn-sec-bg/40 p-3.5 rounded-xl border border-border space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <LogOut className="w-3.5 h-3.5" /> Sortie (Check-Out)
                  </label>
                  <input 
                    required 
                    name="punchOutTime"
                    type="time" 
                    defaultValue={defaultOutTime}
                    className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm font-bold text-foreground focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>

              <div className="bg-primary/10 border border-primary/20 rounded-xl p-3.5 text-xs text-foreground/70 space-y-1">
                <p className="font-bold text-primary flex items-center gap-1">
                  💡 Cas d'Oubli de Pointage à l'Entrée :
                </p>
                <p>Si l'employé a oublié de pointer le matin et a uniquement pointé le soir, ajustez l'heure d'entrée sur l'heure habituelle de son shift (ex: 08:00 ou 09:00) et validez.</p>
              </div>

              <div className="pt-2 flex justify-end gap-3 border-t border-border">
                <button 
                  type="button" 
                  onClick={() => setIsResolveOpen(false)}
                  className="px-4 py-2 rounded-xl font-medium text-xs text-foreground/70 hover:bg-btn-sec-hover transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-white text-xs font-bold py-2.5 px-5 rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-md"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Valider & Recalculer les Heures
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
