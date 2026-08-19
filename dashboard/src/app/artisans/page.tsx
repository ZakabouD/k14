import { prisma } from "@/lib/prisma";
import { parseContractTypes, parseMaritalStatuses } from "@/lib/tags";
import { getSession } from "@/lib/session";
import { ArtisansClient } from "@/components/ArtisansClient";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ArtisansPage() {
  const session = await getSession();
  if (!session || !session.adminId) {
    redirect("/login");
  }

  const artisans = await prisma.user.findMany({
    orderBy: [{ isActive: 'desc' }, { zktecoUserId: 'asc' }]
  });
  
  const shifts = await prisma.shift.findMany();

  const settings = await prisma.systemSettings.findFirst({
    select: { contractTypes: true, maritalStatuses: true }
  });
  const contractTypesList = parseContractTypes(settings?.contractTypes || "");
  const maritalStatusesList = parseMaritalStatuses(settings?.maritalStatuses || "");

  const canViewSalaries = session.adminId === "admin" || session.permissions?.canViewSalaries === true;

  return (
    <ArtisansClient
      artisans={artisans}
      shifts={shifts}
      contractTypesList={contractTypesList}
      maritalStatusesList={maritalStatusesList}
      canViewSalaries={canViewSalaries}
    />
  );
}
