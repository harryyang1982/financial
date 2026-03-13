'use client';

import { formatKRW, formatPercent } from '@/lib/utils';

interface SummaryCardProps {
  title: string;
  value: number;
  icon: string;
  change?: number;
  color: string;
  formatter?: (amount: number) => string;
}

export default function SummaryCard({ title, value, icon, change, color, formatter }: SummaryCardProps) {
  const fmt = formatter || formatKRW;
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <span className="text-gray-400 text-sm">{title}</span>
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="text-2xl font-bold text-white">{fmt(value)}</p>
      {change !== undefined && (
        <p className={`text-sm mt-1 ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {formatPercent(change)}
        </p>
      )}
      <div className={`h-1 rounded-full mt-3`} style={{ backgroundColor: color, opacity: 0.6 }} />
    </div>
  );
}
