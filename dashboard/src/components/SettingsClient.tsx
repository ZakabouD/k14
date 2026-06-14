"use client";

import { useState } from "react";
import { Settings as SettingsIcon, Network, Shield, Database, Loader2 } from "lucide-react";
import { updateConnectionSettings, updateAdminCredentials } from "@/app/actions";

export default function SettingsClient({ initialSettings }: { initialSettings: any }) {
  const [isSavingConn, setIsSavingConn] = useState(false);
  const [isSavingAuth, setIsSavingAuth] = useState(false);

  const handleConnectionSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSavingConn(true);
    await updateConnectionSettings(new FormData(e.currentTarget));
    setIsSavingConn(false);
    alert("Hardware connection saved successfully!");
  };

  const handleAuthSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSavingAuth(true);
    await updateAdminCredentials(new FormData(e.currentTarget));
    setIsSavingAuth(false);
    alert("Admin credentials updated successfully!");
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">System Settings</h1>
        <p className="text-foreground/60">Configure your biometric device connection and administrative preferences.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel p-6">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center">
              <Network className="w-5 h-5 mr-2 text-primary" />
              ZKTeco Hardware Connection
            </h2>
            
            <form onSubmit={handleConnectionSave} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground/70 mb-1">IP Address</label>
                  <input 
                    name="deviceIp"
                    required
                    type="text" 
                    defaultValue={initialSettings?.deviceIp}
                    className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground/70 mb-1">Port</label>
                  <input 
                    name="devicePort"
                    required
                    type="number" 
                    defaultValue={initialSettings?.devicePort}
                    className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-foreground/70 mb-1">Timeout (ms)</label>
                <input 
                  name="deviceTimeout"
                  required
                  type="number" 
                  defaultValue={initialSettings?.deviceTimeout}
                  className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              <div className="pt-4">
                <button disabled={isSavingConn} type="submit" className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-medium py-2 px-6 rounded-lg transition-all shadow-[0_0_15px_var(--primary-glow)] flex items-center">
                  {isSavingConn ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Save Connection Settings
                </button>
              </div>
            </form>
          </div>

          <div className="glass-panel p-6">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center">
              <Shield className="w-5 h-5 mr-2 text-warning" />
              Administrator Account
            </h2>
            
            <form onSubmit={handleAuthSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground/70 mb-1">Admin Email</label>
                <input 
                  name="adminEmail"
                  required
                  type="email" 
                  defaultValue={initialSettings?.adminEmail}
                  className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-foreground/70 mb-1">Update Password (leave blank to keep current)</label>
                <input 
                  name="newPassword"
                  type="password" 
                  placeholder="Enter new password"
                  className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              <div className="pt-4">
                <button disabled={isSavingAuth} type="submit" className="bg-surface-hover hover:bg-white/10 disabled:opacity-50 text-white font-medium py-2 px-6 rounded-lg transition-all flex items-center">
                  {isSavingAuth ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Update Credentials
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-panel p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center">
              <Database className="w-5 h-5 mr-2 text-success" />
              System Status
            </h2>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-white/5">
                <span className="text-sm text-foreground/70">Database</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-success/10 text-success">
                  Connected
                </span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-white/5">
                <span className="text-sm text-foreground/70">Background Worker</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-success/10 text-success">
                  Active
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-foreground/70">App Version</span>
                <span className="text-sm font-medium text-white">v1.0.0</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
