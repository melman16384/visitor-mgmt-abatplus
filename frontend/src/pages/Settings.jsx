import React, { useState, useEffect } from 'react';
import { Settings2, Users, Key, Plus, Trash2, Pencil, X, Eye, EyeOff, DatabaseZap, UserCheck, ShieldCheck, ShieldAlert, ShieldQuestion, Cloud, Copy, Check, ClipboardList, ArrowUp, ArrowDown, RefreshCw, ListChecks } from 'lucide-react';
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

function Toggle({ value, onChange }) {
  return (
    <div
      onClick={() => onChange(v => !v)}
      role="switch"
      aria-checked={value}
      tabIndex={0}
      onKeyDown={e => (e.key === ' ' || e.key === 'Enter') && onChange(v => !v)}
      className={`relative flex-shrink-0 w-12 h-6 rounded-full cursor-pointer transition-colors duration-200 ease-in-out ${value ? 'bg-abat-blau' : 'bg-gray-300'}`}
    >
      <span className={`absolute top-0.5 left-0 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ease-in-out ${value ? 'translate-x-6' : 'translate-x-0.5'}`} />
    </div>
  );
}

// ---- Auto-Checkout Tab ----
function AutoCheckoutTab() {
  const [enabled, setEnabled] = useState(true);
  const [time, setTime] = useState('20:00');
  const [notifyHost, setNotifyHost] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/settings').then(r => {
      const s = r.data;
      setEnabled(s.auto_checkout_enabled !== '0' && s.auto_checkout_enabled !== false);
      setTime(s.auto_checkout_time || '20:00');
      setNotifyHost(s.notify_host_on_arrival !== 'false' && s.notify_host_on_arrival !== '0');
    }).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/settings', {
        auto_checkout_enabled: enabled ? 'true' : 'false',
        auto_checkout_time: time,
        notify_host_on_arrival: notifyHost ? 'true' : 'false',
      });
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
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-gray-700">Auto-Checkout aktiviert</p>
            <p className="text-xs text-gray-400 mt-0.5">Alle aktiven Besucher werden zur konfigurierten Uhrzeit automatisch ausgecheckt</p>
          </div>
          <Toggle value={enabled} onChange={setEnabled} />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Checkout-Zeit</label>
          <input type="time" value={time} onChange={e => setTime(e.target.value)} className={inp} disabled={!enabled} />
        </div>
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 space-y-4">
        <h3 className="font-semibold text-gray-800">Gastgeber-Benachrichtigung</h3>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-gray-700">Gastgeber bei Ankunft per Mail benachrichtigen</p>
            <p className="text-xs text-gray-400 mt-0.5">Setzt eine funktionierende Verzeichnis-Anbindung voraus (siehe Tab „Gastgeber")</p>
          </div>
          <Toggle value={notifyHost} onChange={setNotifyHost} />
        </div>
      </div>

      <button onClick={save} disabled={saving} className="w-full py-2.5 bg-abat-blau text-white rounded-xl text-sm font-semibold disabled:opacity-50">
        {saving ? 'Speichern…' : 'Einstellungen speichern'}
      </button>
    </div>
  );
}

// ---- Gastgeber-Tab (AD-Gegencheck) ----
function AdStatusBadge({ result }) {
  if (!result) return <span className="text-xs text-gray-300">–</span>;
  if (result.error) return <span className="inline-flex items-center gap-1 text-xs text-gray-400"><ShieldQuestion size={13} />Fehler</span>;
  const map = {
    ok: { icon: ShieldCheck, cls: 'text-green-600', label: 'OK' },
    not_found: { icon: ShieldAlert, cls: 'text-red-500', label: 'Nicht im AD gefunden' },
    disabled: { icon: ShieldAlert, cls: 'text-amber-500', label: 'Im AD deaktiviert' },
    name_mismatch: { icon: ShieldAlert, cls: 'text-amber-500', label: `Name weicht ab (${result.adName})` },
    no_email: { icon: ShieldQuestion, cls: 'text-gray-400', label: 'Keine E-Mail hinterlegt' },
  };
  const m = map[result.status] || { icon: ShieldQuestion, cls: 'text-gray-400', label: result.status };
  const Icon = m.icon;
  return <span className={`inline-flex items-center gap-1 text-xs font-medium ${m.cls}`}><Icon size={13} />{m.label}</span>;
}

function HostsTab() {
  const [hosts, setHosts] = useState([]);
  const [results, setResults] = useState({});
  const [checking, setChecking] = useState({});
  const [notConfigured, setNotConfigured] = useState(false);

  const load = () => api.get('/hosts').then(r => setHosts(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const check = async (id) => {
    setChecking(c => ({ ...c, [id]: true }));
    try {
      const res = await api.get(`/hosts/${id}/ad-check`);
      setResults(r => ({ ...r, [id]: res.data }));
      setNotConfigured(false);
    } catch (err) {
      if (err.response?.status === 503) setNotConfigured(true);
      setResults(r => ({ ...r, [id]: { error: true } }));
    } finally {
      setChecking(c => ({ ...c, [id]: false }));
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-400">Gastgeber werden automatisch aus dem Verzeichnis angelegt (Microsoft-Login oder AD-Autocomplete beim Einchecken). Hier lässt sich je Eintrag gegen das Verzeichnis gegenprüfen.</p>
      {notConfigured && (
        <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">Verzeichnis-Zugriff nicht konfiguriert — siehe Tab „Microsoft SSO".</p>
      )}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">E-Mail</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">AD-Status</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Aktion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {hosts.length === 0 ? (
              <tr><td colSpan={4} className="py-10 text-center text-gray-400">Noch keine Gastgeber</td></tr>
            ) : hosts.map(h => (
              <tr key={h.id} className="hover:bg-gray-50/50">
                <td className="px-4 py-3 font-medium text-gray-800">{h.name}</td>
                <td className="px-4 py-3 text-gray-600">{h.email || '–'}</td>
                <td className="px-4 py-3"><AdStatusBadge result={results[h.id]} /></td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => check(h.id)}
                    disabled={checking[h.id]}
                    className="px-3 py-1.5 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-xs font-medium disabled:opacity-50"
                  >
                    {checking[h.id] ? 'Prüfe…' : 'Prüfen'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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

// ---- Besuchszwecke Tab ----
function PurposesTab() {
  const [purposes, setPurposes] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => api.get('/visit-purposes').then(r => setPurposes(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editItem) {
        await api.put(`/visit-purposes/${editItem.id}`, { name });
        showToast('Besuchszweck aktualisiert');
      } else {
        await api.post('/visit-purposes', { name });
        showToast('Besuchszweck gespeichert');
      }
      setShowForm(false);
      setEditItem(null);
      setName('');
      load();
    } catch (err) {
      showToast(err.response?.data?.error || 'Fehler', 'error');
    } finally {
      setSaving(false);
    }
  };

  const del = async (id) => {
    if (!confirm('Besuchszweck deaktivieren?')) return;
    try { await api.delete(`/visit-purposes/${id}`); load(); showToast('Deaktiviert'); }
    catch { showToast('Fehler', 'error'); }
  };

  const move = async (index, dir) => {
    const next = [...purposes];
    const swapIndex = index + dir;
    if (swapIndex < 0 || swapIndex >= next.length) return;
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    setPurposes(next);
    try {
      await api.put('/visit-purposes/reorder', {
        order: next.map((p, i) => ({ id: p.id, sort_order: i })),
      });
    } catch {
      showToast('Fehler beim Sortieren', 'error');
      load();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => { setName(''); setEditItem(null); setShowForm(true); }}
          className="flex items-center gap-2 bg-abat-blau text-white px-4 py-2 rounded-xl text-sm font-semibold">
          <Plus size={16} /> Besuchszweck hinzufügen
        </button>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {purposes.length === 0 ? (
          <p className="py-10 text-center text-gray-400 text-sm">Noch keine Besuchszwecke angelegt</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {purposes.map((p, i) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50/50">
                <span className="font-medium text-gray-800 text-sm">{p.name}</span>
                <div className="flex gap-1">
                  <button onClick={() => move(i, -1)} disabled={i === 0} className="p-1.5 text-gray-400 hover:text-abat-blau hover:bg-abat-blau/10 rounded-lg disabled:opacity-30"><ArrowUp size={14} /></button>
                  <button onClick={() => move(i, 1)} disabled={i === purposes.length - 1} className="p-1.5 text-gray-400 hover:text-abat-blau hover:bg-abat-blau/10 rounded-lg disabled:opacity-30"><ArrowDown size={14} /></button>
                  <button onClick={() => { setName(p.name); setEditItem(p); setShowForm(true); }} className="p-1.5 text-gray-400 hover:text-abat-blau hover:bg-abat-blau/10 rounded-lg"><Pencil size={14} /></button>
                  <button onClick={() => del(p.id)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <Modal title={editItem ? 'Besuchszweck bearbeiten' : 'Besuchszweck hinzufügen'} onClose={() => setShowForm(false)}>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Bezeichnung *</label>
              <input value={name} onChange={e => setName(e.target.value)} required className={inp} placeholder="z.B. Besprechung" autoFocus />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm">Abbrechen</button>
              <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-abat-blau text-white rounded-xl text-sm font-semibold disabled:opacity-50">
                {saving ? 'Speichern…' : (editItem ? 'Speichern' : 'Erstellen')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ---- Datenschutz Tab (Aufbewahrung + Datenschutztext) ----
function DataRetentionTab() {
  const [days, setDays] = useState('365');
  const [custom, setCustom] = useState(false);
  const [privacyEnabled, setPrivacyEnabled] = useState(true);
  const [privacyText, setPrivacyText] = useState('');
  const [saving, setSaving] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  useEffect(() => {
    api.get('/settings').then(r => {
      const val = r.data.data_retention_days || '365';
      const presets = ['30', '60', '90', '180', '365', '0'];
      if (presets.includes(val)) {
        setDays(val);
        setCustom(false);
      } else {
        setDays(val);
        setCustom(true);
      }
      setPrivacyEnabled(r.data.privacy_policy_enabled !== 'false' && r.data.privacy_policy_enabled !== '0');
      setPrivacyText(r.data.privacy_policy_text || '');
    }).catch(() => {});
  }, []);

  const save = async () => {
    const val = parseInt(days, 10);
    if (isNaN(val) || val < 0) { showToast('Ungültiger Wert', 'error'); return; }
    setSaving(true);
    try {
      await api.put('/settings', {
        data_retention_days: String(val),
        privacy_policy_enabled: privacyEnabled ? 'true' : 'false',
        privacy_policy_text: privacyText.trim(),
      });
      showToast('Einstellungen gespeichert');
    } catch {
      showToast('Fehler beim Speichern', 'error');
    } finally {
      setSaving(false);
    }
  };

  const cleanup = async () => {
    if (!confirm('Datenschutz-Bereinigung jetzt ausführen? Abgelaufene Besuchsdaten werden dauerhaft gelöscht.')) return;
    setCleaning(true);
    try {
      const res = await api.post('/settings/gdpr/cleanup');
      const { visits = 0, visitors = 0, prereg = 0 } = res.data || {};
      showToast(`Bereinigung abgeschlossen: ${visits} Besuche, ${visitors} Besucher, ${prereg} Vorregistrierungen gelöscht`);
    } catch {
      showToast('Bereinigung fehlgeschlagen', 'error');
    } finally {
      setCleaning(false);
    }
  };

  const presets = [
    { label: '30 Tage', value: '30' },
    { label: '60 Tage', value: '60' },
    { label: '90 Tage', value: '90' },
    { label: '180 Tage', value: '180' },
    { label: '1 Jahr', value: '365' },
    { label: 'Benutzerdefiniert', value: 'custom' },
    { label: 'Deaktiviert', value: '0' },
  ];

  const handlePreset = (val) => {
    if (val === 'custom') { setCustom(true); return; }
    setCustom(false);
    setDays(val);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 space-y-5">
        <div>
          <h3 className="font-semibold text-gray-800">Datenspeicherung</h3>
          <p className="text-xs text-gray-400 mt-1">Abgeschlossene Besuche und Vorregistrierungen werden nach Ablauf der Frist automatisch gelöscht. Aktive Besuche und ausstehende Vorregistrierungen bleiben immer erhalten.</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Aufbewahrungsdauer</label>
          <div className="flex flex-wrap gap-2">
            {presets.map(p => (
              <button
                key={p.value}
                onClick={() => handlePreset(p.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors duration-150 ease-in-out ${
                  (p.value === 'custom' ? custom : !custom && days === p.value)
                    ? 'bg-abat-blau text-white border-abat-blau'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-abat-blau hover:text-abat-blau'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {custom && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Anzahl Tage</label>
            <input
              type="number"
              min="1"
              value={days}
              onChange={e => setDays(e.target.value)}
              className={inp}
              placeholder="z.B. 730"
            />
          </div>
        )}

        {days === '0' && !custom && (
          <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">Datenlöschung deaktiviert — Besuchsdaten werden unbegrenzt gespeichert.</p>
        )}

        <div className="flex justify-end">
          <button onClick={cleanup} disabled={cleaning} className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl text-xs font-semibold disabled:opacity-50">
            {cleaning ? 'Bereinige…' : 'Jetzt bereinigen'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 space-y-4">
        <div>
          <h3 className="font-semibold text-gray-800">Datenschutzerklärung am Kiosk</h3>
          <p className="text-xs text-gray-400 mt-1">Steuert den Hinweistext im Check-in-Formular. Bleibt das Feld leer, wird der Standard-Link zur Datenschutzerklärung angezeigt.</p>
        </div>
        <div className="flex items-center justify-between gap-4">
          <p className="font-medium text-gray-700">Eigenen Datenschutztext anzeigen</p>
          <Toggle value={privacyEnabled} onChange={setPrivacyEnabled} />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Datenschutztext</label>
          <textarea value={privacyText} onChange={e => setPrivacyText(e.target.value)} rows={4} className={`${inp} resize-none`}
            placeholder="Der Besucher wurde auf die Datenschutzerklärung hingewiesen…" disabled={!privacyEnabled} />
        </div>
      </div>

      <button onClick={save} disabled={saving} className="w-full py-2.5 bg-abat-blau text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors duration-150">
        {saving ? 'Speichern…' : 'Einstellungen speichern'}
      </button>
    </div>
  );
}

// ---- Microsoft SSO Tab ----
// ---- Zugriffsliste: einzelne per SSO zum Login berechtigte Benutzer ----
function SsoAllowedUsersSection() {
  const [items, setItems] = useState([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user');
  const [saving, setSaving] = useState(false);

  const load = () => api.get('/settings/sso-allowed-users').then(r => setItems(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSaving(true);
    try {
      await api.post('/settings/sso-allowed-users', { email: email.trim(), role });
      setEmail('');
      setRole('user');
      load();
    } catch (err) {
      showToast(err.response?.data?.error || 'Fehler', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (e) => {
    if (!confirm(`${e} von der Zugriffsliste entfernen?`)) return;
    try { await api.delete(`/settings/sso-allowed-users/${encodeURIComponent(e)}`); load(); }
    catch { showToast('Fehler', 'error'); }
  };

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 space-y-4">
      <div>
        <h3 className="font-semibold text-gray-800 flex items-center gap-2"><ListChecks size={16} /> Zugriffsliste</h3>
        <p className="text-xs text-gray-400 mt-1">Nur hier gelistete E-Mail-Adressen dürfen sich per Microsoft SSO anmelden. Die Rolle wird bei jedem Login synchronisiert.</p>
      </div>

      <form onSubmit={add} className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-semibold text-gray-700 mb-1">E-Mail</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className={inp} placeholder="name@firma.de" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Rolle</label>
          <select value={role} onChange={e => setRole(e.target.value)} className={`${inp} bg-white`}>
            <option value="user">Benutzer</option>
            <option value="admin">Administrator</option>
          </select>
        </div>
        <button type="submit" disabled={saving} className="px-4 py-2.5 bg-abat-blau text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5">
          <Plus size={14} /> Hinzufügen
        </button>
      </form>

      <div className="divide-y divide-gray-50 border border-gray-100 rounded-xl overflow-hidden">
        {items.length === 0 ? (
          <p className="py-6 text-center text-gray-400 text-sm">Noch keine Benutzer in der Zugriffsliste</p>
        ) : items.map(it => (
          <div key={it.email} className="flex items-center justify-between px-4 py-2.5">
            <div>
              <p className="text-sm font-medium text-gray-800">{it.email}</p>
              <span className={`text-xs font-semibold ${it.role === 'admin' ? 'text-abat-blau' : 'text-gray-400'}`}>{it.role === 'admin' ? 'Administrator' : 'Benutzer'}</span>
            </div>
            <button onClick={() => remove(it.email)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SsoTab() {
  const [form, setForm] = useState({ tenantId: '', clientId: '', clientSecret: '', notifyFromEmail: '' });
  const [secretSet, setSecretSet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const redirectUri = `${window.location.origin}/api/auth/microsoft/callback`;

  const load = () => api.get('/settings').then(r => {
    const s = r.data;
    setForm({
      tenantId: s.sso_tenant_id || '',
      clientId: s.sso_client_id || '',
      clientSecret: '',
      notifyFromEmail: s.notify_from_email || '',
    });
    setSecretSet(!!s.sso_client_secret_set);
  }).catch(() => {});
  useEffect(() => { load(); }, []);

  const configured = secretSet && !!form.tenantId && !!form.clientId;

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/settings', {
        sso_tenant_id: form.tenantId.trim(),
        sso_client_id: form.clientId.trim(),
        sso_client_secret: form.clientSecret,
        notify_from_email: form.notifyFromEmail.trim(),
      });
      showToast('SSO-Einstellungen gespeichert');
      load();
    } catch (err) {
      showToast(err.response?.data?.error || 'Fehler beim Speichern', 'error');
    } finally {
      setSaving(false);
    }
  };

  const copyRedirect = () => {
    navigator.clipboard.writeText(redirectUri);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Microsoft SSO</h3>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${configured ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${configured ? 'bg-green-500' : 'bg-gray-400'}`} />
            {configured ? 'Konfiguriert' : 'Nicht konfiguriert'}
          </span>
        </div>
        <p className="text-xs text-gray-400">
          Eine einzige Azure-App-Registrierung deckt sowohl den Mitarbeiter-Login als auch die Verzeichnis-Anbindung (Gastgeber-Autocomplete, AD-Gegencheck, Ankunfts-Mails) ab.
        </p>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Tenant-ID</label>
          <input value={form.tenantId} onChange={e => setForm(f => ({ ...f, tenantId: e.target.value }))} className={inp} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Client-ID</label>
          <input value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))} className={inp} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Client Secret</label>
          <input
            type="password"
            value={form.clientSecret}
            onChange={e => setForm(f => ({ ...f, clientSecret: e.target.value }))}
            className={inp}
            placeholder={secretSet ? '•••••••• (gesetzt — leer lassen für unverändert)' : 'Client Secret eingeben'}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Absender-Postfach für Gastgeber-Mails</label>
          <input type="email" value={form.notifyFromEmail} onChange={e => setForm(f => ({ ...f, notifyFromEmail: e.target.value }))} className={inp} placeholder="besucher@firma.de" />
        </div>

        <button onClick={save} disabled={saving} className="w-full py-2.5 bg-abat-blau text-white rounded-xl text-sm font-semibold disabled:opacity-50">
          {saving ? 'Speichern…' : 'Einstellungen speichern'}
        </button>
      </div>

      <SsoAllowedUsersSection />

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
        <h4 className="text-sm font-semibold text-blue-900">Azure-Einrichtung</h4>
        <div>
          <p className="text-xs text-blue-700 mb-1">Umleitungs-URI (Redirect URI, Typ „Web"):</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-white border border-blue-200 rounded-lg px-2.5 py-1.5 text-blue-900 break-all">{redirectUri}</code>
            <button onClick={copyRedirect} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg flex-shrink-0">
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
        </div>
        <div className="text-xs text-blue-700 space-y-1">
          <p><span className="font-semibold">Delegierte Berechtigungen</span> (Login): <code>openid</code>, <code>profile</code>, <code>email</code>, <code>User.Read</code></p>
          <p><span className="font-semibold">Anwendungsberechtigungen</span> (Verzeichnis, Admin-Zustimmung erforderlich): <code>User.Read.All</code>, <code>Mail.Send</code></p>
        </div>
      </div>
    </div>
  );
}

// ---- Gastgeber-Sync Tab (geplanter Entra-ID-Sync) ----
function EntraSyncTab() {
  const [enabled, setEnabled] = useState(false);
  const [filter, setFilter] = useState('');
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const load = () => {
    api.get('/entra-sync/config').then(r => {
      setEnabled(r.data.enabled);
      setFilter(r.data.filter || '');
    }).catch(() => {});
    api.get('/entra-sync/status').then(r => setStatus(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/entra-sync/config', { enabled, filter: filter.trim() });
      showToast('Sync-Einstellungen gespeichert');
    } catch (err) {
      showToast(err.response?.data?.error || 'Fehler', 'error');
    } finally {
      setSaving(false);
    }
  };

  const syncNow = async () => {
    setSyncing(true);
    try {
      const res = await api.post('/entra-sync/sync');
      const { created = 0, updated = 0, deactivated = 0 } = res.data || {};
      showToast(`Sync abgeschlossen: ${created} neu, ${updated} aktualisiert, ${deactivated} deaktiviert`);
      load();
    } catch (err) {
      showToast(err.response?.data?.error || 'Sync fehlgeschlagen', 'error');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 space-y-4">
        <div>
          <h3 className="font-semibold text-gray-800">Gastgeber-Sync</h3>
          <p className="text-xs text-gray-400 mt-1">Zieht täglich alle Benutzer aus dem Microsoft-Verzeichnis als Gastgeber. Nutzt dieselbe App-Registrierung wie die Microsoft SSO (Tab „Microsoft SSO"). Entfernte Benutzer werden als Gastgeber deaktiviert, nicht gelöscht.</p>
        </div>
        <div className="flex items-center justify-between gap-4">
          <p className="font-medium text-gray-700">Geplanten Sync aktivieren</p>
          <Toggle value={enabled} onChange={setEnabled} />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Graph-Filter (optional)</label>
          <input value={filter} onChange={e => setFilter(e.target.value)} className={inp} placeholder="z.B. accountEnabled eq true" />
          <p className="text-xs text-gray-400 mt-1">OData-$filter für Microsoft Graph /users. Leer = alle Benutzer des Mandanten.</p>
        </div>
        <button onClick={save} disabled={saving} className="w-full py-2.5 bg-abat-blau text-white rounded-xl text-sm font-semibold disabled:opacity-50">
          {saving ? 'Speichern…' : 'Einstellungen speichern'}
        </button>
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Status</h3>
          <button onClick={syncNow} disabled={syncing} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-xs font-medium disabled:opacity-50">
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Synchronisiere…' : 'Jetzt synchronisieren'}
          </button>
        </div>
        {status?.lastSyncAt ? (
          <div className="text-sm text-gray-600 space-y-1">
            <p>Letzter Sync: <span className="font-medium text-gray-800">{new Date(status.lastSyncAt).toLocaleString('de-DE')}</span></p>
            {status.lastResult && (
              <p className="text-xs text-gray-400">{status.lastResult.created} neu · {status.lastResult.updated} aktualisiert · {status.lastResult.deactivated} deaktiviert</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Noch kein Sync ausgeführt</p>
        )}
      </div>
    </div>
  );
}

// ---- Main Settings ----
const SETTINGS_GROUPS = [
  {
    key: 'operations', label: 'Betrieb',
    tabs: [
      { key: 'checkout', label: 'Auto-Checkout', icon: Settings2, adminOnly: true },
      { key: 'purposes', label: 'Besuchszwecke', icon: ClipboardList, adminOnly: true },
    ],
  },
  {
    key: 'access', label: 'Zugriff & Benutzer',
    tabs: [
      { key: 'users', label: 'Benutzer', icon: Users, adminOnly: true },
      { key: 'hosts', label: 'Gastgeber', icon: UserCheck, adminOnly: true },
      { key: 'entraSync', label: 'Gastgeber-Sync', icon: RefreshCw, adminOnly: true },
      { key: 'sso', label: 'Microsoft SSO', icon: Cloud, adminOnly: true },
    ],
  },
  {
    key: 'system', label: 'System',
    tabs: [
      { key: 'retention', label: 'Datenschutz', icon: DatabaseZap, adminOnly: true },
    ],
  },
  {
    key: 'account', label: 'Konto',
    tabs: [
      { key: 'password', label: 'Passwort', icon: Key, adminOnly: false },
    ],
  },
];

const TAB_CONTENT = {
  checkout: AutoCheckoutTab,
  purposes: PurposesTab,
  retention: DataRetentionTab,
  password: PasswordTab,
  users: UsersTab,
  hosts: HostsTab,
  entraSync: EntraSyncTab,
  sso: SsoTab,
};

export default function Settings() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const visibleGroups = SETTINGS_GROUPS
    .map(g => ({ ...g, tabs: g.tabs.filter(t => !t.adminOnly || isAdmin) }))
    .filter(g => g.tabs.length > 0);

  const [tab, setTab] = useState(isAdmin ? 'checkout' : 'password');

  useEffect(() => {
    setTab(isAdmin ? 'checkout' : 'password');
  }, [isAdmin]);

  const ActiveContent = TAB_CONTENT[tab] || PasswordTab;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-xl md:text-2xl font-bold text-gray-900">Einstellungen</h1>

      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* Gruppierte Navigation */}
        <nav className="w-full md:w-56 flex-shrink-0 space-y-5">
          {visibleGroups.map(group => (
            <div key={group.key}>
              <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{group.label}</p>
              <div className="space-y-0.5">
                {group.tabs.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left
                      ${tab === key ? 'bg-abat-blau/10 text-abat-blau' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
                  >
                    <Icon size={16} className="flex-shrink-0" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Tab-Inhalt */}
        <div className="flex-1 min-w-0 max-w-2xl">
          <ActiveContent />
        </div>
      </div>
    </div>
  );
}
