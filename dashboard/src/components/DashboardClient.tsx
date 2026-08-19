"use client";

import { useState } from "react";
import { 
  Users, 
  AlertTriangle, 
  Clock, 
  CalendarDays, 
  TrendingUp, 
  Wallet, 
  Percent, 
  ChevronRight,
  UserCheck,
  UserMinus,
  Loader2,
  Calendar,
  Filter,
  CheckCircle2,
  XCircle,
  Palmtree,
  Crown
} from "lucide-react";
import Link from "next/link";
import { getDashboardData } from "@/app/actions";

type PeriodFilterMode = "TODAY" | "YESTERDAY" | "THIS_WEEK" | "LAST_WEEK" | "THIS_MONTH" | "LAST_MONTH" | "CUSTOM";
type PersonnelTab = "ALL" | "PRESENT" | "ABSENT" | "LEAVE" | "EXEMPT";

interface DashboardClientProps {
  initialData: any;
  canViewSalaries: boolean;
}

export default function DashboardClient({ initialData, canViewSalaries }: DashboardClientProps) {
  const [data, setData] = useState<any>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterMode>(initialData.periodFilter || "TODAY");
  const [startDate, setStartDate] = useState<string>(initialData.startDateStr || new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState<string>(initialData.endDateStr || new Date().toISOString().split("T")[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activePersonnelTab, setActivePersonnelTab] = useState<PersonnelTab>("ALL");

  const fetchDashboard = async (
    filter: PeriodFilterMode,
    startStr?: string,
    endStr?: string
  ) => {
    setIsLoading(true);
    try {
      const res = await getDashboardData(filter, startStr, endStr);
      if (res.success) {
        setData(res);
      }
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (mode: PeriodFilterMode) => {
    setPeriodFilter(mode);
    if (mode !== "CUSTOM") {
      fetchDashboard(mode);
    } else {
      fetchDashboard("CUSTOM", startDate, endDate);
    }
  };

  const handleCustomDateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDashboard("CUSTOM", startDate, endDate);
  };

  const kpis = data?.kpis || {};
  const chartDays = data?.chartDays || [];
  const employeeRows = data?.employeeRows || [];
  const isMultiDay = data?.isMultiDay ?? false;

  // Filter employees for card feed based on search query & tab
  const filteredPersonnel = employeeRows.filter((e: any) => {
    const matchesSearch = `${e.firstName} ${e.lastName} ${e.zktecoUserId}`.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (activePersonnelTab === "PRESENT") {
      return isMultiDay ? e.daysAbsent === 0 && !e.isExempt : e.statusCategory === "PRESENT";
    }
    if (activePersonnelTab === "ABSENT") {
      return isMultiDay ? e.daysAbsent > 0 && !e.isExempt : e.statusCategory === "ABSENT";
    }
    if (activePersonnelTab === "LEAVE") return e.statusCategory === "LEAVE";
    if (activePersonnelTab === "EXEMPT") return e.statusCategory === "EXEMPT";
    return true;
  });

  // Counts for tabs
  const countAll = employeeRows.length;
  const countPresent = isMultiDay 
    ? employeeRows.filter((e: any) => !e.isExempt && e.daysAbsent === 0).length 
    : employeeRows.filter((e: any) => e.statusCategory === "PRESENT").length;
  
  const countAbsent = isMultiDay
    ? employeeRows.filter((e: any) => !e.isExempt && e.daysAbsent > 0).length
    : employeeRows.filter((e: any) => e.statusCategory === "ABSENT").length;
    
  const countLeave = employeeRows.filter((e: any) => e.statusCategory === "LEAVE").length;
  const countExempt = employeeRows.filter((e: any) => e.statusCategory === "EXEMPT").length;

  // Max cost in chart for scaling bars
  const maxChartCost = Math.max(...chartDays.map((d: any) => d.cost), 1);

  const currency = data?.currency || "DH";

  // Compact number formatting for chart labels to prevent overflow
  const formatBarValue = (cost: number, numDays: number) => {
    if (numDays <= 7) return `${cost} ${currency}`;
    if (cost >= 1000) return `${(cost / 1000).toFixed(1)}k`;
    return Math.round(cost).toString();
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* HEADER WITH ADVANCED DATE FILTER */}
      <div className="bg-surface border border-border rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
              Tableau de Bord
            </h1>
            <p className="text-sm text-foreground/60 mt-1">
              Suivi de présence, heures supplémentaires et masse salariale en temps réel.
            </p>
          </div>

          {/* Active Period Badge */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-primary/10 border border-primary/20 rounded-xl text-xs font-bold text-primary">
            <Calendar className="w-4 h-4" />
            <span>Période: {data?.periodLabel}</span>
          </div>
        </div>

        {/* PERIOD PRESET BUTTONS BAR */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
          <span className="text-xs font-bold uppercase tracking-wider text-foreground/60 flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5 text-primary" /> Filtre :
          </span>

          <button
            onClick={() => handleFilterChange("TODAY")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              periodFilter === "TODAY"
                ? "bg-primary text-primary-foreground shadow-md scale-105"
                : "bg-surface border border-border text-foreground/70 hover:bg-surface-hover"
            }`}
          >
            Aujourd'hui
          </button>

          <button
            onClick={() => handleFilterChange("YESTERDAY")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              periodFilter === "YESTERDAY"
                ? "bg-primary text-primary-foreground shadow-md scale-105"
                : "bg-surface border border-border text-foreground/70 hover:bg-surface-hover"
            }`}
          >
            Hier
          </button>

          <button
            onClick={() => handleFilterChange("THIS_WEEK")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              periodFilter === "THIS_WEEK"
                ? "bg-primary text-primary-foreground shadow-md scale-105"
                : "bg-surface border border-border text-foreground/70 hover:bg-surface-hover"
            }`}
          >
            Cette Semaine
          </button>

          <button
            onClick={() => handleFilterChange("LAST_WEEK")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              periodFilter === "LAST_WEEK"
                ? "bg-primary text-primary-foreground shadow-md scale-105"
                : "bg-surface border border-border text-foreground/70 hover:bg-surface-hover"
            }`}
          >
            Semaine Dernière
          </button>

          <button
            onClick={() => handleFilterChange("THIS_MONTH")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              periodFilter === "THIS_MONTH"
                ? "bg-primary text-primary-foreground shadow-md scale-105"
                : "bg-surface border border-border text-foreground/70 hover:bg-surface-hover"
            }`}
          >
            Ce Mois-ci
          </button>

          <button
            onClick={() => handleFilterChange("LAST_MONTH")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              periodFilter === "LAST_MONTH"
                ? "bg-primary text-primary-foreground shadow-md scale-105"
                : "bg-surface border border-border text-foreground/70 hover:bg-surface-hover"
            }`}
          >
            Le Mois Dernier
          </button>

          <button
            onClick={() => handleFilterChange("CUSTOM")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              periodFilter === "CUSTOM"
                ? "bg-primary text-primary-foreground shadow-md scale-105"
                : "bg-surface border border-border text-foreground/70 hover:bg-surface-hover"
            }`}
          >
            Plage Personnalisée 📅
          </button>
        </div>

        {/* CUSTOM DATE RANGE PICKER (IF CUSTOM IS ACTIVE) */}
        {periodFilter === "CUSTOM" && (
          <form onSubmit={handleCustomDateSubmit} className="flex flex-wrap items-end gap-3 pt-3 bg-surface-hover/50 p-3 rounded-xl border border-border animate-in fade-in duration-200">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-foreground/70 mb-1">
                Du (Date Début)
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-background border border-border rounded-xl px-3 py-1.5 text-xs font-bold text-foreground focus:outline-none focus:border-primary transition-colors cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-foreground/70 mb-1">
                Au (Date Fin)
              </label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-background border border-border rounded-xl px-3 py-1.5 text-xs font-bold text-foreground focus:outline-none focus:border-primary transition-colors cursor-pointer"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Filtrer les Données"}
            </button>
          </form>
        )}
      </div>

      {/* TOP KPI CARDS FOR SELECTED PERIOD */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Presence Rate */}
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-foreground/60">
              Taux Présence (Période)
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <Percent className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-foreground">
              {kpis.presenceRate}%
            </span>
            <span className="text-xs font-semibold text-emerald-500 flex items-center gap-0.5">
              <TrendingUp className="w-3.5 h-3.5" /> Actif
            </span>
          </div>
          <p className="text-[11px] text-foreground/50">
            Basé sur les jours ouvrables requis de la période.
          </p>
        </div>

        {/* Total Hours Worked */}
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-foreground/60">
              Heures Cumulées (Période)
            </span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-foreground">
              {kpis.totalHoursWorked} h
            </span>
          </div>
          <p className="text-[11px] text-foreground/50">
            Cumul des heures normales & sup. sur la période.
          </p>
        </div>

        {/* Estimated Payroll Cost */}
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-foreground/60">
              Masse Salariale Est. (Période)
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            {canViewSalaries ? (
              <span className="text-3xl font-black text-foreground">
                {kpis.estimatedPayrollCost?.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {currency}
              </span>
            ) : (
              <span className="text-sm font-semibold text-foreground/40 italic">Réservé Admin</span>
            )}
          </div>
          <p className="text-[11px] text-foreground/50">
            Calculé sur la base des taux horaires pour la période filtrée.
          </p>
        </div>

        {/* Anomalies */}
        <Link href="/anomalies" className="block">
          <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden hover:border-primary/50 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground/60">
                Anomalies (Période)
              </span>
              <div className={`p-2 rounded-xl ${kpis.anomalyCount > 0 ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'}`}>
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-black ${kpis.anomalyCount > 0 ? 'text-danger' : 'text-foreground'}`}>
                {kpis.anomalyCount}
              </span>
            </div>
            <p className="text-[11px] text-foreground/50">
              Pointages nécessitant une résolution manuelle.
            </p>
          </div>
        </Link>
      </div>

      {/* SECTION 1: PERSONNEL PRÉSENCES & ABSENCES FEED CARDS */}
      <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/60 pb-4">
          <div>
            <h2 className="text-lg font-black text-foreground flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Statut du Personnel sur la Période
            </h2>
            <p className="text-xs text-foreground/60 mt-0.5">
              Consultez le statut individuel et le cumul des absences de chaque artisan pour la période filtrée.
            </p>
          </div>

          {/* Personnel Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-background p-1 rounded-xl border border-border">
            <button
              onClick={() => setActivePersonnelTab("ALL")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activePersonnelTab === "ALL"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-foreground/70 hover:text-foreground"
              }`}
            >
              Tous ({countAll})
            </button>

            <button
              onClick={() => setActivePersonnelTab("PRESENT")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                activePersonnelTab === "PRESENT"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-emerald-600 hover:bg-emerald-500/10"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> {isMultiDay ? `100% Présents (${countPresent})` : `Présents (${countPresent})`}
            </button>

            <button
              onClick={() => setActivePersonnelTab("ABSENT")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                activePersonnelTab === "ABSENT"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-rose-600 hover:bg-rose-500/10"
              }`}
            >
              <XCircle className="w-3.5 h-3.5" /> {isMultiDay ? `avec Absences (${countAbsent})` : `Absents (${countAbsent})`}
            </button>

            {countLeave > 0 && (
              <button
                onClick={() => setActivePersonnelTab("LEAVE")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  activePersonnelTab === "LEAVE"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-purple-600 hover:bg-purple-500/10"
                }`}
              >
                <Palmtree className="w-3.5 h-3.5" /> En Congé ({countLeave})
              </button>
            )}

            {countExempt > 0 && (
              <button
                onClick={() => setActivePersonnelTab("EXEMPT")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  activePersonnelTab === "EXEMPT"
                    ? "bg-amber-600 text-white shadow-sm"
                    : "text-amber-600 hover:bg-amber-500/10"
                }`}
              >
                <Crown className="w-3.5 h-3.5" /> Direction ({countExempt})
              </button>
            )}
          </div>
        </div>

        {/* CARDS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredPersonnel.map((e: any) => {
            const hasAbsences = e.daysAbsent > 0 && !e.isExempt;
            const isFullyPresent = e.daysAbsent === 0 && !e.isExempt;
            const isLeave = e.statusCategory === "LEAVE";
            const isExempt = e.statusCategory === "EXEMPT";

            return (
              <div
                key={e.id}
                className="bg-background border border-border rounded-2xl p-4 shadow-sm space-y-3 relative hover:border-primary/40 transition-colors flex flex-col justify-between"
              >
                <div>
                  {/* Card Top Header: Avatar + Status Dot + Badge */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-2xl bg-surface border border-border flex items-center justify-center font-black text-lg text-primary shadow-inner">
                        {e.firstName[0]}
                      </div>
                      {/* Status Dot */}
                      <span className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-background ${
                        isFullyPresent ? "bg-emerald-500" : isLeave ? "bg-purple-500" : isExempt ? "bg-amber-500" : "bg-rose-500"
                      }`} />
                    </div>

                    {/* Status Badge */}
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                      isExempt
                        ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                        : isLeave
                        ? "bg-purple-500/10 text-purple-600 border border-purple-500/20"
                        : hasAbsences
                        ? "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                        : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                    }`}>
                      {isExempt
                        ? "DIRECTION"
                        : isLeave
                        ? "EN CONGÉ"
                        : hasAbsences
                        ? `${e.daysAbsent} jrs d'absence`
                        : "PRÉSENT (100%)"}
                    </span>
                  </div>

                  {/* Name & Details */}
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-foreground truncate">
                      {e.firstName} {e.lastName}
                    </h3>
                    <p className="text-[11px] text-foreground/50 font-medium">
                      Device ID: {e.zktecoUserId} · {e.shiftName}
                    </p>
                    <div className="pt-2 text-xs font-semibold text-foreground/80">
                      {e.detailStr}
                    </div>

                    {/* Presence Progress Bar if multi-day */}
                    {isMultiDay && !isExempt && (
                      <div className="pt-2 space-y-1">
                        <div className="w-full bg-surface border border-border h-2 rounded-full overflow-hidden flex">
                          <div className="bg-emerald-500 h-full transition-all" style={{ width: `${e.presenceRate}%` }} />
                          <div className="bg-rose-500 h-full transition-all" style={{ width: `${100 - e.presenceRate}%` }} />
                        </div>
                        <div className="flex justify-between text-[10px] text-foreground/60 font-bold">
                          <span className="text-emerald-600">{e.daysPresent} jrs présent ({e.presenceRate}%)</span>
                          {e.daysAbsent > 0 && <span className="text-rose-600">{e.daysAbsent} jrs absent</span>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Bottom Footer: Hours & Cost + Action Button */}
                <div className="pt-3 border-t border-border/60 flex items-center justify-between mt-3 text-xs">
                  <div className="font-bold text-foreground">
                    <span>{e.totalHours}h travaillées</span>
                    {canViewSalaries && <span className="block text-[10px] text-primary font-bold">{e.earnedCost} {currency}</span>}
                  </div>

                  <Link
                    href={`/reports?userId=${e.id}`}
                    className="px-2.5 py-1 bg-surface hover:bg-surface-hover border border-border rounded-xl text-[11px] font-bold text-foreground/70 hover:text-primary transition-colors flex items-center gap-1"
                  >
                    Rapports <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: DAILY COST CHART */}
      <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Masse Salariale & Heures par Jour
            </h2>
            <p className="text-xs text-foreground/50">Évolution du coût journalier pendant la période filtrée.</p>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold text-foreground/70">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-primary" /> Coût ({currency})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-border/40" /> Plage Sans Pointage
            </span>
          </div>
        </div>

        {/* Bar Chart Container with Extra Top Padding to prevent Tooltip Clipping */}
        <div className="pt-16 pb-2 h-60 flex items-end justify-between gap-1 overflow-x-auto relative">
          {chartDays.map((d: any, idx: number) => {
            const hasData = d.cost > 0 || d.hours > 0;
            const heightPct = maxChartCost > 0 && d.cost > 0 ? Math.max(12, Math.round((d.cost / maxChartCost) * 100)) : (hasData ? 12 : 4);

            return (
              <div key={idx} className="flex-1 min-w-[28px] h-full flex flex-col items-center justify-end gap-1.5 group relative">
                
                {/* TOOLTIP ON HOVER - Positioned inside container with high z-index and zero clipping */}
                <div className="absolute -top-14 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center bg-foreground text-background text-[11px] font-extrabold py-1.5 px-3 rounded-xl shadow-2xl z-50 whitespace-nowrap pointer-events-none border border-background/20">
                  <span>📅 Date: {d.label}</span>
                  <span className="text-primary-foreground font-black">💰 Coût: {d.cost.toLocaleString("fr-FR")} {currency}</span>
                  <span className="text-foreground/70 font-semibold">⏱️ Heures: {d.hours} h</span>
                </div>

                {/* Value badge on top of bar if cost > 0 */}
                {d.cost > 0 && (
                  <span className="text-[9px] font-extrabold text-primary truncate max-w-full">
                    {formatBarValue(d.cost, chartDays.length)}
                  </span>
                )}

                {/* Track and Bar */}
                <div className="w-full h-36 bg-surface-hover/60 border border-border/40 rounded-t-xl relative flex items-end overflow-hidden p-0.5">
                  <div
                    className={`w-full rounded-t-lg transition-all duration-300 ${
                      d.cost > 0
                        ? "bg-primary group-hover:bg-primary/80 shadow-sm"
                        : hasData
                        ? "bg-blue-400/50"
                        : "bg-border/30"
                    }`}
                    style={{ height: `${heightPct}%` }}
                  />
                </div>

                {/* X-Axis Date Label */}
                <span className={`text-[10px] font-bold truncate w-full text-center ${d.cost > 0 ? "text-primary font-black" : "text-foreground/50"}`}>
                  {d.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 3: DETAILED EMPLOYEE BREAKDOWN TABLE FOR PERIOD */}
      <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              Détails des Heures & Coûts de la Période
            </h2>
            <p className="text-xs text-foreground/50">Synthèse individuelle des heures normales, sup. et coûts pour chaque employé.</p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <input
              type="text"
              placeholder="Rechercher par nom..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-background border border-border rounded-xl px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary transition-colors w-full sm:w-48"
            />
            <Link
              href="/reports"
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1 whitespace-nowrap"
            >
              Consulter les rapports <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border text-foreground/60 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-3">Personnel / Employé</th>
                <th className="py-3 px-3">Shift</th>
                <th className="py-3 px-3 text-center">Présence Période</th>
                <th className="py-3 px-3 text-right">H. Normales</th>
                <th className="py-3 px-3 text-right">H. Sup 150%</th>
                <th className="py-3 px-3 text-right">H. Sup 200%</th>
                {canViewSalaries && <th className="py-3 px-3 text-right">Coût Est. ({currency})</th>}
                <th className="py-3 px-3 text-center">Statut Période</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {employeeRows.filter((e: any) => `${e.firstName} ${e.lastName} ${e.zktecoUserId}`.toLowerCase().includes(searchQuery.toLowerCase())).map((e: any) => (
                <tr key={e.id} className="hover:bg-surface-hover/50 transition-colors">
                  <td className="py-3 px-3 font-bold text-foreground">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                        {e.firstName[0]}
                      </div>
                      <div>
                        <span>{e.firstName} {e.lastName}</span>
                        <span className="block text-[10px] text-foreground/40 font-normal">ID: {e.zktecoUserId}</span>
                      </div>
                    </div>
                  </td>

                  <td className="py-3 px-3 text-foreground/70 font-medium">
                    {e.shiftName}
                  </td>

                  <td className="py-3 px-3 text-center font-bold text-foreground">
                    {isMultiDay ? (
                      <div>
                        <span>{e.daysPresent}/{e.daysExpected} jrs</span>
                        {e.daysAbsent > 0 && <span className="block text-[10px] text-rose-500 font-bold">{e.daysAbsent} jrs abs.</span>}
                      </div>
                    ) : (
                      <span>{e.daysPresent} jrs</span>
                    )}
                  </td>

                  <td className="py-3 px-3 text-right font-bold text-foreground">
                    {e.regHours.toFixed(2)} h
                  </td>

                  <td className="py-3 px-3 text-right font-bold text-amber-500">
                    {e.ot150Hours > 0 ? `${e.ot150Hours.toFixed(2)} h` : "0.00 h"}
                  </td>

                  <td className="py-3 px-3 text-right font-bold text-purple-500">
                    {e.ot200Hours > 0 ? `${e.ot200Hours.toFixed(2)} h` : "0.00 h"}
                  </td>

                  {canViewSalaries && (
                    <td className="py-3 px-3 text-right font-black text-foreground">
                      {e.earnedCost.toFixed(2)} {currency}
                    </td>
                  )}

                  <td className="py-3 px-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      e.isExempt
                        ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                        : e.daysAbsent > 0
                        ? "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                        : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                    }`}>
                      {e.statusLabel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
