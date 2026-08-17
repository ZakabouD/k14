"use client";

import { useState } from "react";
import { Clock, X, Loader2 } from "lucide-react";
import { createShift, updateShift, deleteShift } from "../app/actions";

export function ShiftModal({ shift }: { shift?: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFlexible, setIsFlexible] = useState(shift ? shift.autoClose : false);

  const openModal = () => {
    setIsFlexible(shift ? shift.autoClose : false);
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    if (shift) {
      await updateShift(shift.id, formData);
    } else {
      await createShift(formData);
    }
    setIsSubmitting(false);
    setIsOpen(false);
  };

  const handleDelete = async () => {
    if (shift && window.confirm(`Are you sure you want to delete the shift "${shift.name}"? This will unassign any artisans currently on this shift.`)) {
      setIsSubmitting(true);
      await deleteShift(shift.id);
      setIsSubmitting(false);
      setIsOpen(false);
    }
  };

  return (
    <>
      {shift ? (
        <button 
          onClick={openModal}
          className="flex-1 py-2 rounded-lg bg-btn-sec-bg hover:bg-btn-sec-hover text-btn-sec-text text-sm font-medium transition-colors cursor-pointer border border-border"
        >
          Modifier
        </button>
      ) : (
        <button 
          onClick={openModal}
          className="bg-primary hover:bg-primary/95 text-white font-medium py-2.5 px-5 rounded-xl shadow-[0_0_15px_var(--primary-glow)] transition-all flex items-center gap-1.5 cursor-pointer text-sm"
        >
          <Clock className="w-4.5 h-4.5" />
          Créer un Shift
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 text-left">
            <div className="flex justify-between items-center p-6 border-b border-border">
              <h2 className="text-xl font-bold text-foreground">{shift ? "Modifier le Shift" : "Créer un Nouveau Shift"}</h2>
              <button onClick={() => setIsOpen(false)} className="text-foreground/50 hover:text-foreground transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground/70 mb-1">Nom du Shift</label>
                <input 
                  required 
                  name="name"
                  type="text" 
                  defaultValue={shift ? shift.name : ""}
                  placeholder="Ex: Shift Standard 8h"
                  className="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              {/* Flexible Shift Checkbox (placed at the top for clarity) */}
              <div className="flex items-start gap-2.5 p-3 bg-surface/50 border border-border rounded-xl">
                <input 
                  id="autoClose"
                  name="autoClose"
                  type="checkbox"
                  checked={isFlexible}
                  onChange={(e) => setIsFlexible(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary w-4.5 h-4.5 cursor-pointer mt-0.5"
                />
                <div>
                  <label htmlFor="autoClose" className="block text-sm font-bold text-foreground cursor-pointer select-none">
                    Shift Flexible (Sans pointage de sortie)
                  </label>
                  <span className="text-[11px] text-foreground/50 block mt-0.5 leading-snug">
                    Idéal pour les cadres et managers. Crédite automatiquement les heures de base quotidiennes dès le premier pointage de la journée (pas d&apos;anomalies de sortie manquante ou de retard).
                  </span>
                </div>
              </div>
              
              {!isFlexible ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground/70 mb-1">Heure de Début</label>
                      <input 
                        required 
                        name="startTime"
                        type="time" 
                        defaultValue={shift ? shift.startTime : "08:00"}
                        className="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground focus:outline-none focus:border-primary transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground/70 mb-1">Heure de Fin</label>
                      <input 
                        required 
                        name="endTime"
                        type="time" 
                        defaultValue={shift ? shift.endTime : "17:00"}
                        className="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground focus:outline-none focus:border-primary transition-colors"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground/70 mb-1">Marge de Retard (min)</label>
                      <input 
                        required 
                        name="gracePeriod"
                        type="number" 
                        defaultValue={shift ? shift.gracePeriod : "15"}
                        className="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground focus:outline-none focus:border-primary transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground/70 mb-1">Pause Déjeuner (min)</label>
                      <input 
                        required 
                        name="lunchBreak"
                        type="number" 
                        defaultValue={shift ? shift.lunchBreak : "0"}
                        placeholder="Ex: 60"
                        className="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground focus:outline-none focus:border-primary transition-colors"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <input type="hidden" name="startTime" value="00:00" />
                  <input type="hidden" name="endTime" value="00:00" />
                  <input type="hidden" name="gracePeriod" value="0" />
                  <input type="hidden" name="lunchBreak" value="0" />
                </>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground/70 mb-1">Heures de Base (Semaine)</label>
                  <input 
                    required 
                    name="baseHours"
                    type="number" 
                    step="0.5"
                    defaultValue={shift ? shift.baseHours : "8"}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground/70 mb-1">Heures de Base (Samedi)</label>
                  <input 
                    required 
                    name="saturdayHours"
                    type="number" 
                    step="0.5"
                    defaultValue={shift ? shift.saturdayHours : "4"}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                {shift && (
                  <button 
                    type="button" 
                    onClick={handleDelete}
                    disabled={isSubmitting}
                    className="mr-auto px-4 py-2 bg-danger/10 hover:bg-danger/20 disabled:opacity-50 text-danger font-medium text-sm rounded-lg transition-colors cursor-pointer"
                  >
                    Supprimer
                  </button>
                )}
                <button 
                  type="button" 
                  onClick={() => setIsOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg font-medium text-foreground/70 hover:bg-btn-sec-hover disabled:opacity-50 transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-medium py-2 px-6 rounded-lg transition-all flex items-center cursor-pointer"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  {shift ? "Sauvegarder" : "Créer le Shift"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
