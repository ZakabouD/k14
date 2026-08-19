import { prisma } from "@/lib/prisma";
import LeavesClient from "@/components/LeavesClient";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { parseLeaveTypes } from "@/lib/tags";

export const dynamic = "force-dynamic";

export default async function LeavesPage() {
  const session = await getSession();
  if (!session || !session.adminId) {
    redirect("/login");
  }

  const hasAccess = session.role === "SUPERADMIN" || session.permissions?.canManageLeaves === true;
  if (!hasAccess) {
    redirect("/");
  }

  const canViewSalaries = session.role === "SUPERADMIN" || session.permissions?.canViewSalaries === true;

  // Fetch leaves ordered by start date desc
  const leaves = await prisma.leave.findMany({
    include: {
      user: {
        include: { shift: true }
      },
    },
    orderBy: {
      startDate: "desc",
    },
  });

  // Fetch all active users to select in dropdown
  const artisans = await prisma.user.findMany({
    where: {
      isActive: true,
    },
    include: {
      shift: true,
    },
    orderBy: [
      { lastName: "asc" },
      { firstName: "asc" },
    ],
  });

  const settings = await prisma.systemSettings.findFirst({
    select: { leaveTypes: true, currency: true }
  });
  const leaveTypesList = parseLeaveTypes(settings?.leaveTypes || "");
  const currency = settings?.currency || "DH";

  return (
    <div className="container mx-auto">
      <LeavesClient
        initialLeaves={leaves}
        artisans={artisans}
        leaveTypesList={leaveTypesList}
        canViewSalaries={canViewSalaries}
        currency={currency}
      />
    </div>
  );
}
