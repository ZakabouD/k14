export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { Clock } from "lucide-react";
import { ShiftModal } from "@/components/ShiftModal";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function ShiftsPage() {
  const session = await getSession();
  if (!session || !session.adminId) {
    redirect("/login");
  }

  const hasAccess = session.role === "SUPERADMIN" || session.permissions?.canManageShifts === true;
  if (!hasAccess) {
    redirect("/");
  }
  const shifts = await prisma.shift.findMany({
    include: {
      _count: {
        select: { users: true }
      }
    }
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Shift Configuration</h1>
          <p className="text-foreground/60">Define standard working hours for accurate overtime calculation.</p>
        </div>
        <ShiftModal />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {shifts.length === 0 ? (
          <div className="col-span-full glass-panel p-12 text-center text-foreground/50">
            No shifts configured. Create one to start calculating overtime correctly.
          </div>
        ) : shifts.map((shift) => (
          <div key={shift.id} className="glass-panel p-6 flex flex-col group hover:border-primary/50 transition-colors relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Clock size={48} className="text-primary" />
            </div>
            <div className="flex items-start justify-between mb-2 gap-2">
              <h3 className="text-xl font-bold text-foreground leading-tight">{shift.name}</h3>
              {shift.autoClose && (
                <span className="text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded flex-shrink-0">
                  Flexible (Cadre)
                </span>
              )}
            </div>
            
            <div className="space-y-3 mt-4">
              <div className="flex justify-between items-center pb-2 border-b border-border">
                <span className="text-sm text-foreground/60">Horaires</span>
                <span className="text-sm font-semibold text-foreground">{shift.startTime} - {shift.endTime}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-border">
                <span className="text-sm text-foreground/60">Heures de Base (Lun-Ven)</span>
                <span className="text-sm font-medium text-foreground">{shift.baseHours} h</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-border">
                <span className="text-sm text-foreground/60">Heures de Base (Samedi)</span>
                <span className="text-sm font-medium text-foreground">{shift.saturdayHours} h</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-border">
                <span className="text-sm text-foreground/60">Pause Déjeuner</span>
                <span className="text-sm font-medium text-foreground">{shift.lunchBreak > 0 ? `${shift.lunchBreak} min` : "Aucune"}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-border">
                <span className="text-sm text-foreground/60">Marge de Retard (Tolérance)</span>
                <span className="text-sm font-medium text-foreground">{shift.gracePeriod} min</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-foreground/60">Personnel Assigné</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-primary/10 text-primary">{shift._count.users}</span>
              </div>
            </div>
            
            <div className="mt-6 flex gap-2">
              <ShiftModal shift={shift} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
