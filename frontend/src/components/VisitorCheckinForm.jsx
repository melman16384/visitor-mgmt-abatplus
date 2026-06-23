import React, { useState, useEffect } from 'react';
import { X, UserPlus } from 'lucide-react';
import api from '../api/client';

export default function VisitorCheckinForm({ onSuccess, onClose }) {
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    company: '',
    host_id: '',
    notes: '',
    privacy_accepted: false,
  });
  const [hosts, setHosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/hosts').then(r => setHosts(r.data)).catch(() => {});
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.privacy_accepted) {
      setError('Bitte Datenschutzerklärung bestätigen.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/visitors', form);
      onSuccess(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler beim Einchecken');
    } finally {
      setLoading(false);
    }
  };

  const inp = 'w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-abat-blau focus:ring-1 focus:ring-abat-blau';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-abat-blau/10 rounded-xl flex items-center justify-center">
              <UserPlus size={20} className="text-abat-blau" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Besucher einchecken</h2>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Vorname *</label>
              <input name="first_name" value={form.first_name} onChange={handleChange} required className={inp} placeholder="Max" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Nachname *</label>
              <input name="last_name" value={form.last_name} onChange={handleChange} required className={inp} placeholder="Mustermann" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Unternehmen</label>
            <input name="company" value={form.company} onChange={handleChange} className={inp} placeholder="Optional" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Mitarbeiter (Ansprechpartner) *</label>
            <select name="host_id" value={form.host_id} onChange={handleChange} required className={`${inp} bg-white`}>
              <option value="">– bitte wählen –</option>
              {hosts.map(h => (
                <option key={h.id} value={h.id}>{h.name}{h.email ? ` – ${h.email}` : ''}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Notizen</label>
            <textarea name="notes" value={form.notes} onChange={handleChange} rows={2} className={`${inp} resize-none`} placeholder="Optional" />
          </div>

          <label className="flex items-start gap-3 cursor-pointer p-3 bg-gray-50 rounded-xl border border-gray-200">
            <input
              type="checkbox"
              name="privacy_accepted"
              checked={form.privacy_accepted}
              onChange={handleChange}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 text-abat-blau focus:ring-abat-blau flex-shrink-0"
            />
            <span className="text-sm text-gray-600">
              Der Besucher hat die <span className="font-semibold text-gray-800">Datenschutzerklärung</span> zur Kenntnis genommen und stimmt der Verarbeitung seiner Daten zu. *
            </span>
          </label>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
              Abbrechen
            </button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 bg-abat-blau text-white rounded-xl text-sm font-semibold hover:bg-primary-600 disabled:opacity-50 transition-colors shadow-md">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Einchecken…
                </span>
              ) : 'Einchecken'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
