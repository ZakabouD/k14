import { prisma } from "@/lib/prisma";
import { Users, AlertTriangle, Clock, CalendarDays } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  // Fetch high-level stats
  const totalArtisans = await prisma.user.count({ where: { isActive: true } });
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayReports = await prisma.calculatedDailyReport.findMany({
    where: { date: { gte: today } },
    include: { user: true },
    orderBy: { date: 'desc' }
  });

  const anomalyCount = todayReports.filter(r => r.status === 'ANOMALY').length;
  const activeTodayCount = todayReports.length;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Welcome Back, Admin</h1>
        <p className="text-foreground/60">Here is what is happening in the workshop today.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-panel p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Users size={64} className="text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground/60 mb-1">Total Active Artisans</p>
          <p className="text-4xl font-bold text-white">{totalArtisans}</p>
        </div>

        <div className="glass-panel p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Clock size={64} className="text-success" />
          </div>
          <p className="text-sm font-medium text-foreground/60 mb-1">Punched In Today</p>
          <p className="text-4xl font-bold text-white">{activeTodayCount}</p>
        </div>

        <div className="glass-panel p-6 relative overflow-hidden group border-danger/20">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <AlertTriangle size={64} className="text-danger" />
          </div>
          <p className="text-sm font-medium text-foreground/60 mb-1">Anomalies Detected</p>
          <p className="text-4xl font-bold text-danger">{anomalyCount}</p>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="glass-panel overflow-hidden">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white flex items-center">
            <CalendarDays className="w-5 h-5 mr-2 text-primary" />
            Today's Payroll Calculations
          </h2>
          <Link href="/anomalies" className="text-sm font-medium text-primary hover:text-primary/80 transition-colors">
            View All
          </Link>
        </div>
        <div className="p-0">
          {todayReports.length === 0 ? (
            <div className="p-12 text-center text-foreground/50">
              No punches recorded today yet.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface/50 text-xs uppercase tracking-wider text-foreground/50 border-b border-white/5">
                  <th className="p-4 font-semibold">Artisan</th>
                  <th className="p-4 font-semibold">Status</th>
                  <th className="p-4 font-semibold">Regular (Hrs)</th>
                  <th className="p-4 font-semibold">Overtime 150%</th>
                  <th className="p-4 font-semibold">Overtime 200%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {todayReports.map((report) => (
                  <tr key={report.id} className="hover:bg-surface-hover/30 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold mr-3">
                          {report.user.firstName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-white">{report.user.firstName} {report.user.lastName}</p>
                          <p className="text-xs text-foreground/50">ID: {report.user.zktecoUserId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      {report.status === 'OK' || report.status === 'RESOLVED' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success border border-success/20">
                          Complete
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-danger/10 text-danger border border-danger/20">
                          {report.status}
                        </span>
                      )}
                    </td>
                    <td className="p-4 font-medium">{report.regularHours}</td>
                    <td className="p-4 text-warning">{report.overtime150Hours}</td>
                    <td className="p-4 text-accent">{report.overtime200Hours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
