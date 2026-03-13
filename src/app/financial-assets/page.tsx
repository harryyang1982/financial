'use client';

import { useState, useMemo } from 'react';
import { usePortfolio } from '@/lib/usePortfolio';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import RefreshButton from '@/components/RefreshButton';
import { formatFullKRW, formatPercent, filterByCategory, formatKRWEok } from '@/lib/utils';
import { Asset } from '@/lib/types';

type ViewMode = 'all' | 'assetClass' | 'account' | 'country';

function groupBy(assets: Asset[], key: (a: Asset) => string): Map<string, Asset[]> {
  const map = new Map<string, Asset[]>();
  assets.forEach((a) => {
    const k = key(a);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(a);
  });
  return map;
}

function GroupTotals({ assets, label }: { assets: Asset[]; label: string }) {
  const totalInvested = assets.reduce((s, a) => s + a.investedAmount, 0);
  const totalCurrent = assets.reduce((s, a) => s + a.currentValue, 0);
  const totalProfit = assets.reduce((s, a) => s + a.profit, 0);
  const profitRate = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;
  const isPositive = totalProfit >= 0;

  return (
    <div className="flex items-center justify-between bg-gray-700/40 rounded-lg px-4 py-3 mb-1">
      <span className="text-white font-semibold text-sm">{label}</span>
      <div className="flex items-center gap-6 text-sm">
        <span className="text-gray-400">투자 {formatKRWEok(totalInvested)}</span>
        <span className="text-white font-medium">평가 {formatKRWEok(totalCurrent)}</span>
        <span className={`font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
          {formatFullKRW(totalProfit)} ({formatPercent(profitRate)})
        </span>
      </div>
    </div>
  );
}

function AssetTable({ assets }: { assets: Asset[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-700 text-gray-400">
          <th className="text-left p-3">자산명</th>
          <th className="text-left p-3">대범주</th>
          <th className="text-left p-3">계좌</th>
          <th className="text-left p-3">국가</th>
          <th className="text-left p-3">유형</th>
          <th className="text-right p-3">수량</th>
          <th className="text-right p-3">투자금액</th>
          <th className="text-right p-3">현재가</th>
          <th className="text-right p-3">수익금</th>
          <th className="text-right p-3">수익률</th>
        </tr>
      </thead>
      <tbody>
        {assets.map((a) => {
          const isPositive = a.profit >= 0;
          return (
            <tr key={`${a.name}-${a.account}-${a.accountType}`} className="border-b border-gray-700/50 hover:bg-gray-700/30">
              <td className="p-3 text-white font-medium">{a.name}</td>
              <td className="p-3 text-gray-400">{a.assetClass}</td>
              <td className="p-3 text-gray-400">{a.account} ({a.accountType})</td>
              <td className="p-3 text-gray-400">{a.country}</td>
              <td className="p-3 text-gray-400">{a.type}</td>
              <td className="p-3 text-right text-gray-300">{a.quantity.toLocaleString()}</td>
              <td className="p-3 text-right text-gray-300">{formatFullKRW(a.investedAmount)}</td>
              <td className="p-3 text-right text-white">{formatFullKRW(a.currentValue)}</td>
              <td className={`p-3 text-right font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                {formatFullKRW(a.profit)}
              </td>
              <td className={`p-3 text-right font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                {formatPercent(a.profitRate)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function FinancialAssetsPage() {
  const { data, loading, refresh } = usePortfolio();
  const [view, setView] = useState<ViewMode>('all');

  const financialAssets = useMemo(() => {
    if (!data) return [];
    const securities = filterByCategory(data.assets, '증권');
    const crypto = filterByCategory(data.assets, '코인');
    return [...securities, ...crypto];
  }, [data]);

  if (loading) return <LoadingSkeleton />;

  const totalInvested = financialAssets.reduce((s, a) => s + a.investedAmount, 0);
  const totalCurrent = financialAssets.reduce((s, a) => s + a.currentValue, 0);
  const totalProfit = financialAssets.reduce((s, a) => s + a.profit, 0);
  const profitRate = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;
  const isPositive = totalProfit >= 0;

  const viewButtons: { key: ViewMode; label: string }[] = [
    { key: 'all', label: '전체' },
    { key: 'assetClass', label: '자산 대범주별' },
    { key: 'account', label: '계좌별' },
    { key: 'country', label: '국가별' },
  ];

  const groupKey: Record<ViewMode, (a: Asset) => string> = {
    all: () => '전체',
    assetClass: (a) => a.assetClass,
    account: (a) => a.accountType,
    country: (a) => a.country,
  };

  const grouped = groupBy(financialAssets, groupKey[view]);
  // Sort groups by total currentValue descending
  const sortedGroups = Array.from(grouped.entries()).sort(
    (a, b) => b[1].reduce((s, x) => s + x.currentValue, 0) - a[1].reduce((s, x) => s + x.currentValue, 0)
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">💹 금융 자산</h1>
            <p className="text-gray-400 text-sm mt-1">증권 + 암호화폐 통합 현황</p>
          </div>
          <RefreshButton onClick={refresh} loading={loading} />
        </div>
        <div className="bg-gray-800 rounded-xl px-5 py-3 border border-gray-700">
          <p className="text-gray-400 text-xs">금융 자산 합계</p>
          <p className="text-2xl font-bold text-white">{formatFullKRW(totalCurrent)}</p>
          <p className={`text-xs ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {formatFullKRW(totalProfit)} ({formatPercent(profitRate)})
          </p>
        </div>
      </div>

      {/* View mode buttons */}
      <div className="flex gap-2">
        {viewButtons.map((btn) => (
          <button
            key={btn.key}
            onClick={() => setView(btn.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === btn.key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white border border-gray-700'
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="space-y-4">
        {sortedGroups.map(([groupName, assets]) => (
          <div key={groupName} className="bg-gray-800 rounded-xl border border-gray-700 overflow-x-auto">
            {view !== 'all' && (
              <div className="p-4 pb-0">
                <GroupTotals assets={assets} label={groupName} />
              </div>
            )}
            <div className="p-2">
              <AssetTable assets={assets} />
            </div>
          </div>
        ))}
      </div>

      {/* Grand total footer */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
        <div className="flex items-center justify-between">
          <span className="text-white font-bold">총 합계</span>
          <div className="flex items-center gap-8 text-sm">
            <div>
              <span className="text-gray-400">투자금액</span>
              <span className="text-white font-bold ml-2">{formatFullKRW(totalInvested)}</span>
            </div>
            <div>
              <span className="text-gray-400">현재 평가</span>
              <span className="text-white font-bold ml-2">{formatFullKRW(totalCurrent)}</span>
            </div>
            <div>
              <span className="text-gray-400">수익</span>
              <span className={`font-bold ml-2 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                {formatFullKRW(totalProfit)} ({formatPercent(profitRate)})
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
