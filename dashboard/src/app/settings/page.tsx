import { prisma } from "@/lib/prisma";
import SettingsClient from "@/components/SettingsClient";

export default async function SettingsPage() {
  const settings = await prisma.systemSettings.findFirst();
  return <SettingsClient initialSettings={settings} />;
}
