import { prisma } from "@/lib/prisma";
import { SyncButton } from "@/components/SyncButton";
import { ArtisanCard } from "@/components/ArtisanCard";

export default async function ArtisansPage() {
  const artisans = await prisma.user.findMany({
    orderBy: { zktecoUserId: 'asc' }
  });
  
  const shifts = await prisma.shift.findMany();

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Artisan Directory</h1>
          <p className="text-foreground/60">Manage your workforce, assign shifts, and view profiles.</p>
        </div>
        <SyncButton />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {artisans.map((artisan) => (
          <ArtisanCard key={artisan.id} artisan={artisan} shifts={shifts} />
        ))}
      </div>
    </div>
  );
}
