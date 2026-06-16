import React, { useState, useEffect, useCallback } from 'react';
import { Plus, UserX, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import Modal from '../components/Modal';
import client from '../api/client';
import { showToast } from '../components/Layout';

const severityConfig = {
  high: { label: 'Hoch', cls: 'bg-red-100 text-red-700 border border-red-200' },
  medium: { label: 'Mittel', cls: 'bg-orange-100 text-orange-700 border border-orange-200' },
  low: { label: 'Niedrig', cls: 'bg-yellow-100 text-yellow-700 border border-yellow-200' },
};

function WatchlistForm({ onSubmit, loading }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', company: '', reason: '', severity: 'medium' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const handleSubmit = (e) => { e.preventDefault(); onSubmit(form); };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Vorname *</label>
          <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={form.first_name} onChange={e => set('first_name', e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nachname *</label>
          <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={form.last_name} onChange={e => set('last_name', e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
          <input type="email" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={form.email} onChange={e => set('email', e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Unternehmen</label>
          <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={form.company} onChange={e => set('company', e.target.value)} />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Grund *</label>
        <textarea rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          value={form.reason} onChange={e => set('reason', e.target.value)} required
          placeholder="Bitte Grund für die Aufnahme in die Sperrliste angeben..." />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Schweregrad</label>
        <div className="flex gap-3">
          {Object.entries(severityConfig).map(([key, { label, cls }]) => (
            <label key={key} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 cursor-pointer transition-all text-sm font-medium
              ${form.severity === key ? cls + ' border-opacity-100' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
              <input type="radio" className="sr-only" value={key} checked={form.severity === key}
                onChange={() => set('severity', key)} />
              {label}
            </label>
          ))}
        </div>
      </div>
      <button type="submit" disabled={loading}
        className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 text-sm">
        {loading ? 'Wird gespeichert...' : 'Zur Sperrliste hinzufügen'}
      </button>
    </form>
  );
}

export default function Watchlist() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await client.get('/watchlist');
      setEntries(res.data);
    } catch {
      showToast('Fehler beim Laden', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAdd = async (form) => {
    setSubmitting(true);
    try {
      await client.post('/watchlist', form);
      showToast('Person zur Sperrliste hinzugefügt');
      setShowModal(false);
      loadData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Fehler', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (id) => {
    try {
      await client.delete(`/watchlist/${id}`);
      showToast('Eintrag deaktiviert');
      loadData();
    } catch {
      showToast('Fehler', 'error');
    }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sperrliste</h1>
          <p className="text-sm text-gray-500 mt-0.5">{entries.length} aktive Einträge</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm shadow-sm transition-colors">
          <Plus size={18} /> Zur Sperrliste hinzufügen
        </button>
      </div>

      {entries.length === 0 && !loading && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
          <ShieldAlert size={32} className="mx-auto text-green-400 mb-3" />
          <p className="text-green-700 font-medium">Sperrliste ist leer</p>
          <p className="text-green-500 text-sm mt-1">Derzeit sind keine Personen auf der Sperrliste</p>
        </div>
      )}

      {entries.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-6 py-3">Person</th>
                <th className="text-left px-6 py-3">Unternehmen</th>
                <th className="text-left px-6 py-3">Grund</th>
                <th className="text-left px-6 py-3">Schweregrad</th>
                <th className="text-left px-6 py-3">Hinzugefügt</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-16">
                  <div className="inline-block w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                </td></tr>
              ) : entries.map(e => {
                const sc = severityConfig[e.severity] || severityConfig.medium;
                return (
                  <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                          <UserX size={16} className="text-red-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{e.first_name} {e.last_name}</p>
                          {e.email && <p className="text-xs text-gray-400">{e.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{e.company || '–'}</td>
                    <td className="px-6 py-4 text-gray-600 max-w-xs">
                      <p className="truncate" title={e.reason}>{e.reason}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${sc.cls}`}>{sc.label}</span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {e.created_at ? format(new Date(e.created_at), 'dd.MM.yyyy', { locale: de }) : '–'}
                    </td>
                    <td className="px-6 py-4">
                      <button onClick={() => handleDeactivate(e.id)}
                        className="text-xs text-gray-400 hover:text-red-600 border border-gray-200 hover:border-red-200 px-3 py-1.5 rounded-lg transition-all font-medium">
                        Deaktivieren
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <Modal title="Zur Sperrliste hinzufügen" onClose={() => setShowModal(false)} size="md">
          <WatchlistForm onSubmit={handleAdd} loading={submitting} />
        </Modal>
      )}
    </div>
  );
}
