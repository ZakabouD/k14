import { getDashboardData } from "@/app/actions";
import DashboardClient from "@/components/DashboardClient";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  const canViewSalaries = session?.adminId === "admin" || session?.permissions?.canViewSalaries === true;

  const initialData = await getDashboardData("TODAY");

  return <DashboardClient initialData={initialData} canViewSalaries={canViewSalaries} />;
}
