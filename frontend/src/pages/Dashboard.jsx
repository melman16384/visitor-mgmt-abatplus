import React, { useState, useEffect } from 'react';
import { Users, UserCheck, UserMinus, CalendarCheck, UserPlus, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import api from '../api/client';
import VisitorCheckinForm from '../components/VisitorCheckinForm';
import { showToast } from '../components/Layout';
import { useAuth } from '../context/AuthContext';

function StatCard({ icon: Icon, label, value, color = 'blue' }) {
  const colors = {
    blue:   { icon: 'text-abat-blau',   iconBg: 'bg-blue-50',   val: 'text-gray-900' },
    green:  { icon: 'text-green-600',   iconBg: 'bg-green-50',  val: 'text-gray-900' },
    gray:   { icon: 'text-gray-500',    iconBg: 'bg-gray-100',  val: 'text-gray-900' },
    orange: { icon: 'text-orange-500',  iconBg: 'bg-orange-50', val: 'text-gray-900' },
  };
  const c = colors[color];
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col gap-3">
      <div className={`w-10 h-10 ${c.iconBg} rounded-xl flex items-center justify-center`}>
        <Icon size={20} className={c.icon} />
      </div>
      <div>
        <p className={`text-3xl font-extrabold leading-none ${c.val}`}>{value ?? '–'}</p>
        <p className="text-xs font-medium text-gray-400 mt-1">{label}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  if (status === 'active') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />Anwesend</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Ausgecheckt</span>;
}

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [showCheckin, setShowCheckin] = useState(false);

  const loadData = () => {
    api.get('/dashboard/stats').then(r => setStats(r.data)).catch(() => {});
    if (isAdmin) api.get('/dashboard/recent').then(r => setRecent(r.data)).catch(() => {});
  };

  useEffect(() => { loadData(); }, []);

  const handleCheckinSuccess = () => {
    setShowCheckin(false);
    showToast('Besucher erfolgreich eingecheckt');
    loadData();
  };

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header — only visible on desktop (mobile shows it in Layout header) */}
      <div className="hidden md:flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">{format(new Date(), 'EEEE, d. MMMM yyyy', { locale: de })}</p>
        </div>
        <button
          onClick={() => setShowCheckin(true)}
          className="flex items-center gap-2 bg-abat-blau hover:bg-primary-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-md transition-colors duration-150 ease-in-out"
        >
          <UserPlus size={18} />
          Besucher einchecken
        </button>
      </div>

      {/* Mobile date + big check-in button */}
      <div className="md:hidden">
        <p className="text-xs text-gray-400 mb-3">{format(new Date(), 'EEEE, d. MMMM yyyy', { locale: de })}</p>
        <button
          onClick={() => setShowCheckin(true)}
          className="w-full flex items-center justify-center gap-3 bg-abat-blau hover:bg-primary-600 text-white py-4 rounded-2xl text-base font-bold shadow-lg transition-colors active:scale-[0.98]"
        >
          <UserPlus size={22} />
          Besucher einchecken
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Users}        label="Aktuell anwesend"       value={stats?.currentlyIn}    color="blue" />
        <StatCard icon={UserCheck}    label="Heute eingecheckt"      value={stats?.todayTotal}      color="green" />
        <StatCard icon={UserMinus}    label="Heute ausgecheckt"      value={stats?.checkedOutToday} color="gray" />
        <StatCard icon={CalendarCheck} label="Vorregistr. offen"     value={stats?.pendingPrereg}   color="orange" />
      </div>

      {isAdmin && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 text-sm">Letzte Aktivitäten</h2>
            <Link to="/visitors" className="flex items-center gap-1 text-xs font-semibold text-abat-blau hover:underline">
              Alle Besuche ansehen <ArrowRight size={13} />
            </Link>
          </div>
          {recent.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">Noch keine Aktivitäten</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recent.map(v => (
                <div key={v.id} className="px-4 py-3.5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-abat-blau/10 flex items-center justify-center text-abat-blau font-bold text-sm flex-shrink-0">
                    {v.first_name?.[0]}{v.last_name?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm truncate">{v.first_name} {v.last_name}</p>
                    <p className="text-xs text-gray-400 truncate leading-snug mt-0.5">
                      {v.company ? `${v.company} · ` : ''}
                      {v.host_name ? `bei ${v.host_name}` : ''}
                      {v.checked_in_by_name ? ` · von ${v.checked_in_by_name}` : ''}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <StatusBadge status={v.status} />
                    <p className="text-xs text-gray-400 mt-1">
                      {format(new Date(v.checked_in_at), 'HH:mm', { locale: de })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showCheckin && (
        <VisitorCheckinForm
          onSuccess={handleCheckinSuccess}
          onClose={() => setShowCheckin(false)}
        />
      )}
    </div>
  );
}
