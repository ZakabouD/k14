import { prisma } from "@/lib/prisma";
import { Clock } from "lucide-react";
import { ShiftModal } from "@/components/ShiftModal";

export default async function ShiftsPage() {
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
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Shift Configuration</h1>
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
            
            <h3 className="text-xl font-bold text-white mb-2">{shift.name}</h3>
            
            <div className="space-y-3 mt-4">
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <span className="text-sm text-foreground/60">Schedule</span>
                <span className="text-sm font-medium text-white">{shift.startTime} - {shift.endTime}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <span className="text-sm text-foreground/60">Base Hours</span>
                <span className="text-sm font-medium text-white">{shift.baseHours} hrs</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-foreground/60">Assigned Artisans</span>
                <span className="text-sm font-medium text-white">{shift._count.users}</span>
              </div>
            </div>
            
            <div className="mt-6 flex gap-2">
              <button className="flex-1 py-2 rounded-lg bg-surface-hover hover:bg-white/10 text-sm font-medium transition-colors">
                Edit
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
