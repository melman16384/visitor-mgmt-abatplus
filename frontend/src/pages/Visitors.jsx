import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, LogOut, Trash2, UserPlus, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import api from '../api/client';
import { showToast } from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import VisitorCheckinForm from '../components/VisitorCheckinForm';

function StatusBadge({ status }) {
  if (status === 'active') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />Anwesend</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">Ausgecheckt</span>;
}

function Avatar({ first, last }) {
  return (
    <div className="w-9 h-9 rounded-full bg-abat-blau/10 flex items-center justify-center text-abat-blau font-semibold text-sm flex-shrink-0">
      {first?.[0]}{last?.[0]}
    </div>
  );
}

export default function Visitors() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('active');
  const [visitors, setVisitors] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showCheckin, setShowCheckin] = useState(false);
  const limit = 25;

  const load = useCallback(() => {
    const statusParam = activeTab === 'active' ? 'active' : activeTab === 'checkedout' ? 'completed' : '';
    const params = new URLSearchParams({ page, limit, search });
    if (statusParam) params.set('status', statusParam);
    api.get(`/visitors?${params}`).then(r => {
      setVisitors(r.data.visitors || r.data);
      setTotal(r.data.total || 0);
    }).catch(() => {});
  }, [activeTab, page, search]);

  useEffect(() => { setPage(1); }, [activeTab, search]);
  useEffect(() => { load(); }, [load]);

  const handleCheckout = async (visitId) => {
    try {
      await api.post(`/visits/${visitId}/checkout`);
      showToast('Ausgecheckt');
      load();
    } catch {
      showToast('Fehler beim Auschecken', 'error');
    }
  };

  const handleDelete = async (visitorId) => {
    if (!confirm('Besucher dauerhaft löschen?')) return;
    try {
      await api.delete(`/visitors/${visitorId}`);
      showToast('Gelöscht');
      load();
    } catch {
      showToast('Fehler beim Löschen', 'error');
    }
  };

  const tabs = [
    { key: 'active', label: 'Anwesend' },
    { key: 'checkedout', label: 'Ausgecheckt' },
    { key: 'all', label: 'Alle' },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header — desktop only (mobile uses Layout header) */}
      <div className="hidden md:flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Besucher</h1>
        <button
          onClick={() => setShowCheckin(true)}
          className="flex items-center gap-2 bg-abat-blau hover:bg-primary-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-md transition-colors"
        >
          <UserPlus size={18} />
          Einchecken
        </button>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl self-start">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === t.key ? 'bg-white text-abat-blau shadow-sm' : 'text-gray-500'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Name oder Unternehmen suchen…"
            className="w-full pl-9 pr-4 py-3 md:py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-abat-blau"
          />
        </div>
      </div>

      {/* Mobile: floating check-in button */}
      <div className="md:hidden">
        <button
          onClick={() => setShowCheckin(true)}
          className="w-full flex items-center justify-center gap-2 bg-abat-blau text-white py-3.5 rounded-xl text-sm font-bold shadow-md active:scale-[0.98] transition-all"
        >
          <UserPlus size={18} />
          Besucher einchecken
        </button>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Besucher</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Mitarbeiter</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Einchecken</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Erfasst durch</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {visitors.length === 0 ? (
              <tr><td colSpan={6} className="py-12 text-center text-gray-400">Keine Einträge</td></tr>
            ) : visitors.map(v => (
              <tr key={v.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar first={v.first_name} last={v.last_name} />
                    <div>
                      <p className="font-medium text-gray-800">{v.first_name} {v.last_name}</p>
                      {v.company && <p className="text-xs text-gray-400">{v.company}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600">{v.host_name || '–'}</td>
                <td className="px-4 py-3 text-gray-600">
                  {v.checked_in_at ? format(new Date(v.checked_in_at), 'dd.MM. HH:mm', { locale: de }) : '–'}
                </td>
                <td className="px-4 py-3 text-gray-600">{v.checked_in_by_name || '–'}</td>
                <td className="px-4 py-3"><StatusBadge status={v.visit_status} /></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    {v.visit_status === 'active' && v.visit_id && (
                      <button
                        onClick={() => handleCheckout(v.visit_id)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-abat-blau/10 hover:bg-abat-blau/20 text-abat-blau rounded-lg text-xs font-medium transition-colors"
                      >
                        <LogOut size={13} />
                        Auschecken
                      </button>
                    )}
                    {user?.role === 'admin' && (
                      <button
                        onClick={() => handleDelete(v.id)}
                        className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-2.5">
        {visitors.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center text-gray-400 text-sm shadow-sm border border-gray-100">
            <Users size={32} className="mx-auto mb-3 opacity-25" />
            Keine Einträge
          </div>
        ) : visitors.map(v => (
          <div key={v.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Card header */}
            <div className="px-4 pt-4 pb-3 flex items-center gap-3">
              <Avatar first={v.first_name} last={v.last_name} />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 leading-tight">{v.first_name} {v.last_name}</p>
                {v.company && <p className="text-xs text-gray-400 truncate mt-0.5">{v.company}</p>}
              </div>
              <StatusBadge status={v.visit_status} />
            </div>

            {/* Meta row */}
            <div className="px-4 pb-3 grid grid-cols-2 gap-x-3 gap-y-1">
              {v.host_name && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Mitarbeiter</p>
                  <p className="text-xs text-gray-700 font-medium truncate">{v.host_name}</p>
                </div>
              )}
              {v.checked_in_at && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Check-in</p>
                  <p className="text-xs text-gray-700 font-medium">{format(new Date(v.checked_in_at), 'dd.MM. HH:mm', { locale: de })}</p>
                </div>
              )}
              {v.checked_in_by_name && (
                <div className="col-span-2">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Erfasst durch</p>
                  <p className="text-xs text-gray-700 font-medium">{v.checked_in_by_name}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            {(v.visit_status === 'active' || user?.role === 'admin') && (
              <div className="border-t border-gray-100 flex">
                {v.visit_status === 'active' && v.visit_id && (
                  <button
                    onClick={() => handleCheckout(v.visit_id)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 text-abat-blau text-sm font-semibold active:bg-blue-50 transition-colors"
                  >
                    <LogOut size={16} />
                    Auschecken
                  </button>
                )}
                {user?.role === 'admin' && (
                  <button
                    onClick={() => handleDelete(v.id)}
                    className={`flex items-center justify-center gap-1 px-4 py-3 text-red-400 text-xs font-medium active:bg-red-50 transition-colors ${v.visit_status === 'active' ? 'border-l border-gray-100' : 'flex-1'}`}
                  >
                    <Trash2 size={15} />
                    {v.visit_status !== 'active' && 'Löschen'}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{total} Einträge gesamt</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-gray-50">Zurück</button>
            <span className="px-3 py-1.5">Seite {page}</span>
            <button disabled={page * limit >= total} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-gray-50">Weiter</button>
          </div>
        </div>
      )}

      {showCheckin && (
        <VisitorCheckinForm
          onSuccess={() => { setShowCheckin(false); showToast('Besucher eingecheckt'); load(); }}
          onClose={() => setShowCheckin(false)}
        />
      )}
    </div>
  );
}
