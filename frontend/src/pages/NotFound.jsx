import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-6">
          <AlertTriangle size={36} className="text-red-500" />
        </div>
        <h1 className="text-6xl font-bold text-gray-200 mb-2">404</h1>
        <h2 className="text-xl font-semibold text-gray-800 mb-3">Seite nicht gefunden</h2>
        <p className="text-gray-500 text-sm mb-8">
          Die aufgerufene Seite existiert nicht oder wurde verschoben.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft size={16} /> Zurück
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-abat-blau rounded-xl hover:bg-primary-600 transition-colors"
          >
            Zur Startseite
          </button>
        </div>
        <p className="mt-10 text-xs text-gray-400">abat AG Besucherverwaltung</p>
      </div>
    </div>
  );
}
