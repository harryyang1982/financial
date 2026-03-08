'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { usePortfolio } from '@/lib/usePortfolio';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import RefreshButton from '@/components/RefreshButton';
import DonutChart from '@/components/charts/DonutChart';
import { calcAssetClassSummary, formatKRW, formatFullKRW, ASSET_CLASS_COLORS } from '@/lib/utils';

export default function PortfolioPage() {
  const { data, loading, refresh } = usePortfolio();

  if (loading) return <LoadingSkeleton />;

  const assetClassSummary = calcAssetClassSummary(data, true);
  const targets = data.allocationTargets;
  const subTargets = data.subAllocationTargets;

  const allocationChartData = targets.map((t) => ({
    name: `${t.country}\n${t.assetClass}`,
    label: `${t.assetClass} (${t.country})`,
    현재: t.currentWeight,
    목표: t.targetWeight,
    color: ASSET_CLASS_COLORS[t.assetClass] || '#6B7280',
  }));

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">🎯 포트폴리오 배분</h1>
          <p className="text-gray-400 text-sm mt-1">부동산 제외 투자 자산 기준 / 시트 목표 비중 기반</p>
        </div>
        <RefreshButton onClick={refresh} loading={loading} />
      </div>

      <DonutChart data={assetClassSummary} title="현재 자산대범주별 배분 (부동산 제외)" />

      {/* 현재 vs 목표 비중 차트 */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h3 className="text-white font-semibold mb-4">자산대범주별 현재 vs 목표 비중</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={allocationChartData} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" stroke="#9CA3AF" tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="label" stroke="#9CA3AF" tick={{ fontSize: 11 }} width={120} />
              <Tooltip formatter={(v) => `${v}%`} contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }} itemStyle={{ color: '#E5E7EB' }} />
              <Legend />
              <Bar dataKey="현재" fill="#3B82F6" radius={[0, 4, 4, 0]} />
              <Bar dataKey="목표" fill="#4B5563" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 대범주별 리밸런싱 가이드 */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-x-auto">
        <div className="p-5 border-b border-gray-700">
          <h3 className="text-white font-semibold">자산대범주별 리밸런싱 가이드</h3>
          <p className="text-gray-400 text-xs mt-1">양수 = 추가 매수 필요 / 음수 = 비중 초과</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400">
              <th className="text-left p-4">국가</th>
              <th className="text-left p-4">자산대범주</th>
              <th className="text-right p-4">현재 금액</th>
              <th className="text-right p-4">현재</th>
              <th className="text-right p-4">목표</th>
              <th className="text-right p-4">1.6억 목표</th>
              <th className="text-right p-4">조정</th>
              <th className="text-right p-4">1.8억 목표</th>
              <th className="text-right p-4">조정</th>
              <th className="text-center p-4">방향</th>
            </tr>
          </thead>
          <tbody>
            {targets.map((t) => {
              const diff = t.targetWeight - t.currentWeight;
              let direction: string, dirColor: string;
              if (diff > 1) { direction = '매수 ▲'; dirColor = 'text-green-400'; }
              else if (diff < -1) { direction = '축소 ▼'; dirColor = 'text-red-400'; }
              else { direction = '적정 ●'; dirColor = 'text-blue-400'; }

              return (
                <tr key={t.country + t.assetClass} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="p-4 text-gray-400">{t.country}</td>
                  <td className="p-4 text-white font-medium">{t.assetClass}</td>
                  <td className="p-4 text-right text-white">{formatKRW(t.currentValue)}</td>
                  <td className="p-4 text-right text-gray-300">{t.currentWeight.toFixed(1)}%</td>
                  <td className="p-4 text-right text-white font-medium">{t.targetWeight.toFixed(1)}%</td>
                  <td className="p-4 text-right text-gray-300">{formatKRW(t.targetAmount160)}</td>
                  <td className={`p-4 text-right font-medium ${t.gap160 > 0 ? 'text-green-400' : t.gap160 < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                    {formatFullKRW(t.gap160)}
                  </td>
                  <td className="p-4 text-right text-gray-300">{formatKRW(t.targetAmount180)}</td>
                  <td className={`p-4 text-right font-medium ${t.gap180 > 0 ? 'text-green-400' : t.gap180 < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                    {formatFullKRW(t.gap180)}
                  </td>
                  <td className={`p-4 text-center font-medium ${dirColor}`}>{direction}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 중범주별 세부 */}
      {subTargets.length > 0 && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-x-auto">
          <div className="p-5 border-b border-gray-700">
            <h3 className="text-white font-semibold">자산중범주별 세부 배분</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="text-left p-4">국가</th>
                <th className="text-left p-4">대범주</th>
                <th className="text-left p-4">중범주</th>
                <th className="text-right p-4">현재 금액</th>
                <th className="text-right p-4">현재</th>
                <th className="text-right p-4">목표</th>
                <th className="text-right p-4">1.6억 목표</th>
                <th className="text-right p-4">조정</th>
              </tr>
            </thead>
            <tbody>
              {subTargets.map((t) => (
                <tr key={t.country + t.assetClass + t.assetSubClass} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="p-4 text-gray-400">{t.country}</td>
                  <td className="p-4 text-gray-400">{t.assetClass}</td>
                  <td className="p-4 text-white font-medium">{t.assetSubClass}</td>
                  <td className="p-4 text-right text-white">{formatKRW(t.currentValue)}</td>
                  <td className="p-4 text-right text-gray-300">{t.currentWeight.toFixed(1)}%</td>
                  <td className="p-4 text-right text-white">{t.targetWeight.toFixed(2)}%</td>
                  <td className="p-4 text-right text-gray-300">{formatKRW(t.targetAmount160)}</td>
                  <td className={`p-4 text-right font-medium ${t.gap160 > 0 ? 'text-green-400' : t.gap160 < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                    {formatFullKRW(t.gap160)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
