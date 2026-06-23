import React, { useState, useEffect } from 'react';
import { Settings2, Users, Key, UserCheck, Plus, Trash2, Pencil, X, Eye, EyeOff } from 'lucide-react';
import api from '../api/client';
import { showToast } from '../components/Layout';
import { useAuth } from '../context/AuthContext';

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

const inp = 'w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-abat-blau focus:ring-1 focus:ring-abat-blau';

// ---- Auto-Checkout Tab ----
function AutoCheckoutTab() {
  const [enabled, setEnabled] = useState(true);
  const [time, setTime] = useState('20:00');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/settings').then(r => {
      const s = r.data;
      setEnabled(s.auto_checkout_enabled !== '0' && s.auto_checkout_enabled !== false);
      setTime(s.auto_checkout_time || '20:00');
    }).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/settings', { auto_checkout_enabled: enabled ? '1' : '0', auto_checkout_time: time });
      showToast('Einstellungen gespeichert');
    } catch {
      showToast('Fehler beim Speichern', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 space-y-4">
        <h3 className="font-semibold text-gray-800">Automatischer Checkout</h3>
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <p className="font-medium text-gray-700">Auto-Checkout aktiviert</p>
            <p className="text-xs text-gray-400 mt-0.5">Alle aktiven Besucher werden zur konfigurierten Uhrzeit automatisch ausgecheckt</p>
          </div>
          <button
            onClick={() => setEnabled(e => !e)}
            className={`relative w-12 h-6 rounded-full transition-colors ${enabled ? 'bg-abat-blau' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
        </label>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Checkout-Zeit</label>
          <input type="time" value={time} onChange={e => setTime(e.target.value)} className={inp} disabled={!enabled} />
        </div>
        <button onClick={save} disabled={saving} className="w-full py-2.5 bg-abat-blau text-white rounded-xl text-sm font-semibold disabled:opacity-50">
          {saving ? 'Speichern…' : 'Einstellungen speichern'}
        </button>
      </div>
    </div>
  );
}

// ---- Change Password Tab ----
function PasswordTab() {
  const [form, setForm] = useState({ current: '', newPw: '', confirm: '' });
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    if (form.newPw !== form.confirm) { showToast('Passwörter stimmen nicht überein', 'error'); return; }
    if (form.newPw.length < 8) { showToast('Mindestens 8 Zeichen', 'error'); return; }
    setSaving(true);
    try {
      await api.put('/auth/change-password', { currentPassword: form.current, newPassword: form.newPw });
      showToast('Passwort geändert');
      setForm({ current: '', newPw: '', confirm: '' });
    } catch (err) {
      showToast(err.response?.data?.error || 'Fehler', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <h3 className="font-semibold text-gray-800 mb-4">Passwort ändern</h3>
      <form onSubmit={save} className="space-y-4">
        {[
          { key: 'current', label: 'Aktuelles Passwort' },
          { key: 'newPw', label: 'Neues Passwort' },
          { key: 'confirm', label: 'Neues Passwort bestätigen' },
        ].map(({ key, label }) => (
          <div key={key}>
            <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                value={form[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                required
                className={`${inp} pr-10`}
              />
              <button type="button" onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        ))}
        <button type="submit" disabled={saving} className="w-full py-2.5 bg-abat-blau text-white rounded-xl text-sm font-semibold disabled:opacity-50">
          {saving ? 'Speichern…' : 'Passwort ändern'}
        </button>
      </form>
    </div>
  );
}

// ---- Users Tab (admin only) ----
function UsersTab() {
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'user' });
  const [saving, setSaving] = useState(false);

  const load = () => api.get('/users').then(r => setUsers(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editUser) {
        const data = { name: form.name, email: form.email, role: form.role };
        if (form.password) data.password = form.password;
        await api.put(`/users/${editUser.id}`, data);
        showToast('Benutzer aktualisiert');
      } else {
        await api.post('/users', form);
        showToast('Benutzer erstellt');
      }
      setShowForm(false);
      setEditUser(null);
      load();
    } catch (err) {
      showToast(err.response?.data?.error || 'Fehler', 'error');
    } finally {
      setSaving(false);
    }
  };

  const del = async (id) => {
    if (!confirm('Benutzer löschen?')) return;
    try { await api.delete(`/users/${id}`); load(); showToast('Gelöscht'); }
    catch { showToast('Fehler', 'error'); }
  };

  const openEdit = (u) => {
    setForm({ name: u.name, email: u.email, password: '', role: u.role });
    setEditUser(u);
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => { setForm({ name: '', email: '', password: '', role: 'user' }); setEditUser(null); setShowForm(true); }}
          className="flex items-center gap-2 bg-abat-blau text-white px-4 py-2 rounded-xl text-sm font-semibold">
          <Plus size={16} /> Benutzer hinzufügen
        </button>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">E-Mail</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Rolle</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-gray-50/50">
                <td className="px-4 py-3 font-medium text-gray-800">{u.name}</td>
                <td className="px-4 py-3 text-gray-600">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${u.role === 'admin' ? 'bg-abat-blau/10 text-abat-blau' : 'bg-gray-100 text-gray-500'}`}>
                    {u.role === 'admin' ? 'Administrator' : 'Benutzer'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => openEdit(u)} className="p-1.5 text-gray-400 hover:text-abat-blau hover:bg-abat-blau/10 rounded-lg"><Pencil size={14} /></button>
                    <button onClick={() => del(u.id)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal title={editUser ? 'Benutzer bearbeiten' : 'Benutzer erstellen'} onClose={() => setShowForm(false)}>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className={inp} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">E-Mail *</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required className={inp} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">{editUser ? 'Neues Passwort (leer = unverändert)' : 'Passwort *'}</label>
              <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required={!editUser} className={inp} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Rolle</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className={`${inp} bg-white`}>
                <option value="user">Benutzer</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm">Abbrechen</button>
              <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-abat-blau text-white rounded-xl text-sm font-semibold disabled:opacity-50">
                {saving ? 'Speichern…' : (editUser ? 'Speichern' : 'Erstellen')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ---- Main Settings ----
export default function Settings() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [tab, setTab] = useState('password');

  const tabs = [
    ...(isAdmin ? [{ key: 'checkout', label: 'Auto-Checkout', icon: Settings2 }] : []),
    { key: 'password', label: 'Passwort', icon: Key },
    ...(isAdmin ? [{ key: 'users', label: 'Benutzer', icon: Users }] : []),
  ];

  useEffect(() => {
    if (isAdmin) setTab('checkout');
  }, [isAdmin]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-xl md:text-2xl font-bold text-gray-900">Einstellungen</h1>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === key ? 'bg-white text-abat-blau shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      <div className="max-w-2xl">
        {tab === 'checkout' && isAdmin && <AutoCheckoutTab />}
        {tab === 'password' && <PasswordTab />}
        {tab === 'users' && isAdmin && <UsersTab />}
      </div>
    </div>
  );
}
