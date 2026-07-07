import React, { useState } from 'react';
import Modal from './Modal';

// Zweistufige Bestätigung für heikle Aktionen (z.B. Auschecken) — nutzt den
// gemeinsamen Modal-Wrapper statt einer eigenen Kopie je Seite.
export default function ConfirmDialog({ title, message, confirmLabel = 'Bestätigen', danger = false, onConfirm, onClose }) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={title} onClose={onClose} size="sm">
      <div className="space-y-5">
        <p className="text-sm text-gray-600">{message}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-abat-blau hover:bg-primary-600'}`}
          >
            {loading ? 'Bitte warten…' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
