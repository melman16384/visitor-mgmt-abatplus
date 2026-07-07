import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import api from '../api/client';

// Sucht Gastgeber live im Active Directory (ab 3 Zeichen). Beim Auswählen wird
// {name, email, ad_object_id} an onSelect übergeben — der Host wird serverseitig
// beim Absenden des Formulars per E-Mail angelegt/gefunden. Mit allowManual=true
// kann alternativ ein Gastgeber ohne AD-Treffer frei eingegeben werden (kein E-Mail-Abgleich).
export default function HostAutocomplete({ value, onSelect, placeholder = 'Name oder E-Mail…', allowManual = false }) {
  const [manualMode, setManualMode] = useState(false);
  const [query, setQuery] = useState(value?.name || '');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);
  const timer = useRef(null);
  const wrapperRef = useRef(null);

  if (manualMode) {
    return (
      <div>
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); onSelect(e.target.value.trim() ? { name: e.target.value, email: null, ad_object_id: null } : null); }}
          placeholder="Name des Gastgebers…"
          className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-abat-blau focus:ring-1 focus:ring-abat-blau bg-white"
        />
        <button
          type="button"
          onClick={() => { setManualMode(false); setQuery(''); onSelect(null); }}
          className="mt-1.5 text-xs text-abat-blau hover:underline"
        >
          Zurück zur Verzeichnis-Suche
        </button>
      </div>
    );
  }

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(() => {
      setLoading(true);
      api.get(`/hosts/search-ad?q=${encodeURIComponent(query.trim())}`)
        .then(r => { setResults(r.data); setNotConfigured(false); })
        .catch(err => {
          setResults([]);
          if (err.response?.status === 503) setNotConfigured(true);
        })
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer.current);
  }, [query]);

  const handleSelect = (user) => {
    setQuery(user.name);
    setOpen(false);
    onSelect({ name: user.name, email: user.email, ad_object_id: user.id });
  };

  const handleClear = () => {
    setQuery('');
    onSelect(null);
  };

  const inp = 'w-full pl-9 pr-8 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-abat-blau focus:ring-1 focus:ring-abat-blau bg-white';

  return (
    <div className="relative" ref={wrapperRef}>
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); onSelect(null); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={inp}
        autoComplete="off"
      />
      {query && (
        <button type="button" onClick={handleClear} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
          <X size={15} />
        </button>
      )}

      {open && query.trim().length >= 3 && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
          {loading && <div className="px-3 py-2.5 text-xs text-gray-400">Suche…</div>}
          {!loading && notConfigured && (
            <div className="px-3 py-2.5 text-xs text-amber-600">Verzeichnis-Suche nicht konfiguriert</div>
          )}
          {!loading && !notConfigured && results.length === 0 && (
            <div className="px-3 py-2.5 text-xs text-gray-400">Keine Treffer</div>
          )}
          {!loading && results.map(u => (
            <button
              key={u.id}
              type="button"
              onClick={() => handleSelect(u)}
              className="w-full text-left px-3 py-2.5 hover:bg-gray-50 text-sm border-b border-gray-50 last:border-0"
            >
              <p className="font-medium text-gray-800">{u.name}</p>
              <p className="text-xs text-gray-400">{u.email}</p>
            </button>
          ))}
        </div>
      )}

      {allowManual && (
        <button
          type="button"
          onClick={() => { setManualMode(true); setQuery(''); setOpen(false); onSelect(null); }}
          className="mt-1.5 text-xs text-gray-500 hover:text-abat-blau hover:underline"
        >
          Gastgeber nicht im Verzeichnis? Manuell eingeben
        </button>
      )}
    </div>
  );
}
