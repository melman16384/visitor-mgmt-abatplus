import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, UserCheck, CalendarCheck, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { to: '/dashboard',        label: 'Dashboard',          short: 'Dashboard',  icon: LayoutDashboard },
  { to: '/visitors',         label: 'Besucher',           short: 'Besucher',   icon: Users },
  { to: '/preregistrations', label: 'Vorregistrierungen', short: 'Voranmeld.', icon: CalendarCheck },
  { to: '/hosts',            label: 'Gastgeber',          short: 'Gastgeb.',   icon: UserCheck },
];
const ADMIN_ITEMS = [
  { to: '/settings', label: 'Einstellungen', short: 'Einstellg.', icon: Settings },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useAuth();
  const allItems = [...NAV_ITEMS, ...(user?.role === 'admin' ? ADMIN_ITEMS : [])];

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────────── */}
      <aside className={`hidden md:flex ${collapsed ? 'w-16' : 'w-60'} flex-shrink-0 bg-abat-dunkelgrau text-white flex-col transition-all duration-300 ease-in-out`}>
        <div className={`flex items-center px-4 py-5 border-b border-white/10 ${collapsed ? 'justify-center' : ''}`}>
          {!collapsed
            ? <span className="text-white font-bold text-lg tracking-tight">abat<span className="text-abat-hellblau">+</span></span>
            : <div className="w-8 h-8 bg-abat-blau rounded-lg flex items-center justify-center text-white text-xs font-bold">a+</div>
          }
        </div>

        <nav className="flex-1 py-4 overflow-y-auto space-y-1 px-2">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
                ${isActive ? 'bg-abat-blau text-white shadow-md' : 'text-abat-hellgrau hover:bg-abat-blau/20 hover:text-white'}
                ${collapsed ? 'justify-center' : ''}`}
              title={collapsed ? label : undefined}
            >
              <Icon size={18} className="flex-shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}

          {user?.role === 'admin' && (
            <div className="mt-4 pt-4 border-t border-white/10 space-y-1">
              {!collapsed && <p className="px-3 text-xs text-abat-grau uppercase tracking-wider mb-2">Administration</p>}
              {ADMIN_ITEMS.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
                    ${isActive ? 'bg-abat-blau text-white' : 'text-abat-hellgrau hover:bg-abat-blau/20 hover:text-white'}
                    ${collapsed ? 'justify-center' : ''}`}
                  title={collapsed ? label : undefined}
                >
                  <Icon size={18} className="flex-shrink-0" />
                  {!collapsed && <span>{label}</span>}
                </NavLink>
              ))}
            </div>
          )}
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

      {/* ── Mobile bottom tab bar ───────────────────────────── */}
      <nav className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-abat-dunkelgrau border-t border-white/10 flex">
        {allItems.map(({ to, short, icon: Icon }) => (
          <NavLink key={to} to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors
              ${isActive ? 'text-abat-hellblau' : 'text-white/40'}`}
          >
            {({ isActive }) => (
              <>
                <Icon size={21} />
                <span className={`text-[10px] font-semibold leading-tight ${isActive ? 'text-abat-hellblau' : 'text-white/40'}`}>{short}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
