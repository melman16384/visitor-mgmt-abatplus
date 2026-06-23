import React, { useState, useEffect } from 'react';
import { Users, UserCheck, UserMinus, CalendarCheck, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import api from '../api/client';
import VisitorCheckinForm from '../components/VisitorCheckinForm';
import { showToast } from '../components/Layout';

function StatCard({ icon: Icon, label, value, color = 'blue' }) {
  const colors = {
    blue: 'bg-abat-blau/10 text-abat-blau',
    green: 'bg-green-100 text-green-600',
    gray: 'bg-gray-100 text-gray-500',
    orange: 'bg-orange-100 text-orange-600',
  };
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value ?? '–'}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  if (status === 'active') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />Anwesend</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Ausgecheckt</span>;
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [showCheckin, setShowCheckin] = useState(false);

  const loadData = () => {
    api.get('/dashboard/stats').then(r => setStats(r.data)).catch(() => {});
    api.get('/dashboard/recent').then(r => setRecent(r.data)).catch(() => {});
  };

  useEffect(() => { loadData(); }, []);

  const handleCheckinSuccess = () => {
    setShowCheckin(false);
    showToast('Besucher erfolgreich eingecheckt');
    loadData();
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">{format(new Date(), 'EEEE, d. MMMM yyyy', { locale: de })}</p>
        </div>
        <button
          onClick={() => setShowCheckin(true)}
          className="flex items-center gap-2 bg-abat-blau hover:bg-primary-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md transition-colors"
        >
          <UserPlus size={18} />
          <span className="hidden sm:inline">Besucher einchecken</span>
          <span className="sm:hidden">Check-in</span>
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Aktuell anwesend" value={stats?.currentlyIn} color="blue" />
        <StatCard icon={UserCheck} label="Heute eingecheckt" value={stats?.todayTotal} color="green" />
        <StatCard icon={UserMinus} label="Heute ausgecheckt" value={stats?.checkedOutToday} color="gray" />
        <StatCard icon={CalendarCheck} label="Vorregistrierungen offen" value={stats?.pendingPrereg} color="orange" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Letzte Aktivitäten</h2>
        </div>
        {recent.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">Noch keine Aktivitäten</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recent.map(v => (
              <div key={v.id} className="px-5 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-abat-blau/10 flex items-center justify-center text-abat-blau font-semibold text-sm flex-shrink-0">
                  {v.first_name?.[0]}{v.last_name?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 text-sm truncate">{v.first_name} {v.last_name}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {v.company ? `${v.company} · ` : ''}
                    {v.host_name ? `bei ${v.host_name}` : ''}
                    {v.checked_in_by_name ? ` · erfasst durch ${v.checked_in_by_name}` : ''}
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

      {showCheckin && (
        <VisitorCheckinForm
          onSuccess={handleCheckinSuccess}
          onClose={() => setShowCheckin(false)}
        />
      )}
    </div>
  );
}
