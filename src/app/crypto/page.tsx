'use client';

import { usePortfolio } from '@/lib/usePortfolio';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import RefreshButton from '@/components/RefreshButton';
import { formatFullKRW, formatPercent, filterByCategory } from '@/lib/utils';

export default function CryptoPage() {
  const { data, loading, refresh } = usePortfolio();

  if (loading) return <LoadingSkeleton />;

  const cryptos = filterByCategory(data.assets, '코인');
  const totalInvested = cryptos.reduce((s, a) => s + a.investedAmount, 0);
  const totalCurrent = cryptos.reduce((s, a) => s + a.currentValue, 0);
  const totalProfit = cryptos.reduce((s, a) => s + a.profit, 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">🪙 암호화폐</h1>
          <p className="text-gray-400 text-sm mt-1">보유 암호화폐 상세 현황</p>
        </div>
        <RefreshButton onClick={refresh} loading={loading} />
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400">
              <th className="text-left p-4">코인명</th>
              <th className="text-left p-4">거래소</th>
              <th className="text-right p-4">수량</th>
              <th className="text-right p-4">평단</th>
              <th className="text-right p-4">투자금액</th>
              <th className="text-right p-4">현재가</th>
              <th className="text-right p-4">수익금</th>
              <th className="text-right p-4">수익률</th>
            </tr>
          </thead>
          <tbody>
            {cryptos.map((c) => {
              const isPositive = c.profit >= 0;
              return (
                <tr key={c.name} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="p-4 text-white font-medium">{c.name}</td>
                  <td className="p-4 text-gray-400">{c.account}</td>
                  <td className="p-4 text-right text-gray-300">{c.quantity}</td>
                  <td className="p-4 text-right text-gray-300">{formatFullKRW(c.avgPrice)}</td>
                  <td className="p-4 text-right text-gray-300">{formatFullKRW(c.investedAmount)}</td>
                  <td className="p-4 text-right text-white">{formatFullKRW(c.currentValue)}</td>
                  <td className={`p-4 text-right font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                    {formatFullKRW(c.profit)}
                  </td>
                  <td className={`p-4 text-right font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                    {formatPercent(c.profitRate)}
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
