import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getDashboardUsers } from "../actions";
import UsersClient from "@/components/UsersClient";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const session = await getSession();
  
  if (!session || !session.adminId) {
    redirect("/login");
  }

  // Only SUPERADMIN or users with canManageSettings can view this page
  const hasAccess = session.role === "SUPERADMIN" || session.permissions?.canManageSettings === true;
  if (!hasAccess) {
    redirect("/");
  }

  const users = await getDashboardUsers();
  const settings = await prisma.systemSettings.findFirst();
  const masterAdminEmail = settings?.adminEmail || process.env.ADMIN_EMAIL || "admin@example.com";

  return (
    <UsersClient 
      initialUsers={JSON.parse(JSON.stringify(users))} 
      currentUserId={session.adminId} 
      masterAdminEmail={masterAdminEmail}
    />
  );
}
