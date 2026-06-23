import React, { useState, useEffect } from 'react';
import { Plus, X, CalendarCheck, LogIn, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import api from '../api/client';
import { showToast } from '../components/Layout';
import { useAuth } from '../context/AuthContext';

function StatusBadge({ status }) {
  if (status === 'pending') return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">Ausstehend</span>;
  if (status === 'checked_in') return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Eingecheckt</span>;
  if (status === 'cancelled') return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-600">Abgesagt</span>;
  return null;
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

const emptyForm = { visitor_first_name: '', visitor_last_name: '', visitor_company: '', host_id: '', expected_date: '', expected_time: '', notes: '' };

export default function PreRegistration() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('pending');
  const [items, setItems] = useState([]);
  const [hosts, setHosts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = () => {
    api.get('/preregistrations').then(r => setItems(r.data)).catch(() => {});
  };

  useEffect(() => {
    load();
    api.get('/hosts').then(r => setHosts(r.data)).catch(() => {});
  }, []);

  const filtered = items.filter(i => {
    if (activeTab === 'pending') return i.status === 'pending';
    if (activeTab === 'checked_in') return i.status === 'checked_in';
    return true;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editId) {
        await api.put(`/preregistrations/${editId}`, form);
        showToast('Vorregistrierung aktualisiert');
      } else {
        await api.post('/preregistrations', form);
        showToast('Vorregistrierung erstellt');
      }
      setShowForm(false);
      setForm(emptyForm);
      setEditId(null);
      load();
    } catch (err) {
      showToast(err.response?.data?.error || 'Fehler', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckin = async (id) => {
    try {
      await api.post(`/preregistrations/${id}/checkin`);
      showToast('Besucher eingecheckt');
      load();
    } catch (err) {
      showToast(err.response?.data?.error || 'Fehler', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Vorregistrierung löschen?')) return;
    try {
      await api.delete(`/preregistrations/${id}`);
      showToast('Gelöscht');
      load();
    } catch {
      showToast('Fehler', 'error');
    }
  };

  const openEdit = (item) => {
    setForm({
      visitor_first_name: item.visitor_first_name,
      visitor_last_name: item.visitor_last_name,
      visitor_company: item.visitor_company || '',
      host_id: item.host_id || '',
      expected_date: item.expected_date || '',
      expected_time: item.expected_time || '',
      notes: item.notes || '',
    });
    setEditId(item.id);
    setShowForm(true);
  };

  const inp = 'w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-abat-blau focus:ring-1 focus:ring-abat-blau';

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Vorregistrierungen</h1>
          <p className="text-sm text-gray-500 mt-0.5">Besucher vorab eintragen</p>
        </div>
        <button
          onClick={() => { setForm(emptyForm); setEditId(null); setShowForm(true); }}
          className="flex items-center gap-2 bg-abat-blau hover:bg-primary-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md transition-colors"
        >
          <Plus size={18} />
          <span className="hidden sm:inline">Vorregistrierung</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[{ key: 'pending', label: 'Ausstehend' }, { key: 'checked_in', label: 'Eingecheckt' }, { key: 'all', label: 'Alle' }].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === t.key ? 'bg-white text-abat-blau shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center text-gray-400 text-sm shadow-sm border border-gray-100">
          <CalendarCheck size={36} className="mx-auto mb-3 opacity-30" />
          Keine Einträge
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => (
            <div key={item.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-abat-blau/10 flex items-center justify-center text-abat-blau font-semibold text-sm flex-shrink-0">
                  {item.visitor_first_name?.[0]}{item.visitor_last_name?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="font-semibold text-gray-800">{item.visitor_first_name} {item.visitor_last_name}</p>
                    <StatusBadge status={item.status} />
                  </div>
                  <div className="mt-1 text-xs text-gray-500 space-y-0.5">
                    {item.visitor_company && <p>{item.visitor_company}</p>}
                    {item.host_name && <p>Mitarbeiter: {item.host_name}</p>}
                    {item.expected_date && (
                      <p>Erwartet: {format(new Date(item.expected_date + 'T12:00:00'), 'dd.MM.yyyy', { locale: de })}
                        {item.expected_time ? ` um ${item.expected_time}` : ''}
                      </p>
                    )}
                    {item.notes && <p className="text-gray-400 truncate">{item.notes}</p>}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex gap-2 flex-wrap">
                {item.status === 'pending' && (
                  <button
                    onClick={() => handleCheckin(item.id)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold transition-colors"
                  >
                    <LogIn size={14} />
                    Einchecken
                  </button>
                )}
                {item.status === 'pending' && (
                  <button
                    onClick={() => openEdit(item)}
                    className="px-3 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-xs font-medium"
                  >
                    Bearbeiten
                  </button>
                )}
                {user?.role === 'admin' && (
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="ml-auto px-2.5 py-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <Modal title={editId ? 'Vorregistrierung bearbeiten' : 'Neue Vorregistrierung'} onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Vorname *</label>
                <input name="visitor_first_name" value={form.visitor_first_name} onChange={e => setForm(f => ({ ...f, visitor_first_name: e.target.value }))} required className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Nachname *</label>
                <input name="visitor_last_name" value={form.visitor_last_name} onChange={e => setForm(f => ({ ...f, visitor_last_name: e.target.value }))} required className={inp} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Unternehmen</label>
              <input value={form.visitor_company} onChange={e => setForm(f => ({ ...f, visitor_company: e.target.value }))} className={inp} placeholder="Optional" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Mitarbeiter *</label>
              <select value={form.host_id} onChange={e => setForm(f => ({ ...f, host_id: e.target.value }))} required className={`${inp} bg-white`}>
                <option value="">– bitte wählen –</option>
                {hosts.map(h => <option key={h.id} value={h.id}>{h.name}{h.email ? ` – ${h.email}` : ''}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Datum *</label>
                <input type="date" value={form.expected_date} onChange={e => setForm(f => ({ ...f, expected_date: e.target.value }))} required className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Uhrzeit</label>
                <input type="time" value={form.expected_time} onChange={e => setForm(f => ({ ...f, expected_time: e.target.value }))} className={inp} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Notizen</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={`${inp} resize-none`} />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">Abbrechen</button>
              <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 bg-abat-blau text-white rounded-xl text-sm font-semibold disabled:opacity-50">
                {loading ? 'Speichern…' : (editId ? 'Speichern' : 'Erstellen')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
