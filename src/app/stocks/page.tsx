'use client';

import { usePortfolio } from '@/lib/usePortfolio';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import RefreshButton from '@/components/RefreshButton';
import { formatFullKRW, formatPercent, filterByCategory } from '@/lib/utils';

export default function StocksPage() {
  const { data, loading, refresh } = usePortfolio();

  if (loading) return <LoadingSkeleton />;

  const securities = filterByCategory(data.assets, '증권');
  const totalInvested = securities.reduce((s, a) => s + a.investedAmount, 0);
  const totalCurrent = securities.reduce((s, a) => s + a.currentValue, 0);
  const totalProfit = securities.reduce((s, a) => s + a.profit, 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">📈 증권</h1>
          <p className="text-gray-400 text-sm mt-1">보유 증권 상세 현황</p>
        </div>
        <RefreshButton onClick={refresh} loading={loading} />
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400">
              <th className="text-left p-4">자산명</th>
              <th className="text-left p-4">계좌</th>
              <th className="text-left p-4">유형</th>
              <th className="text-right p-4">수량</th>
              <th className="text-right p-4">투자금액</th>
              <th className="text-right p-4">현재가</th>
              <th className="text-right p-4">수익금</th>
              <th className="text-right p-4">수익률</th>
            </tr>
          </thead>
          <tbody>
            {securities.map((a) => {
              const isPositive = a.profit >= 0;
              return (
                <tr key={a.name + a.account + a.accountType} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="p-4 text-white font-medium">{a.name}</td>
                  <td className="p-4 text-gray-400">{a.account} ({a.accountType})</td>
                  <td className="p-4 text-gray-400">{a.type}</td>
                  <td className="p-4 text-right text-gray-300">{a.quantity.toLocaleString()}</td>
                  <td className="p-4 text-right text-gray-300">{formatFullKRW(a.investedAmount)}</td>
                  <td className="p-4 text-right text-white">{formatFullKRW(a.currentValue)}</td>
                  <td className={`p-4 text-right font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                    {formatFullKRW(a.profit)}
                  </td>
                  <td className={`p-4 text-right font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                    {formatPercent(a.profitRate)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-700/30">
              <td className="p-4 text-white font-bold" colSpan={4}>합계</td>
              <td className="p-4 text-right text-white font-bold">{formatFullKRW(totalInvested)}</td>
              <td className="p-4 text-right text-white font-bold">{formatFullKRW(totalCurrent)}</td>
              <td className={`p-4 text-right font-bold ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatFullKRW(totalProfit)}
              </td>
              <td className="p-4"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
