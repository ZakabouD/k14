import { prisma } from "@/lib/prisma";
import HolidaysClient from "@/components/HolidaysClient";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HolidaysPage() {
  const session = await getSession();
  if (!session || !session.adminId) {
    redirect("/login");
  }

  const hasAccess = session.role === "SUPERADMIN" || session.permissions?.canManageLeaves === true;
  if (!hasAccess) {
    redirect("/");
  }

  // Fetch holidays ordered by date ascending
  const holidays = await prisma.holiday.findMany({
    orderBy: {
      date: "asc",
    },
  });

  return (
    <div className="container mx-auto">
      <HolidaysClient initialHolidays={holidays} />
    </div>
  );
}
