'use client';

import SummaryCard from '@/components/SummaryCard';
import DonutChart from '@/components/charts/DonutChart';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import RefreshButton from '@/components/RefreshButton';
import { usePortfolio } from '@/lib/usePortfolio';
import {
  calcTotalValue, calcTotalInvested, calcTotalProfit, calcOverallProfitRate,
  calcCategorySummary, calcAssetClassSummary, formatKRW, formatFullKRW,
  formatPercent, filterByCategory, getInvestmentAssets,
} from '@/lib/utils';

export default function Dashboard() {
  const { data, loading, error, refresh } = usePortfolio();

  if (loading) return <LoadingSkeleton />;

  const allAssets = data.assets;
  const investmentAssets = getInvestmentAssets(allAssets);
  const totalValueAll = calcTotalValue(allAssets);
  const totalValueInvestment = calcTotalValue(investmentAssets);
  const totalProfit = calcTotalProfit(investmentAssets);
  const overallRate = calcOverallProfitRate(investmentAssets);
  const categorySummary = calcCategorySummary(data);
  const assetClassSummary = calcAssetClassSummary(data, true); // 부동산 제외

  const securities = filterByCategory(allAssets, '증권');
  const crypto = filterByCategory(allAssets, '코인');
  const realEstate = filterByCategory(allAssets, '부동산');

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">대시보드</h1>
            <p className="text-gray-400 text-sm mt-1">자산 현황을 한눈에 확인하세요</p>
          </div>
          <RefreshButton onClick={refresh} loading={loading} />
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="bg-gray-800 rounded-xl px-5 py-3 border border-gray-700">
            <p className="text-gray-400 text-xs">총 자산 (부동산 포함)</p>
            <p className="text-2xl font-bold text-white">{formatKRW(totalValueAll)}</p>
          </div>
          <div className="bg-gray-800 rounded-xl px-5 py-3 border border-gray-700">
            <p className="text-gray-400 text-xs">투자 자산 (부동산 제외)</p>
            <p className="text-2xl font-bold text-white">{formatKRW(totalValueInvestment)}</p>
            <p className={`text-xs ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatFullKRW(totalProfit)} ({formatPercent(overallRate)})
            </p>
          </div>
          {data.debts.length > 0 && (() => {
            const totalDebt = data.debts.reduce((s, d) => s + d.remaining, 0);
            const netWorth = totalValueAll - totalDebt;
            return (
              <div className="bg-gray-800 rounded-xl px-5 py-3 border border-gray-700">
                <p className="text-gray-400 text-xs">순자산 (자산 - 부채)</p>
                <p className={`text-2xl font-bold ${netWorth >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatKRW(netWorth)}</p>
                <p className="text-xs text-red-400">부채 {formatKRW(totalDebt)}</p>
              </div>
            );
          })()}
        </div>
      </div>

      {error && (
        <div className="bg-yellow-900/30 border border-yellow-700 text-yellow-300 text-sm p-3 rounded-lg">{error}</div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard title="증권" value={calcTotalValue(securities)} icon="📈" color="#3B82F6" change={calcOverallProfitRate(securities)} />
        <SummaryCard title="코인" value={calcTotalValue(crypto)} icon="🪙" color="#8B5CF6" change={calcOverallProfitRate(crypto)} />
        <SummaryCard title="부동산" value={calcTotalValue(realEstate)} icon="🏠" color="#F59E0B" change={calcOverallProfitRate(realEstate)} />
        <SummaryCard title="총 투자금액" value={calcTotalInvested(investmentAssets)} icon="💰" color="#10B981" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DonutChart data={categorySummary} title="대범주별 비중 (전체)" />
        <DonutChart data={assetClassSummary} title="자산대범주별 비중 (투자 자산)" />
      </div>

      {/* 부채 & 지분 요약 */}
      {data.debtSummary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <p className="text-gray-400 text-xs">아파트 지분율</p>
            <p className="text-xl font-bold text-green-400">{data.debtSummary.equityRate.toFixed(1)}%</p>
            <div className="mt-2 bg-gray-700 rounded-full h-2">
              <div className="bg-green-400 h-2 rounded-full" style={{ width: `${Math.min(data.debtSummary.equityRate, 100)}%` }} />
            </div>
            <p className="text-gray-400 text-xs mt-1">자본 {formatKRW(data.debtSummary.equity)}</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <p className="text-gray-400 text-xs">부채 상환율</p>
            <p className="text-xl font-bold text-blue-400">{data.debtSummary.paidRate.toFixed(2)}%</p>
            <div className="mt-2 bg-gray-700 rounded-full h-2">
              <div className="bg-blue-400 h-2 rounded-full" style={{ width: `${Math.min(data.debtSummary.paidRate * 10, 100)}%` }} />
            </div>
            <p className="text-gray-400 text-xs mt-1">상환 {formatKRW(data.debtSummary.totalPaid)} / {formatKRW(data.debtSummary.totalDebt)}</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <p className="text-gray-400 text-xs">잔여 부채</p>
            <p className="text-xl font-bold text-red-400">{formatKRW(data.debtSummary.remainingDebt)}</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <p className="text-gray-400 text-xs">부채비율 (부채/자산)</p>
            <p className="text-xl font-bold text-yellow-400">{((data.debtSummary.remainingDebt / totalValueAll) * 100).toFixed(1)}%</p>
          </div>
        </div>
      )}
    </div>
  );
}
