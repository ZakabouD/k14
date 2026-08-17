"use client";

import { useState } from "react";
import { createHoliday, deleteHoliday, importPublicHolidays } from "@/app/actions";
import { formatDate } from "@/lib/utils";
import { Calendar, Tag, Trash2, Plus, Download, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface HolidaysClientProps {
  initialHolidays: any[];
}

export default function HolidaysClient({ initialHolidays }: HolidaysClientProps) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!date || !name) {
      setError("Veuillez renseigner tous les champs.");
      return;
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("date", date);
      formData.append("name", name);

      const res = await createHoliday(formData);
      if (res.success) {
        setSuccess("Jour férié enregistré avec succès !");
        setDate("");
        setName("");
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
    if (!confirm("Voulez-vous vraiment supprimer ce jour férié ? Les calculs d'heures seront recalculés pour ce jour.")) {
      return;
    }

    try {
      const res = await deleteHoliday(id);
      if (res.success) {
        router.refresh();
      } else {
        alert(res.error || "Impossible de supprimer le jour férié.");
      }
    } catch (err) {
      alert("Erreur lors de la suppression.");
    }
  };

  const handleImport = async () => {
    setError("");
    setSuccess("");
    setIsImporting(true);

    try {
      const res = await importPublicHolidays();
      if (res.success) {
        const currentYear = new Date().getFullYear();
        if (res.importedCount > 0) {
          setSuccess(`${res.importedCount} jours fériés importés avec succès pour l'année ${currentYear} !`);
        } else {
          setSuccess(`Tous les jours fériés de ${currentYear} sont déjà configurés.`);
        }
        router.refresh();
      } else {
        setError("Erreur lors de l'importation.");
      }
    } catch (err) {
      setError("Erreur de communication avec le serveur.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Configuration des Jours Fériés</h1>
          <p className="text-foreground/60">Configurez les jours fériés pour comptabiliser les heures travaillées à 200%.</p>
        </div>
        <button
          onClick={handleImport}
          disabled={isImporting}
          className="px-5 py-2.5 bg-btn-sec-bg hover:bg-btn-sec-hover text-btn-sec-text border border-border font-semibold text-sm rounded-lg transition-colors flex items-center justify-center cursor-pointer disabled:opacity-50"
        >
          {isImporting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Importation...
            </>
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              Importer les Jours Fériés (Maroc {new Date().getFullYear()})
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Form Panel */}
        <div className="glass-panel p-6 h-fit">
          <h2 className="text-lg font-bold text-foreground mb-6 flex items-center">
            <Plus className="w-5 h-5 mr-2 text-primary" />
            Ajouter un jour férié
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
                <Calendar className="w-4 h-4 mr-2 text-primary" />
                Date *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground/70 mb-2 flex items-center">
                <Tag className="w-4 h-4 mr-2 text-primary" />
                Libellé / Nom *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ex: Fête du Travail"
                className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground focus:outline-none focus:border-primary transition-colors"
              />
            </div>

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
                "Ajouter le jour férié"
              )}
            </button>
          </form>
        </div>

        {/* Right Column: List Panel */}
        <div className="glass-panel p-6 lg:col-span-2">
          <h2 className="text-lg font-bold text-foreground mb-6">Jours Fériés Configurés</h2>

          {initialHolidays.length === 0 ? (
            <div className="text-center py-16 text-foreground/50 border border-dashed border-border rounded-xl">
              <Calendar className="w-12 h-12 mx-auto mb-3 text-foreground/30" />
              <p className="text-sm">Aucun jour férié configuré pour le moment.</p>
              <p className="text-xs text-foreground/40 mt-1">Utilisez le bouton d'importation en haut à droite pour ajouter rapidement les jours fériés de {new Date().getFullYear()}.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface/50 text-xs uppercase tracking-wider text-foreground/50 border-b border-border">
                    <th className="p-4 font-semibold">Date</th>
                    <th className="p-4 font-semibold">Libellé</th>
                    <th className="p-4 font-semibold text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {initialHolidays.map((h) => (
                    <tr key={h.id} className="hover:bg-surface-hover/30 transition-colors text-sm">
                      <td className="p-4 text-foreground font-bold">
                        {formatDate(h.date)}
                      </td>
                      <td className="p-4 text-foreground/90 font-medium">
                        {h.name}
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => handleDelete(h.id)}
                          className="p-2 text-danger hover:bg-danger/10 rounded-lg transition-colors inline-flex items-center justify-center cursor-pointer"
                          title="Supprimer le jour férié"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
