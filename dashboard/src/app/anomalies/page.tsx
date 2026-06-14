import { prisma } from "@/lib/prisma";
import { CheckCircle2 } from "lucide-react";
import { AnomalyCard } from "@/components/AnomalyCard";

export default async function AnomaliesPage() {
  const anomalyReports = await prisma.calculatedDailyReport.findMany({
    where: { status: 'ANOMALY' },
    include: { user: true },
    orderBy: { date: 'desc' }
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Anomalies & Exceptions</h1>
        <p className="text-foreground/60">Review and resolve missing punch-outs or illogical shifts.</p>
      </div>

      <div className="glass-panel overflow-hidden">
        {anomalyReports.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-success/10 text-success rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">All Clear!</h3>
            <p className="text-foreground/50 max-w-md">
              There are no anomalies to resolve. All payroll calculations are in perfect order.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {anomalyReports.map((report) => (
              <AnomalyCard key={report.id} report={report} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
