"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  Clock, 
  AlertTriangle,
  Settings,
  LogOut,
  Sun,
  Moon,
  FileSpreadsheet,
  Calendar,
  CalendarDays,
  Menu,
  X,
  ShieldCheck,
  Banknote
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { getSidebarSession } from '../app/actions';

export function Sidebar() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isOpen, setIsOpen] = useState(false);
  const [permissions, setPermissions] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>("");
  const [companyName, setCompanyName] = useState<string>("Mon Entreprise");

  useEffect(() => {
    const isLight = document.documentElement.classList.contains('light');
    setTheme(isLight ? 'light' : 'dark');

    async function loadSession() {
      try {
        const sess = await getSidebarSession();
        if (sess) {
          setPermissions(sess.permissions);
          setUserRole(sess.role);
          if (sess.companyName) setCompanyName(sess.companyName);
        }
      } catch (err) {
        console.error("Failed to load session in sidebar:", err);
      }
    }
    loadSession();
  }, []);

  useEffect(() => {
    // Close sidebar overlay when pathname changes
    setIsOpen(false);
  }, [pathname]);

  const toggleTheme = () => {
    if (theme === 'dark') {
      document.documentElement.classList.add('light');
      localStorage.setItem('theme', 'light');
      setTheme('light');
    } else {
      document.documentElement.classList.remove('light');
      localStorage.setItem('theme', 'dark');
      setTheme('dark');
    }
  };

  const navItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    ...(permissions === null || permissions?.canManagePersonnel ? [{ name: 'Personnel', href: '/artisans', icon: Users }] : []),
    ...(permissions === null || permissions?.canManageShifts ? [{ name: 'Shifts', href: '/shifts', icon: Clock }] : []),
    { name: 'Anomalies', href: '/anomalies', icon: AlertTriangle },
    { name: 'Reports', href: '/reports', icon: FileSpreadsheet },
    ...(permissions === null || permissions?.canViewSalaries ? [{ name: 'Salaires & Avances', href: '/salaries', icon: Banknote }] : []),
    ...(permissions === null || permissions?.canManageLeaves ? [
      { name: 'Congés', href: '/leaves', icon: Calendar },
      { name: 'Jours Fériés', href: '/holidays', icon: CalendarDays }
    ] : []),
    ...(permissions && (userRole === "SUPERADMIN" || permissions?.canManageSettings) ? [{ name: 'Utilisateurs', href: '/users', icon: ShieldCheck }] : [])
  ];

  return (
    <>
      {/* Mobile Top Bar Header */}
      <header className="lg:hidden w-full h-16 fixed top-0 left-0 bg-background/80 backdrop-blur-md border-b border-border z-40 px-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center mr-2.5 shadow-[0_0_10px_var(--primary-glow)]">
            <span className="font-bold text-white text-base">{companyName.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-xs tracking-tight text-foreground leading-tight truncate max-w-[140px]">{companyName}</span>
            <span className="text-primary font-semibold text-[9px] tracking-wider uppercase leading-none mt-0.5">Suivi d'Atelier</span>
          </div>
        </div>
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-lg hover:bg-surface-hover text-foreground/75 hover:text-foreground focus:outline-none transition-colors cursor-pointer"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/55 backdrop-blur-sm z-45 transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside className={`w-64 h-screen fixed top-0 left-0 glass-panel border-r border-y-0 border-l-0 rounded-none flex flex-col justify-between z-50 transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
      <div>
        <div className="h-20 flex items-center px-8 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center mr-3 shadow-[0_0_15px_var(--primary-glow)]">
            <span className="font-bold text-white text-lg">{companyName.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-tight text-foreground leading-tight truncate max-w-[160px]">{companyName}</span>
            <span className="text-primary font-semibold text-[10px] tracking-wider uppercase leading-none mt-0.5">Suivi d'Atelier</span>
          </div>
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
                    : 'text-foreground/70 hover:bg-surface-hover hover:text-foreground'
                }`}
              >
                <Icon className={`w-5 h-5 mr-3 transition-colors ${isActive ? 'text-primary' : 'text-foreground/50 group-hover:text-foreground'}`} />
                <span className="font-medium">{item.name}</span>
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary-glow)]" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-border space-y-2">
        <button 
          onClick={toggleTheme}
          className="flex items-center w-full px-4 py-3 rounded-xl transition-all duration-200 text-foreground/70 hover:bg-surface-hover hover:text-foreground group cursor-pointer"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-5 h-5 mr-3 text-foreground/50 group-hover:text-foreground" />
              <span className="font-medium">Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="w-5 h-5 mr-3 text-foreground/50 group-hover:text-foreground" />
              <span className="font-medium">Dark Mode</span>
            </>
          )}
        </button>
        {(permissions === null || userRole === "SUPERADMIN" || permissions?.canManageSettings) ? (
          <Link href="/settings" className={`flex items-center w-full px-4 py-3 rounded-xl transition-all duration-200 group ${pathname === '/settings' ? 'bg-primary/10 text-primary shadow-sm' : 'text-foreground/70 hover:bg-surface-hover hover:text-foreground'}`}>
            <Settings className={`w-5 h-5 mr-3 transition-colors ${pathname === '/settings' ? 'text-primary' : 'text-foreground/50 group-hover:text-foreground'}`} />
            <span className="font-medium">Settings</span>
          </Link>
        ) : null}
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
  </>
  );
}
