'use client';

import { usePortfolio } from '@/lib/usePortfolio';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import RefreshButton from '@/components/RefreshButton';
import DonutChart from '@/components/charts/DonutChart';
import { formatFullKRW, formatPercent, calcAccountSummary } from '@/lib/utils';

export default function AccountsPage() {
  const { data, loading, refresh } = usePortfolio();

  if (loading) return <LoadingSkeleton />;

  const accountSummary = calcAccountSummary(data);

  // Group assets by account type
  const accountTypes = Array.from(new Set(data.assets.map((a) => a.accountType)));

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">🏦 계좌별 현황</h1>
          <p className="text-gray-400 text-sm mt-1">계좌 유형별 자산 현황</p>
        </div>
        <RefreshButton onClick={refresh} loading={loading} />
      </div>

      <DonutChart data={accountSummary} title="계좌별 비중" />

      {accountTypes.map((accountType) => {
        const assets = data.assets.filter((a) => a.accountType === accountType);
        const totalCurrent = assets.reduce((s, a) => s + a.currentValue, 0);
        const totalProfit = assets.reduce((s, a) => s + a.profit, 0);
        return (
          <div key={accountType} className="bg-gray-800 rounded-xl border border-gray-700 overflow-x-auto">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-white font-semibold">{accountType}</h3>
              <div className="flex gap-4 text-sm">
                <span className="text-gray-400">현재가: <span className="text-white font-medium">{formatFullKRW(totalCurrent)}</span></span>
                <span className={totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}>{formatFullKRW(totalProfit)}</span>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-gray-400">
                  <th className="text-left p-3">자산명</th>
                  <th className="text-right p-3">투자금액</th>
                  <th className="text-right p-3">현재가</th>
                  <th className="text-right p-3">수익금</th>
                  <th className="text-right p-3">수익률</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((a) => (
                  <tr key={a.name + a.account} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="p-3 text-white">{a.name}</td>
                    <td className="p-3 text-right text-gray-300">{formatFullKRW(a.investedAmount)}</td>
                    <td className="p-3 text-right text-white">{formatFullKRW(a.currentValue)}</td>
                    <td className={`p-3 text-right ${a.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatFullKRW(a.profit)}</td>
                    <td className={`p-3 text-right ${a.profitRate >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatPercent(a.profitRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
