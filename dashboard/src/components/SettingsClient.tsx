"use client";

import { useState, useEffect } from "react";
import { Settings as SettingsIcon, Network, Database, Loader2, Clock, Building2 } from "lucide-react";
import { saveAllSystemSettings, getSystemStatus } from "@/app/actions";
import { ContractTypeOption, MaritalStatusOption, LeaveTypeOption, parseContractTypes, parseMaritalStatuses, parseLeaveTypes } from "../lib/tags";

export default function SettingsClient({ initialSettings }: { initialSettings: any }) {
  const [isSaving, setIsSaving] = useState(false);

  const [contractTypes, setContractTypes] = useState<ContractTypeOption[]>(
    parseContractTypes(initialSettings?.contractTypes || "")
  );
  const [maritalStatuses, setMaritalStatuses] = useState<MaritalStatusOption[]>(
    parseMaritalStatuses(initialSettings?.maritalStatuses || "")
  );
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeOption[]>(
    parseLeaveTypes(initialSettings?.leaveTypes || "")
  );

  const [newContractInput, setNewContractInput] = useState("");
  const [newContractOvertime, setNewContractOvertime] = useState(true);

  const [newMaritalInput, setNewMaritalInput] = useState("");
  const [newMaritalChildren, setNewMaritalChildren] = useState(true);

  const [newLeaveInput, setNewLeaveInput] = useState("");
  const [newLeavePaid, setNewLeavePaid] = useState(true);

  const handleAddLeave = (e: React.MouseEvent) => {
    e.preventDefault();
    const name = newLeaveInput.trim();
    if (name && !leaveTypes.some(t => t.name.toLowerCase() === name.toLowerCase())) {
      setLeaveTypes([...leaveTypes, { name, isPaid: newLeavePaid }]);
      setNewLeaveInput("");
    }
  };

  const handleRemoveLeave = (name: string) => {
    setLeaveTypes(leaveTypes.filter(t => t.name !== name));
  };

  const handleAddContract = (e: React.MouseEvent) => {
    e.preventDefault();
    const name = newContractInput.trim();
    if (name && !contractTypes.some(t => t.name.toLowerCase() === name.toLowerCase())) {
      setContractTypes([...contractTypes, { name, hasOvertime: newContractOvertime }]);
      setNewContractInput("");
    }
  };

  const handleRemoveContract = (name: string) => {
    setContractTypes(contractTypes.filter(t => t.name !== name));
  };

  const handleAddMarital = (e: React.MouseEvent) => {
    e.preventDefault();
    const name = newMaritalInput.trim();
    if (name && !maritalStatuses.some(t => t.name.toLowerCase() === name.toLowerCase())) {
      setMaritalStatuses([...maritalStatuses, { name, allowChildren: newMaritalChildren }]);
      setNewMaritalInput("");
    }
  };

  const handleRemoveMarital = (name: string) => {
    setMaritalStatuses(maritalStatuses.filter(t => t.name !== name));
  };

  const handleAllSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    const formData = new FormData(e.currentTarget);
    try {
      const res = await saveAllSystemSettings(formData);
      if (res.success) {
        alert("Tous les paramètres système ont été sauvegardés avec succès !");
      } else {
        alert("Erreur: " + res.error);
      }
    } catch (err) {
      alert("Une erreur est survenue lors de la sauvegarde.");
    } finally {
      setIsSaving(false);
    }
  };

  const [bridgeOnline, setBridgeOnline] = useState(false);
  const [deviceOnline, setDeviceOnline] = useState(false);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await getSystemStatus();
        if (res.success) {
          setBridgeOnline(!!res.bridgeOnline);
          setDeviceOnline(!!res.deviceOnline);
        }
      } catch (err) {
        console.error("Failed to fetch system status in settings client:", err);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Configuration Système</h1>
          <p className="text-foreground/60 text-sm">Gérez la connexion de la machine ZKTeco, les règles de calcul et les listes RH.</p>
        </div>
        
        {/* Top-Right Unified Save Button */}
        <button
          type="submit"
          form="systemSettingsForm"
          disabled={isSaving}
          className="bg-primary hover:bg-primary/95 text-white font-semibold py-2.5 px-6 rounded-xl shadow-[0_0_15px_var(--primary-glow)] transition-all flex items-center gap-2 cursor-pointer text-sm disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : <SettingsIcon className="w-4.5 h-4.5" />}
          Enregistrer Tout
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Unified Settings Form */}
        <form id="systemSettingsForm" onSubmit={handleAllSave} className="lg:col-span-2 space-y-6">
          
          {/* Company Identity & Localization Card */}
          <div className="glass-panel p-6">
            <h2 className="text-lg font-bold text-foreground mb-5 flex items-center gap-2 border-b border-border/50 pb-3">
              <Building2 className="w-5 h-5 text-primary" />
              Identité de l'Entreprise & Paramètres Régionaux
            </h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground/75 mb-1.5 uppercase tracking-wider">Nom de l'Entreprise</label>
                  <input 
                    name="companyName"
                    required
                    type="text" 
                    defaultValue={initialSettings?.companyName || "Mon Entreprise"}
                    placeholder="Ex: Mon Entreprise"
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground focus:outline-none focus:border-primary transition-colors text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground/75 mb-1.5 uppercase tracking-wider">Devise Monétaire</label>
                  <input 
                    name="currency"
                    required
                    type="text" 
                    defaultValue={initialSettings?.currency || "DH"}
                    placeholder="Ex: DH, EUR, USD, DZD"
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground focus:outline-none focus:border-primary transition-colors text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground/75 mb-1.5 uppercase tracking-wider">Fuseau Horaire (Timezone)</label>
                  <input 
                    name="timezone"
                    required
                    type="text" 
                    defaultValue={initialSettings?.timezone || "Africa/Casablanca"}
                    placeholder="Ex: Africa/Casablanca, Europe/Paris"
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground focus:outline-none focus:border-primary transition-colors text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground/75 mb-1.5 uppercase tracking-wider">Email de Contact</label>
                  <input 
                    name="companyEmail"
                    type="email" 
                    defaultValue={initialSettings?.companyEmail || ""}
                    placeholder="Ex: contact@entreprise.com"
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground focus:outline-none focus:border-primary transition-colors text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground/75 mb-1.5 uppercase tracking-wider">Téléphone</label>
                  <input 
                    name="companyPhone"
                    type="text" 
                    defaultValue={initialSettings?.companyPhone || ""}
                    placeholder="Ex: +212 5 22 00 00 00"
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground focus:outline-none focus:border-primary transition-colors text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground/75 mb-1.5 uppercase tracking-wider">Adresse Physique</label>
                  <input 
                    name="companyAddress"
                    type="text" 
                    defaultValue={initialSettings?.companyAddress || ""}
                    placeholder="Ex: Zone Industrielle, Lot 45"
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground focus:outline-none focus:border-primary transition-colors text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
          
          {/* ZKTeco Hardware Card */}
          <div className="glass-panel p-6">
            <h2 className="text-lg font-bold text-foreground mb-5 flex items-center gap-2 border-b border-border/50 pb-3">
              <Network className="w-5 h-5 text-primary" />
              Connexion Matériel ZKTeco
            </h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground/75 mb-1.5 uppercase tracking-wider">Adresse IP</label>
                  <input 
                    name="deviceIp"
                    required
                    type="text" 
                    defaultValue={initialSettings?.deviceIp}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground focus:outline-none focus:border-primary transition-colors text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground/75 mb-1.5 uppercase tracking-wider">Port</label>
                  <input 
                    name="devicePort"
                    required
                    type="number" 
                    defaultValue={initialSettings?.devicePort}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground focus:outline-none focus:border-primary transition-colors text-sm"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-foreground/75 mb-1.5 uppercase tracking-wider">Délai d&apos;attente (Timeout en ms)</label>
                <input 
                  name="deviceTimeout"
                  required
                  type="number" 
                  defaultValue={initialSettings?.deviceTimeout}
                  className="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground focus:outline-none focus:border-primary transition-colors text-sm"
                />
              </div>
            </div>
          </div>

          {/* Overtime Settings Card */}
          <div className="glass-panel p-6">
            <h2 className="text-lg font-bold text-foreground mb-5 flex items-center gap-2 border-b border-border/50 pb-3">
              <Clock className="w-5 h-5 text-primary" />
              Règles de Calcul & Heures Supplémentaires
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-foreground/75 mb-1.5 uppercase tracking-wider">Seuil H. Sup Tier 1 (h/jour)</label>
                <input 
                  name="otThresholdLimit"
                  required
                  type="number"
                  step="0.1"
                  defaultValue={initialSettings?.otThresholdLimit ?? 2.0}
                  className="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground focus:outline-none focus:border-primary transition-colors text-sm"
                />
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-foreground/75 mb-1.5 uppercase tracking-wider">Taux H. Sup Tier 1 (%)</label>
                <input 
                  name="otRate1"
                  required
                  type="number"
                  step="1"
                  defaultValue={Math.round((initialSettings?.otRate1 ?? 1.5) * 100)}
                  className="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground focus:outline-none focus:border-primary transition-colors text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/75 mb-1.5 uppercase tracking-wider">Taux H. Sup Tier 2 (%)</label>
                <input 
                  name="otRate2"
                  required
                  type="number"
                  step="1"
                  defaultValue={Math.round((initialSettings?.otRate2 ?? 2.0) * 100)}
                  className="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground focus:outline-none focus:border-primary transition-colors text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/75 mb-1.5 uppercase tracking-wider">Marge de Tolérance Globale (min)</label>
                <input 
                  name="gracePeriod"
                  required
                  type="number"
                  min="0"
                  max="60"
                  step="1"
                  defaultValue={initialSettings?.gracePeriod ?? 15}
                  className="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground focus:outline-none focus:border-primary transition-colors text-sm"
                />
              </div>
            </div>
          </div>

          {/* HR Tags & Lists Card */}
          <div className="glass-panel p-6">
            <h2 className="text-lg font-bold text-foreground mb-5 flex items-center gap-2 border-b border-border/50 pb-3">
              <Database className="w-5 h-5 text-primary" />
              Configuration des Menus Déroulants (RH)
            </h2>
            
            <input type="hidden" name="contractTypes" value={JSON.stringify(contractTypes)} />
            <input type="hidden" name="maritalStatuses" value={JSON.stringify(maritalStatuses)} />
            <input type="hidden" name="leaveTypes" value={JSON.stringify(leaveTypes)} />

            <div className="space-y-6">
              {/* 1. Contract Types */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-foreground/80">Options pour &quot;Type de Contrat&quot;</label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={newContractInput}
                    onChange={(e) => setNewContractInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const name = newContractInput.trim();
                        if (name && !contractTypes.some(t => t.name.toLowerCase() === name.toLowerCase())) {
                          setContractTypes([...contractTypes, { name, hasOvertime: newContractOvertime }]);
                          setNewContractInput("");
                        }
                      }
                    }}
                    placeholder="Ex: CDI, CDD, ANAPEC..."
                    className="flex-1 bg-background border border-border rounded-lg px-4 py-2 text-foreground focus:outline-none focus:border-primary text-sm transition-colors"
                  />
                  <div className="flex items-center gap-2 px-3 py-2 bg-background border border-border rounded-lg text-sm select-none">
                    <input
                      id="newContractOvertime"
                      type="checkbox"
                      checked={newContractOvertime}
                      onChange={(e) => setNewContractOvertime(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                    />
                    <label htmlFor="newContractOvertime" className="text-xs text-foreground/80 cursor-pointer">Éligible Heures Sup.</label>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddContract}
                    className="bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 font-medium text-sm py-2 px-5 rounded-lg transition-colors cursor-pointer"
                  >
                    Ajouter
                  </button>
                </div>
                <div className="flex flex-wrap gap-2.5 pt-1">
                  {contractTypes.length === 0 ? (
                    <span className="text-xs text-foreground/40 italic">Aucun type de contrat défini.</span>
                  ) : (
                    contractTypes.map((tag) => (
                      <span key={tag.name} className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-btn-sec-bg text-foreground text-xs border border-border shadow-sm">
                        <span className="font-semibold">{tag.name}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-bold ${
                          tag.hasOvertime ? 'bg-success/10 text-success border border-success/15' : 'bg-foreground/5 text-foreground/60 border border-border'
                        }`}>
                          {tag.hasOvertime ? 'Heures Sup.' : 'Pas d\'H.S.'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveContract(tag.name)}
                          className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-danger hover:text-white text-foreground/50 transition-colors ml-1 cursor-pointer"
                        >
                          ✕
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* 2. Marital Statuses */}
              <div className="space-y-3 pt-2">
                <label className="block text-sm font-semibold text-foreground/80">Options pour &quot;Situation Familiale&quot;</label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={newMaritalInput}
                    onChange={(e) => setNewMaritalInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const name = newMaritalInput.trim();
                        if (name && !maritalStatuses.some(t => t.name.toLowerCase() === name.toLowerCase())) {
                          setMaritalStatuses([...maritalStatuses, { name, allowChildren: newMaritalChildren }]);
                          setNewMaritalInput("");
                        }
                      }
                    }}
                    placeholder="Ex: Célibataire, Marié(e)..."
                    className="flex-1 bg-background border border-border rounded-lg px-4 py-2 text-foreground focus:outline-none focus:border-primary text-sm transition-colors"
                  />
                  <div className="flex items-center gap-2 px-3 py-2 bg-background border border-border rounded-lg text-sm select-none">
                    <input
                      id="newMaritalChildren"
                      type="checkbox"
                      checked={newMaritalChildren}
                      onChange={(e) => setNewMaritalChildren(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                    />
                    <label htmlFor="newMaritalChildren" className="text-xs text-foreground/80 cursor-pointer">Autoriser Enfants</label>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddMarital}
                    className="bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 font-medium text-sm py-2 px-5 rounded-lg transition-colors cursor-pointer"
                  >
                    Ajouter
                  </button>
                </div>
                <div className="flex flex-wrap gap-2.5 pt-1">
                  {maritalStatuses.length === 0 ? (
                    <span className="text-xs text-foreground/40 italic">Aucune situation familiale définie.</span>
                  ) : (
                    maritalStatuses.map((tag) => (
                      <span key={tag.name} className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-btn-sec-bg text-foreground text-xs border border-border shadow-sm">
                        <span className="font-semibold">{tag.name}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-bold ${
                          tag.allowChildren ? 'bg-success/10 text-success border border-success/15' : 'bg-foreground/5 text-foreground/60 border border-border'
                        }`}>
                          {tag.allowChildren ? 'Enfants OK' : 'Pas d\'enfants'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveMarital(tag.name)}
                          className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-danger hover:text-white text-foreground/50 transition-colors ml-1 cursor-pointer"
                        >
                          ✕
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* 3. Leave Types */}
              <div className="space-y-3 pt-2">
                <label className="block text-sm font-semibold text-foreground/80">Options pour &quot;Motifs d&apos;Absence / Congés&quot;</label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={newLeaveInput}
                    onChange={(e) => setNewLeaveInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const name = newLeaveInput.trim();
                        if (name && !leaveTypes.some(t => t.name.toLowerCase() === name.toLowerCase())) {
                          setLeaveTypes([...leaveTypes, { name, isPaid: newLeavePaid }]);
                          setNewLeaveInput("");
                        }
                      }
                    }}
                    placeholder="Ex: Congé Payé, Maladie..."
                    className="flex-1 bg-background border border-border rounded-lg px-4 py-2 text-foreground focus:outline-none focus:border-primary text-sm transition-colors"
                  />
                  <div className="flex items-center gap-2 px-3 py-2 bg-background border border-border rounded-lg text-sm select-none">
                    <input
                      id="newLeavePaid"
                      type="checkbox"
                      checked={newLeavePaid}
                      onChange={(e) => setNewLeavePaid(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                    />
                    <label htmlFor="newLeavePaid" className="text-xs text-foreground/80 cursor-pointer">Absence Payée</label>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddLeave}
                    className="bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 font-medium text-sm py-2 px-5 rounded-lg transition-colors cursor-pointer"
                  >
                    Ajouter
                  </button>
                </div>
                <div className="flex flex-wrap gap-2.5 pt-1">
                  {leaveTypes.length === 0 ? (
                    <span className="text-xs text-foreground/40 italic">Aucun motif d&apos;absence défini.</span>
                  ) : (
                    leaveTypes.map((tag) => (
                      <span key={tag.name} className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-btn-sec-bg text-foreground text-xs border border-border shadow-sm">
                        <span className="font-semibold">{tag.name}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-bold ${
                          tag.isPaid ? 'bg-success/10 text-success border border-success/15' : 'bg-danger/10 text-danger border border-danger/15'
                        }`}>
                          {tag.isPaid ? 'Payé' : 'Non Payé'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveLeave(tag.name)}
                          className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-danger hover:text-white text-foreground/50 transition-colors ml-1 cursor-pointer"
                        >
                          ✕
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Unified Save Button */}
            <div className="pt-6 border-t border-border mt-6 flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="bg-primary hover:bg-primary/95 text-white font-semibold py-2.5 px-8 rounded-xl shadow-[0_0_15px_var(--primary-glow)] transition-all flex items-center gap-2 cursor-pointer text-sm disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : null}
                Enregistrer Tout
              </button>
            </div>
          </div>

        </form>

        {/* Right Status Column */}
        <div className="space-y-6">
          <div className="glass-panel p-6">
            <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2 border-b border-border/50 pb-3">
              <Database className="w-5 h-5 text-success" />
              État du Système
            </h2>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-border">
                <span className="text-sm text-foreground/70">Base de données</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-success/10 text-success">
                  Connecté
                </span>
              </div>
              
              <div className="flex justify-between items-center pb-3 border-b border-border">
                <span className="text-sm text-foreground/70">Raspberry Pi Bridge</span>
                {bridgeOnline ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-success/10 text-success">
                    Connecté
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-danger/10 text-danger">
                    Déconnecté
                  </span>
                )}
              </div>
              
              <div className="flex justify-between items-center pb-3 border-b border-border">
                <span className="text-sm text-foreground/70">ZKTeco Device</span>
                {deviceOnline ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-success/10 text-success">
                    Connecté
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-danger/10 text-danger">
                    Déconnecté
                  </span>
                )}
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-foreground/70">Version App</span>
                <span className="text-sm font-semibold text-foreground">v1.0.0</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
