import React, { useState, useEffect, useCallback } from 'react';
import { Search, Users, LogOut, Trash2, UserPlus, CalendarPlus, LogIn, Undo2, Ban } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { de } from 'date-fns/locale';
import api from '../api/client';
import { showToast } from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import VisitorCheckinForm from '../components/VisitorCheckinForm';
import HostAutocomplete from '../components/HostAutocomplete';
import ConfirmDialog from '../components/ConfirmDialog';
import TimeAdjuster from '../components/TimeAdjuster';
import Modal from '../components/Modal';

function StatusBadge({ status }) {
  if (status === 'active') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />Anwesend</span>;
  if (status === 'vorregistriert') return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">Vorregistriert</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">Ausgecheckt</span>;
}

function Avatar({ first, last }) {
  return (
    <div className="w-9 h-9 rounded-full bg-abat-blau/10 flex items-center justify-center text-abat-blau font-semibold text-sm flex-shrink-0">
      {first?.[0]}{last?.[0]}
    </div>
  );
}

function isPrereg(row) {
  return !!row.prereg_id;
}

function dayKey(row) {
  const ts = row.checked_in_at || row.checked_out_at || (row.expected_date ? `${row.expected_date}T${row.expected_time || '00:00'}` : row.created_at);
  return ts ? ts.split('T')[0] : null;
}

function dayLabel(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  if (isToday(d)) return 'Heute';
  if (isYesterday(d)) return 'Gestern';
  return format(d, 'dd.MM.yyyy', { locale: de });
}

// Jenseits der ersten 10 Einträge werden Tageskopfzeilen eingezogen, damit ältere
// Aktivitäten tageweise statt als endlose flache Liste durchsucht werden.
function withDayHeaders(rows) {
  const out = [];
  let lastDay = null;
  rows.forEach((row, idx) => {
    if (idx >= 10) {
      const key = dayKey(row);
      if (key !== lastDay) {
        out.push({ __header: true, key: `h-${key}-${idx}`, label: key ? dayLabel(key) : 'Unbekanntes Datum' });
        lastDay = key;
      }
    }
    out.push(row);
  });
  return out;
}

function canCancelPrereg(row, user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return !!(row.host_email && row.host_email.toLowerCase() === user.email.toLowerCase());
}

// ---- Vorregistrierung anlegen ----
const emptyPreregForm = { visitor_first_name: '', visitor_last_name: '', visitor_company: '', expected_date: '', expected_time: '', notes: '' };

function PreRegFormModal({ onClose, onSuccess }) {
  const [form, setForm] = useState(emptyPreregForm);
  const [host, setHost] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const inp = 'w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-abat-blau focus:ring-1 focus:ring-abat-blau';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.notes.trim()) { setError('Bitte Notizen eintragen.'); return; }
    setError('');
    setLoading(true);
    try {
      await api.post('/preregistrations', {
        ...form,
        host_name: host?.name,
        host_email: host?.email,
        host_ad_object_id: host?.ad_object_id,
      });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Neue Vorregistrierung" onClose={onClose} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Vorname *</label>
            <input value={form.visitor_first_name} onChange={e => setForm(f => ({ ...f, visitor_first_name: e.target.value }))} required className={inp} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Nachname *</label>
            <input value={form.visitor_last_name} onChange={e => setForm(f => ({ ...f, visitor_last_name: e.target.value }))} required className={inp} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Unternehmen</label>
          <input value={form.visitor_company} onChange={e => setForm(f => ({ ...f, visitor_company: e.target.value }))} className={inp} placeholder="Optional" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Gastgeber *</label>
          <HostAutocomplete value={host} onSelect={setHost} />
        </div>
        <div>
          <div className="flex items-baseline justify-between mb-1">
            <label className="text-xs font-semibold text-gray-700">Datum & Uhrzeit</label>
            <span className="text-[10px] text-gray-400">optional · Check-in-Zeit wird automatisch erfasst</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input type="date" value={form.expected_date} onChange={e => setForm(f => ({ ...f, expected_date: e.target.value }))} className={inp} />
            <input type="time" value={form.expected_time} onChange={e => setForm(f => ({ ...f, expected_time: e.target.value }))} className={inp} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Notizen *</label>
          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} required rows={2} className={`${inp} resize-none`} />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">Abbrechen</button>
          <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 bg-abat-blau text-white rounded-xl text-sm font-semibold disabled:opacity-50">
            {loading ? 'Speichern…' : 'Erstellen'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---- Vorregistrierten Besucher einchecken (mit korrigierbarer Uhrzeit) ----
function CheckinPreregDialog({ row, onClose, onSuccess }) {
  const now = new Date();
  const [time, setTime] = useState(format(now, 'HH:mm'));
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const checkedInAt = new Date(`${format(now, 'yyyy-MM-dd')}T${time}`).toISOString();
      await api.post(`/preregistrations/${row.prereg_id}/checkin`, { checked_in_at: checkedInAt });
      onSuccess();
    } catch (err) {
      showToast(err.response?.data?.error || 'Fehler', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Besucher einchecken" onClose={onClose} size="sm">
      <div className="space-y-5">
        <p className="text-sm text-gray-600">
          <strong className="text-gray-900">{row.first_name} {row.last_name}</strong> jetzt einchecken?
        </p>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Check-in-Uhrzeit</label>
          <TimeAdjuster value={time} onChange={setTime} />
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">Abbrechen</button>
          <button type="button" onClick={handleConfirm} disabled={loading} className="flex-1 px-4 py-2.5 bg-abat-blau text-white rounded-xl text-sm font-semibold disabled:opacity-50">
            {loading ? 'Bitte warten…' : 'Einchecken'}
          </button>
        </div>
      </div>
    </Modal>
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
  const [showPrereg, setShowPrereg] = useState(false);
  const [checkoutTarget, setCheckoutTarget] = useState(null);
  const [checkinPreregTarget, setCheckinPreregTarget] = useState(null);
  const limit = 25;

  const statusParam = { active: 'active', checkedout: 'completed', vorregistriert: 'vorregistriert', all: '' }[activeTab];

  const load = useCallback(() => {
    const params = new URLSearchParams({ page, limit, search });
    if (statusParam) params.set('status', statusParam);
    api.get(`/visitors?${params}`).then(r => {
      setVisitors(r.data.visitors || r.data);
      setTotal(r.data.total || 0);
    }).catch(() => {});
  }, [activeTab, page, search]);

  useEffect(() => { setPage(1); }, [activeTab, search]);
  useEffect(() => { load(); }, [load]);

  const handleCheckoutConfirmed = async () => {
    try {
      await api.post(`/visits/${checkoutTarget.visit_id}/checkout`);
      showToast('Ausgecheckt');
      setCheckoutTarget(null);
      load();
    } catch {
      showToast('Fehler beim Auschecken', 'error');
    }
  };

  const handleReactivate = async (visitId) => {
    try {
      await api.post(`/visits/${visitId}/reactivate`);
      showToast('Checkout rückgängig gemacht');
      load();
    } catch (err) {
      showToast(err.response?.data?.error || 'Fehler', 'error');
    }
  };

  const handleCancelPrereg = async (id) => {
    if (!confirm('Vorregistrierung absagen?')) return;
    try {
      const res = await api.delete(`/preregistrations/${id}`);
      showToast(res.data.message || 'Abgesagt');
      load();
    } catch (err) {
      showToast(err.response?.data?.error || 'Fehler', 'error');
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
    { key: 'vorregistriert', label: 'Vorregistriert' },
    { key: 'checkedout', label: 'Ausgecheckt' },
    { key: 'all', label: 'Alle' },
  ];

  const displayRows = withDayHeaders(visitors);

  const renderActions = (v, mobile = false) => {
    if (isPrereg(v)) {
      const canCancel = canCancelPrereg(v, user);
      return (
        <>
          <button
            onClick={() => setCheckinPreregTarget(v)}
            className={mobile
              ? 'flex-1 flex items-center justify-center gap-2 py-3 text-abat-blau text-sm font-semibold active:bg-blue-50 transition-colors'
              : 'flex items-center gap-1 px-3 py-1.5 bg-abat-blau/10 hover:bg-abat-blau/20 text-abat-blau rounded-lg text-xs font-medium transition-colors'}
          >
            <LogIn size={mobile ? 16 : 13} />
            Einchecken
          </button>
          {canCancel && (
            <button
              onClick={() => handleCancelPrereg(v.prereg_id)}
              className={mobile
                ? 'flex items-center justify-center gap-1 px-4 py-3 text-red-400 text-xs font-medium active:bg-red-50 transition-colors border-l border-gray-100'
                : 'flex items-center gap-1 px-3 py-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium transition-colors'}
            >
              <Ban size={mobile ? 15 : 13} />
              {mobile ? '' : 'Absagen'}
            </button>
          )}
        </>
      );
    }

    const isSameDayCheckout = v.visit_status === 'completed' && v.checked_out_at && isToday(new Date(v.checked_out_at));

    return (
      <>
        {v.visit_status === 'active' && v.visit_id && (
          <button
            onClick={() => setCheckoutTarget(v)}
            className={mobile
              ? 'flex-1 flex items-center justify-center gap-2 py-3 text-abat-blau text-sm font-semibold active:bg-blue-50 transition-colors'
              : 'flex items-center gap-1 px-3 py-1.5 bg-abat-blau/10 hover:bg-abat-blau/20 text-abat-blau rounded-lg text-xs font-medium transition-colors'}
          >
            <LogOut size={mobile ? 16 : 13} />
            Auschecken
          </button>
        )}
        {isSameDayCheckout && (
          <button
            onClick={() => handleReactivate(v.visit_id)}
            className={mobile
              ? 'flex-1 flex items-center justify-center gap-2 py-3 text-gray-600 text-sm font-semibold active:bg-gray-50 transition-colors'
              : 'flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-medium transition-colors'}
          >
            <Undo2 size={mobile ? 16 : 13} />
            Rückgängig
          </button>
        )}
        {user?.role === 'admin' && (
          <button
            onClick={() => handleDelete(v.id)}
            className={mobile
              ? `flex items-center justify-center gap-1 px-4 py-3 text-red-400 text-xs font-medium active:bg-red-50 transition-colors ${v.visit_status === 'active' || isSameDayCheckout ? 'border-l border-gray-100' : 'flex-1'}`
              : 'p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors'}
          >
            <Trash2 size={mobile ? 15 : 15} />
            {mobile && v.visit_status !== 'active' && !isSameDayCheckout && 'Löschen'}
          </button>
        )}
      </>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header — desktop only (mobile uses Layout header) */}
      <div className="hidden md:flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Besucher</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowPrereg(true)}
            className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
          >
            <CalendarPlus size={18} />
            Vorregistrieren
          </button>
          <button
            onClick={() => setShowCheckin(true)}
            className="flex items-center gap-2 bg-abat-blau hover:bg-primary-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-md transition-colors"
          >
            <UserPlus size={18} />
            Einchecken
          </button>
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl self-start flex-wrap">
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

      {/* Mobile: floating action buttons */}
      <div className="md:hidden flex gap-2">
        <button
          onClick={() => setShowPrereg(true)}
          className="flex-1 flex items-center justify-center gap-2 border border-gray-200 text-gray-700 py-3.5 rounded-xl text-sm font-bold active:scale-[0.98] transition-all"
        >
          <CalendarPlus size={18} />
          Vorreg.
        </button>
        <button
          onClick={() => setShowCheckin(true)}
          className="flex-[2] flex items-center justify-center gap-2 bg-abat-blau text-white py-3.5 rounded-xl text-sm font-bold shadow-md active:scale-[0.98] transition-all"
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
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Gastgeber</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Check-in</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Check-out</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Notizen</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Erfasst durch</th>
              {activeTab === 'all' && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>}
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {displayRows.length === 0 ? (
              <tr><td colSpan={8} className="py-12 text-center text-gray-400">Keine Einträge</td></tr>
            ) : displayRows.map(v => v.__header ? (
              <tr key={v.key} className="bg-gray-50">
                <td colSpan={8} className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">{v.label}</td>
              </tr>
            ) : (
              <tr key={isPrereg(v) ? `p${v.prereg_id}` : `v${v.id}-${v.visit_id}`} className="hover:bg-gray-50/50 transition-colors">
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
                  {v.checked_in_at ? format(new Date(v.checked_in_at), 'dd.MM. HH:mm', { locale: de })
                    : v.expected_date ? `Erwartet: ${format(new Date(v.expected_date + 'T12:00:00'), 'dd.MM.yyyy', { locale: de })}${v.expected_time ? ` ${v.expected_time}` : ''}`
                    : '–'}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {v.checked_out_at ? format(new Date(v.checked_out_at), 'dd.MM. HH:mm', { locale: de }) : '–'}
                </td>
                <td className="px-4 py-3 text-gray-500 max-w-[16rem] truncate" title={v.notes || ''}>{v.notes || '–'}</td>
                <td className="px-4 py-3 text-gray-600">{v.checked_in_by_name || '–'}</td>
                {activeTab === 'all' && <td className="px-4 py-3"><StatusBadge status={v.visit_status} /></td>}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    {renderActions(v)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-2.5">
        {displayRows.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center text-gray-400 text-sm shadow-sm border border-gray-100">
            <Users size={32} className="mx-auto mb-3 opacity-25" />
            Keine Einträge
          </div>
        ) : displayRows.map(v => v.__header ? (
          <p key={v.key} className="px-1 pt-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">{v.label}</p>
        ) : (
          <div key={isPrereg(v) ? `p${v.prereg_id}` : `v${v.id}-${v.visit_id}`} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Card header */}
            <div className="px-4 pt-4 pb-3 flex items-center gap-3">
              <Avatar first={v.first_name} last={v.last_name} />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 leading-tight">{v.first_name} {v.last_name}</p>
                {v.company && <p className="text-xs text-gray-400 truncate mt-0.5">{v.company}</p>}
              </div>
              {activeTab === 'all' && <StatusBadge status={v.visit_status} />}
            </div>

            {/* Meta row */}
            <div className="px-4 pb-3 grid grid-cols-2 gap-x-3 gap-y-1">
              {v.host_name && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Gastgeber</p>
                  <p className="text-xs text-gray-700 font-medium truncate">{v.host_name}</p>
                </div>
              )}
              {v.checked_in_at && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Check-in</p>
                  <p className="text-xs text-gray-700 font-medium">{format(new Date(v.checked_in_at), 'dd.MM. HH:mm', { locale: de })}</p>
                </div>
              )}
              {v.checked_out_at && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Check-out</p>
                  <p className="text-xs text-gray-700 font-medium">{format(new Date(v.checked_out_at), 'dd.MM. HH:mm', { locale: de })}</p>
                </div>
              )}
              {v.checked_in_by_name && (
                <div className="col-span-2">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Erfasst durch</p>
                  <p className="text-xs text-gray-700 font-medium">{v.checked_in_by_name}</p>
                </div>
              )}
              {v.notes && (
                <div className="col-span-2">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Notizen</p>
                  <p className="text-xs text-gray-700">{v.notes}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="border-t border-gray-100 flex">
              {renderActions(v, true)}
            </div>
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

      {showPrereg && (
        <PreRegFormModal
          onClose={() => setShowPrereg(false)}
          onSuccess={() => { setShowPrereg(false); showToast('Vorregistrierung erstellt'); load(); }}
        />
      )}

      {checkinPreregTarget && (
        <CheckinPreregDialog
          row={checkinPreregTarget}
          onClose={() => setCheckinPreregTarget(null)}
          onSuccess={() => { setCheckinPreregTarget(null); showToast('Besucher eingecheckt'); load(); }}
        />
      )}

      {checkoutTarget && (
        <ConfirmDialog
          title="Auschecken bestätigen"
          message={`${checkoutTarget.first_name} ${checkoutTarget.last_name} wirklich auschecken?`}
          confirmLabel="Auschecken"
          onConfirm={handleCheckoutConfirmed}
          onClose={() => setCheckoutTarget(null)}
        />
      )}
    </div>
  );
}
