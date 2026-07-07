import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

function addMinutes(time, delta) {
  const [h, m] = time.split(':').map(Number);
  let total = (h * 60 + m + delta + 24 * 60) % (24 * 60);
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

// Uhrzeit-Eingabe, die sich per Mausrad (±1 Min, mit Shift ±5 Min) oder per
// Chevron-Buttons (±5 Min, für Touch) leicht korrigieren lässt.
export default function TimeAdjuster({ value, onChange }) {
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.shiftKey ? 5 : 1;
    onChange(addMinutes(value, e.deltaY < 0 ? delta : -delta));
  };

  return (
    <div className="flex items-center gap-1">
      <input
        type="time"
        value={value}
        onChange={e => onChange(e.target.value)}
        onWheel={handleWheel}
        className="flex-1 px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-abat-blau focus:ring-1 focus:ring-abat-blau"
      />
      <div className="flex flex-col">
        <button type="button" onClick={() => onChange(addMinutes(value, 5))} className="p-1 text-gray-400 hover:text-abat-blau">
          <ChevronUp size={16} />
        </button>
        <button type="button" onClick={() => onChange(addMinutes(value, -5))} className="p-1 text-gray-400 hover:text-abat-blau">
          <ChevronDown size={16} />
        </button>
      </div>
    </div>
  );
}
