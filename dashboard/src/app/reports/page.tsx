import { prisma } from "@/lib/prisma";
import ReportsClient from "@/components/ReportsClient";
import { getSession } from "@/lib/session";

export default async function ReportsPage() {
  const artisans = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: [
      { lastName: "asc" },
      { firstName: "asc" }
    ]
  });

  const settings = await prisma.systemSettings.findFirst();

  const session = await getSession();
  const canViewSalaries = session?.adminId === "admin" || session?.permissions?.canViewSalaries === true;

  return <ReportsClient artisans={artisans} settings={settings} canViewSalaries={canViewSalaries} />;
}
