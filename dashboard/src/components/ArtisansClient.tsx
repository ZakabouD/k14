"use client";

import { useState } from "react";
import { Users, UserCheck, UserMinus, Search, Filter } from "lucide-react";
import { ArtisanCard } from "@/components/ArtisanCard";
import { SyncButton } from "@/components/SyncButton";

type ArtisanTab = "ACTIVE" | "ARCHIVED" | "ALL";

interface ArtisansClientProps {
  artisans: any[];
  shifts: any[];
  contractTypesList: any[];
  maritalStatusesList: any[];
  canViewSalaries: boolean;
}

export function ArtisansClient({
  artisans,
  shifts,
  contractTypesList,
  maritalStatusesList,
  canViewSalaries
}: ArtisansClientProps) {
  const [activeTab, setActiveTab] = useState<ArtisanTab>("ACTIVE");
  const [searchQuery, setSearchQuery] = useState("");

  const countActive = artisans.filter((a: any) => a.isActive && !a.exitDate).length;
  const countArchived = artisans.filter((a: any) => !a.isActive || Boolean(a.exitDate)).length;
  const countAll = artisans.length;

  const filteredArtisans = artisans.filter((a: any) => {
    const matchesSearch = `${a.firstName} ${a.lastName} ${a.zktecoUserId}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === "ACTIVE") return a.isActive && !a.exitDate;
    if (activeTab === "ARCHIVED") return !a.isActive || Boolean(a.exitDate);
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">
            Registre du Personnel
          </h1>
          <p className="text-sm text-foreground/60 mt-1">
            Gérer votre effectif, attribuer des shifts, suivre les départs et consulter les archives.
          </p>
        </div>
        <SyncButton />
      </div>

      {/* FILTER BAR: TABS & SEARCH INPUT */}
      <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* TABS */}
        <div className="flex flex-wrap items-center gap-1.5 bg-background p-1.5 rounded-xl border border-border">
          <button
            onClick={() => setActiveTab("ACTIVE")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "ACTIVE"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-foreground/70 hover:text-foreground"
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" /> Actifs en Poste ({countActive})
          </button>

          <button
            onClick={() => setActiveTab("ARCHIVED")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "ARCHIVED"
                ? "bg-rose-600 text-white shadow-sm"
                : "text-foreground/70 hover:text-foreground"
            }`}
          >
            <UserMinus className="w-3.5 h-3.5" /> Départs & Archivés ({countArchived})
          </button>

          <button
            onClick={() => setActiveTab("ALL")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "ALL"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-foreground/70 hover:text-foreground"
            }`}
          >
            <Users className="w-3.5 h-3.5" /> Tous ({countAll})
          </button>
        </div>

        {/* SEARCH INPUT */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-foreground/40 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par nom ou Device ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-background border border-border rounded-xl pl-9 pr-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary w-full"
          />
        </div>
      </div>

      {/* CARDS GRID */}
      {filteredArtisans.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-12 text-center text-foreground/50 font-medium">
          <UserMinus className="w-10 h-10 mx-auto mb-3 opacity-40 text-foreground/40" />
          <p className="text-base font-bold text-foreground">Aucun artisan trouvé dans cette catégorie.</p>
          <p className="text-xs text-foreground/50 mt-1">Modifiez vos filtres ou effectuez une autre recherche.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredArtisans.map((artisan) => (
            <ArtisanCard
              key={artisan.id}
              artisan={artisan}
              shifts={shifts}
              contractTypesList={contractTypesList}
              maritalStatusesList={maritalStatusesList}
              canViewSalaries={canViewSalaries}
            />
          ))}
        </div>
      )}

    </div>
  );
}
