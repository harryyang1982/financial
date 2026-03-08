'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { usePortfolio } from '@/lib/usePortfolio';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import RefreshButton from '@/components/RefreshButton';
import { formatKRW, formatFullKRW, calcTotalValue } from '@/lib/utils';

const DEBT_COLORS = ['#EF4444', '#F59E0B', '#3B82F6'];

export default function DebtsPage() {
  const { data, loading, refresh } = usePortfolio();

  if (loading) return <LoadingSkeleton />;

  const { debts, debtPayments, debtSummary } = data;
  const totalAssets = calcTotalValue(data.assets);
  const totalDebt = debts.reduce((s, d) => s + d.remaining, 0);
  const netWorth = totalAssets - totalDebt;

  // 대출별 잔금 비중 (도넛)
  const debtPieData = debts.map((d, i) => ({
    name: d.name,
    value: d.remaining,
    color: DEBT_COLORS[i % DEBT_COLORS.length],
  }));

  // 대출별 상환 현황 (바 차트)
  const debtBarData = debts.map((d) => ({
    name: d.name,
    상환: d.paid,
    잔금: d.remaining,
  }));

  // 상환 내역을 카테고리별로 집계
  const paymentByCategory = new Map<string, { principal: number; interest: number }>();
  debtPayments.forEach((p) => {
    const existing = paymentByCategory.get(p.category) || { principal: 0, interest: 0 };
    existing.principal += p.principal;
    existing.interest += p.interest;
    paymentByCategory.set(p.category, existing);
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">부채 관리</h1>
          <p className="text-gray-400 text-sm mt-1">대출 현황과 상환 진행 상황</p>
        </div>
        <RefreshButton onClick={refresh} loading={loading} />
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <p className="text-gray-400 text-xs">총 자산</p>
          <p className="text-xl font-bold text-white">{formatKRW(totalAssets)}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <p className="text-gray-400 text-xs">총 부채 잔액</p>
          <p className="text-xl font-bold text-red-400">{formatKRW(totalDebt)}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <p className="text-gray-400 text-xs">순자산 (자산 - 부채)</p>
          <p className={`text-xl font-bold ${netWorth >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatKRW(netWorth)}</p>
        </div>
        {debtSummary && (
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <p className="text-gray-400 text-xs">총 상환율</p>
            <p className="text-xl font-bold text-blue-400">{debtSummary.paidRate.toFixed(2)}%</p>
            <p className="text-gray-400 text-xs mt-1">상환액 {formatKRW(debtSummary.totalPaid)}</p>
          </div>
        )}
      </div>

      {/* DTI / LTV 지표 */}
      {debtSummary && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <p className="text-gray-400 text-xs">부채비율 (부채/자산)</p>
            <p className="text-xl font-bold text-yellow-400">{((totalDebt / totalAssets) * 100).toFixed(1)}%</p>
            <div className="mt-2 bg-gray-700 rounded-full h-2">
              <div className="bg-yellow-400 h-2 rounded-full" style={{ width: `${Math.min((totalDebt / totalAssets) * 100, 100)}%` }} />
            </div>
          </div>
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <p className="text-gray-400 text-xs">아파트 지분율</p>
            <p className="text-xl font-bold text-green-400">{debtSummary.equityRate.toFixed(1)}%</p>
            <div className="mt-2 bg-gray-700 rounded-full h-2">
              <div className="bg-green-400 h-2 rounded-full" style={{ width: `${Math.min(debtSummary.equityRate, 100)}%` }} />
            </div>
          </div>
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <p className="text-gray-400 text-xs">자본 (상환 + 자기자본)</p>
            <p className="text-xl font-bold text-white">{formatKRW(debtSummary.equity)}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 부채 구성 도넛 */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h3 className="text-white font-semibold mb-4">부채 구성</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={debtPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(1)}%`}
                  labelLine={false}
                >
                  {debtPieData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatFullKRW(Number(v))} contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }} itemStyle={{ color: '#E5E7EB' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 상환 현황 바 차트 */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h3 className="text-white font-semibold mb-4">대출별 상환 현황</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={debtBarData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis type="number" stroke="#9CA3AF" tick={{ fontSize: 11 }} tickFormatter={(v) => formatKRW(v)} />
                <YAxis type="category" dataKey="name" stroke="#9CA3AF" tick={{ fontSize: 11 }} width={100} />
                <Tooltip formatter={(v) => formatFullKRW(Number(v))} contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }} itemStyle={{ color: '#E5E7EB' }} />
                <Bar dataKey="상환" stackId="a" fill="#10B981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="잔금" stackId="a" fill="#EF4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 상환 전략 참고 */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h3 className="text-white font-semibold mb-3">상환 우선순위 전략</h3>
        <div className="space-y-2 text-sm">
          {[...debts].sort((a, b) => a.priority - b.priority).map((d) => (
            <div key={d.name} className="flex items-start gap-3">
              <span className={`mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${
                d.priority === 1 ? 'bg-red-500/20 text-red-400' :
                d.priority === 2 ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-blue-500/20 text-blue-400'
              }`}>{d.priority}</span>
              <div>
                <p className="text-white font-medium">{d.name} <span className="text-gray-400 font-normal">({d.interestRate.toFixed(3)}%)</span></p>
                <p className="text-gray-400 text-xs">{d.terms}</p>
                {d.name === '주택담보대출' && (
                  <p className="text-yellow-400 text-xs mt-1">* 중도상환수수료 0.65% (3년 후 소멸, 잔여기간 비례 감소)</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 대출 상세 테이블 */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-x-auto">
        <div className="p-5 border-b border-gray-700">
          <h3 className="text-white font-semibold">대출 상세 현황</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400">
              <th className="text-center p-4">우선순위</th>
              <th className="text-left p-4">대출 종류</th>
              <th className="text-right p-4">원금</th>
              <th className="text-right p-4">상환액</th>
              <th className="text-right p-4">잔금</th>
              <th className="text-right p-4">이자 지급</th>
              <th className="text-right p-4">금리</th>
              <th className="text-right p-4">상환율</th>
              <th className="text-left p-4">조건</th>
            </tr>
          </thead>
          <tbody>
            {[...debts].sort((a, b) => a.priority - b.priority).map((d) => (
              <tr key={d.name} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="p-4 text-center">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                    d.priority === 1 ? 'bg-red-500/20 text-red-400' :
                    d.priority === 2 ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-blue-500/20 text-blue-400'
                  }`}>{d.priority}</span>
                </td>
                <td className="p-4 text-white font-medium">{d.name}</td>
                <td className="p-4 text-right text-white">{formatKRW(d.principal)}</td>
                <td className="p-4 text-right text-green-400">{formatKRW(d.paid)}</td>
                <td className="p-4 text-right text-red-400">{formatKRW(d.remaining)}</td>
                <td className="p-4 text-right text-yellow-400">{formatKRW(d.interestPaid)}</td>
                <td className="p-4 text-right text-white">{d.interestRate.toFixed(3)}%</td>
                <td className="p-4 text-right text-blue-400">{d.paidRate.toFixed(2)}%</td>
                <td className="p-4 text-gray-400 text-xs">{d.terms}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 상환 내역 */}
      {debtPayments.length > 0 && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-x-auto">
          <div className="p-5 border-b border-gray-700">
            <h3 className="text-white font-semibold">최근 상환 내역</h3>
            <p className="text-gray-400 text-xs mt-1">카테고리별 상환 원금/이자 구분</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="text-left p-4">일자</th>
                <th className="text-left p-4">종류</th>
                <th className="text-right p-4">금액</th>
                <th className="text-right p-4">원금</th>
                <th className="text-right p-4">이자</th>
              </tr>
            </thead>
            <tbody>
              {debtPayments.map((p, i) => (
                <tr key={`${p.date}-${i}`} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="p-4 text-gray-400">{p.date}</td>
                  <td className="p-4 text-white">{p.category}</td>
                  <td className="p-4 text-right text-white">{formatFullKRW(p.amount)}</td>
                  <td className="p-4 text-right text-green-400">{formatFullKRW(p.principal)}</td>
                  <td className="p-4 text-right text-yellow-400">{p.interest > 0 ? formatFullKRW(p.interest) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
