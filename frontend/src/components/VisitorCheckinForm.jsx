import React, { useState, useEffect } from 'react';
import { X, UserPlus } from 'lucide-react';
import api from '../api/client';

export default function VisitorCheckinForm({ onSuccess, onClose }) {
  const [form, setForm] = useState({
    first_name: '', last_name: '', company: '',
    host_id: '', notes: '', privacy_accepted: false,
  });
  const [hosts, setHosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/hosts').then(r => setHosts(r.data)).catch(() => {});
    // prevent body scroll on mobile
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.privacy_accepted) { setError('Bitte Datenschutzerklärung bestätigen.'); return; }
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

  const inp = 'w-full px-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-abat-blau focus:ring-1 focus:ring-abat-blau bg-white';

  return (
    /* Backdrop */
    <div className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center md:items-center md:p-4 bg-black/50"
         onClick={e => e.target === e.currentTarget && onClose()}>

      {/* Sheet / Modal */}
      <div className="bg-white w-full md:max-w-md md:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[92dvh] md:max-h-[90vh]">

        {/* Handle bar — mobile only */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-abat-blau/10 rounded-xl flex items-center justify-center">
              <UserPlus size={18} className="text-abat-blau" />
            </div>
            <h2 className="text-base font-bold text-gray-900">Besucher einchecken</h2>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Form — scrollable */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Vorname *</label>
              <input name="first_name" value={form.first_name} onChange={handleChange} required className={inp} placeholder="Max" autoFocus />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nachname *</label>
              <input name="last_name" value={form.last_name} onChange={handleChange} required className={inp} placeholder="Mustermann" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Unternehmen</label>
            <input name="company" value={form.company} onChange={handleChange} className={inp} placeholder="Optional" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Mitarbeiter (Ansprechpartner) *</label>
            <select name="host_id" value={form.host_id} onChange={handleChange} required className={`${inp} appearance-none`}>
              <option value="">– bitte wählen –</option>
              {hosts.map(h => (
                <option key={h.id} value={h.id}>{h.name}{h.email ? ` – ${h.email}` : ''}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Notizen</label>
            <textarea name="notes" value={form.notes} onChange={handleChange} rows={2} className={`${inp} resize-none`} placeholder="Optional" />
          </div>

          <label className="flex items-start gap-3 cursor-pointer p-3.5 bg-blue-50 rounded-xl border border-blue-100">
            <input
              type="checkbox" name="privacy_accepted" checked={form.privacy_accepted} onChange={handleChange}
              className="mt-0.5 w-5 h-5 rounded border-gray-300 text-abat-blau focus:ring-abat-blau flex-shrink-0 cursor-pointer"
            />
            <span className="text-sm text-gray-700 leading-snug">
              Besucher hat die <strong className="text-gray-900">Datenschutzerklärung</strong> zur Kenntnis genommen und stimmt der Verarbeitung zu. *
            </span>
          </label>
        </form>

        {/* Sticky footer buttons */}
        <div className="px-5 py-4 border-t border-gray-100 flex gap-3 bg-white">
          <button type="button" onClick={onClose}
            className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors">
            Abbrechen
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-2 flex-grow px-4 py-3 bg-abat-blau text-white rounded-xl text-sm font-bold hover:bg-primary-600 disabled:opacity-50 transition-colors shadow-md flex items-center justify-center gap-2">
            {loading
              ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Einchecken…</>
              : 'Einchecken'
            }
          </button>
        </div>
      </div>
    </div>
  );
}
