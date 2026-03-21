'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { usePortfolio } from '@/lib/usePortfolio';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import RefreshButton from '@/components/RefreshButton';
import { formatKRW, formatFullKRW, calcTotalValue } from '@/lib/utils';
import { calcDebtProjections, calcEarlyPayoffScenarios, calcRepaymentOrder, calcSingleScenario, generateMonthlySchedule } from '@/lib/debt-analysis';
import { useMemo, useState } from 'react';

const DEBT_COLORS = ['#EF4444', '#F59E0B', '#3B82F6'];

export default function DebtsPage() {
  const { data, loading, refresh } = usePortfolio();

  // 상태
  const [customExtra, setCustomExtra] = useState(4000000);
  const [customInput, setCustomInput] = useState('400');
  const [showPayments, setShowPayments] = useState(false);
  const [paymentPage, setPaymentPage] = useState(0);
  const [selectedScenario, setSelectedScenario] = useState(0);
  const [schedulePage, setSchedulePage] = useState(0);

  // 부채 상환 프로젝션 & 시나리오 분석 (hooks must be before early return)
  const projections = useMemo(() => calcDebtProjections(data.debts, data.debtPayments), [data.debts, data.debtPayments]);
  const scenarios = useMemo(() => calcEarlyPayoffScenarios(data.debts, projections), [data.debts, projections]);
  const repaymentOrder = useMemo(() => calcRepaymentOrder(data.debts, projections), [data.debts, projections]);
  const customScenario = useMemo(() => {
    if (!scenarios[0] || customExtra <= 0) return null;
    return calcSingleScenario(
      data.debts, customExtra,
      scenarios[0].totalInterest,
      scenarios[0].maxMonths,
      new Date()
    );
  }, [data.debts, customExtra, scenarios]);

  // 월별 상환 스케줄
  const totalAssets = useMemo(() => calcTotalValue(data.assets), [data.assets]);
  const apartmentValue = useMemo(
    () => data.assets.filter(a => a.category === '부동산').reduce((s, a) => s + a.currentValue, 0),
    [data.assets]
  );
  const scheduleConfig = useMemo(() => {
    const configs = [
      { extra: 0, snowball: false, label: '현행 유지' },
      { extra: 500000, snowball: true, label: '월 50만원 추가' },
      { extra: 1000000, snowball: true, label: '월 100만원 추가' },
      { extra: 2000000, snowball: true, label: '월 200만원 추가' },
      { extra: 3000000, snowball: true, label: '월 300만원 추가' },
      { extra: customExtra, snowball: true, label: `월 ${Math.round(customExtra / 10000)}만원 (직접입력)` },
    ];
    return configs[selectedScenario] || configs[0];
  }, [selectedScenario, customExtra]);
  const schedule = useMemo(
    () => generateMonthlySchedule(data.debts, scheduleConfig.extra, scheduleConfig.snowball, totalAssets, apartmentValue),
    [data.debts, scheduleConfig, totalAssets, apartmentValue]
  );

  if (loading) return <LoadingSkeleton />;

  const { debts, debtPayments, debtSummary } = data;
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
            <p className="text-gray-400 text-xs">아파트 지분율(현재 시세 기준)</p>
            {(() => {
              const mortgageRemaining = data.debts.filter(d => d.name.includes('주택담보')).reduce((s, d) => s + d.remaining, 0);
              const eqRate = apartmentValue > 0 ? ((apartmentValue - mortgageRemaining) / apartmentValue) * 100 : 0;
              return (
                <>
                  <p className="text-xl font-bold text-green-400">{eqRate.toFixed(1)}%</p>
                  <div className="mt-2 bg-gray-700 rounded-full h-2">
                    <div className="bg-green-400 h-2 rounded-full" style={{ width: `${Math.min(eqRate, 100)}%` }} />
                  </div>
                </>
              );
            })()}
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

      {/* 상환 내역 (접기/펼치기 + 페이지네이션) */}
      {debtPayments.length > 0 && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-x-auto">
          <div className="p-5 border-b border-gray-700 flex items-center justify-between">
            <div>
              <h3 className="text-white font-semibold">최근 상환 내역</h3>
              <p className="text-gray-400 text-xs mt-1">카테고리별 상환 원금/이자 구분 ({debtPayments.length}건)</p>
            </div>
            <button
              onClick={() => { setShowPayments(!showPayments); setPaymentPage(0); }}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-600 text-gray-300 hover:bg-gray-700 transition-colors"
            >
              {showPayments ? '접기' : '펼치기'}
            </button>
          </div>
          {showPayments && (() => {
            const pageSize = 10;
            const totalPages = Math.ceil(debtPayments.length / pageSize);
            const paged = debtPayments.slice(paymentPage * pageSize, (paymentPage + 1) * pageSize);
            return (
              <>
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
                    {paged.map((p, i) => (
                      <tr key={`${p.date}-${paymentPage}-${i}`} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                        <td className="p-4 text-gray-400">{p.date}</td>
                        <td className="p-4 text-white">{p.category}</td>
                        <td className="p-4 text-right text-white">{formatFullKRW(p.amount)}</td>
                        <td className="p-4 text-right text-green-400">{formatFullKRW(p.principal)}</td>
                        <td className="p-4 text-right text-yellow-400">{p.interest > 0 ? formatFullKRW(p.interest) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 p-4 border-t border-gray-700">
                    <button
                      onClick={() => setPaymentPage(Math.max(0, paymentPage - 1))}
                      disabled={paymentPage === 0}
                      className="px-3 py-1 rounded text-sm text-gray-300 border border-gray-600 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      이전
                    </button>
                    <span className="text-gray-400 text-sm">{paymentPage + 1} / {totalPages}</span>
                    <button
                      onClick={() => setPaymentPage(Math.min(totalPages - 1, paymentPage + 1))}
                      disabled={paymentPage >= totalPages - 1}
                      className="px-3 py-1 rounded text-sm text-gray-300 border border-gray-600 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      다음
                    </button>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* ─── 상환 완납 예상 시점 ─── */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-x-auto">
        <div className="p-5 border-b border-gray-700">
          <h3 className="text-white font-semibold">대출별 완납 예상 시점</h3>
          <p className="text-gray-400 text-xs mt-1">현행 유지 기준 — 각 대출의 순수 상환 스케줄 (snowball 미적용)</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400">
              <th className="text-center p-4">순서</th>
              <th className="text-left p-4">대출명</th>
              <th className="text-center p-4">현재 상태</th>
              <th className="text-right p-4">잔액</th>
              <th className="text-right p-4">월 납부액</th>
              <th className="text-right p-4">원금/이자</th>
              <th className="text-right p-4">남은 기간</th>
              <th className="text-right p-4">예상 완납</th>
              <th className="text-right p-4">남은 총 이자</th>
            </tr>
          </thead>
          <tbody>
            {repaymentOrder.map((item, idx) => {
              const proj = projections.find(p => p.name === item.name);
              const isGrace = (proj?.graceMonthsLeft ?? 0) > 0;
              return (
                <tr key={item.name} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="p-4 text-center">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                      idx === 0 ? 'bg-green-500/20 text-green-400' :
                      idx === 1 ? 'bg-blue-500/20 text-blue-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>{idx + 1}</span>
                  </td>
                  <td className="p-4 text-white font-medium">{item.name}</td>
                  <td className="p-4 text-center">
                    {isGrace ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-500/20 text-orange-400">
                        거치 {Math.ceil((proj?.graceMonthsLeft ?? 0) / 12)}년 남음
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400">
                        상환 중
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-right text-red-400">{formatKRW(item.remaining)}</td>
                  <td className="p-4 text-right text-white">
                    {isGrace
                      ? <span className="text-orange-400">{formatKRW(proj?.monthlyInterest ?? 0)} <span className="text-xs text-gray-500">(이자만)</span></span>
                      : formatKRW(item.monthlyPayment)}
                  </td>
                  <td className="p-4 text-right text-gray-400 text-xs">
                    {proj && (isGrace
                      ? `0원 / ${formatKRW(proj.monthlyInterest)}`
                      : `${formatKRW(proj.monthlyPrincipal)} / ${formatKRW(proj.monthlyInterest)}`)}
                  </td>
                  <td className="p-4 text-right text-white">
                    {proj && proj.remainingMonths < 999
                      ? `${Math.floor(proj.remainingMonths / 12)}년 ${proj.remainingMonths % 12}개월`
                      : '-'}
                  </td>
                  <td className="p-4 text-right text-blue-400 font-medium">{item.completionDate}</td>
                  <td className="p-4 text-right text-yellow-400">
                    {proj ? formatKRW(proj.totalInterestRemaining) : '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-600 bg-gray-700/30">
              <td colSpan={3} className="p-4 text-white font-semibold">합계</td>
              <td className="p-4 text-right text-red-400 font-semibold">{formatKRW(projections.reduce((s, p) => s + p.remaining, 0))}</td>
              <td className="p-4 text-right text-white font-semibold">{formatKRW(projections.reduce((s, p) => s + p.monthlyPayment, 0))}</td>
              <td className="p-4"></td>
              <td className="p-4"></td>
              <td className="p-4"></td>
              <td className="p-4 text-right text-yellow-400 font-semibold">{formatKRW(projections.reduce((s, p) => s + p.totalInterestRemaining, 0))}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ─── 조기 상환 시나리오 비교 ─── */}
      <div className="bg-gray-800 rounded-xl border border-gray-700">
        <div className="p-5 border-b border-gray-700">
          <h3 className="text-white font-semibold">빨리 갚으면 얼마나 유리할까?</h3>
          <p className="text-gray-400 text-xs mt-1">
            추가 상환 시 절약되는 이자와 단축 기간 비교 — 대출 완납 후 상환금이 다음 대출로 자동 이전 (snowball)
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 p-5">
          {scenarios.map((s, i) => {
            const isBase = i === 0;
            return (
              <div
                key={s.label}
                className={`rounded-xl p-4 border ${
                  isBase ? 'border-gray-600 bg-gray-700/30' : 'border-emerald-500/30 bg-emerald-500/5'
                }`}
              >
                <p className={`text-sm font-semibold ${isBase ? 'text-gray-300' : 'text-emerald-400'}`}>
                  {s.label}
                </p>
                <p className="text-gray-400 text-xs mt-1 leading-relaxed">{s.description}</p>
                <div className="mt-3 space-y-2">
                  <div>
                    <p className="text-gray-500 text-xs">월 총 납부액</p>
                    <p className="text-white font-bold">{formatKRW(s.totalMonthlyPayment)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">총 이자</p>
                    <p className="text-white font-bold">{formatKRW(s.totalInterest)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">완납 시점</p>
                    <p className="text-white font-medium text-sm">{s.completionDate}</p>
                  </div>
                  {!isBase && (
                    <>
                      <div className="pt-2 border-t border-gray-600">
                        <p className="text-gray-500 text-xs">이자 절약</p>
                        <p className="text-emerald-400 font-bold">{formatKRW(s.monthlySaved)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">기간 단축</p>
                        <p className="text-emerald-400 font-medium text-sm">
                          {s.timeSavedMonths > 0
                            ? `${Math.floor(s.timeSavedMonths / 12)}년 ${s.timeSavedMonths % 12}개월`
                            : '-'}
                        </p>
                      </div>
                    </>
                  )}
                  {/* 타임라인 이벤트 */}
                  {s.timeline.length > 0 && (
                    <div className="pt-2 border-t border-gray-600 space-y-1">
                      <p className="text-gray-500 text-xs">완납 순서</p>
                      {s.timeline.map((t, ti) => (
                        <div key={ti} className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                          <p className="text-gray-400 text-xs">
                            {t.debtName} <span className="text-blue-400">{t.date}</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {/* 커스텀 추가 상환 입력 카드 */}
          <div className="rounded-xl p-4 border border-purple-500/30 bg-purple-500/5">
            <p className="text-sm font-semibold text-purple-400">직접 입력</p>
            <div className="mt-2 flex items-center gap-1">
              <span className="text-gray-400 text-sm">월</span>
              <input
                type="number"
                value={customInput}
                onChange={(e) => {
                  setCustomInput(e.target.value);
                  const val = parseInt(e.target.value);
                  if (!isNaN(val) && val > 0) setCustomExtra(val * 10000);
                }}
                className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm text-right focus:outline-none focus:border-purple-400"
                min="1"
              />
              <span className="text-gray-400 text-sm">만원</span>
            </div>
            {customScenario && (
              <div className="mt-3 space-y-2">
                <div>
                  <p className="text-gray-500 text-xs">월 총 납부액</p>
                  <p className="text-white font-bold">{formatKRW(customScenario.totalMonthlyPayment)}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">총 이자</p>
                  <p className="text-white font-bold">{formatKRW(customScenario.totalInterest)}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">완납 시점</p>
                  <p className="text-white font-medium text-sm">{customScenario.completionDate}</p>
                </div>
                <div className="pt-2 border-t border-gray-600">
                  <p className="text-gray-500 text-xs">이자 절약</p>
                  <p className="text-purple-400 font-bold">{formatKRW(customScenario.monthlySaved)}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">기간 단축</p>
                  <p className="text-purple-400 font-medium text-sm">
                    {customScenario.timeSavedMonths > 0
                      ? `${Math.floor(customScenario.timeSavedMonths / 12)}년 ${customScenario.timeSavedMonths % 12}개월`
                      : '-'}
                  </p>
                </div>
                {customScenario.timeline.length > 0 && (
                  <div className="pt-2 border-t border-gray-600 space-y-1">
                    <p className="text-gray-500 text-xs">완납 순서</p>
                    {customScenario.timeline.map((t, ti) => (
                      <div key={ti} className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                        <p className="text-gray-400 text-xs">
                          {t.debtName} <span className="text-purple-400">{t.date}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 시나리오별 이자 비교 바 차트 */}
        <div className="px-5 pb-5">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scenarios.map(s => ({ name: s.label, 총이자: s.totalInterest, 절약: s.monthlySaved }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fontSize: 10 }} />
                <YAxis stroke="#9CA3AF" tick={{ fontSize: 11 }} tickFormatter={(v) => formatKRW(v)} />
                <Tooltip
                  formatter={(v) => formatFullKRW(Number(v))}
                  contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                  itemStyle={{ color: '#E5E7EB' }}
                />
                <Bar dataKey="총이자" fill="#EF4444" name="총 이자" radius={[4, 4, 0, 0]} />
                <Bar dataKey="절약" fill="#10B981" name="절약 이자" radius={[4, 4, 0, 0]} />
                <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 상환 전략 요약 카드 */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-800/50 rounded-xl p-5 border border-gray-700">
        <h3 className="text-white font-semibold mb-3">상환 전략 요약</h3>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 w-2 h-2 rounded-full bg-red-400 shrink-0" />
            <p className="text-gray-300">
              현행 유지 시 (거치기간 이자만 + 주담대 원리금균등) 총 <span className="text-yellow-400 font-semibold">{formatKRW(scenarios[0]?.totalInterest || 0)}</span>의
              이자를 지불하게 됩니다.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
            <p className="text-gray-300">
              교직원공제회, 사학연금 완납 시 해당 상환금이 <span className="text-white font-medium">주담대 원금 추가 납입</span>으로
              자동 전환됩니다 (snowball 효과).
            </p>
          </div>
          {scenarios.length > 1 && scenarios[1].monthlySaved > 0 && (
            <div className="flex items-start gap-3">
              <span className="mt-0.5 w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <p className="text-gray-300">
                월 50만원만 추가 상환해도 <span className="text-emerald-400 font-semibold">{formatKRW(scenarios[1].monthlySaved)}</span>의
                이자를 절약하고, 완납을 <span className="text-emerald-400 font-semibold">
                  {scenarios[1].timeSavedMonths > 0
                    ? `${Math.floor(scenarios[1].timeSavedMonths / 12)}년 ${scenarios[1].timeSavedMonths % 12}개월`
                    : '0개월'}
                </span> 앞당길 수 있습니다.
              </p>
            </div>
          )}
          {scenarios.length > 4 && scenarios[4].monthlySaved > 0 && (
            <div className="flex items-start gap-3">
              <span className="mt-0.5 w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <p className="text-gray-300">
                월 300만원 추가 상환 시 <span className="text-emerald-400 font-semibold">{formatKRW(scenarios[4].monthlySaved)}</span> 절약,{' '}
                <span className="text-emerald-400 font-semibold">
                  {scenarios[4].timeSavedMonths > 0
                    ? `${Math.floor(scenarios[4].timeSavedMonths / 12)}년 ${scenarios[4].timeSavedMonths % 12}개월`
                    : '0개월'}
                </span> 단축 가능합니다.
              </p>
            </div>
          )}
          <div className="flex items-start gap-3">
            <span className="mt-0.5 w-2 h-2 rounded-full bg-blue-400 shrink-0" />
            <p className="text-gray-300">
              현행 기준 <span className="text-white font-medium">{repaymentOrder[0]?.name}</span>이
              가장 먼저 (<span className="text-blue-400">{repaymentOrder[0]?.completionDate}</span>) 완납 예정입니다.
            </p>
          </div>
        </div>
      </div>

      {/* ─── 월별 상환 스케줄 ─── */}
      <div className="bg-gray-800 rounded-xl border border-gray-700">
        <div className="p-5 border-b border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-white font-semibold">월별 상환 스케줄</h3>
            <p className="text-gray-400 text-xs mt-1">시나리오별 상세 상환 내역 ({schedule.length}개월)</p>
          </div>
          <select
            value={selectedScenario}
            onChange={(e) => { setSelectedScenario(Number(e.target.value)); setSchedulePage(0); }}
            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-400"
          >
            <option value={0}>현행 유지</option>
            <option value={1}>월 50만원 추가</option>
            <option value={2}>월 100만원 추가</option>
            <option value={3}>월 200만원 추가</option>
            <option value={4}>월 300만원 추가</option>
            <option value={5}>직접입력 ({Math.round(customExtra / 10000)}만원)</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          {(() => {
            const pageSize = 12;
            const totalPages = Math.ceil(schedule.length / pageSize);
            const paged = schedule.slice(schedulePage * pageSize, (schedulePage + 1) * pageSize);

            const findLoan = (row: typeof schedule[0], keyword: string) =>
              row.loans.find(l => l.name.includes(keyword));

            return (
              <>
                <table className="w-full text-xs whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-gray-700 text-gray-500">
                      <th rowSpan={2} className="p-2 text-center sticky left-0 bg-gray-800 z-10 border-r border-gray-700">월</th>
                      <th colSpan={3} className="p-2 text-center border-r border-gray-700 text-yellow-400">주택담보대출</th>
                      <th colSpan={2} className="p-2 text-center border-r border-gray-700 text-red-400">교직원공제회</th>
                      <th colSpan={2} className="p-2 text-center border-r border-gray-700 text-blue-400">사학연금</th>
                      <th colSpan={4} className="p-2 text-center border-r border-gray-700 text-white">합계</th>
                      <th colSpan={4} className="p-2 text-center text-gray-300">지표</th>
                    </tr>
                    <tr className="border-b border-gray-600 text-gray-400">
                      <th className="p-2 text-right">원금</th>
                      <th className="p-2 text-right">이자</th>
                      <th className="p-2 text-right border-r border-gray-700">수수료</th>
                      <th className="p-2 text-right">원금</th>
                      <th className="p-2 text-right border-r border-gray-700">이자</th>
                      <th className="p-2 text-right">원금</th>
                      <th className="p-2 text-right border-r border-gray-700">이자</th>
                      <th className="p-2 text-right">원금</th>
                      <th className="p-2 text-right">이자</th>
                      <th className="p-2 text-right">수수료</th>
                      <th className="p-2 text-right border-r border-gray-700">납부</th>
                      <th className="p-2 text-right">상환율</th>
                      <th className="p-2 text-right">부채</th>
                      <th className="p-2 text-right">지분</th>
                      <th className="p-2 text-right">순자산</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((row) => {
                      const mortgage = findLoan(row, '주택담보');
                      const teacher = findLoan(row, '교직원');
                      const pension = findLoan(row, '사학연금');
                      return (
                        <tr key={row.month} className="border-b border-gray-700/50 hover:bg-gray-700/20">
                          <td className="p-2 text-center text-gray-300 sticky left-0 bg-gray-800 z-10 border-r border-gray-700 font-medium">
                            {row.date}
                          </td>
                          <td className="p-2 text-right text-green-400">{mortgage?.principalPaid ? formatKRW(mortgage.principalPaid) : '-'}</td>
                          <td className="p-2 text-right text-yellow-400">{mortgage?.interestPaid ? formatKRW(mortgage.interestPaid) : '-'}</td>
                          <td className="p-2 text-right text-orange-400 border-r border-gray-700">{mortgage?.penaltyPaid ? formatKRW(mortgage.penaltyPaid) : '-'}</td>
                          <td className="p-2 text-right text-green-400">{teacher?.principalPaid ? formatKRW(teacher.principalPaid) : '-'}</td>
                          <td className="p-2 text-right text-yellow-400 border-r border-gray-700">{teacher?.interestPaid ? formatKRW(teacher.interestPaid) : '-'}</td>
                          <td className="p-2 text-right text-green-400">{pension?.principalPaid ? formatKRW(pension.principalPaid) : '-'}</td>
                          <td className="p-2 text-right text-yellow-400 border-r border-gray-700">{pension?.interestPaid ? formatKRW(pension.interestPaid) : '-'}</td>
                          <td className="p-2 text-right text-green-400 font-medium">{formatKRW(row.totalPrincipalPaid)}</td>
                          <td className="p-2 text-right text-yellow-400">{formatKRW(row.totalInterestPaid)}</td>
                          <td className="p-2 text-right text-orange-400">{row.totalPenaltyPaid > 0 ? formatKRW(row.totalPenaltyPaid) : '-'}</td>
                          <td className="p-2 text-right text-white font-medium border-r border-gray-700">{formatKRW(row.totalPayment)}</td>
                          <td className="p-2 text-right text-blue-400">{row.repaymentRate}%</td>
                          <td className="p-2 text-right text-red-400">{row.debtRatio}%</td>
                          <td className="p-2 text-right text-green-400">{row.equityRate}%</td>
                          <td className="p-2 text-right text-white">{formatKRW(row.netWorth)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 p-4 border-t border-gray-700">
                    <button
                      onClick={() => setSchedulePage(0)}
                      disabled={schedulePage === 0}
                      className="px-2 py-1 rounded text-xs text-gray-300 border border-gray-600 hover:bg-gray-700 disabled:opacity-40"
                    >
                      처음
                    </button>
                    <button
                      onClick={() => setSchedulePage(Math.max(0, schedulePage - 1))}
                      disabled={schedulePage === 0}
                      className="px-3 py-1 rounded text-xs text-gray-300 border border-gray-600 hover:bg-gray-700 disabled:opacity-40"
                    >
                      이전
                    </button>
                    <span className="text-gray-400 text-xs">
                      {schedulePage * pageSize + 1}~{Math.min((schedulePage + 1) * pageSize, schedule.length)}월 / {schedule.length}월
                    </span>
                    <button
                      onClick={() => setSchedulePage(Math.min(totalPages - 1, schedulePage + 1))}
                      disabled={schedulePage >= totalPages - 1}
                      className="px-3 py-1 rounded text-xs text-gray-300 border border-gray-600 hover:bg-gray-700 disabled:opacity-40"
                    >
                      다음
                    </button>
                    <button
                      onClick={() => setSchedulePage(totalPages - 1)}
                      disabled={schedulePage >= totalPages - 1}
                      className="px-2 py-1 rounded text-xs text-gray-300 border border-gray-600 hover:bg-gray-700 disabled:opacity-40"
                    >
                      끝
                    </button>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
