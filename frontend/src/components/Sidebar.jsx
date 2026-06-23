import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, UserCheck, CalendarCheck, Settings, ChevronLeft, ChevronRight, Menu } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/visitors', label: 'Besucher', icon: Users },
    { to: '/preregistrations', label: 'Vorregistrierungen', icon: CalendarCheck },
    { to: '/hosts', label: 'Mitarbeiter', icon: UserCheck },
  ];

  const adminItems = user?.role === 'admin'
    ? [{ to: '/settings', label: 'Einstellungen', icon: Settings }]
    : [];

  const NavItems = ({ onClick }) => (
    <>
      <div className="space-y-1 px-2">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClick}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
              ${isActive ? 'bg-abat-blau text-white shadow-lg' : 'text-abat-hellgrau hover:bg-abat-blau/20 hover:text-white'}
              ${collapsed ? 'justify-center' : ''}`
            }
            title={collapsed ? label : undefined}
          >
            <Icon size={18} className="flex-shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </div>

      {adminItems.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/10 px-2 space-y-1">
          {!collapsed && <p className="px-3 text-xs text-abat-grau uppercase tracking-wider mb-2">Administration</p>}
          {adminItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClick}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
                ${isActive ? 'bg-abat-blau text-white' : 'text-abat-hellgrau hover:bg-abat-blau/20 hover:text-white'}
                ${collapsed ? 'justify-center' : ''}`
              }
              title={collapsed ? label : undefined}
            >
              <Icon size={18} className="flex-shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        className="fixed top-3 left-3 z-50 md:hidden bg-abat-dunkelgrau text-white p-2 rounded-lg shadow-lg"
        onClick={() => setMobileOpen(o => !o)}
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
        </div>
      )}

      {/* Mobile sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-abat-dunkelgrau text-white flex flex-col transition-transform duration-300 md:hidden ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
          <img src="/logo-light.png" alt="abat AG" className="h-10" />
        </div>
        <nav className="flex-1 py-4 overflow-y-auto">
          <NavItems onClick={() => setMobileOpen(false)} />
        </nav>
      </aside>

      {/* Desktop sidebar */}
      <aside className={`hidden md:flex ${collapsed ? 'w-16' : 'w-64'} flex-shrink-0 bg-abat-dunkelgrau text-white flex-col transition-all duration-300 ease-in-out`}>
        <div className={`flex items-center gap-3 px-4 py-5 border-b border-white/10 ${collapsed ? 'justify-center' : ''}`}>
          {!collapsed
            ? <img src="/logo-light.png" alt="abat AG" className="h-10" />
            : <div className="w-8 h-8 bg-abat-blau rounded-lg flex items-center justify-center"><span className="text-white text-xs font-bold">a</span></div>
          }
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          <NavItems />
        </nav>

        <div className="border-t border-white/10 px-2 py-2">
          <button
            onClick={() => setCollapsed(c => !c)}
            className={`w-full flex items-center gap-2 px-3 py-2.5 text-abat-grau hover:text-white hover:bg-abat-blau/20 transition-colors rounded-lg ${collapsed ? 'justify-center' : ''}`}
          >
            {collapsed ? <ChevronRight size={18} /> : <><ChevronLeft size={18} /><span className="text-sm">Einklappen</span></>}
          </button>
        </div>
      </aside>
    </>
  );
}
