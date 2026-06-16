import React, { useState, useEffect, useCallback } from 'react';
import { Download, Users, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO, subDays } from 'date-fns';
import { de } from 'date-fns/locale';
import client from '../api/client';
import { showToast } from '../components/Layout';

export default function Reports() {
  const defaultFrom = format(subDays(new Date(), 30), 'yyyy-MM-dd');
  const defaultTo = format(new Date(), 'yyyy-MM-dd');

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [data, setData] = useState(null);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Use daily report with range
      const [dailyRes, exportRes] = await Promise.all([
        client.get('/reports/daily', { params: { date: to } }),
        client.get('/reports/export', { params: { from, to, format: 'json' } }),
      ]);

      // Calculate stats from export data
      const allVisits = exportRes.data;

      // Group by day for chart
      const byDay = {};
      allVisits.forEach(v => {
        const day = v.checked_in_at?.split('T')[0];
        if (day) byDay[day] = (byDay[day] || 0) + 1;
      });
      const chartData = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));

      setData({ total: allVisits.length, chart: chartData });
      setVisits(allVisits.slice(0, 50));
    } catch {
      showToast('Fehler beim Laden der Berichte', 'error');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleExportCSV = () => {
    const url = `/api/reports/export?from=${from}&to=${to}&format=csv`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `besucher-export-${from}-${to}.csv`;
    const token = localStorage.getItem('token');
    // Open with auth token in new window (token in URL not ideal, but for file download)
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const objUrl = URL.createObjectURL(blob);
        a.href = objUrl;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objUrl);
      })
      .catch(() => showToast('Fehler beim Export', 'error'));
  };

  const formatDate = (d) => {
    try { return format(parseISO(d), 'dd.MM', { locale: de }); } catch { return d; }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Berichte</h1>
          <p className="text-sm text-gray-500 mt-0.5">Besuchsstatistiken und Auswertungen</p>
        </div>
        <button onClick={handleExportCSV}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm shadow-sm transition-colors">
          <Download size={18} />
          CSV exportieren
        </button>
      </div>

      {/* Date range */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Von</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Bis</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <button onClick={loadData} disabled={loading}
            className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
            {loading ? 'Laden...' : 'Auswerten'}
          </button>
        </div>
      </div>

      {/* Stats */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="bg-blue-50 p-3 rounded-xl"><Users size={20} className="text-blue-600" /></div>
              <div>
                <p className="text-xs text-gray-500">Gesamtbesuche</p>
                <p className="text-2xl font-bold text-gray-900">{data.total}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="bg-green-50 p-3 rounded-xl"><TrendingUp size={20} className="text-green-600" /></div>
              <div>
                <p className="text-xs text-gray-500">Zeitraum</p>
                <p className="text-sm font-bold text-gray-900">{format(parseISO(from), 'dd.MM.yy', { locale: de })} – {format(parseISO(to), 'dd.MM.yy', { locale: de })}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      {data?.chart?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Tägliche Besuche</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.chart} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  formatter={(v) => [v, 'Besuche']}
                  labelFormatter={(l) => `${formatDate(l)}`}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                />
                <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Visits table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Besuchsliste</h2>
          <span className="text-sm text-gray-500">{visits.length} Einträge (max. 50)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-6 py-3">Besucher</th>
                <th className="text-left px-6 py-3">Gastgeber</th>
                <th className="text-left px-6 py-3">Zweck</th>
                <th className="text-left px-6 py-3">Eingecheckt</th>
                <th className="text-left px-6 py-3">Ausgecheckt</th>
                <th className="text-left px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-16">
                  <div className="inline-block w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                </td></tr>
              ) : visits.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-16 text-gray-400">
                  Keine Besuche im gewählten Zeitraum
                </td></tr>
              ) : visits.map(v => (
                <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3">
                    <p className="font-medium text-gray-900">{v.first_name} {v.last_name}</p>
                    <p className="text-xs text-gray-400">{v.company || '–'}</p>
                  </td>
                  <td className="px-6 py-3 text-gray-600">{v.host_name || '–'}</td>
                  <td className="px-6 py-3 text-gray-600">{v.purpose || '–'}</td>
                  <td className="px-6 py-3 text-gray-500">
                    {v.checked_in_at ? format(new Date(v.checked_in_at), 'dd.MM.yy HH:mm', { locale: de }) : '–'}
                  </td>
                  <td className="px-6 py-3 text-gray-500">
                    {v.checked_out_at ? format(new Date(v.checked_out_at), 'dd.MM.yy HH:mm', { locale: de }) : '–'}
                  </td>
                  <td className="px-6 py-3">
                    {v.status === 'active'
                      ? <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">Anwesend</span>
                      : <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">Ausgecheckt</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
