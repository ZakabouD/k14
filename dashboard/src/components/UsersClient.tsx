"use client";

import { useState, useTransition } from "react";
import { 
  UserPlus, 
  ShieldCheck, 
  Edit3, 
  Trash2, 
  X, 
  Loader2, 
  Key, 
  Check, 
  Lock,
  User,
  Mail,
  Users,
  Info,
  Sliders,
  Shield,
  Eye,
  Settings as SettingsIcon,
  Calendar,
  Clock
} from "lucide-react";
import { 
  createDashboardUser, 
  updateDashboardUser, 
  deleteDashboardUser,
  updateAdminCredentials
} from "@/app/actions";

interface DashboardUserType {
  id: string;
  email: string;
  name: string;
  role: string;
  canManagePersonnel: boolean;
  canManageShifts: boolean;
  canManageLeaves: boolean;
  canViewSalaries: boolean;
  canManageSettings: boolean;
  createdAt: string;
}

export default function UsersClient({ 
  initialUsers, 
  currentUserId,
  masterAdminEmail
}: { 
  initialUsers: DashboardUserType[], 
  currentUserId: string,
  masterAdminEmail: string
}) {
  const [users, setUsers] = useState<DashboardUserType[]>(initialUsers);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<DashboardUserType | null>(null);
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("MANAGER");
  const [canManagePersonnel, setCanManagePersonnel] = useState(false);
  const [canManageShifts, setCanManageShifts] = useState(false);
  const [canManageLeaves, setCanManageLeaves] = useState(false);
  const [canViewSalaries, setCanViewSalaries] = useState(false);
  const [canManageSettings, setCanManageSettings] = useState(false);

  const openCreateModal = () => {
    setEditingUser(null);
    setName("");
    setEmail("");
    setPassword("");
    setRole("MANAGER");
    setCanManagePersonnel(false);
    setCanManageShifts(false);
    setCanManageLeaves(false);
    setCanViewSalaries(false);
    setCanManageSettings(false);
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const openEditModal = (user: DashboardUserType) => {
    setEditingUser(user);
    setName(user.name);
    setEmail(user.email);
    setPassword("");
    setRole(user.role);
    setCanManagePersonnel(user.canManagePersonnel);
    setCanManageShifts(user.canManageShifts);
    setCanManageLeaves(user.canManageLeaves);
    setCanViewSalaries(user.canViewSalaries);
    setCanManageSettings(user.canManageSettings);
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const openEditMasterAdminModal = () => {
    const virtualMasterAdmin: DashboardUserType = {
      id: "master-admin",
      name: "Administrateur Système (Maître)",
      email: masterAdminEmail,
      role: "SUPERADMIN",
      canManagePersonnel: true,
      canManageShifts: true,
      canManageLeaves: true,
      canViewSalaries: true,
      canManageSettings: true,
      createdAt: ""
    };
    openEditModal(virtualMasterAdmin);
  };

  const handleRoleChange = (selectedRole: string) => {
    setRole(selectedRole);
    if (selectedRole === "SUPERADMIN") {
      setCanManagePersonnel(true);
      setCanManageShifts(true);
      setCanManageLeaves(true);
      setCanViewSalaries(true);
      setCanManageSettings(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (editingUser?.id === "master-admin") {
      const formData = new FormData();
      formData.append("adminEmail", email);
      formData.append("newPassword", password);

      startTransition(async () => {
        const result = await updateAdminCredentials(formData);
        if (result.success) {
          window.location.reload();
        } else {
          setErrorMessage(result.error || "Une erreur s'est produite lors de la modification des identifiants maîtres.");
        }
      });
      return;
    }

    const formData = new FormData();
    if (editingUser) {
      formData.append("userId", editingUser.id);
    }
    formData.append("name", name);
    formData.append("email", email);
    formData.append("password", password);
    formData.append("role", role);
    formData.append("canManagePersonnel", String(canManagePersonnel));
    formData.append("canManageShifts", String(canManageShifts));
    formData.append("canManageLeaves", String(canManageLeaves));
    formData.append("canViewSalaries", String(canViewSalaries));
    formData.append("canManageSettings", String(canManageSettings));

    startTransition(async () => {
      let result;
      if (editingUser) {
        result = await updateDashboardUser(formData);
      } else {
        result = await createDashboardUser(formData);
      }

      if (result.success) {
        window.location.reload();
      } else {
        setErrorMessage(result.error || "Une erreur s'est produite.");
      }
    });
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cet utilisateur ? Cette action est irréversible.")) {
      return;
    }

    startTransition(async () => {
      const result = await deleteDashboardUser(userId);
      if (result.success) {
        window.location.reload();
      } else {
        alert(result.error);
      }
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 pb-2">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Comptes & Habilitations</h1>
          </div>
          <p className="text-foreground/60 text-sm">Gérez les comptes administratifs de la plateforme et configurez finement leurs droits d&apos;accès.</p>
        </div>
        <button 
          onClick={openCreateModal}
          className="bg-primary hover:bg-primary/95 text-white font-medium py-3 px-6 rounded-xl transition-all shadow-[0_0_20px_var(--primary-glow)] hover:shadow-[0_0_30px_var(--primary-glow)] flex items-center justify-center gap-2 cursor-pointer text-sm w-full sm:w-auto hover:-translate-y-0.5 duration-200"
        >
          <UserPlus className="w-4.5 h-4.5" />
          Créer un Utilisateur
        </button>
      </div>

      {/* Main Table Panel */}
      <div className="glass-panel border border-border/80 shadow-xl overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface/50 text-xs font-bold uppercase tracking-wider text-foreground/50 border-b border-border">
                <th className="py-5 px-6 font-semibold border-b border-border w-[25%]">Nom complet</th>
                <th className="py-5 px-6 font-semibold border-b border-border w-[25%]">Adresse Email</th>
                <th className="py-5 px-6 font-semibold text-center border-b border-border w-[12%]">Rôle</th>
                <th className="py-5 px-6 font-semibold text-left border-b border-border w-[28%]">Habilitations & Accès</th>
                <th className="py-5 px-6 font-semibold text-right border-b border-border w-[10%]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-sm">
              
              {/* Virtual Master System Admin Row */}
              <tr className="bg-primary/5 hover:bg-primary/[0.08] transition-colors duration-150">
                <td className="py-5 px-6">
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-xl bg-warning/15 text-warning flex items-center justify-center font-bold mr-3.5 shadow-sm border border-warning/20">
                      AS
                    </div>
                    <div>
                      <p className="font-bold text-foreground">Administrateur Système (Maître)</p>
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider bg-warning/10 text-warning px-2 py-0.5 rounded-md border border-warning/20 mt-1">
                        Compte Racine
                      </span>
                    </div>
                  </div>
                </td>
                <td className="py-5 px-6 font-mono text-xs text-foreground/75">{masterAdminEmail}</td>
                <td className="py-5 px-6 text-center">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-wide bg-gradient-to-r from-warning/20 to-warning/10 text-warning border border-warning/30 shadow-sm">
                    SUPERADMIN
                  </span>
                </td>
                {/* Master Admin Accréditations */}
                <td className="py-5 px-6">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    Accès Total Illimité
                  </span>
                </td>
                <td className="py-5 px-6 text-right">
                  <div className="flex justify-end gap-2.5">
                    <button 
                      onClick={openEditMasterAdminModal}
                      className="p-2 rounded-xl bg-surface hover:bg-surface-hover border border-border text-foreground/75 hover:text-foreground transition-all cursor-pointer hover:scale-105 duration-155"
                      title="Modifier les identifiants de l'administrateur maître"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <div className="p-2 rounded-xl bg-surface/50 border border-border text-foreground/35 cursor-not-allowed" title="Compte système racine protégé contre la suppression">
                      <Lock className="w-4 h-4" />
                    </div>
                  </div>
                </td>
              </tr>

              {/* Custom Created Users */}
              {users.map((user) => {
                const perms = [];
                if (user.role === 'SUPERADMIN') {
                  perms.push(
                    <span key="all" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      Accès Total Illimité
                    </span>
                  );
                } else {
                  if (user.canManagePersonnel) {
                    perms.push(
                      <span key="pers" className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-surface border border-border/80 text-foreground/80" title="Gestion du Personnel">
                        <User className="w-3 h-3" />
                        Personnel
                      </span>
                    );
                  }
                  if (user.canManageShifts) {
                    perms.push(
                      <span key="shifts" className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-surface border border-border/80 text-foreground/80" title="Gestion des Shifts">
                        <Clock className="w-3 h-3" />
                        Shifts
                      </span>
                    );
                  }
                  if (user.canManageLeaves) {
                    perms.push(
                      <span key="leaves" className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-surface border border-border/80 text-foreground/80" title="Gestion des Congés & Jours Fériés">
                        <Calendar className="w-3 h-3" />
                        Congés
                      </span>
                    );
                  }
                  if (user.canViewSalaries) {
                    perms.push(
                      <span key="salaries" className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-primary/10 border border-primary/20 text-primary" title="Accès aux Salaires & Coûts">
                        <Eye className="w-3 h-3" />
                        Salaires
                      </span>
                    );
                  }
                  if (user.canManageSettings) {
                    perms.push(
                      <span key="settings" className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-surface border border-border/80 text-foreground/80" title="Configuration du Système">
                        <SettingsIcon className="w-3 h-3" />
                        Paramètres
                      </span>
                    );
                  }
                  if (perms.length === 0) {
                    perms.push(
                      <span key="none" className="text-xs text-foreground/35 italic">Aucun accès configuré</span>
                    );
                  }
                }

                return (
                  <tr key={user.id} className="hover:bg-surface/30 transition-colors duration-150">
                    <td className="py-5 px-6">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold mr-3.5 shadow-sm border border-primary/20">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <p className="font-bold text-foreground">{user.name}</p>
                      </div>
                    </td>
                    <td className="py-5 px-6 font-mono text-xs text-foreground/75">{user.email}</td>
                    <td className="py-5 px-6 text-center">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-wide ${
                        user.role === 'SUPERADMIN' 
                          ? 'bg-gradient-to-r from-warning/20 to-warning/10 text-warning border border-warning/30 shadow-sm' 
                          : user.role === 'ADMIN'
                          ? 'bg-gradient-to-r from-blue-500/20 to-blue-500/10 text-blue-400 border border-blue-500/30 shadow-sm'
                          : 'bg-gradient-to-r from-emerald-500/20 to-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-sm'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    
                    {/* Permissions tags grouped in a row */}
                    <td className="py-5 px-6">
                      <div className="flex flex-wrap gap-1.5">
                        {perms}
                      </div>
                    </td>
                    
                    {/* Actions column */}
                    <td className="py-5 px-6 text-right">
                      <div className="flex justify-end gap-2.5">
                        <button 
                          onClick={() => openEditModal(user)}
                          className="p-2 rounded-xl bg-surface hover:bg-surface-hover border border-border text-foreground/75 hover:text-foreground transition-all cursor-pointer hover:scale-105 duration-155"
                          title="Modifier les accréditations"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {user.id !== currentUserId ? (
                          <button 
                            onClick={() => handleDelete(user.id)}
                            className="p-2 rounded-xl bg-danger/10 hover:bg-danger/25 border border-danger/20 text-danger transition-all cursor-pointer hover:scale-105 duration-155"
                            title="Supprimer le compte"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <div className="p-2 rounded-xl bg-surface/50 border border-border text-foreground/35 cursor-not-allowed" title="Votre propre session active">
                            <Lock className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* Empty state illustration if no custom users exist */}
              {users.length === 0 && (
                <tr className="bg-surface/5">
                  <td colSpan={5} className="py-14 px-6">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="p-4 rounded-2xl bg-surface border border-border/80 text-foreground/45 mb-4 shadow-inner">
                        <Users className="w-8 h-8" />
                      </div>
                      <h3 className="text-base font-bold text-foreground mb-1">Aucun utilisateur configuré</h3>
                      <p className="text-sm text-foreground/50 max-w-sm">Vous n&apos;avez pas encore créé de comptes administrateurs supplémentaires pour gérer la plateforme.</p>
                      <button 
                        onClick={openCreateModal}
                        className="mt-4 text-xs font-bold text-primary hover:text-primary/80 flex items-center gap-1 cursor-pointer bg-primary/10 border border-primary/20 px-4 py-2 rounded-lg transition-colors"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Créer le premier utilisateur
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh] border border-border shadow-2xl rounded-2xl">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-border/80 flex items-center justify-between bg-surface/30">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Shield className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold text-foreground">
                  {editingUser?.id === "master-admin" 
                    ? "Modifier l'Administrateur Système" 
                    : editingUser 
                    ? "Modifier l'Utilisateur" 
                    : "Créer un Compte Admin"}
                </h2>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-lg hover:bg-surface-hover text-foreground/60 hover:text-foreground transition-colors cursor-pointer border border-transparent hover:border-border"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1 bg-background/50">
              {errorMessage && (
                <div className="p-4 bg-danger/10 border border-danger/20 rounded-xl text-danger text-sm flex items-start gap-2.5">
                  <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Login Info Card */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground/50 flex items-center gap-1.5 mb-1">
                  <User className="w-3.5 h-3.5" />
                  Informations de Connexion
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-foreground/75 mb-1.5">Nom Complet</label>
                    <div className="relative">
                      <input 
                        required
                        disabled={editingUser?.id === "master-admin"}
                        type="text" 
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-background/80 disabled:opacity-60 disabled:cursor-not-allowed border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200"
                        placeholder="Ex: Omar Bensalah"
                      />
                      <User className="w-4.5 h-4.5 text-foreground/45 absolute left-3.5 top-3.5" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-foreground/75 mb-1.5">Adresse Email</label>
                    <div className="relative">
                      <input 
                        required
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-background/80 border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200"
                        placeholder="Ex: manager@example.com"
                      />
                      <Mail className="w-4.5 h-4.5 text-foreground/45 absolute left-3.5 top-3.5" />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-foreground/75">Mot de Passe</label>
                    {editingUser && (
                      <span className="text-[10px] text-foreground/40 italic">Laisser vide pour ne pas modifier</span>
                    )}
                  </div>
                  <div className="relative">
                    <input 
                      required={!editingUser}
                      type="password" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-background/80 border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200"
                      placeholder={editingUser ? "•••••••• (Changer le mot de passe)" : "Définir le mot de passe"}
                    />
                    <Key className="w-4.5 h-4.5 text-foreground/45 absolute left-3.5 top-3.5" />
                  </div>
                </div>
              </div>

              {/* Radio Group for Role */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground/50 flex items-center gap-1.5 mb-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Rôle & Niveau d&apos;Accès
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  
                  {/* MANAGER Card */}
                  <label className={`flex flex-col p-4 rounded-xl border transition-all duration-150 ${
                    editingUser?.id === "master-admin"
                      ? "opacity-50 cursor-not-allowed border-border bg-background/30 text-foreground/45"
                      : role === "MANAGER" 
                      ? "border-emerald-500 bg-emerald-500/5 text-emerald-400 cursor-pointer" 
                      : "border-border bg-background/50 hover:bg-surface/50 text-foreground/80 cursor-pointer"
                  }`}>
                    <input 
                      type="radio" 
                      name="role" 
                      value="MANAGER"
                      disabled={editingUser?.id === "master-admin"}
                      checked={role === "MANAGER"}
                      onChange={() => handleRoleChange("MANAGER")}
                      className="sr-only"
                    />
                    <span className="font-bold text-sm mb-1">MANAGER</span>
                    <span className="text-[10px] opacity-75 leading-relaxed">Lecture seule et modifications standards de base.</span>
                  </label>

                  {/* ADMIN Card */}
                  <label className={`flex flex-col p-4 rounded-xl border transition-all duration-150 ${
                    editingUser?.id === "master-admin"
                      ? "opacity-50 cursor-not-allowed border-border bg-background/30 text-foreground/45"
                      : role === "ADMIN" 
                      ? "border-blue-500 bg-blue-500/5 text-blue-400 cursor-pointer" 
                      : "border-border bg-background/50 hover:bg-surface/50 text-foreground/80 cursor-pointer"
                  }`}>
                    <input 
                      type="radio" 
                      name="role" 
                      value="ADMIN"
                      disabled={editingUser?.id === "master-admin"}
                      checked={role === "ADMIN"}
                      onChange={() => handleRoleChange("ADMIN")}
                      className="sr-only"
                    />
                    <span className="font-bold text-sm mb-1">ADMINISTRATEUR</span>
                    <span className="text-[10px] opacity-75 leading-relaxed">Habilitations personnalisables selon les besoins.</span>
                  </label>

                  {/* SUPERADMIN Card */}
                  <label className={`flex flex-col p-4 rounded-xl border transition-all duration-150 ${
                    editingUser?.id === "master-admin"
                      ? "border-warning bg-warning/5 text-warning cursor-not-allowed"
                      : role === "SUPERADMIN" 
                      ? "border-warning bg-warning/5 text-warning cursor-pointer" 
                      : "border-border bg-background/50 hover:bg-surface/50 text-foreground/80 cursor-pointer"
                  }`}>
                    <input 
                      type="radio" 
                      name="role" 
                      value="SUPERADMIN"
                      disabled={editingUser?.id === "master-admin"}
                      checked={role === "SUPERADMIN"}
                      onChange={() => handleRoleChange("SUPERADMIN")}
                      className="sr-only"
                    />
                    <span className="font-bold text-sm mb-1">SUPERADMIN</span>
                    <span className="text-[10px] opacity-75 leading-relaxed">Contrôle complet et accès illimité aux données.</span>
                  </label>

                </div>
              </div>

              {/* Custom Fine-Grained Permissions Panel */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground/50 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5" />
                  Habilitations Détaillées
                </h3>

                <div className="bg-surface/20 border border-border rounded-xl p-4 space-y-4">
                  {(role === "SUPERADMIN" || editingUser?.id === "master-admin") && (
                    <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg text-warning text-xs flex items-center gap-2 mb-1">
                      <Lock className="w-4 h-4 flex-shrink-0" />
                      <span>Les super-administrateurs possèdent d&apos;office toutes les autorisations.</span>
                    </div>
                  )}

                  <div className="space-y-3.5">
                    
                    {/* Permission Item 1 */}
                    <div className="flex items-start justify-between gap-4 p-2.5 rounded-lg hover:bg-surface/10 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-surface border border-border text-foreground/75 mt-0.5">
                          <User className="w-4 h-4" />
                        </div>
                        <div>
                          <label htmlFor="canManagePersonnel" className="block text-sm font-bold text-foreground cursor-pointer select-none">
                            Gestion du Personnel
                          </label>
                          <span className="text-xs text-foreground/50">Ajouter, modifier ou réassigner les employés/artisans.</span>
                        </div>
                      </div>
                      <input 
                        id="canManagePersonnel"
                        type="checkbox"
                        checked={canManagePersonnel}
                        disabled={role === "SUPERADMIN" || editingUser?.id === "master-admin"}
                        onChange={(e) => setCanManagePersonnel(e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary w-5 h-5 cursor-pointer disabled:opacity-50 mt-1"
                      />
                    </div>

                    {/* Permission Item 2 */}
                    <div className="flex items-start justify-between gap-4 p-2.5 rounded-lg hover:bg-surface/10 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-surface border border-border text-foreground/75 mt-0.5">
                          <Clock className="w-4 h-4" />
                        </div>
                        <div>
                          <label htmlFor="canManageShifts" className="block text-sm font-bold text-foreground cursor-pointer select-none">
                            Gestion des Horaires & Shifts
                          </label>
                          <span className="text-xs text-foreground/50">Créer et planifier les shifts de travail des employés.</span>
                        </div>
                      </div>
                      <input 
                        id="canManageShifts"
                        type="checkbox"
                        checked={canManageShifts}
                        disabled={role === "SUPERADMIN" || editingUser?.id === "master-admin"}
                        onChange={(e) => setCanManageShifts(e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary w-5 h-5 cursor-pointer disabled:opacity-50 mt-1"
                      />
                    </div>

                    {/* Permission Item 3 */}
                    <div className="flex items-start justify-between gap-4 p-2.5 rounded-lg hover:bg-surface/10 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-surface border border-border text-foreground/75 mt-0.5">
                          <Calendar className="w-4 h-4" />
                        </div>
                        <div>
                          <label htmlFor="canManageLeaves" className="block text-sm font-bold text-foreground cursor-pointer select-none">
                            Gestion des Absences & Congés
                          </label>
                          <span className="text-xs text-foreground/50">Valider ou refuser les demandes de congé et planifier les jours fériés.</span>
                        </div>
                      </div>
                      <input 
                        id="canManageLeaves"
                        type="checkbox"
                        checked={canManageLeaves}
                        disabled={role === "SUPERADMIN" || editingUser?.id === "master-admin"}
                        onChange={(e) => setCanManageLeaves(e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary w-5 h-5 cursor-pointer disabled:opacity-50 mt-1"
                      />
                    </div>

                    {/* Permission Item 4 */}
                    <div className="flex items-start justify-between gap-4 p-2.5 rounded-lg hover:bg-surface/10 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-primary mt-0.5">
                          <Eye className="w-4 h-4" />
                        </div>
                        <div>
                          <label htmlFor="canViewSalaries" className="block text-sm font-bold text-primary cursor-pointer select-none">
                            Accès aux Coûts & Salaires
                          </label>
                          <span className="text-xs text-foreground/50">Consulter et configurer les tarifs horaires, paies et coûts totaux.</span>
                        </div>
                      </div>
                      <input 
                        id="canViewSalaries"
                        type="checkbox"
                        checked={canViewSalaries}
                        disabled={role === "SUPERADMIN" || editingUser?.id === "master-admin"}
                        onChange={(e) => setCanViewSalaries(e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary w-5 h-5 cursor-pointer disabled:opacity-50 mt-1"
                      />
                    </div>

                    {/* Permission Item 5 */}
                    <div className="flex items-start justify-between gap-4 p-2.5 rounded-lg hover:bg-surface/10 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-surface border border-border text-foreground/75 mt-0.5">
                          <SettingsIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <label htmlFor="canManageSettings" className="block text-sm font-bold text-foreground cursor-pointer select-none">
                            Configuration du Système (Matériel)
                          </label>
                          <span className="text-xs text-foreground/50">Gérer les machines de pointage ZKTeco et les paramètres généraux.</span>
                        </div>
                      </div>
                      <input 
                        id="canManageSettings"
                        type="checkbox"
                        checked={canManageSettings}
                        disabled={role === "SUPERADMIN" || editingUser?.id === "master-admin"}
                        onChange={(e) => setCanManageSettings(e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary w-5 h-5 cursor-pointer disabled:opacity-50 mt-1"
                      />
                    </div>

                  </div>
                </div>
              </div>
            </form>

            {/* Modal Footer Actions */}
            <div className="p-5 border-t border-border flex justify-end gap-3 bg-surface/30">
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="bg-surface hover:bg-surface-hover border border-border text-foreground/80 font-bold py-2.5 px-5 rounded-xl transition-all cursor-pointer text-xs"
              >
                Annuler
              </button>
              <button 
                type="submit"
                disabled={isPending}
                onClick={handleSubmit}
                className="bg-primary hover:bg-primary/95 text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-[0_0_12px_var(--primary-glow)] flex items-center gap-2 cursor-pointer text-xs disabled:opacity-50"
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {editingUser ? "Enregistrer" : "Créer l'Utilisateur"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
