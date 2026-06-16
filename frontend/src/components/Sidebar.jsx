import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, LogIn, UserCheck, CalendarCheck,
  AlertTriangle, BarChart3, Settings, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/visitors', label: 'Besucher', icon: Users },
  { to: '/hosts', label: 'Gastgeber', icon: UserCheck },
  { to: '/preregistrations', label: 'Vorregistrierung', icon: CalendarCheck },

  { to: '/evacuation', label: 'Evakuierungsliste', icon: AlertTriangle },
  { to: '/reports', label: 'Berichte', icon: BarChart3 },
];

const adminItems = [
  { to: '/settings', label: 'Einstellungen', icon: Settings, roles: ['superadmin', 'admin'] },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useAuth();

  return (
    <aside className={`${collapsed ? 'w-16' : 'w-64'} flex-shrink-0 bg-abat-dunkelgrau text-white flex flex-col transition-all duration-300 ease-in-out`}>
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-white/10 ${collapsed ? 'justify-center' : ''}`}>
        {!collapsed ? (
          <img src="/logo-light.png" alt="abat AG" className="h-10" />
        ) : (
          <div className="w-8 h-8 bg-abat-blau rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">a</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <div className="space-y-1 px-2">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group
                ${isActive
                  ? 'bg-abat-blau text-white shadow-lg'
                  : 'text-abat-hellgrau hover:bg-abat-blau/20 hover:text-white'
                } ${collapsed ? 'justify-center' : ''}`
              }
              title={collapsed ? label : undefined}
            >
              <Icon size={18} className="flex-shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </div>

        {/* Admin items */}
        {user && (user.role === 'superadmin' || user.role === 'admin') && (
          <div className="mt-4 pt-4 border-t border-white/10 px-2 space-y-1">
            {!collapsed && <p className="px-3 text-xs text-abat-metallic uppercase tracking-wider mb-2">Administration</p>}
            {adminItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
                  ${isActive
                    ? 'bg-abat-blau text-white'
                    : 'text-abat-hellgrau hover:bg-abat-blau/20 hover:text-white'
                  } ${collapsed ? 'justify-center' : ''}`
                }
                title={collapsed ? label : undefined}
              >
                <Icon size={18} className="flex-shrink-0" />
                {!collapsed && <span>{label}</span>}
              </NavLink>
            ))}
          </div>
        )}
      </nav>

      {/* Collapse button */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className={`flex items-center gap-2 px-4 py-3 text-abat-metallic hover:text-white hover:bg-abat-blau/20 transition-colors border-t border-white/10 ${collapsed ? 'justify-center' : ''}`}
      >
        {collapsed ? <ChevronRight size={18} /> : (
          <>
            <ChevronLeft size={18} />
            <span className="text-sm">Einklappen</span>
          </>
        )}
      </button>
    </aside>
  );
}
