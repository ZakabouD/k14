"use client";

import { useState } from "react";
import { X, Loader2, Calendar, UserMinus, UserCheck, Palmtree, TrendingUp } from "lucide-react";
import { updateEmployeeProfile, getEmployeeStats, getArtisanHistory } from "../app/actions";
import { formatDate } from "@/lib/utils";

export function ArtisanCard({ 
  artisan, 
  shifts, 
  contractTypesList = [], 
  maritalStatusesList = [],
  canViewSalaries = true
}: { 
  artisan: any, 
  shifts: any[], 
  contractTypesList?: any[], 
  maritalStatusesList?: any[],
  canViewSalaries?: boolean
}) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // History modal states
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyPunches, setHistoryPunches] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState("");

  // Stats modal states
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState("");
  const [statsStartDate, setStatsStartDate] = useState("");
  const [statsEndDate, setStatsEndDate] = useState("");

  // Edit form states for status, dates, and live wage calculator
  const [statusMode, setStatusMode] = useState<"ACTIVE" | "ARCHIVED">(artisan.isActive ? "ACTIVE" : "ARCHIVED");
  const [exitDateStr, setExitDateStr] = useState<string>(
    artisan.exitDate ? new Date(artisan.exitDate).toISOString().split("T")[0] : ""
  );
  const [exitReason, setExitReason] = useState<string>(artisan.exitReason || "Démission");

  const [monthlySalary, setMonthlySalary] = useState(artisan.monthlySalary ?? 0);
  const [hourlyRate, setHourlyRate] = useState(artisan.hourlyRate ?? 0);
  const [paymentFrequency, setPaymentFrequency] = useState(artisan.paymentFrequency || "MONTHLY");
  const [selectedShiftId, setSelectedShiftId] = useState(artisan.shiftId || "");
  const [maritalStatus, setMaritalStatus] = useState(artisan.maritalStatus || "");
  const [childrenCount, setChildrenCount] = useState(artisan.childrenCount ?? 0);

  const selectedShift = shifts.find(s => s.id === selectedShiftId);
  const shiftHours = selectedShift ? selectedShift.baseHours : 8.0;

  const getAverageHours = (freq: string, shiftIdStr: string) => {
    const shift = shifts.find(s => s.id === shiftIdStr);
    const hours = shift ? shift.baseHours : 8.0;
    if (freq === "WEEKLY") {
      return hours * 5.5;
    } else {
      return Math.round((hours * 5.5 * 52) / 12);
    }
  };

  const handleSalaryChange = (val: number, freq: string = paymentFrequency, sId: string = selectedShiftId) => {
    setMonthlySalary(val);
    const avgHours = getAverageHours(freq, sId);
    if (avgHours > 0) {
      const calculatedRate = Number((val / avgHours).toFixed(2));
      setHourlyRate(calculatedRate);
    }
  };

  const handleFrequencyChange = (freq: string) => {
    setPaymentFrequency(freq);
    handleSalaryChange(monthlySalary, freq, selectedShiftId);
  };

  const handleShiftChange = (shiftId: string) => {
    setSelectedShiftId(shiftId);
    handleSalaryChange(monthlySalary, paymentFrequency, shiftId);
  };

  const handleMaritalStatusChange = (status: string) => {
    setMaritalStatus(status);
    const config = maritalStatusesList.find(s => s.name === status);
    const allowChildren = config ? config.allowChildren : true;
    if (!allowChildren) {
      setChildrenCount(0);
    }
  };

  const handleEditClick = () => {
    setStatusMode(artisan.isActive ? "ACTIVE" : "ARCHIVED");
    setExitDateStr(artisan.exitDate ? new Date(artisan.exitDate).toISOString().split("T")[0] : "");
    setExitReason(artisan.exitReason || "Démission");
    setMonthlySalary(artisan.monthlySalary ?? 0);
    setHourlyRate(artisan.hourlyRate ?? 0);
    setPaymentFrequency(artisan.paymentFrequency || "MONTHLY");
    setSelectedShiftId(artisan.shiftId || "");
    setMaritalStatus(artisan.maritalStatus || "");
    setChildrenCount(artisan.childrenCount ?? 0);
    setIsEditOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    formData.append("statusMode", statusMode);
    formData.append("exitDate", exitDateStr);
    formData.append("exitReason", exitReason);

    try {
      const res = await updateEmployeeProfile(formData);
      if (res.success) {
        setIsEditOpen(false);
      } else {
        alert(res.error || "Erreur de mise à jour du profil.");
      }
    } catch (err) {
      alert("Une erreur inattendue est survenue.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewHistory = async () => {
    setIsHistoryOpen(true);
    setIsLoadingHistory(true);
    setHistoryError("");

    try {
      const res = await getArtisanHistory(artisan.id);
      if (res.success && res.punches) {
        setHistoryPunches(res.punches);
      } else {
        setHistoryError(res.error || "Impossible de récupérer l'historique des pointages.");
      }
    } catch (err) {
      setHistoryError("Erreur de connexion au serveur.");
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleOpenStats = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);

    const formatLocal = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const startStr = formatLocal(firstDay);
    const endStr = formatLocal(now);

    setStatsStartDate(startStr);
    setStatsEndDate(endStr);
    setIsStatsOpen(true);
    loadStats(artisan.id, startStr, endStr);
  };

  const loadStats = async (id: string, start: string, end: string) => {
    setIsLoadingStats(true);
    setStatsError("");
    try {
      const res = await getEmployeeStats(id, start, end);
      if (res.success && res.stats) {
        setStats(res.stats);
      } else {
        setStatsError(res.error || "Erreur de chargement des statistiques.");
      }
    } catch (err) {
      setStatsError("Une erreur est survenue lors de la récupération des données.");
    } finally {
      setIsLoadingStats(false);
    }
  };

  const assignedShift = shifts.find(s => s.id === artisan.shiftId);
  const isArchived = !artisan.isActive || Boolean(artisan.exitDate);

  return (
    <>
      <div className={`glass-panel p-6 flex flex-col items-center text-center relative group hover:border-primary/50 transition-colors ${
        isArchived ? "opacity-80 bg-surface-hover/30 border-rose-500/30" : ""
      }`}>
        {artisan.isActive ? (
          <div className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_var(--color-success)]" title="Artisan Actif" />
        ) : (
          <div className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_var(--color-danger)]" title="Artisan Archivé / Démission" />
        )}
        
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-surface to-surface-hover flex items-center justify-center text-3xl font-bold text-foreground mb-3 border border-border shadow-inner relative">
          {artisan.firstName.charAt(0)}
          {isArchived && (
            <span className="absolute -bottom-1 -right-1 bg-rose-600 text-white text-[10px] p-1 rounded-full border-2 border-background">
              <UserMinus className="w-3 h-3" />
            </span>
          )}
        </div>
        
        <h3 className="text-lg font-bold text-foreground mb-0.5">{artisan.firstName} {artisan.lastName}</h3>
        <p className="text-xs text-foreground/50 mb-2">Device ID: {artisan.zktecoUserId}</p>
        
        {/* Status Badges */}
        <div className="mb-4 flex flex-col items-center gap-1">
          {isArchived ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-rose-500/15 text-rose-600 border border-rose-500/30">
              🔴 Départs / Archivé {artisan.exitDate ? `(${formatDate(artisan.exitDate)})` : ""}
            </span>
          ) : artisan.isExempt ? (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-600 border border-amber-500/30">
              👑 Direction / Exonéré
            </span>
          ) : assignedShift ? (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
              {assignedShift.name}
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-warning/10 text-warning border border-warning/20">
              Aucun Shift Assigné
            </span>
          )}

          {artisan.exitReason && (
            <span className="text-[10px] text-foreground/60 italic font-semibold">
              Motif: {artisan.exitReason}
            </span>
          )}
        </div>
        
        <div className="mt-auto w-full pt-4 border-t border-border flex flex-col gap-2">
          <div className="flex gap-2">
            <button 
              onClick={handleEditClick}
              className="flex-1 py-2 rounded-lg bg-btn-sec-bg hover:bg-btn-sec-hover text-btn-sec-text text-sm font-medium transition-colors border border-border cursor-pointer"
            >
              Modifier
            </button>
            <button 
              onClick={handleViewHistory}
              className="flex-1 py-2 rounded-lg bg-btn-sec-bg hover:bg-btn-sec-hover text-btn-sec-text text-sm font-medium transition-colors border border-border cursor-pointer"
            >
              Historique
            </button>
          </div>
          <button 
            onClick={handleOpenStats}
            className="w-full py-2 rounded-lg bg-primary hover:bg-primary/95 text-white text-sm font-medium transition-colors shadow-sm cursor-pointer"
          >
            Détails & Statistiques
          </button>
        </div>
      </div>

      {/* HISTORY MODAL */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm text-left animate-in fade-in duration-200">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center p-6 border-b border-border">
              <div>
                <h2 className="text-xl font-bold text-foreground">Historique des Pointages (ZKTeco)</h2>
                <p className="text-xs text-foreground/50 mt-0.5">
                  Pointages enregistrés pour {artisan.firstName} {artisan.lastName} (ID: {artisan.zktecoUserId})
                </p>
              </div>
              <button onClick={() => setIsHistoryOpen(false)} className="text-foreground/50 hover:text-foreground transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {isLoadingHistory ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
                  <p className="text-sm text-foreground/50">Récupération des pointages...</p>
                </div>
              ) : historyError ? (
                <p className="text-sm text-danger text-center py-4">{historyError}</p>
              ) : historyPunches.length === 0 ? (
                <p className="text-sm text-foreground/50 text-center py-8">Aucun pointage trouvé pour cet employé.</p>
              ) : (
                <div className="space-y-4">
                  {(() => {
                    const groups: { [key: string]: typeof historyPunches } = {};
                    historyPunches.forEach((punch) => {
                      const d = new Date(punch.recordTime);
                      const dateStr = d.toLocaleDateString('fr-FR', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      });
                      if (!groups[dateStr]) {
                        groups[dateStr] = [];
                      }
                      groups[dateStr].push(punch);
                    });

                    Object.keys(groups).forEach((key) => {
                      groups[key].sort((a, b) => new Date(a.recordTime).getTime() - new Date(b.recordTime).getTime());
                    });

                    const sortedDays = Object.keys(groups).sort((a, b) => {
                      const timeA = new Date(groups[a][0].recordTime).getTime();
                      const timeB = new Date(groups[b][0].recordTime).getTime();
                      return timeB - timeA;
                    });

                    return sortedDays.map((dayStr) => (
                      <div key={dayStr} className="space-y-2 border-b border-border/40 pb-3 last:border-0 last:pb-0">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-foreground/60 mb-2 mt-2">{dayStr}</h4>
                        <div className="space-y-1.5">
                          {groups[dayStr].map((punch, index) => {
                            const dateObj = new Date(punch.recordTime);
                            const timeString = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                            const isCheckIn = index % 2 === 0;
                            return (
                              <div key={punch.id} className="flex items-center justify-between p-2.5 bg-background/50 rounded-xl border border-border/60 hover:border-primary/30 transition-colors">
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold ${
                                    isCheckIn ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10' : 'bg-amber-500/10 text-amber-400 border border-amber-500/10'
                                  }`}>
                                    {isCheckIn ? 'IN' : 'OUT'}
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-foreground">{timeString}</p>
                                    <p className="text-[10px] text-foreground/40 mt-0.5">
                                      {isCheckIn ? 'Entrée' : 'Sortie'} <span className="text-[9px] text-foreground/30 font-normal">(Brut ZK: {punch.type === 0 ? 'Check-In' : 'Check-Out'})</span>
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="text-[9px] bg-surface text-foreground/50 px-2 py-0.5 rounded border border-border">
                                    IP: {punch.ip}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-border flex justify-end">
              <button 
                onClick={() => setIsHistoryOpen(false)}
                className="px-5 py-2.5 bg-btn-sec-bg hover:bg-btn-sec-hover text-btn-sec-text font-medium text-sm rounded-lg transition-colors cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STATS & DETAILS MODAL WITH DAILY GRAPH */}
      {isStatsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm text-left animate-in fade-in duration-200">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-3xl shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b border-border">
              <div>
                <h2 className="text-xl font-bold text-foreground">Fiche Individuelle & Statistiques</h2>
                <p className="text-xs text-foreground/50 mt-0.5">
                  Calculs financiers, présence et détails pour {artisan.firstName} {artisan.lastName} (Device ID: {artisan.zktecoUserId})
                </p>
              </div>
              <button onClick={() => setIsStatsOpen(false)} className="text-foreground/50 hover:text-foreground transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Date Range Selector Bar inside Modal */}
            <div className="p-4 bg-surface-hover/40 border-b border-border flex flex-col sm:flex-row gap-3 items-end justify-between">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div>
                  <label className="block text-[10px] font-bold text-foreground/60 uppercase tracking-wider mb-1">Du</label>
                  <input
                    type="date"
                    value={statsStartDate}
                    onChange={(e) => setStatsStartDate(e.target.value)}
                    className="bg-background border border-border rounded-xl px-3 py-1.5 text-xs text-foreground font-bold focus:outline-none focus:border-primary cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-foreground/60 uppercase tracking-wider mb-1">Au</label>
                  <input
                    type="date"
                    value={statsEndDate}
                    onChange={(e) => setStatsEndDate(e.target.value)}
                    className="bg-background border border-border rounded-xl px-3 py-1.5 text-xs text-foreground font-bold focus:outline-none focus:border-primary cursor-pointer"
                  />
                </div>
              </div>

              <button
                onClick={() => loadStats(artisan.id, statsStartDate, statsEndDate)}
                disabled={isLoadingStats}
                className="bg-primary hover:bg-primary/90 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 w-full sm:w-auto justify-center"
              >
                {isLoadingStats ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Actualiser la Période"}
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {isLoadingStats ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
                  <p className="text-sm font-semibold text-foreground/50">Calcul des statistiques financières et graphiques...</p>
                </div>
              ) : statsError ? (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-xl text-sm font-bold text-center">
                  {statsError}
                </div>
              ) : stats ? (
                <>
                  {/* Attendance Summary */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                      <span className="text-xs font-bold text-emerald-600 block uppercase tracking-wider">Jours Travaillés</span>
                      <span className="text-2xl font-black text-emerald-600">{stats.attendance.daysWorked} jrs</span>
                    </div>
                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 text-center">
                      <span className="text-xs font-bold text-purple-600 block uppercase tracking-wider">Jours en Congé</span>
                      <span className="text-2xl font-black text-purple-600">{stats.attendance.daysLeave} jrs</span>
                    </div>
                    <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-center">
                      <span className="text-xs font-bold text-rose-600 block uppercase tracking-wider">Jours Absents</span>
                      <span className="text-2xl font-black text-rose-600">{stats.attendance.daysAbsent} jrs</span>
                    </div>
                  </div>

                  {/* DAILY HOURS & COST GRAPH SECTION */}
                  {stats.dailyBreakdown && stats.dailyBreakdown.length > 0 && (
                    <div className="bg-background border border-border rounded-xl p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <div>
                          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5 text-primary" /> Évolution Journalière (Heures & Coût par Jour)
                          </h3>
                          <p className="text-[11px] text-foreground/50">Graphique individuel des heures effectuées et du coût pour chaque jour.</p>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] font-bold text-foreground/60">
                          <span className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-sm bg-primary" /> Travail (Heures/Coût)
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-sm bg-border/40" /> Repos / Absence
                          </span>
                        </div>
                      </div>

                      {/* Bar Chart Track */}
                      {(() => {
                        const maxDailyCost = Math.max(...stats.dailyBreakdown.map((d: any) => d.cost), 1);

                        return (
                          <div className="pt-20 pb-2 h-64 flex items-end justify-between gap-1 overflow-x-auto relative">
                            {stats.dailyBreakdown.map((d: any, idx: number) => {
                              const hasWork = d.totalHours > 0 || d.cost > 0;
                              const heightPct = maxDailyCost > 0 && d.cost > 0 
                                ? Math.max(12, Math.round((d.cost / maxDailyCost) * 100)) 
                                : (hasWork ? 12 : 4);

                              return (
                                <div key={idx} className="flex-1 min-w-[28px] h-full flex flex-col items-center justify-end gap-1.5 group relative">
                                  
                                  {/* Rich Popover Tooltip on Hover - High contrast styling */}
                                  <div className="absolute -top-20 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center bg-slate-900 text-white text-[11px] font-bold py-2.5 px-3.5 rounded-xl shadow-2xl z-50 whitespace-nowrap pointer-events-none border border-slate-700 space-y-0.5">
                                    <span className="text-slate-300">📅 Date: {d.fullDate} ({d.dayName})</span>
                                    <span className="text-blue-400 font-black">⏱️ Total Heures: {d.totalHours} h ({d.regHours}h norm.)</span>
                                    {canViewSalaries && (
                                      <span className="text-emerald-400 font-extrabold">💰 Coût Jour: {d.cost.toLocaleString("fr-FR")} DH</span>
                                    )}
                                    {d.firstPunchStr ? (
                                      <span className="text-amber-300 font-bold">⏰ Pointage: {d.firstPunchStr} {d.lastPunchStr ? `➔ ${d.lastPunchStr}` : ""}</span>
                                    ) : (
                                      <span className="text-rose-400 font-bold">⚠️ Pas de pointage ({d.status})</span>
                                    )}
                                  </div>

                                  {/* Top Value Label */}
                                  {d.totalHours > 0 && (
                                    <span className="text-[9px] font-extrabold text-primary truncate max-w-full">
                                      {d.totalHours}h
                                    </span>
                                  )}

                                  {/* Bar Track */}
                                  <div className="w-full h-36 bg-surface-hover/60 border border-border/40 rounded-t-xl relative flex items-end overflow-hidden p-0.5">
                                    <div
                                      className={`w-full rounded-t-lg transition-all duration-300 ${
                                        d.cost > 0
                                          ? "bg-primary group-hover:bg-primary/80 shadow-sm"
                                          : hasWork
                                          ? "bg-blue-400/50"
                                          : "bg-border/30"
                                      }`}
                                      style={{ height: `${heightPct}%` }}
                                    />
                                  </div>

                                  {/* Date Label */}
                                  <span className={`text-[10px] font-bold truncate w-full text-center ${d.cost > 0 ? "text-primary font-black" : "text-foreground/50"}`}>
                                    {d.dayNumStr || d.label}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Hours Breakdown */}
                  <div className="bg-background border border-border rounded-xl p-4 space-y-3">
                    <h3 className="text-xs font-bold text-foreground/60 uppercase tracking-wider">Cumul des Heures Effectuées</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                      <div className="bg-surface p-2.5 rounded-lg border border-border">
                        <span className="text-[10px] text-foreground/50 font-bold block">Normales</span>
                        <span className="text-base font-bold text-foreground">{stats.hours.regular.toFixed(2)} h</span>
                      </div>
                      <div className="bg-surface p-2.5 rounded-lg border border-border">
                        <span className="text-[10px] text-amber-500 font-bold block">Overtime 150%</span>
                        <span className="text-base font-bold text-amber-500">{stats.hours.overtime150.toFixed(2)} h</span>
                      </div>
                      <div className="bg-surface p-2.5 rounded-lg border border-border">
                        <span className="text-[10px] text-purple-500 font-bold block">Overtime 200%</span>
                        <span className="text-base font-bold text-purple-500">{stats.hours.overtime200.toFixed(2)} h</span>
                      </div>
                      <div className="bg-primary/10 p-2.5 rounded-lg border border-primary/20">
                        <span className="text-[10px] text-primary font-bold block">Total Heures</span>
                        <span className="text-base font-black text-primary">{stats.hours.total.toFixed(2)} h</span>
                      </div>
                    </div>
                  </div>

                  {/* Financials & Wages (If canViewSalaries) */}
                  {canViewSalaries && stats.financials && (
                    <div className="bg-background border border-border rounded-xl p-4 space-y-3">
                      <h3 className="text-xs font-bold text-foreground/60 uppercase tracking-wider">Rémunération & Net à Payer Estimé</h3>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between py-1.5 border-b border-border/50">
                          <span className="text-foreground/70 font-semibold">Taux Horaire de Base :</span>
                          <span className="font-bold text-foreground">{stats.personal.hourlyRate} DH/h</span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-border/50">
                          <span className="text-foreground/70 font-semibold">Salaire de Base ({stats.hours.regular.toFixed(2)}h) :</span>
                          <span className="font-bold text-foreground">{stats.financials.baseWages.toFixed(2)} DH</span>
                        </div>
                        {stats.hours.overtime150 > 0 && (
                          <div className="flex justify-between py-1.5 border-b border-border/50 text-amber-500">
                            <span className="font-semibold">Majorations 150% ({stats.hours.overtime150.toFixed(2)}h) :</span>
                            <span className="font-bold">+{stats.financials.overtime150Wages.toFixed(2)} DH</span>
                          </div>
                        )}
                        {stats.hours.overtime200 > 0 && (
                          <div className="flex justify-between py-1.5 border-b border-border/50 text-purple-500">
                            <span className="font-semibold">Majorations 200% ({stats.hours.overtime200.toFixed(2)}h) :</span>
                            <span className="font-bold">+{stats.financials.overtime200Wages.toFixed(2)} DH</span>
                          </div>
                        )}
                        <div className="flex justify-between pt-2 text-sm font-black text-primary">
                          <span>Total Net Estimé Période :</span>
                          <span className="text-lg">{stats.financials.totalPayout.toFixed(2)} DH</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Personal & Contract Info */}
                  <div className="bg-background border border-border rounded-xl p-4 space-y-3">
                    <h3 className="text-xs font-bold text-foreground/60 uppercase tracking-wider">Informations Personnelles & Contrat</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-foreground/50 block font-semibold">Shift Assigné</span>
                        <span className="font-bold text-foreground">{stats.personal.shiftName}</span>
                      </div>
                      <div>
                        <span className="text-foreground/50 block font-semibold">Type de Contrat</span>
                        <span className="font-bold text-foreground">{stats.personal.contractType || "Standard"}</span>
                      </div>
                      <div>
                        <span className="text-foreground/50 block font-semibold">Date d'embauche</span>
                        <span className="font-bold text-foreground">{stats.personal.hireDate || "Non spécifiée"}</span>
                      </div>
                      <div>
                        <span className="text-foreground/50 block font-semibold">CIN</span>
                        <span className="font-bold text-foreground">{stats.personal.cin || "-"}</span>
                      </div>
                      <div>
                        <span className="text-foreground/50 block font-semibold">CNSS</span>
                        <span className="font-bold text-foreground">{stats.personal.cnss || "-"}</span>
                      </div>
                      <div>
                        <span className="text-foreground/50 block font-semibold">Téléphone</span>
                        <span className="font-bold text-foreground">{stats.personal.phone || "-"}</span>
                      </div>
                      <div>
                        <span className="text-foreground/50 block font-semibold">Banque</span>
                        <span className="font-bold text-foreground">{stats.personal.bankName || "-"}</span>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-foreground/50 block font-semibold">RIB</span>
                        <span className="font-mono font-bold text-foreground tracking-wider text-[11px]">{stats.personal.rib || "-"}</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-border flex justify-end">
              <button
                onClick={() => setIsStatsOpen(false)}
                className="px-5 py-2.5 bg-btn-sec-bg hover:bg-btn-sec-hover text-btn-sec-text font-medium text-sm rounded-lg transition-colors cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm text-left animate-in fade-in duration-200">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-border">
              <h2 className="text-xl font-bold text-foreground">Modifier l'Employé</h2>
              <button onClick={() => setIsEditOpen(false)} className="text-foreground/50 hover:text-foreground transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              <input type="hidden" name="userId" value={artisan.id} />

              {/* Section 1: Administration & Status */}
              <div className="bg-btn-sec-bg/25 border border-border p-4 rounded-xl space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground/50">Administration & Shift</h3>
                
                {/* Exempt Checkbox */}
                <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    id={`isExempt-${artisan.id}`} 
                    name="isExempt" 
                    defaultChecked={artisan.isExempt}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 border-border bg-background cursor-pointer"
                  />
                  <label htmlFor={`isExempt-${artisan.id}`} className="text-xs font-bold text-amber-400 cursor-pointer select-none">
                    👑 Direction / Propriétaire (Exonéré du pointage)
                  </label>
                </div>

                {/* EMPLOYEE STATUS MANAGEMENT (Active vs Exit/Demission) */}
                <div className="bg-surface border border-border p-3.5 rounded-xl space-y-3">
                  <label className="block text-xs font-bold text-foreground/80 uppercase tracking-wider">
                    Statut de l'Artisan dans l'Entreprise
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setStatusMode("ACTIVE")}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        statusMode === "ACTIVE"
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "bg-surface border border-border text-foreground/70 hover:bg-surface-hover"
                      }`}
                    >
                      <UserCheck className="w-4 h-4" /> 🟢 Actif (En Poste)
                    </button>

                    <button
                      type="button"
                      onClick={() => setStatusMode("ARCHIVED")}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        statusMode === "ARCHIVED"
                          ? "bg-rose-600 text-white shadow-sm"
                          : "bg-surface border border-border text-foreground/70 hover:bg-surface-hover"
                      }`}
                    >
                      <UserMinus className="w-4 h-4" /> 🔴 Démission / Départ
                    </button>
                  </div>

                  {/* EXIT DATE & REASON (IF ARCHIVED OR SET) */}
                  {(statusMode === "ARCHIVED" || exitDateStr) && (
                    <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in duration-200">
                      <div>
                        <label className="block text-xs font-bold text-rose-500 mb-1">
                          Date de Sortie / Démission *
                        </label>
                        <input
                          type="date"
                          name="exitDate"
                          value={exitDateStr}
                          onChange={(e) => setExitDateStr(e.target.value)}
                          className="w-full bg-background border border-rose-500/40 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-rose-500 font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-foreground/70 mb-1">
                          Motif du Départ
                        </label>
                        <select
                          name="exitReason"
                          value={exitReason}
                          onChange={(e) => setExitReason(e.target.value)}
                          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary appearance-none cursor-pointer"
                        >
                          <option value="Démission">Démission</option>
                          <option value="Fin de contrat">Fin de contrat</option>
                          <option value="Licenciement">Licenciement</option>
                          <option value="Abandon de poste">Abandon de poste</option>
                          <option value="Autre">Autre</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-foreground/70 mb-1">Assigner un Shift de Travail</label>
                    <select 
                      name="shiftId"
                      value={selectedShiftId}
                      onChange={(e) => handleShiftChange(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary appearance-none cursor-pointer"
                    >
                      <option value="">-- Aucun Shift (Heures Sup. Par Défaut) --</option>
                      {shifts.map(shift => (
                        <option key={shift.id} value={shift.id}>{shift.name} ({shift.baseHours} hrs)</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground/70 mb-1">Type de Contrat</label>
                    <select
                      name="contractType"
                      defaultValue={artisan.contractType || ""}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary appearance-none cursor-pointer"
                    >
                      <option value="">-- Sélectionner --</option>
                      {contractTypesList.map(type => (
                        <option key={type.name} value={type.name}>{type.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground/70 mb-1">Date d'embauche</label>
                    <input 
                      name="hireDate"
                      type="date"
                      defaultValue={artisan.hireDate ? new Date(artisan.hireDate).toISOString().split("T")[0] : ""}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Rémunération */}
              {canViewSalaries ? (
                <div className="bg-btn-sec-bg/25 border border-border p-4 rounded-xl space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground/50">Rémunération & Coûts</h3>
                    <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20 font-medium">
                      Base : {getAverageHours(paymentFrequency, selectedShiftId)}h/{paymentFrequency === "WEEKLY" ? "semaine" : "mois"} (Samedi 1/2 journée)
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-foreground/70 mb-1">Fréquence de Paie</label>
                      <select 
                        name="paymentFrequency"
                        value={paymentFrequency}
                        onChange={(e) => handleFrequencyChange(e.target.value)}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                      >
                        <option value="MONTHLY">Mensuelle (par mois)</option>
                        <option value="WEEKLY">Hebdomadaire (par semaine)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground/70 mb-1">
                        {paymentFrequency === "WEEKLY" ? "Salaire Hebdomadaire (DH)" : "Salaire Mensuel Estimé (DH)"}
                      </label>
                      <input 
                        name="monthlySalary"
                        type="number"
                        step="0.01"
                        value={monthlySalary}
                        onChange={(e) => handleSalaryChange(parseFloat(e.target.value) || 0, paymentFrequency, selectedShiftId)}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                        placeholder={paymentFrequency === "WEEKLY" ? "Ex: 1500" : "Ex: 6000"}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground/70 mb-1">Taux Horaire (DH/heure)</label>
                      <input 
                        required 
                        name="hourlyRate"
                        type="number"
                        step="0.01"
                        value={hourlyRate}
                        onChange={(e) => setHourlyRate(parseFloat(e.target.value) || 0)}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary font-bold text-primary"
                        placeholder="Ex: 34.09"
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Section 3: Coordonnées Bancaires */}
              <div className="bg-btn-sec-bg/25 border border-border p-4 rounded-xl space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground/50">Coordonnées Bancaires</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-foreground/70 mb-1">Nom de la Banque</label>
                    <input 
                      name="bankName"
                      type="text"
                      defaultValue={artisan.bankName || ""}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                      placeholder="Ex: Attijariwafa Bank"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground/70 mb-1">Téléphone</label>
                    <input 
                      name="phone"
                      type="text"
                      defaultValue={artisan.phone || ""}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                      placeholder="Ex: 0612345678"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-foreground/70 mb-1">RIB (24 chiffres)</label>
                    <input 
                      name="rib"
                      type="text"
                      maxLength={24}
                      defaultValue={artisan.rib || ""}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary tracking-widest font-mono text-xs"
                      placeholder="Ex: 011780000012345678901234"
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Situation Personnelle */}
              <div className="bg-btn-sec-bg/25 border border-border p-4 rounded-xl space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground/50">Situation Personnelle</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-foreground/70 mb-1">CIN</label>
                    <input 
                      name="cin"
                      type="text"
                      defaultValue={artisan.cin || ""}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                      placeholder="Ex: EE123456"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground/70 mb-1">Numéro CNSS</label>
                    <input 
                      name="cnss"
                      type="text"
                      defaultValue={artisan.cnss || ""}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                      placeholder="Ex: 123456789"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground/70 mb-1">Situation Familiale</label>
                    <select
                      name="maritalStatus"
                      value={maritalStatus}
                      onChange={(e) => handleMaritalStatusChange(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary appearance-none cursor-pointer"
                    >
                      <option value="">-- Sélectionner --</option>
                      {maritalStatusesList.map(status => (
                        <option key={status.name} value={status.name}>{status.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground/70 mb-1">Nombre d'enfants</label>
                    <input 
                      name="childrenCount"
                      type="number"
                      min={0}
                      max={20}
                      disabled={maritalStatusesList.find(s => s.name === maritalStatus)?.allowChildren === false}
                      value={childrenCount}
                      onChange={(e) => setChildrenCount(parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary disabled:opacity-55 disabled:cursor-not-allowed"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-foreground/70 mb-1">Adresse Résidentielle</label>
                    <textarea 
                      name="address"
                      defaultValue={artisan.address || ""}
                      rows={2}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary resize-none"
                      placeholder="Adresse complète..."
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-border mt-6">
                <button 
                  type="button" 
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 rounded-lg font-medium text-foreground/70 hover:bg-btn-sec-hover transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-medium py-2 px-6 rounded-lg transition-all flex items-center cursor-pointer"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Enregistrer Modif.
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
