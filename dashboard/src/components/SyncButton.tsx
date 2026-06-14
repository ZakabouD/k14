"use client";

import { useState } from "react";
import { Users, Loader2 } from "lucide-react";
import { triggerDeviceSync } from "../app/actions";

export function SyncButton() {
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    const result = await triggerDeviceSync();
    if (result.success) {
      alert("Successfully synced with ZKTeco Device!");
    } else {
      alert(result.error || "Failed to sync. Make sure the device is connected to the network.");
    }
    setIsSyncing(false);
  };


  return (
    <button 
      onClick={handleSync}
      disabled={isSyncing}
      className="bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-xl shadow-[0_0_15px_var(--primary-glow)] transition-all flex items-center"
    >
      {isSyncing ? (
        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
      ) : (
        <Users className="w-5 h-5 mr-2" />
      )}
      {isSyncing ? "Syncing..." : "Sync from Device"}
    </button>
  );
}
