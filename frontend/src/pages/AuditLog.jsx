import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, FileText, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import client from '../api/client';
import { showToast } from '../components/Layout';

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function formatDateDE(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

export default function AuditLog() {
  const { t } = useTranslation();
  const [availableDates, setAvailableDates] = useState([]);
  const [loadingDates, setLoadingDates] = useState(true);
  const [showAllDates, setShowAllDates] = useState(false);
  const [complianceFrom, setComplianceFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [complianceTo, setComplianceTo] = useState(todayStr());
  const [downloadingReport, setDownloadingReport] = useState(false);

  useEffect(() => {
    client.get('/audit-log/available-dates')
      .then(r => setAvailableDates(r.data))
      .catch(() => showToast(t('auditLog.loadError'), 'error'))
      .finally(() => setLoadingDates(false));
  }, []);

  const handleDownloadDay = async (date) => {
    try {
      const res = await client.get('/audit-log/download', {
        params: { date },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-${date}.log`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast(t('auditLog.notAvailable'), 'error');
    }
  };

  const handleComplianceReport = async () => {
    if (!complianceFrom || !complianceTo) return;
    setDownloadingReport(true);
    try {
      const res = await client.get('/audit-log/compliance-report', {
        params: { from: complianceFrom, to: complianceTo },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance-bericht-${complianceFrom}-${complianceTo}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(t('auditLog.downloaded'));
    } catch {
      showToast(t('auditLog.reportError'), 'error');
    } finally {
      setDownloadingReport(false);
    }
  };

  const visibleDates = showAllDates ? availableDates : availableDates.slice(0, 10);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('auditLog.title')}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{t('auditLog.subtitle')}</p>
      </div>

      {/* Tagesprotokoll */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Calendar size={18} className="text-gray-500" />
          <h2 className="font-semibold text-gray-800">{t('auditLog.dailyLogs')}</h2>
          {!loadingDates && (
            <span className="ml-auto text-xs text-gray-400">{availableDates.length} {t('auditLog.available')}</span>
          )}
        </div>

        {loadingDates ? (
          <div className="py-12 flex justify-center">
            <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          </div>
        ) : availableDates.length === 0 ? (
          <p className="px-6 py-10 text-center text-gray-400 text-sm">{t('auditLog.noLogs')}</p>
        ) : (
          <>
            <ul className="divide-y divide-gray-50">
              {visibleDates.map(date => (
                <li key={date} className="flex items-center justify-between px-6 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <FileText size={15} className="text-gray-400" />
                    <span className="text-sm font-medium text-gray-700">{formatDateDE(date)}</span>
                    <span className="text-xs text-gray-400 font-mono">audit-{date}.log</span>
                    {date === todayStr() && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">{t('auditLog.todayLabel')}</span>
                    )}
                  </div>
                  <button
                    onClick={() => handleDownloadDay(date)}
                    className="flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-800 hover:bg-primary-50 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Download size={13} /> {t('auditLog.download')}
                  </button>
                </li>
              ))}
            </ul>

            {availableDates.length > 10 && (
              <div className="px-6 py-3 border-t border-gray-100">
                <button
                  onClick={() => setShowAllDates(s => !s)}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {showAllDates ? (
                    <><ChevronUp size={15} /> {t('auditLog.showLess')}</>
                  ) : (
                    <><ChevronDown size={15} /> {t('auditLog.showAll', { count: availableDates.length })}</>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Compliance-Bericht */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <FileText size={18} className="text-gray-500" />
          <h2 className="font-semibold text-gray-800">{t('auditLog.complianceTitle')}</h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-500">{t('auditLog.complianceDesc')}</p>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('auditLog.from')}</label>
              <input
                type="date"
                value={complianceFrom}
                max={complianceTo}
                onChange={e => setComplianceFrom(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('auditLog.to')}</label>
              <input
                type="date"
                value={complianceTo}
                min={complianceFrom}
                max={todayStr()}
                onChange={e => setComplianceTo(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <button
              onClick={handleComplianceReport}
              disabled={downloadingReport || !complianceFrom || !complianceTo}
              className="flex items-center gap-2 bg-abat-dunkelgrau hover:bg-gray-700 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-xl text-sm transition-colors shadow-sm"
            >
              {downloadingReport ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {t('auditLog.generating')}</>
              ) : (
                <><Download size={15} /> {t('auditLog.downloadReport')}</>
              )}
            </button>
          </div>
          <p className="text-xs text-gray-400">
            {t('auditLog.format')}
          </p>
        </div>
      </div>
    </div>
  );
}
