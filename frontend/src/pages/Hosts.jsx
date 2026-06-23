import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, X, UserCheck } from 'lucide-react';
import api from '../api/client';
import { showToast } from '../components/Layout';
import { useAuth } from '../context/AuthContext';

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

const emptyForm = { name: '', email: '' };

export default function Hosts() {
  const { user } = useAuth();
  const [hosts, setHosts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = () => api.get('/hosts').then(r => setHosts(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editId) {
        await api.put(`/hosts/${editId}`, form);
        showToast('Mitarbeiter aktualisiert');
      } else {
        await api.post('/hosts', form);
        showToast('Mitarbeiter hinzugefügt');
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

  const handleDelete = async (id) => {
    if (!confirm('Mitarbeiter entfernen?')) return;
    try {
      await api.delete(`/hosts/${id}`);
      showToast('Entfernt');
      load();
    } catch {
      showToast('Fehler', 'error');
    }
  };

  const openEdit = (host) => {
    setForm({ name: host.name, email: host.email || '' });
    setEditId(host.id);
    setShowForm(true);
  };

  const inp = 'w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-abat-blau focus:ring-1 focus:ring-abat-blau';
  const isAdmin = user?.role === 'admin';

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Mitarbeiter</h1>
          <p className="text-sm text-gray-500 mt-0.5">Ansprechpartner für Besucher · wird automatisch bei Microsoft-Login angelegt</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setForm(emptyForm); setEditId(null); setShowForm(true); }}
            className="flex items-center gap-2 bg-abat-blau hover:bg-primary-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md transition-colors"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Hinzufügen</span>
          </button>
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">E-Mail</th>
              {isAdmin && <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Aktionen</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {hosts.length === 0 ? (
              <tr><td colSpan={3} className="py-12 text-center text-gray-400">Noch keine Mitarbeiter — werden automatisch bei erstem Microsoft-Login angelegt</td></tr>
            ) : hosts.map(h => (
              <tr key={h.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-abat-blau/10 flex items-center justify-center text-abat-blau font-semibold text-xs">
                      {h.name?.split(' ').map(p => p[0]).join('').slice(0,2).toUpperCase()}
                    </div>
                    <span className="font-medium text-gray-800">{h.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500">{h.email || '–'}</td>
                {isAdmin && (
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => openEdit(h)} className="p-1.5 text-gray-400 hover:text-abat-blau hover:bg-abat-blau/10 rounded-lg transition-colors"><Pencil size={15} /></button>
                      <button onClick={() => handleDelete(h.id)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={15} /></button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {hosts.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center text-gray-400 text-sm shadow-sm border border-gray-100">
            <UserCheck size={36} className="mx-auto mb-3 opacity-30" />
            Werden automatisch bei erstem Microsoft-Login angelegt
          </div>
        ) : hosts.map(h => (
          <div key={h.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-abat-blau/10 flex items-center justify-center text-abat-blau font-semibold text-sm">
                  {h.name?.split(' ').map(p => p[0]).join('').slice(0,2).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-gray-800">{h.name}</p>
                  {h.email && <p className="text-xs text-gray-400">{h.email}</p>}
                </div>
              </div>
              {isAdmin && (
                <div className="flex gap-1">
                  <button onClick={() => openEdit(h)} className="p-2 text-gray-400 hover:text-abat-blau hover:bg-abat-blau/10 rounded-lg"><Pencil size={15} /></button>
                  <button onClick={() => handleDelete(h.id)} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={15} /></button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <Modal title={editId ? 'Mitarbeiter bearbeiten' : 'Mitarbeiter hinzufügen'} onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className={inp} placeholder="Max Mustermann" autoFocus />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">E-Mail</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inp} placeholder="max@abat.de" />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">Abbrechen</button>
              <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 bg-abat-blau text-white rounded-xl text-sm font-semibold disabled:opacity-50">
                {loading ? 'Speichern…' : (editId ? 'Speichern' : 'Hinzufügen')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
