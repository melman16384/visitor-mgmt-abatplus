import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import Sidebar from './Sidebar';
import { useAuth } from '../context/AuthContext';

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/visitors':  'Besucher',
  '/settings':  'Einstellungen',
};

function Toast({ toasts }) {
  return (
    <div className="fixed bottom-20 md:bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium max-w-xs
          ${t.type === 'success' ? 'bg-green-600' : t.type === 'error' ? 'bg-red-600' : 'bg-gray-800'}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

let toastListeners = [];
let toastId = 0;

export function showToast(message, type = 'success') {
  const id = ++toastId;
  toastListeners.forEach(fn => fn(prev => [...prev, { id, message, type }]));
  setTimeout(() => {
    toastListeners.forEach(fn => fn(prev => prev.filter(t => t.id !== id)));
  }, 3500);
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [toasts, setToasts] = useState([]);

  React.useEffect(() => {
    toastListeners.push(setToasts);
    return () => { toastListeners = toastListeners.filter(fn => fn !== setToasts); };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const pageTitle = PAGE_TITLES[location.pathname] ?? 'abat+';
  const roleLabel = user?.role === 'admin' ? 'Administrator' : 'Benutzer';
  const initials = user?.name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() ?? '?';

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* ── Header ── */}
        <header className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 flex items-center justify-between flex-shrink-0">
          {/* Mobile: page title | Desktop: nothing (sidebar has logo) */}
          <div className="md:hidden">
            <p className="text-base font-bold text-gray-900 leading-tight">{pageTitle}</p>
            <p className="text-xs text-gray-400 leading-tight">abat+ Besucherverwaltung</p>
          </div>
          <div className="hidden md:block" /> {/* spacer */}

          {/* User info + logout */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-abat-blau rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="hidden sm:block text-right">
              <p className="text-sm font-semibold text-gray-800 leading-tight">{user?.name}</p>
              <p className="text-xs text-gray-400">{roleLabel}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Abmelden"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* ── Content ── pb-20 on mobile for bottom tab bar */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <Outlet />
        </main>
      </div>

      <Toast toasts={toasts} />
    </div>
  );
}
