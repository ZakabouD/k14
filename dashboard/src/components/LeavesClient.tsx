"use client";

import { useState } from "react";
import { createLeave, deleteLeave } from "@/app/actions";
import { formatDate } from "@/lib/utils";
import { Calendar, Users, FileText, Trash2, Plus, Search, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface LeavesClientProps {
  initialLeaves: any[];
  artisans: any[];
  leaveTypesList?: any[];
  canViewSalaries?: boolean;
}

export default function LeavesClient({ initialLeaves, artisans, leaveTypesList = [], canViewSalaries = true }: LeavesClientProps) {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [type, setType] = useState(leaveTypesList[0]?.name || "Congé Payé");
  const [comment, setComment] = useState("");
  
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const calculateLeaveCost = (user: any, startStr: string, endStr: string) => {
    if (!user || !startStr || !endStr) return { cost: 0, workingDays: 0, totalHours: 0 };
    const start = new Date(startStr);
    const end = new Date(endStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      return { cost: 0, workingDays: 0, totalHours: 0 };
    }

    let totalHours = 0;
    let workingDays = 0;
    const current = new Date(start);

    const hourlyRate = user.hourlyRate || 0;
    const shiftBaseHours = user.shift?.baseHours ?? 8.0;
    const shiftSaturdayHours = user.shift?.saturdayHours ?? 4.0;

    while (current <= end) {
      const dayOfWeek = current.getUTCDay();
      if (dayOfWeek !== 0) { // Skip Sunday
        workingDays++;
        const hours = dayOfWeek === 6 ? shiftSaturdayHours : shiftBaseHours;
        totalHours += hours;
      }
      current.setDate(current.getDate() + 1);
    }

    const cost = totalHours * hourlyRate;
    return { cost, workingDays, totalHours };
  };

  const selectedUser = artisans.find(a => a.id === userId);
  const formCostInfo = calculateLeaveCost(selectedUser, startDate, endDate);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!userId || !startDate || !endDate || !type) {
      setError("Veuillez remplir tous les champs obligatoires.");
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setError("La date de début ne peut pas être supérieure à la date de fin.");
      return;
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("userId", userId);
      formData.append("startDate", startDate);
      formData.append("endDate", endDate);
      formData.append("type", type);
      formData.append("comment", comment);

      const res = await createLeave(formData);
      if (res.success) {
        setSuccess("Absence enregistrée avec succès ! Les feuilles de pointage ont été recalculées.");
        // Reset form
        setUserId("");
        setStartDate("");
        setEndDate("");
        setType(leaveTypesList[0]?.name || "Congé Payé");
        setComment("");
        router.refresh();
      } else {
        setError(res.error || "Une erreur s'est produite.");
      }
    } catch (err) {
      setError("Erreur de communication avec le serveur.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Voulez-vous vraiment supprimer cette absence ? Les calculs d'heures seront recalculés pour cette période.")) {
      return;
    }

    try {
      const res = await deleteLeave(id);
      if (res.success) {
        router.refresh();
      } else {
        alert(res.error || "Impossible de supprimer l'absence.");
      }
    } catch (err) {
      alert("Erreur lors de la suppression.");
    }
  };

  // Helper translations and styles
  const getLeaveTypeDetails = (t: string) => {
    const customConfig = leaveTypesList.find(l => l.name === t);
    if (customConfig) {
      return { 
        label: customConfig.name, 
        badge: customConfig.isPaid ? "bg-success/10 text-success border-success/20" : "bg-danger/10 text-danger border-danger/20" 
      };
    }
    switch (t) {
      case "CONGE_PAYE":
        return { label: "Congé Payé", badge: "bg-primary/10 text-primary border-primary/20" };
      case "MALADIE":
        return { label: "Maladie", badge: "bg-danger/10 text-danger border-danger/20" };
      case "RTT":
        return { label: "RTT", badge: "bg-warning/10 text-warning border-warning/20" };
      case "SANS_SOLDE":
        return { label: "Sans Solde", badge: "bg-foreground/15 text-foreground/70 border-border" };
      case "RECUPERATION":
        return { label: "Récupération", badge: "bg-success/10 text-success border-success/20" };
      default:
        return { label: t, badge: "bg-foreground/10 text-foreground border-border" };
    }
  };

  // Filter leaves based on search input
  const filteredLeaves = initialLeaves.filter(leave => {
    const fullName = `${leave.user.firstName} ${leave.user.lastName}`.toLowerCase();
    const zktecoId = leave.user.zktecoUserId.toLowerCase();
    return fullName.includes(searchTerm.toLowerCase()) || zktecoId.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Gestion des Absences & Congés</h1>
        <p className="text-foreground/60">Enregistrez les congés du personnel pour suspendre automatiquement les anomalies de pointage.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Form Panel */}
        <div className="glass-panel p-6 h-fit">
          <h2 className="text-lg font-bold text-foreground mb-6 flex items-center">
            <Plus className="w-5 h-5 mr-2 text-primary" />
            Enregistrer une absence
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm font-medium">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-success text-sm font-medium">
                {success}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-foreground/70 mb-2 flex items-center">
                <Users className="w-4 h-4 mr-2 text-primary" />
                Employé *
              </label>
              <select
                required
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
              >
                <option value="">-- Sélectionner un employé --</option>
                {artisans.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.lastName.replace(/_/g, " ").toUpperCase()} {a.firstName.replace(/_/g, " ")} (ID: {a.zktecoUserId})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground/70 mb-2 flex items-center">
                <Calendar className="w-4 h-4 mr-2 text-primary" />
                Date de début *
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
                Date de fin (Inclus) *
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
                <FileText className="w-4 h-4 mr-2 text-primary" />
                Motif de l'absence *
              </label>
              <select
                required
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
              >
                {leaveTypesList.map(item => (
                  <option key={item.name} value={item.name}>{item.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground/70 mb-2 flex items-center">
                <FileText className="w-4 h-4 mr-2 text-primary" />
                Commentaire / Note
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Facultatif (ex: Arrêt maladie transmis, etc.)"
                rows={3}
                className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground focus:outline-none focus:border-primary transition-colors resize-none"
              />
            </div>

            {formCostInfo.workingDays > 0 && (
              <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-primary uppercase tracking-wider">Coût Estimé de l'Absence</p>
                  <p className="text-[11px] text-foreground/60">{formCostInfo.workingDays} jour(s) ouvré(s) • {formCostInfo.totalHours.toFixed(1)}h</p>
                </div>
                <div className="text-right font-extrabold text-lg text-primary">
                  {canViewSalaries ? `${formCostInfo.cost.toFixed(2)} DH` : 'Confidentiel'}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary/95 transition-colors flex items-center justify-center cursor-pointer shadow-[0_0_15px_rgba(var(--primary-glow-color),0.4)] disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Calcul en cours...
                </>
              ) : (
                "Enregistrer l'absence"
              )}
            </button>
          </form>
        </div>

        {/* Right Column: List Panel */}
        <div className="glass-panel p-6 lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <h2 className="text-lg font-bold text-foreground">Absences Enregistrées</h2>
              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  placeholder="Rechercher un employé..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                />
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-foreground/40" />
              </div>
            </div>

            {filteredLeaves.length === 0 ? (
              <div className="text-center py-16 text-foreground/50 border border-dashed border-border rounded-xl">
                <Calendar className="w-12 h-12 mx-auto mb-3 text-foreground/30" />
                <p className="text-sm">Aucun congé enregistré pour le moment.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface/50 text-xs uppercase tracking-wider text-foreground/50 border-b border-border">
                      <th className="p-4 font-semibold">Employé</th>
                      <th className="p-4 font-semibold">Période</th>
                      <th className="p-4 font-semibold">Motif</th>
                      <th className="p-4 font-semibold">Coût Estimé</th>
                      <th className="p-4 font-semibold">Notes</th>
                      <th className="p-4 font-semibold text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredLeaves.map((leave) => {
                      const { label, badge } = getLeaveTypeDetails(leave.type);
                      const costInfo = calculateLeaveCost(leave.user, leave.startDate, leave.endDate);
                      return (
                        <tr key={leave.id} className="hover:bg-surface-hover/30 transition-colors text-sm">
                          <td className="p-4">
                            <span className="font-bold text-foreground">
                              {leave.user.lastName.replace(/_/g, " ").toUpperCase()}
                            </span>{" "}
                            {leave.user.firstName.replace(/_/g, " ")}
                            <p className="text-xs text-foreground/50">ID: {leave.user.zktecoUserId}</p>
                          </td>
                          <td className="p-4 text-foreground/90 font-medium">
                            <div className="flex flex-col">
                              <span>Du {formatDate(leave.startDate)}</span>
                              <span>Au {formatDate(leave.endDate)}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge}`}>
                              {label}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className="font-bold text-primary">
                              {canViewSalaries ? `${costInfo.cost.toFixed(2)} DH` : "Confidentiel"}
                            </span>
                            <p className="text-[11px] text-foreground/50 font-normal">
                              {costInfo.workingDays}j ({costInfo.totalHours.toFixed(1)}h)
                            </p>
                          </td>
                          <td className="p-4 text-foreground/60 max-w-[200px] truncate" title={leave.comment || ""}>
                            {leave.comment || "—"}
                          </td>
                          <td className="p-4 text-center">
                            <button
                              onClick={() => handleDelete(leave.id)}
                              className="p-2 text-danger hover:bg-danger/10 rounded-lg transition-colors inline-flex items-center justify-center cursor-pointer"
                              title="Supprimer l'absence"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
