"use client";

import React, { useState, useEffect } from "react";
import { 
  FileSpreadsheet, 
  Calendar, 
  Users, 
  Loader2, 
  ChevronDown, 
  ChevronUp, 
  Printer, 
  Clock, 
  DollarSign, 
  CheckCircle2, 
  AlertTriangle, 
  UserCheck, 
  UserX, 
  CalendarDays, 
  Briefcase,
  Layers,
  Sparkles
} from "lucide-react";
import { getReportsPreview } from "@/app/actions";
import { formatDate } from "@/lib/utils";

// --- SUBCOMPONENTS ---

// 1. Radial Progress Gauge
const RadialGauge = ({ value, label, colorClass, trailColorClass }: { value: number, label: string, colorClass: string, trailColorClass: string }) => {
  const radius = 50;
  const stroke = 8;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center space-y-2">
      <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle
            className={`${trailColorClass} stroke-current`}
            strokeWidth={stroke}
            fill="transparent"
            r={normalizedRadius}
            cx={50}
            cy={50}
          />
          <circle
            className={`${colorClass} stroke-current transition-all duration-1000 ease-out`}
            strokeWidth={stroke}
            strokeDasharray={circumference + ' ' + circumference}
            style={{ strokeDashoffset }}
            strokeLinecap="round"
            fill="transparent"
            r={normalizedRadius}
            cx={50}
            cy={50}
          />
        </svg>
        <span className="absolute text-lg font-black text-foreground">{value}%</span>
      </div>
      <span className="text-xs font-semibold text-foreground/50 uppercase tracking-wider text-center">{label}</span>
    </div>
  );
};

// 2. Interactive Daily Timeline Stacked Bar Chart
const DailyTimelineChart = ({ 
  data, 
  rate1Percent, 
  rate2Percent,
  canViewSalaries,
  currency = "DH"
}: { 
  data: any[], 
  rate1Percent: number, 
  rate2Percent: number,
  canViewSalaries: boolean,
  currency?: string
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return <div className="text-foreground/40 text-center py-12 text-sm">Aucune donnée journalière disponible pour cette période.</div>;
  }

  const maxHours = Math.max(10, Math.ceil((Math.max(...data.map(d => d.totalHours), 1)) / 5) * 5);
  const width = Math.max(600, data.length * 55);
  const height = 240;
  const paddingLeft = 45;
  const paddingRight = 25;
  const paddingTop = 25;
  const paddingBottom = 40;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const barSlotWidth = chartWidth / data.length;
  const barWidth = Math.min(32, Math.max(14, barSlotWidth * 0.65));

  const getY = (val: number) => {
    return height - paddingBottom - (val * chartHeight) / maxHours;
  };

  const hoveredDay = hoveredIndex !== null ? data[hoveredIndex] : null;

  return (
    <div className="w-full relative">
      {/* Chart Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 text-xs font-medium">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-blue-500 rounded-sm" />
            <span className="text-foreground/70">Heures Normales</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-amber-500 rounded-sm" />
            <span className="text-foreground/70">Overtime {rate1Percent}%</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-purple-500 rounded-sm" />
            <span className="text-foreground/70">Overtime {rate2Percent}%</span>
          </span>
        </div>

        {hoveredDay && (
          <div className="flex items-center gap-3 px-3 py-1 rounded-lg bg-surface border border-border shadow-sm text-xs animate-in fade-in">
            <span className="font-bold text-foreground">{hoveredDay.dayName} {hoveredDay.date}</span>
            <span className="text-primary font-bold">{hoveredDay.totalHours.toFixed(2)}h total</span>
            {canViewSalaries && (
              <span className="text-success font-extrabold">{hoveredDay.cost.toFixed(2)} {currency}</span>
            )}
          </div>
        )}
      </div>

      {/* Responsive Horizontal Scroll Container if many days */}
      <div className="w-full overflow-x-auto pb-2 scrollbar-thin">
        <svg viewBox={`0 0 ${width} ${height}`} style={{ minWidth: `${Math.max(100, data.length * 45)}px` }} className="w-full h-auto">
          {/* Y-Axis Gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const val = ratio * maxHours;
            const y = getY(val);
            return (
              <g key={i} className="opacity-15 dark:opacity-25">
                <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="currentColor" strokeWidth={1} strokeDasharray="3 3" />
                <text x={paddingLeft - 8} y={y + 3} textAnchor="end" className="text-[10px] fill-foreground font-semibold">
                  {val.toFixed(0)}h
                </text>
              </g>
            );
          })}

          {/* Stacked Bars for Each Day */}
          {data.map((day, i) => {
            const x = paddingLeft + (i * barSlotWidth) + (barSlotWidth - barWidth) / 2;
            const regY = getY(day.regularHours);
            const regHeight = Math.max(0, height - paddingBottom - regY);

            const ot150Y = getY(day.regularHours + day.overtime150);
            const ot150Height = Math.max(0, regY - ot150Y);

            const ot200Y = getY(day.totalHours);
            const ot200Height = Math.max(0, ot150Y - ot200Y);

            const isHovered = hoveredIndex === i;

            return (
              <g 
                key={day.date} 
                className="cursor-pointer group"
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Column Highlight Background */}
                <rect
                  x={paddingLeft + (i * barSlotWidth)}
                  y={paddingTop}
                  width={barSlotWidth}
                  height={chartHeight}
                  fill="currentColor"
                  className={`${isHovered ? 'opacity-10' : 'opacity-0'} transition-opacity fill-primary`}
                />

                {/* Regular Hours Stack (Blue) */}
                {regHeight > 0 && (
                  <rect
                    x={x}
                    y={regY}
                    width={barWidth}
                    height={regHeight}
                    rx={day.totalHours === day.regularHours ? 3 : 0}
                    fill="#3B82F6"
                    className="transition-all duration-300 group-hover:brightness-110"
                  />
                )}

                {/* Overtime 150% Stack (Amber) */}
                {ot150Height > 0 && (
                  <rect
                    x={x}
                    y={ot150Y}
                    width={barWidth}
                    height={ot150Height}
                    rx={day.overtime200 === 0 ? 3 : 0}
                    fill="#F59E0B"
                    className="transition-all duration-300 group-hover:brightness-110"
                  />
                )}

                {/* Overtime 200% Stack (Purple) */}
                {ot200Height > 0 && (
                  <rect
                    x={x}
                    y={ot200Y}
                    width={barWidth}
                    height={ot200Height}
                    rx={3}
                    fill="#8B5CF6"
                    className="transition-all duration-300 group-hover:brightness-110"
                  />
                )}

                {/* Top Total Value Label */}
                {day.totalHours > 0 && (
                  <text
                    x={x + barWidth / 2}
                    y={ot200Y - 5}
                    textAnchor="middle"
                    className={`text-[9px] font-bold fill-foreground ${isHovered ? 'opacity-100' : 'opacity-70'} transition-opacity`}
                  >
                    {day.totalHours.toFixed(1)}h
                  </text>
                )}

                {/* X-Axis Date Label */}
                <text
                  x={x + barWidth / 2}
                  y={height - paddingBottom + 16}
                  textAnchor="middle"
                  className={`text-[9px] font-medium ${isHovered ? 'fill-primary font-bold' : 'fill-foreground/60'} transition-colors`}
                >
                  {day.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

// 3. Peak Activity Hours Histogram
const PeakHoursHistogram = ({ data }: { data: any[] }) => {
  const width = 600;
  const height = 140;
  const paddingLeft = 35;
  const paddingRight = 20;
  const paddingTop = 15;
  const paddingBottom = 30;
  
  if (!data || data.length === 0) return <div className="text-foreground/40 text-center py-8 text-sm">Aucun pointage enregistré.</div>;

  const maxVal = Math.max(8, Math.ceil((Math.max(...data.map(d => d.count), 1)) / 5) * 5);
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const slotWidth = chartWidth / data.length;
  const barWidth = Math.max(3, slotWidth - 4);

  const getY = (val: number) => {
    return height - paddingBottom - (val * chartHeight) / maxVal;
  };

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        {/* Y Axis Gridlines */}
        {[0, 0.5, 1].map((ratio, i) => {
          const val = ratio * maxVal;
          const y = getY(val);
          return (
            <g key={i} className="opacity-15 dark:opacity-25">
              <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="currentColor" strokeWidth={1} />
              <text x={paddingLeft - 6} y={y + 3} textAnchor="end" className="text-[9px] fill-foreground font-medium">
                {val.toFixed(0)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const x = paddingLeft + (i * slotWidth) + 2;
          const y = getY(d.count);
          const barH = Math.max(2, height - paddingBottom - y);

          return (
            <g key={d.hour} className="group">
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barH}
                rx={2}
                fill="var(--primary)"
                className="opacity-75 hover:opacity-100 transition-opacity fill-primary"
              />
              {d.count > 0 && (
                <text
                  x={x + barWidth / 2}
                  y={y - 4}
                  textAnchor="middle"
                  className="text-[8px] fill-foreground font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {d.count}
                </text>
              )}
              <text
                x={x + barWidth / 2}
                y={height - paddingBottom + 14}
                textAnchor="middle"
                className="text-[8px] fill-foreground/50 font-medium"
              >
                {d.hour}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// --- MAIN COMPONENT ---

export default function ReportsClient({ 
  artisans, 
  settings, 
  canViewSalaries = true 
}: { 
  artisans: any[], 
  settings: any, 
  canViewSalaries?: boolean 
}) {
  const currency = settings?.currency || "DH";
  const rate1Percent = settings ? Math.round(settings.otRate1 * 100) : 150;
  const rate2Percent = settings ? Math.round(settings.otRate2 * 100) : 200;

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [artisanId, setArtisanId] = useState("all");
  
  const [reports, setReports] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [isSingleUser, setIsSingleUser] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [expandedUsers, setExpandedUsers] = useState<Record<string, boolean>>({});

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  // Initialize dates: First day of current month to today
  useEffect(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    
    const firstDay = new Date(y, m, 1);
    const formatLocal = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };
    
    setStartDate(formatLocal(firstDay));
    setEndDate(formatLocal(now));
  }, []);

  const setPreset = (preset: "thisMonth" | "lastMonth" | "last7Days") => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    
    const formatLocal = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    if (preset === "thisMonth") {
      setStartDate(formatLocal(new Date(y, m, 1)));
      setEndDate(formatLocal(now));
    } else if (preset === "lastMonth") {
      setStartDate(formatLocal(new Date(y, m - 1, 1)));
      setEndDate(formatLocal(new Date(y, m, 0)));
    } else if (preset === "last7Days") {
      const lastWeek = new Date();
      lastWeek.setDate(now.getDate() - 7);
      setStartDate(formatLocal(lastWeek));
      setEndDate(formatLocal(now));
    }
  };

  const handlePreview = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!startDate || !endDate) {
      setError("Veuillez renseigner les deux dates de début et fin.");
      return;
    }
    
    if (new Date(startDate) > new Date(endDate)) {
      setError("La date de début ne peut pas être supérieure à la date de fin.");
      return;
    }

    setIsLoading(true);
    setError("");
    setHasSearched(true);

    try {
      const result = await getReportsPreview(startDate, endDate, artisanId);
      if (result.success && result.reports) {
        setReports(result.reports);
        setAnalytics(result.analytics || null);
        setIsSingleUser(result.isSingleUser || false);
        setSelectedUser(result.selectedUser || null);
      } else {
        setReports([]);
        setAnalytics(null);
        setError(result.error || "Une erreur s'est produite lors de la prévisualisation.");
      }
    } catch (err) {
      setError("Erreur de communication avec le serveur.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportUrl = () => {
    return `/api/reports/export?startDate=${startDate}&endDate=${endDate}&artisanId=${artisanId}`;
  };

  const toggleExpand = (userId: string) => {
    setExpandedUsers(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const handlePrint = () => {
    window.print();
  };

  // Aggregated KPIs
  const totalRegular = reports.reduce((sum, r) => sum + r.regularHours, 0);
  const total150 = reports.reduce((sum, r) => sum + r.overtime150Hours, 0);
  const total200 = reports.reduce((sum, r) => sum + r.overtime200Hours, 0);
  const totalHours = totalRegular + total150 + total200;
  const totalCostVal = reports.reduce((sum, r) => sum + (r.totalCost || 0), 0);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 print:space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2 flex items-center gap-3">
            <Layers className="w-8 h-8 text-primary" />
            Centre d'Exportations & Rapports
          </h1>
          <p className="text-foreground/60 text-sm">
            Auditez les présences réelles, analysez les heures quotidiennes et exportez les rapports de paie.
          </p>
        </div>

        {hasSearched && reports.length > 0 && (
          <button
            onClick={handlePrint}
            className="px-4 py-2.5 bg-btn-sec-bg hover:bg-btn-sec-hover text-btn-sec-text border border-border rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors self-start sm:self-auto shadow-sm"
          >
            <Printer className="w-4 h-4 text-primary" />
            Imprimer / PDF
          </button>
        )}
      </div>

      {/* Filter and preset form */}
      <div className="glass-panel p-6 print:hidden">
        <form onSubmit={handlePreview} className="space-y-6">
          <div className="flex flex-wrap items-center gap-3 border-b border-border pb-4">
            <span className="text-sm font-semibold text-foreground/60 flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4 text-primary" />
              Raccourcis :
            </span>
            <button 
              type="button" 
              onClick={() => setPreset("thisMonth")}
              className="px-3 py-1.5 rounded-lg bg-btn-sec-bg hover:bg-btn-sec-hover text-btn-sec-text text-xs font-semibold transition-colors"
            >
              Ce mois-ci
            </button>
            <button 
              type="button" 
              onClick={() => setPreset("lastMonth")}
              className="px-3 py-1.5 rounded-lg bg-btn-sec-bg hover:bg-btn-sec-hover text-btn-sec-text text-xs font-semibold transition-colors"
            >
              Le mois dernier
            </button>
            <button 
              type="button" 
              onClick={() => setPreset("last7Days")}
              className="px-3 py-1.5 rounded-lg bg-btn-sec-bg hover:bg-btn-sec-hover text-btn-sec-text text-xs font-semibold transition-colors"
            >
              7 derniers jours
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-foreground/70 mb-2 flex items-center">
                <Calendar className="w-4 h-4 mr-2 text-primary" />
                Date de Début
              </label>
              <input 
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground/70 mb-2 flex items-center">
                <Calendar className="w-4 h-4 mr-2 text-primary" />
                Date de Fin
              </label>
              <input 
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground/70 mb-2 flex items-center">
                <Users className="w-4 h-4 mr-2 text-primary" />
                Filtrer par Employé
              </label>
              <div className="relative">
                <select 
                  value={artisanId}
                  onChange={(e) => setArtisanId(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg pl-4 pr-10 py-2.5 text-foreground focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer font-medium"
                >
                  <option value="all">👥 Tout le personnel ({artisans.length} employés)</option>
                  {artisans.map(artisan => (
                    <option key={artisan.id} value={artisan.id}>
                      {artisan.lastName.replace(/_/g, ' ').toUpperCase()} {artisan.firstName.replace(/_/g, ' ')} (ID: {artisan.zktecoUserId})
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-foreground/50">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm text-center font-medium flex items-center justify-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {error}
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:justify-end gap-3 pt-2">
            <button 
              type="submit" 
              disabled={isLoading}
              className="px-6 py-2.5 bg-primary text-white font-semibold text-sm rounded-lg hover:bg-primary/90 transition-all flex items-center justify-center shadow-sm disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Filtrer / Aperçu
            </button>
            <a 
              href={`${handleExportUrl()}&format=csv`}
              className={`px-6 py-2.5 bg-btn-sec-bg hover:bg-btn-sec-hover text-btn-sec-text border border-border font-semibold text-sm rounded-lg transition-colors flex items-center justify-center ${
                isLoading ? "opacity-50 pointer-events-none" : ""
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 mr-2 text-primary" />
              Exporter en CSV
            </a>
            <a 
              href={handleExportUrl()}
              className={`px-6 py-2.5 bg-success text-white font-semibold text-sm rounded-lg hover:bg-success/90 transition-all flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.3)] ${
                isLoading ? "opacity-50 pointer-events-none" : ""
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Exporter vers Excel (Multi-Onglets)
            </a>
          </div>
        </form>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="glass-panel p-16 flex flex-col items-center justify-center text-center space-y-4">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-foreground/70 font-semibold text-base">Recalcul en direct des pointages bruts ZKTeco...</p>
          <p className="text-foreground/40 text-xs">Application de la tolérance 15 min et synchronisation journalière.</p>
        </div>
      )}

      {/* Main Results Section */}
      {hasSearched && !isLoading && (
        <div className="space-y-8 animate-in fade-in duration-300">
          {reports.length === 0 ? (
            <div className="glass-panel p-16 text-center text-foreground/50 space-y-2">
              <AlertTriangle className="w-10 h-10 text-warning/70 mx-auto" />
              <p className="font-semibold text-lg text-foreground">Aucune donnée calculée pour cette période</p>
              <p className="text-sm text-foreground/50">Vérifiez que des pointages existent sur la pointeuse pour la plage de dates sélectionnée.</p>
            </div>
          ) : (
            <>
              {/* --- MODE 1: SINGLE EMPLOYEE PROFILE HEADER --- */}
              {isSingleUser && selectedUser && (
                <div className="glass-panel p-6 border-l-4 border-primary space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-border">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 flex items-center justify-center text-primary font-black text-xl shadow-inner">
                        {selectedUser.firstName[0]}{selectedUser.lastName[0]}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-2xl font-bold text-foreground">
                            {selectedUser.lastName.replace(/_/g, ' ').toUpperCase()} {selectedUser.firstName.replace(/_/g, ' ')}
                          </h2>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                            ID: {selectedUser.zktecoUserId}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 mt-1 text-xs text-foreground/60">
                          <span className="flex items-center gap-1">
                            <Briefcase className="w-3.5 h-3.5 text-primary" />
                            {selectedUser.shiftName} ({selectedUser.shiftStartTime} - {selectedUser.shiftEndTime})
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            Contrat : <strong>{selectedUser.contractType || 'Standard'}</strong>
                          </span>
                          {canViewSalaries && (
                            <span className="flex items-center gap-1 text-success font-semibold">
                              <DollarSign className="w-3.5 h-3.5" />
                              Taux : {selectedUser.hourlyRate ? `${selectedUser.hourlyRate} ${currency}/h` : 'Non défini'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quick Period Badges */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-bold flex items-center gap-1.5 shadow-sm">
                        <UserCheck className="w-4 h-4" />
                        {selectedUser.daysWorked} Jours Travaillés
                      </span>
                      {selectedUser.daysAbsent > 0 && (
                        <span className="px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-bold flex items-center gap-1.5 shadow-sm">
                          <UserX className="w-4 h-4" />
                          {selectedUser.daysAbsent} Absences
                        </span>
                      )}
                      {selectedUser.daysLeave > 0 && (
                        <span className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-bold flex items-center gap-1.5 shadow-sm">
                          <Calendar className="w-4 h-4" />
                          {selectedUser.daysLeave} Congés
                        </span>
                      )}
                      {selectedUser.daysAnomaly > 0 && (
                        <span className="px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-bold flex items-center gap-1.5 shadow-sm animate-pulse">
                          <AlertTriangle className="w-4 h-4" />
                          {selectedUser.daysAnomaly} Anomalie(s)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Summary Metric Cards */}
                  <div className={`grid grid-cols-1 sm:grid-cols-2 ${canViewSalaries ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4`}>
                    <div className="glass-panel p-4 bg-surface/40">
                      <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wider mb-1">Heures Normales</p>
                      <p className="text-xl font-bold text-foreground">{selectedUser.regularHours.toFixed(2)} hrs</p>
                    </div>
                    <div className="glass-panel p-4 bg-surface/40">
                      <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wider mb-1">Heures Sup. {rate1Percent}%</p>
                      <p className="text-xl font-bold text-warning">{selectedUser.overtime150Hours.toFixed(2)} hrs</p>
                    </div>
                    <div className="glass-panel p-4 bg-surface/40">
                      <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wider mb-1">Heures Sup. {rate2Percent}%</p>
                      <p className="text-xl font-bold text-accent">{selectedUser.overtime200Hours.toFixed(2)} hrs</p>
                    </div>
                    <div className="glass-panel p-4 bg-surface/40 border-primary/20">
                      <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Total Général</p>
                      <p className="text-xl font-bold text-primary">{selectedUser.totalHours.toFixed(2)} hrs</p>
                    </div>
                    {canViewSalaries && (
                      <div className="glass-panel p-4 bg-success/5 border-success/30">
                        <p className="text-xs font-semibold text-success uppercase tracking-wider mb-1">Salaire Période</p>
                        <p className="text-xl font-bold text-success">
                          {selectedUser.totalCost.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* --- MODE 2: TEAM GLOBAL SUMMARY CARDS --- */}
              {!isSingleUser && (
                <div className={`grid grid-cols-1 sm:grid-cols-2 ${canViewSalaries ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4 sm:gap-6`}>
                  <div className="glass-panel p-5">
                    <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wider mb-1">Total Heures Normales</p>
                    <p className="text-2xl font-bold text-foreground">{totalRegular.toFixed(2)} hrs</p>
                  </div>
                  <div className="glass-panel p-5">
                    <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wider mb-1">Total Overtime {rate1Percent}%</p>
                    <p className="text-2xl font-bold text-warning">{total150.toFixed(2)} hrs</p>
                  </div>
                  <div className="glass-panel p-5">
                    <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wider mb-1">Total Overtime {rate2Percent}%</p>
                    <p className="text-2xl font-bold text-accent">{total200.toFixed(2)} hrs</p>
                  </div>
                  <div className="glass-panel p-5 border-primary/20">
                    <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Total Général Cumulé</p>
                    <p className="text-2xl font-bold text-primary">{totalHours.toFixed(2)} hrs</p>
                  </div>
                  {canViewSalaries && (
                    <div className="glass-panel p-5 border-success/30 bg-success/5">
                      <p className="text-xs font-semibold text-success uppercase tracking-wider mb-1">Masse Salariale (Période)</p>
                      <p className="text-2xl font-bold text-success">
                        {totalCostVal.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* --- DYNAMIC DAY-BY-DAY TIMELINE CHART (Replacing static weekly graph!) --- */}
              {analytics && (
                <div className="glass-panel p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border pb-3">
                    <div>
                      <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                        <Clock className="w-4 h-4 text-primary" />
                        Évolution Journalière des Heures & Coûts ({analytics.dailyTimeline.length} jours)
                      </h3>
                      <p className="text-xs text-foreground/50">
                        {isSingleUser 
                          ? `Décompte journalier exact pour ${selectedUser?.firstName} ${selectedUser?.lastName}`
                          : "Activité cumulée de l'ensemble de l'atelier jour par jour sur la période sélectionnée"}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-semibold">
                      <span className="text-foreground/60">Période : <strong className="text-foreground">{formatDate(new Date(startDate))} ➔ {formatDate(new Date(endDate))}</strong></span>
                    </div>
                  </div>

                  <DailyTimelineChart 
                    data={analytics.dailyTimeline || []} 
                    rate1Percent={rate1Percent} 
                    rate2Percent={rate2Percent}
                    canViewSalaries={canViewSalaries}
                    currency={currency}
                  />
                </div>
              )}

              {/* --- ANALYTICS GAUGES & PEAK HOURS --- */}
              {analytics && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
                  {/* Presence & Anomaly Rates Radial Gauges */}
                  <div className="glass-panel p-6 flex flex-col justify-between">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-foreground/60 mb-4">Assiduité & Anomalies</h3>
                    <div className="flex justify-around items-center py-4">
                      <RadialGauge 
                        value={analytics.presenceRate} 
                        label="Taux de Présence" 
                        colorClass="text-success" 
                        trailColorClass="text-success/10" 
                      />
                      <RadialGauge 
                        value={analytics.anomalyRate} 
                        label="Taux d'Anomalie" 
                        colorClass="text-danger" 
                        trailColorClass="text-danger/10" 
                      />
                    </div>
                    <div className="text-[11px] text-foreground/50 mt-4 leading-relaxed">
                      * Taux de présence calculé sur les jours ouvrables (hors dimanches). Le taux d'anomalie correspond aux pointages incomplets nécessitant un arbitrage.
                    </div>
                  </div>

                  {/* Peak Hours activity Histogram in Morocco Local Time */}
                  <div className="glass-panel p-6 lg:col-span-2">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-foreground/60 mb-4">
                      Heures de Pointe à l'Atelier (Pointages par Heure locale)
                    </h3>
                    <PeakHoursHistogram data={analytics.peakHours || []} />
                    <div className="text-[11px] text-foreground/50 mt-3 leading-relaxed">
                      Distribution horaire exacte de tous les passages sur la pointeuse ZKTeco (fuseau horaire Maroc).
                    </div>
                  </div>
                </div>
              )}

              {/* --- DETAILED DAILY JOURNAL TABLE (When 1 employee is selected) --- */}
              {isSingleUser && selectedUser && (
                <div className="glass-panel overflow-hidden">
                  <div className="p-5 border-b border-border flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-primary" />
                        Journal Détaillé des Pointages & Heures Quotidiennes
                      </h2>
                      <p className="text-xs text-foreground/50">Historique complet jour par jour avec l'ensemble des pointages bruts enregistrés.</p>
                    </div>
                    <span className="text-xs font-semibold px-3 py-1 bg-surface border border-border rounded-lg text-foreground/70">
                      {selectedUser.dailyBreakdown.length} journées analysées
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-surface/60 text-xs uppercase tracking-wider text-foreground/60 border-b border-border">
                          <th className="p-4 font-bold">Date & Jour</th>
                          <th className="p-4 font-bold">1ère Entrée</th>
                          <th className="p-4 font-bold">Dernière Sortie</th>
                          <th className="p-4 font-bold">Pointages de la Journée</th>
                          <th className="p-4 font-bold text-right">Heures Normales</th>
                          <th className="p-4 font-bold text-right text-amber-500">Sup. {rate1Percent}%</th>
                          <th className="p-4 font-bold text-right text-purple-500">Sup. {rate2Percent}%</th>
                          <th className="p-4 font-bold text-right text-primary">Total Jour</th>
                          {canViewSalaries && (
                            <th className="p-4 font-bold text-right text-success">Coût ({currency})</th>
                          )}
                          <th className="p-4 font-bold text-center">Statut</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {selectedUser.dailyBreakdown.map((day: any) => {
                          const isRestDay = day.isSunday || day.status === "REST";
                          const isWorked = day.totalHours > 0;

                          return (
                            <tr key={day.date} className={`hover:bg-surface-hover/40 transition-colors ${isRestDay ? 'opacity-60 bg-surface/20' : ''}`}>
                              <td className="p-4 font-semibold text-foreground whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full ${isWorked ? 'bg-emerald-500' : isRestDay ? 'bg-slate-400' : 'bg-rose-500'}`} />
                                  <span>{day.dayName}</span>
                                  <span className="text-xs font-normal text-foreground/50">({day.formattedDate})</span>
                                </div>
                              </td>
                              <td className="p-4 font-medium text-foreground whitespace-nowrap">
                                {day.firstPunchIn ? (
                                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-xs font-bold">
                                    {day.firstPunchIn}
                                  </span>
                                ) : (
                                  <span className="text-foreground/30 text-xs">-</span>
                                )}
                              </td>
                              <td className="p-4 font-medium text-foreground whitespace-nowrap">
                                {day.lastPunchOut ? (
                                  <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20 text-xs font-bold">
                                    {day.lastPunchOut}
                                  </span>
                                ) : (
                                  <span className="text-foreground/30 text-xs">-</span>
                                )}
                              </td>
                              <td className="p-4">
                                {day.punches && day.punches.length > 0 ? (
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {day.punches.map((p: string, idx: number) => (
                                      <span 
                                        key={idx} 
                                        className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                                          idx % 2 === 0 
                                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                                            : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                                        }`}
                                      >
                                        {p}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-xs text-foreground/40 italic">Aucun pointage</span>
                                )}
                              </td>
                              <td className="p-4 text-right font-medium text-foreground">{day.regularHours.toFixed(2)}</td>
                              <td className="p-4 text-right font-medium text-amber-500">{day.overtime150Hours.toFixed(2)}</td>
                              <td className="p-4 text-right font-medium text-purple-500">{day.overtime200Hours.toFixed(2)}</td>
                              <td className="p-4 text-right font-bold text-primary">{day.totalHours.toFixed(2)}</td>
                              {canViewSalaries && (
                                <td className="p-4 text-right font-extrabold text-success whitespace-nowrap">
                                  {day.cost > 0 ? `${day.cost.toFixed(2)} ${currency}` : '-'}
                                </td>
                              )}
                              <td className="p-4 text-center whitespace-nowrap">
                                {day.status === "OK" && isWorked && (
                                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                    Présent
                                  </span>
                                )}
                                {day.status === "ANOMALY" && (
                                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20" title={day.anomalyReason}>
                                    ⚠️ Anomalie
                                  </span>
                                )}
                                {day.status === "LEAVE" && (
                                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                    Congé
                                  </span>
                                )}
                                {day.status === "HOLIDAY" && (
                                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                                    Férié
                                  </span>
                                )}
                                {day.status === "ABSENT" && !isWorked && (
                                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                                    Absent
                                  </span>
                                )}
                                {day.status === "REST" && (
                                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
                                    Repos
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* --- TEAM AGGREGATED TABLE (With Expandable Inline Accordion Rows) --- */}
              {!isSingleUser && (
                <div className="glass-panel overflow-hidden">
                  <div className="p-5 border-b border-border flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                        <Users className="w-5 h-5 text-primary" />
                        Aperçu du Tableau Agrégé par Salarié
                      </h2>
                      <p className="text-xs text-foreground/50">Cliquez sur un salarié pour déplier son journal quotidien détaillé.</p>
                    </div>
                    <span className="text-xs font-semibold px-3 py-1 bg-surface border border-border rounded-lg text-foreground/70">
                      {reports.length} collaborateurs
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-surface/60 text-xs uppercase tracking-wider text-foreground/60 border-b border-border">
                          <th className="p-4 font-bold w-12 text-center"></th>
                          <th className="p-4 font-bold">ID</th>
                          <th className="p-4 font-bold">Employé</th>
                          <th className="p-4 font-bold">Shift Assigné</th>
                          <th className="p-4 font-bold text-center">Jours Présents</th>
                          <th className="p-4 font-bold text-right">Heures Normales</th>
                          <th className="p-4 font-bold text-right text-amber-500">Heures Sup. {rate1Percent}%</th>
                          <th className="p-4 font-bold text-right text-purple-500">Heures Sup. {rate2Percent}%</th>
                          <th className="p-4 font-bold text-right text-primary">Total Général</th>
                          {canViewSalaries && (
                            <th className="p-4 font-bold text-right text-success">Coût Est. ({currency})</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {reports.map((row) => {
                          const isExpanded = !!expandedUsers[row.id];

                          return (
                            <React.Fragment key={row.id}>
                              {/* Main Employee Summary Row */}
                              <tr 
                                onClick={() => toggleExpand(row.id)}
                                className={`hover:bg-surface-hover/40 transition-colors cursor-pointer ${isExpanded ? 'bg-surface/40' : ''}`}
                              >
                                <td className="p-4 text-center">
                                  <button 
                                    type="button" 
                                    className="p-1 rounded hover:bg-surface text-foreground/50 hover:text-primary transition-colors"
                                  >
                                    {isExpanded ? <ChevronUp className="w-4 h-4 text-primary" /> : <ChevronDown className="w-4 h-4" />}
                                  </button>
                                </td>
                                <td className="p-4 font-mono font-bold text-foreground">{row.zktecoUserId}</td>
                                <td className="p-4">
                                  <div className="font-semibold text-foreground">
                                    {row.lastName.replace(/_/g, ' ').toUpperCase()} {row.firstName.replace(/_/g, ' ')}
                                  </div>
                                </td>
                                <td className="p-4">
                                  <span className="text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded font-medium">
                                    {row.shiftName}
                                  </span>
                                </td>
                                <td className="p-4 text-center">
                                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-xs font-bold">
                                    {row.daysWorked} jrs
                                  </span>
                                </td>
                                <td className="p-4 text-right font-medium text-foreground">{row.regularHours.toFixed(2)}</td>
                                <td className="p-4 text-right font-medium text-amber-500">{row.overtime150Hours.toFixed(2)}</td>
                                <td className="p-4 text-right font-medium text-purple-500">{row.overtime200Hours.toFixed(2)}</td>
                                <td className="p-4 text-right font-bold text-primary">{row.totalHours.toFixed(2)}</td>
                                {canViewSalaries && (
                                  <td className="p-4 text-right">
                                    <span className="font-extrabold text-success bg-success/10 border border-success/20 px-2.5 py-1 rounded-md text-sm shadow-sm inline-block whitespace-nowrap">
                                      {(row.totalCost || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                                    </span>
                                  </td>
                                )}
                              </tr>

                              {/* Accordion Expanded Day-by-Day Table */}
                              {isExpanded && row.dailyBreakdown && (
                                <tr className="bg-surface/20 border-b border-border/50">
                                  <td colSpan={canViewSalaries ? 10 : 9} className="p-4 pl-12">
                                    <div className="bg-background/80 rounded-xl border border-border p-4 space-y-3 shadow-inner">
                                      <div className="flex items-center justify-between text-xs font-bold text-foreground/70 border-b border-border pb-2">
                                        <span>Journal Quotidien Détaillé pour {row.firstName} {row.lastName}</span>
                                        <span>{row.dailyBreakdown.length} jours dans la plage</span>
                                      </div>

                                      <div className="overflow-x-auto">
                                        <table className="w-full text-xs text-left border-collapse">
                                          <thead>
                                            <tr className="text-foreground/50 border-b border-border/50">
                                              <th className="py-2 font-semibold">Date</th>
                                              <th className="py-2 font-semibold">Pointages de la Journée</th>
                                              <th className="py-2 text-right font-semibold">Normales</th>
                                              <th className="py-2 text-right font-semibold text-amber-500">OT {rate1Percent}%</th>
                                              <th className="py-2 text-right font-semibold text-purple-500">OT {rate2Percent}%</th>
                                              <th className="py-2 text-right font-semibold text-primary">Total</th>
                                              {canViewSalaries && (
                                                <th className="py-2 text-right font-semibold text-success">Coût ({currency})</th>
                                              )}
                                              <th className="py-2 text-center font-semibold">Statut</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-border/30">
                                            {row.dailyBreakdown.map((d: any) => (
                                              <tr key={d.date} className="hover:bg-surface/30">
                                                <td className="py-2 font-medium text-foreground whitespace-nowrap">
                                                  {d.dayName} {d.formattedDate}
                                                </td>
                                                <td className="py-2">
                                                  {d.punches && d.punches.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1">
                                                      {d.punches.map((p: string, idx: number) => (
                                                        <span key={idx} className="px-1.5 py-0.5 rounded bg-surface border border-border font-mono text-[10px] font-semibold text-foreground">
                                                          {p}
                                                        </span>
                                                      ))}
                                                    </div>
                                                  ) : (
                                                    <span className="text-foreground/30 italic text-[11px]">-</span>
                                                  )}
                                                </td>
                                                <td className="py-2 text-right text-foreground">{d.regularHours.toFixed(2)}</td>
                                                <td className="py-2 text-right text-amber-500">{d.overtime150Hours.toFixed(2)}</td>
                                                <td className="py-2 text-right text-purple-500">{d.overtime200Hours.toFixed(2)}</td>
                                                <td className="py-2 text-right font-bold text-primary">{d.totalHours.toFixed(2)}</td>
                                                {canViewSalaries && (
                                                  <td className="py-2 text-right font-bold text-success">
                                                    {d.cost > 0 ? `${d.cost.toFixed(2)} ${currency}` : '-'}
                                                  </td>
                                                )}
                                                <td className="py-2 text-center">
                                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-surface border border-border text-foreground/70">
                                                    {d.status}
                                                  </span>
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
