import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

const colorMap = {
  blue: { bg: 'bg-blue-50', icon: 'text-blue-600', border: 'border-blue-100' },
  green: { bg: 'bg-green-50', icon: 'text-green-600', border: 'border-green-100' },
  yellow: { bg: 'bg-yellow-50', icon: 'text-yellow-600', border: 'border-yellow-100' },
  purple: { bg: 'bg-purple-50', icon: 'text-purple-600', border: 'border-purple-100' },
  red: { bg: 'bg-red-50', icon: 'text-red-600', border: 'border-red-100' },
};

export default function StatCard({ title, value, icon: Icon, trend, color = 'blue', subtitle }) {
  const c = colorMap[color] || colorMap.blue;
  return (
    <div className={`bg-white rounded-xl border ${c.border} p-6 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow`}>
      <div className={`${c.bg} p-3 rounded-xl flex-shrink-0`}>
        <Icon className={`${c.icon}`} size={22} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-500 font-medium truncate">{title}</p>
        <p className="text-3xl font-bold text-gray-900 mt-1">{value ?? '–'}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        {trend !== undefined && (
          <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            <span>{trend >= 0 ? '+' : ''}{trend}% vs. letzte Woche</span>
          </div>
        )}
      </div>
    </div>
  );
}
