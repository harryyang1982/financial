'use client';

import { usePortfolio } from '@/lib/usePortfolio';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import RefreshButton from '@/components/RefreshButton';
import { formatKRW, formatPercent, filterByCategory } from '@/lib/utils';

export default function RealEstatePage() {
  const { data, loading, refresh } = usePortfolio();

  if (loading) return <LoadingSkeleton />;

  const properties = filterByCategory(data.assets, '부동산');

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">🏠 부동산</h1>
          <p className="text-gray-400 text-sm mt-1">보유 부동산 상세 현황</p>
        </div>
        <RefreshButton onClick={refresh} loading={loading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {properties.map((p) => {
          const isPositive = p.profitRate >= 0;
          return (
            <div key={p.name} className="bg-gray-800 rounded-xl border border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold text-lg">{p.name}</h3>
                <span className={`text-sm font-medium px-2 py-1 rounded ${isPositive ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                  {formatPercent(p.profitRate)}
                </span>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">매입가 (투자금액)</span>
                  <span className="text-gray-300">{formatKRW(p.investedAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">현재 시세</span>
                  <span className="text-white font-medium">{formatKRW(p.currentValue)}</span>
                </div>
                <div className="border-t border-gray-700 pt-3 flex justify-between">
                  <span className="text-gray-400 font-medium">평가 수익</span>
                  <span className={`font-bold text-lg ${isPositive ? 'text-green-400' : 'text-red-400'}`}>{formatKRW(p.profit)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {properties.length === 0 && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center text-gray-400">
          등록된 부동산이 없습니다
        </div>
      )}
    </div>
  );
}
