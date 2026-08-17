import { getSession } from "@/lib/session";
import { getSalaryOverview } from "@/app/actions";
import SalariesClient from "../../components/SalariesClient";
import { redirect } from "next/navigation";

export default async function SalariesPage() {
  const session = await getSession();
  if (!session || !session.adminId) {
    redirect("/login");
  }

  const canViewSalaries = session.adminId === "admin" || session.permissions?.canViewSalaries === true;
  if (!canViewSalaries) {
    return (
      <div className="p-8 text-center glass-panel">
        <h1 className="text-xl font-bold text-danger mb-2">Accès Restreint</h1>
        <p className="text-foreground/60">Vous n'avez pas les permissions nécessaires pour accéder à la gestion des salaires et avances.</p>
      </div>
    );
  }

  const overview = await getSalaryOverview();

  return (
    <SalariesClient 
      initialMode={overview.periodMode || "MONTHLY"}
      initialDate={overview.dateValue || ""}
      initialLabel={overview.periodLabel || ""}
      initialData={overview.data || []} 
      initialKpis={overview.kpis || { totalEarned: 0, totalAdvances: 0, totalBonuses: 0, totalRemaining: 0 }} 
    />
  );
}
