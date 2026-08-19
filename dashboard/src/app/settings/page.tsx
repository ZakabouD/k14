export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import SettingsClient from "@/components/SettingsClient";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session || !session.adminId) {
    redirect("/login");
  }

  const hasAccess = session.role === "SUPERADMIN" || session.permissions?.canManageSettings === true;
  if (!hasAccess) {
    redirect("/");
  }

  const settings = await prisma.systemSettings.findFirst();
  return <SettingsClient initialSettings={settings} />;
}
