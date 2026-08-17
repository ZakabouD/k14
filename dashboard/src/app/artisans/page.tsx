import { prisma } from "@/lib/prisma";
import { parseContractTypes, parseMaritalStatuses } from "@/lib/tags";
import { getSession } from "@/lib/session";
import { ArtisansClient } from "@/components/ArtisansClient";

export default async function ArtisansPage() {
  const artisans = await prisma.user.findMany({
    orderBy: [{ isActive: 'desc' }, { zktecoUserId: 'asc' }]
  });
  
  const shifts = await prisma.shift.findMany();

  const settings = await prisma.systemSettings.findFirst({
    select: { contractTypes: true, maritalStatuses: true }
  });
  const contractTypesList = parseContractTypes(settings?.contractTypes || "");
  const maritalStatusesList = parseMaritalStatuses(settings?.maritalStatuses || "");

  const session = await getSession();
  const canViewSalaries = session?.adminId === "admin" || session?.permissions?.canViewSalaries === true;

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
