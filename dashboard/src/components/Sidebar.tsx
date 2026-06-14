"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  Clock, 
  AlertTriangle,
  Settings,
  LogOut
} from 'lucide-react';

export function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Artisans', href: '/artisans', icon: Users },
    { name: 'Shifts', href: '/shifts', icon: Clock },
    { name: 'Anomalies', href: '/anomalies', icon: AlertTriangle },
  ];

  return (
    <aside className="w-64 h-screen fixed top-0 left-0 glass-panel border-r border-y-0 border-l-0 rounded-none flex flex-col justify-between">
      <div>
        <div className="h-20 flex items-center px-8 border-b border-white/5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center mr-3 shadow-[0_0_15px_var(--primary-glow)]">
            <span className="font-bold text-white text-lg">Z</span>
          </div>
          <span className="font-bold text-xl tracking-tight text-white">ZKTeco<span className="text-primary font-medium">Sync</span></span>
        </div>
        
        <nav className="p-4 mt-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            
            return (
              <Link 
                key={item.name} 
                href={item.href}
                className={`flex items-center px-4 py-3 rounded-xl transition-all duration-200 group ${
                  isActive 
                    ? 'bg-primary/10 text-primary shadow-sm' 
                    : 'text-foreground/70 hover:bg-surface-hover hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 mr-3 transition-colors ${isActive ? 'text-primary' : 'text-foreground/50 group-hover:text-white'}`} />
                <span className="font-medium">{item.name}</span>
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary-glow)]" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-white/5 space-y-2">
        <Link href="/settings" className={`flex items-center w-full px-4 py-3 rounded-xl transition-all duration-200 group ${pathname === '/settings' ? 'bg-primary/10 text-primary shadow-sm' : 'text-foreground/70 hover:bg-surface-hover hover:text-white'}`}>
          <Settings className={`w-5 h-5 mr-3 transition-colors ${pathname === '/settings' ? 'text-primary' : 'text-foreground/50 group-hover:text-white'}`} />
          <span className="font-medium">Settings</span>
        </Link>
        <button 
          onClick={async () => {
            const { logoutAdmin } = await import('../app/actions');
            await logoutAdmin();
            window.location.href = '/login';
          }}
          className="flex items-center w-full px-4 py-3 rounded-xl transition-all duration-200 text-foreground/70 hover:bg-danger/10 hover:text-danger group"
        >
          <LogOut className="w-5 h-5 mr-3 text-foreground/50 group-hover:text-danger" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
}
