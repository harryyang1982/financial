'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { usePortfolio } from '@/lib/usePortfolio';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import RefreshButton from '@/components/RefreshButton';
import { formatKRW, formatFullKRW, calcTotalValue, getInvestmentAssets } from '@/lib/utils';

export default function ProjectionsPage() {
  const { data, loading, refresh } = usePortfolio();

  if (loading) return <LoadingSkeleton />;

  const growthRecords = data.growthRecords;
  const investmentAssets = getInvestmentAssets(data.assets);
  const currentInvestmentValue = calcTotalValue(investmentAssets);
  const targets = data.allocationTargets;

  // 현재 시점 데이터 + 성장 전망 데이터
  const chartData = [
    { year: '현재', amount: currentInvestmentValue, presentValue: currentInvestmentValue, dividendReinvest: currentInvestmentValue },
    ...growthRecords.map((r) => ({
      year: r.year,
      amount: r.amount,
      presentValue: r.presentValue,
      dividendReinvest: r.dividendReinvest,
    })),
  ];

  // 목표 도달 연도 계산
  const target1B = growthRecords.find((r) => r.amount >= 1000000000);
  const target5B = growthRecords.find((r) => r.amount >= 5000000000);
  const target10B = growthRecords.find((r) => r.amount >= 10000000000);

  // 리밸런싱 우선순위: 조정 금액이 큰 순서
  const rebalancePriority = [...targets]
    .filter((t) => Math.abs(t.gap180) > 100000)
    .sort((a, b) => b.gap180 - a.gap180);

  const buyTargets = rebalancePriority.filter((t) => t.gap180 > 0);
  const sellTargets = rebalancePriority.filter((t) => t.gap180 < 0);

  // 연간 투입금 추이
  const contributionData = growthRecords
    .filter((r) => r.contribution > 0)
    .map((r) => ({
      year: r.year,
      투입금: r.contribution,
      배당수익: r.dividendIncome,
    }));

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">📈 성장 전망 & 리밸런싱</h1>
          <p className="text-gray-400 text-sm mt-1">장기 자산 성장 모델링과 포트폴리오 조정 가이드</p>
        </div>
        <RefreshButton onClick={refresh} loading={loading} />
      </div>

      {/* 주요 마일스톤 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <p className="text-gray-400 text-xs">현재 투자 자산</p>
          <p className="text-xl font-bold text-white">{formatKRW(currentInvestmentValue)}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <p className="text-gray-400 text-xs">10억 달성</p>
          <p className="text-xl font-bold text-blue-400">{target1B ? `${target1B.year}년` : '-'}</p>
          {target1B && <p className="text-gray-400 text-xs mt-1">현재가치 {formatKRW(target1B.presentValue)}</p>}
        </div>
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <p className="text-gray-400 text-xs">50억 달성</p>
          <p className="text-xl font-bold text-green-400">{target5B ? `${target5B.year}년` : '-'}</p>
          {target5B && <p className="text-gray-400 text-xs mt-1">현재가치 {formatKRW(target5B.presentValue)}</p>}
        </div>
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <p className="text-gray-400 text-xs">100억 달성</p>
          <p className="text-xl font-bold text-yellow-400">{target10B ? `${target10B.year}년` : '-'}</p>
          {target10B && <p className="text-gray-400 text-xs mt-1">현재가치 {formatKRW(target10B.presentValue)}</p>}
        </div>
      </div>

      {/* 성장 곡선 차트 */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h3 className="text-white font-semibold mb-4">자산 성장 전망 (명목 vs 현재가치)</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" stroke="#9CA3AF" tick={{ fontSize: 11 }} />
              <YAxis stroke="#9CA3AF" tick={{ fontSize: 11 }} tickFormatter={(v) => formatKRW(v)} />
              <Tooltip
                formatter={(value, name) => {
                  const labels: Record<string, string> = { amount: '명목 금액', presentValue: '현재가치', dividendReinvest: '배당재투자 포함' };
                  return [formatKRW(Number(value)), labels[String(name)] || String(name)];
                }}
                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                itemStyle={{ color: '#E5E7EB' }}
              />
              <Legend formatter={(v) => {
                const labels: Record<string, string> = { amount: '명목 금액', presentValue: '현재가치 (인플레 반영)', dividendReinvest: '배당재투자' };
                return labels[v] || v;
              }} />
              <Area type="monotone" dataKey="dividendReinvest" stroke="#10B981" fill="#10B981" fillOpacity={0.1} strokeWidth={1} />
              <Area type="monotone" dataKey="amount" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.15} strokeWidth={2} />
              <Area type="monotone" dataKey="presentValue" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.1} strokeWidth={1.5} strokeDasharray="4 4" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 투입금 + 배당 */}
      {contributionData.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h3 className="text-white font-semibold mb-4">연간 투입금 & 배당 수익</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={contributionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="year" stroke="#9CA3AF" tick={{ fontSize: 11 }} />
                <YAxis stroke="#9CA3AF" tick={{ fontSize: 11 }} tickFormatter={(v) => formatKRW(v)} />
                <Tooltip formatter={(v) => formatKRW(Number(v))} contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }} itemStyle={{ color: '#E5E7EB' }} />
                <Legend />
                <Line type="monotone" dataKey="투입금" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="배당수익" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 리밸런싱 액션 가이드 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 매수 우선순위 */}
        <div className="bg-gray-800 rounded-xl border border-gray-700">
          <div className="p-5 border-b border-gray-700">
            <h3 className="text-green-400 font-semibold">▲ 매수 우선순위 (비중 부족)</h3>
            <p className="text-gray-400 text-xs mt-1">다음 투입 시 우선 매수할 자산</p>
          </div>
          <div className="p-4 space-y-3">
            {buyTargets.length === 0 && <p className="text-gray-400 text-sm">리밸런싱 불필요</p>}
            {buyTargets.map((t, i) => (
              <div key={t.country + t.assetClass} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-green-400 font-bold text-sm w-6">{i + 1}</span>
                  <div>
                    <p className="text-white text-sm font-medium">{t.assetClass} ({t.country})</p>
                    <p className="text-gray-400 text-xs">{t.currentWeight.toFixed(1)}% → {t.targetWeight.toFixed(1)}%</p>
                  </div>
                </div>
                <span className="text-green-400 font-medium text-sm">{formatFullKRW(t.gap180)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 축소/관망 */}
        <div className="bg-gray-800 rounded-xl border border-gray-700">
          <div className="p-5 border-b border-gray-700">
            <h3 className="text-red-400 font-semibold">▼ 비중 초과 (추가 매수 자제)</h3>
            <p className="text-gray-400 text-xs mt-1">신규 매수를 지양하고 자연 리밸런싱 대기</p>
          </div>
          <div className="p-4 space-y-3">
            {sellTargets.length === 0 && <p className="text-gray-400 text-sm">초과 비중 없음</p>}
            {sellTargets.map((t, i) => (
              <div key={t.country + t.assetClass} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-red-400 font-bold text-sm w-6">{i + 1}</span>
                  <div>
                    <p className="text-white text-sm font-medium">{t.assetClass} ({t.country})</p>
                    <p className="text-gray-400 text-xs">{t.currentWeight.toFixed(1)}% → {t.targetWeight.toFixed(1)}%</p>
                  </div>
                </div>
                <span className="text-red-400 font-medium text-sm">{formatFullKRW(t.gap180)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 성장 전망 상세 테이블 */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-x-auto">
        <div className="p-5 border-b border-gray-700">
          <h3 className="text-white font-semibold">연도별 성장 전망 상세</h3>
          <p className="text-gray-400 text-xs mt-1">수익률 {growthRecords[0]?.returnRate || 10}% 가정 / 인플레이션 {growthRecords[0]?.inflation || 3}% 반영</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400">
              <th className="text-left p-3">연도</th>
              <th className="text-right p-3">명목 금액</th>
              <th className="text-right p-3">투입금</th>
              <th className="text-right p-3">현재가치</th>
              <th className="text-right p-3">배당 수익</th>
              <th className="text-right p-3">배당재투자</th>
              <th className="text-right p-3">인출액</th>
            </tr>
          </thead>
          <tbody>
            {growthRecords.map((r) => (
              <tr key={r.year} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="p-3 text-white font-medium">{r.year}</td>
                <td className="p-3 text-right text-white">{formatKRW(r.amount)}</td>
                <td className="p-3 text-right text-blue-400">{r.contribution > 0 ? formatKRW(r.contribution) : '-'}</td>
                <td className="p-3 text-right text-yellow-400">{formatKRW(r.presentValue)}</td>
                <td className="p-3 text-right text-green-400">{formatKRW(r.dividendIncome)}</td>
                <td className="p-3 text-right text-gray-300">{formatKRW(r.dividendReinvest)}</td>
                <td className="p-3 text-right text-red-400">{r.withdrawal > 0 ? formatKRW(r.withdrawal) : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
