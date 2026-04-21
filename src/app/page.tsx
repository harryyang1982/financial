'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import SummaryCard from '@/components/SummaryCard';
import DonutChart from '@/components/charts/DonutChart';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import RefreshButton from '@/components/RefreshButton';
import { usePortfolio } from '@/lib/usePortfolio';
import {
  calcTotalValue, calcTotalProfit, calcOverallProfitRate,
  calcCategorySummary, calcAssetClassSummary, formatKRW, formatKRWEok, formatFullKRW,
  formatPercent, filterByCategory, getInvestmentAssets,
} from '@/lib/utils';
import { diagnoseMarket } from '@/lib/market-diagnosis';
import { useMarket } from '@/lib/useMarket';

export default function Dashboard() {
  const { data, loading, error, refresh } = usePortfolio();
  const { market } = useMarket();
  const diagnosis = useMemo(() => diagnoseMarket(market), [market]);

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
            <p className="text-2xl font-bold text-white">{formatKRWEok(totalValueInvestment)}</p>
            <p className={`text-xs ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatFullKRW(totalProfit)} ({formatPercent(overallRate)})
            </p>
            {(() => {
              const target = 180000000;
              const progress = Math.min((totalValueInvestment / target) * 100, 100);
              const gap = target - totalValueInvestment;
              return (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">1.8억 목표</span>
                    <span className="text-blue-400 font-medium">{progress.toFixed(1)}%</span>
                  </div>
                  <div className="mt-1 bg-gray-700 rounded-full h-1.5">
                    <div className="bg-blue-400 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="text-gray-500 text-[11px] mt-1">
                    {gap > 0 ? `남은 금액 ${formatFullKRW(gap)}` : `목표 초과 달성 +${formatFullKRW(-gap)}`}
                  </p>
                </div>
              );
            })()}
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

      <div className="grid grid-cols-3 gap-4">
        <SummaryCard title="증권" value={calcTotalValue(securities)} icon="📈" color="#3B82F6" change={calcOverallProfitRate(securities)} formatter={formatKRWEok} />
        <SummaryCard title="코인" value={calcTotalValue(crypto)} icon="🪙" color="#8B5CF6" change={calcOverallProfitRate(crypto)} />
        <SummaryCard title="부동산" value={calcTotalValue(realEstate)} icon="🏠" color="#F59E0B" change={calcOverallProfitRate(realEstate)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DonutChart data={categorySummary} title="대범주별 비중 (전체)" valueFormatter={(name, value) => name === '증권' ? formatKRWEok(value) : formatKRW(value)} />
        <DonutChart data={assetClassSummary} title="자산대범주별 비중 (투자 자산)" />
      </div>

      {/* 전략 & 리밸런싱 요약 */}
      <Link href="/strategy" className="block group">
        <div className={`rounded-xl p-5 border-2 transition-all group-hover:shadow-lg group-hover:shadow-yellow-500/10 ${
          diagnosis.rebalanceUrgency === 'high'
            ? 'bg-red-500/10 border-red-500/40 group-hover:border-red-400'
            : diagnosis.rebalanceUrgency === 'medium'
            ? 'bg-yellow-500/10 border-yellow-500/40 group-hover:border-yellow-400'
            : 'bg-green-500/10 border-green-500/40 group-hover:border-green-400'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                diagnosis.rebalanceUrgency === 'high' ? 'bg-red-500/20' :
                diagnosis.rebalanceUrgency === 'medium' ? 'bg-yellow-500/20' : 'bg-green-500/20'
              }`}>
                <span className="text-xl">
                  {diagnosis.rebalanceUrgency === 'high' ? '🚨' : diagnosis.rebalanceUrgency === 'medium' ? '⚠️' : '✅'}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-semibold ${
                    diagnosis.rebalanceUrgency === 'high' ? 'text-red-400' :
                    diagnosis.rebalanceUrgency === 'medium' ? 'text-yellow-400' : 'text-green-400'
                  }`}>
                    {diagnosis.rebalanceUrgency === 'high' ? '월간 리밸런싱' :
                     diagnosis.rebalanceUrgency === 'medium' ? '분기 리밸런싱' : '연간 리밸런싱'}
                  </span>
                  <span className="text-gray-500 text-xs">{new Date(market.fetchedAt).toLocaleDateString('ko-KR')} 기준</span>
                </div>
                <p className="text-white text-sm mt-0.5">
                  추천: <span className="font-medium">{diagnosis.recommendedName}</span>
                  <span className="text-gray-400 ml-2 text-xs">신뢰도 {diagnosis.confidence}%</span>
                </p>
                <p className="text-gray-400 text-xs mt-1 hidden sm:block">{diagnosis.rebalanceNote}</p>
              </div>
            </div>
            <div className="text-gray-500 group-hover:text-white transition-colors text-sm">
              전략 상세 →
            </div>
          </div>
        </div>
      </Link>

      {/* 부채 & 지분 요약 */}
      {data.debtSummary && (() => {
        const aptValue = realEstate.reduce((s, a) => s + a.currentValue, 0);
        const mortgageRemaining = data.debts.filter(d => d.name.includes('주택담보')).reduce((s, d) => s + d.remaining, 0);
        const equityRateByMarket = aptValue > 0 ? ((aptValue - mortgageRemaining) / aptValue) * 100 : 0;
        const equityAmount = aptValue - mortgageRemaining;
        return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <p className="text-gray-400 text-xs">아파트 지분율(현재 시세 기준)</p>
            <p className="text-xl font-bold text-green-400">{equityRateByMarket.toFixed(1)}%</p>
            <div className="mt-2 bg-gray-700 rounded-full h-2">
              <div className="bg-green-400 h-2 rounded-full" style={{ width: `${Math.min(equityRateByMarket, 100)}%` }} />
            </div>
            <p className="text-gray-400 text-xs mt-1">자본 {formatKRW(equityAmount)}</p>
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
        );
      })()}
    </div>
  );
}
