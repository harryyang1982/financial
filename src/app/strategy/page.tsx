'use client';

import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { usePortfolio } from '@/lib/usePortfolio';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import RefreshButton from '@/components/RefreshButton';
import { formatKRW, formatFullKRW, getInvestmentAssets, calcTotalValue, ASSET_CLASS_COLORS } from '@/lib/utils';
import { Asset } from '@/lib/types';

// ── 시황 지표 ──────────────────────────────────────────────
interface MarketIndicator {
  name: string;
  value: string;
  trend: 'up' | 'down' | 'stable';
  signal: 'positive' | 'neutral' | 'caution' | 'danger';
  detail: string;
}

const MARKET_DATE = '2026.03.12';

const MARKET_INDICATORS: MarketIndicator[] = [
  {
    name: 'WTI 유가',
    value: '$87~95/bbl',
    trend: 'up',
    signal: 'danger',
    detail: '이란-미국 갈등으로 호르무즈 해협 위기. 3Q $80 이하 전망이나 지정학 불확실성 지속.',
  },
  {
    name: '금 가격',
    value: '$5,141/oz',
    trend: 'up',
    signal: 'caution',
    detail: '사상 최고가. 안전자산 수요 급증. 기저 불확실성 반영.',
  },
  {
    name: '미국 CPI',
    value: '2.4%',
    trend: 'stable',
    signal: 'caution',
    detail: '2월 기준. Fed 목표 2% 상회. 유가 급등 반영 전이라 상방 압력 잠재.',
  },
  {
    name: '한국 CPI',
    value: '2.0%',
    trend: 'stable',
    signal: 'neutral',
    detail: '2월 기준. 물가 안정 구간이나 유가 전이 효과 모니터링 필요.',
  },
  {
    name: '미국 금리',
    value: '3.50~3.75%',
    trend: 'stable',
    signal: 'neutral',
    detail: 'Fed 동결 지속. 인하 기대 후퇴. 인플레 재발 시 인상 가능성도 논의.',
  },
  {
    name: '한국 금리',
    value: '2.50%',
    trend: 'stable',
    signal: 'neutral',
    detail: '5회 연속 동결. GDP 2.0% 성장 전망. 완화적 기조 유지.',
  },
  {
    name: 'S&P 500',
    value: 'YTD -0.2%',
    trend: 'stable',
    signal: 'neutral',
    detail: 'Forward PE 21.8 (5년 평균 20.0 상회). EPS 성장 14~15% 전망. 밸류 부담.',
  },
  {
    name: 'KOSPI',
    value: 'YTD +47%',
    trend: 'up',
    signal: 'caution',
    detail: '반도체 랠리 후 -12% 급락. 이란 갈등 충격. 단기 변동성 확대.',
  },
  {
    name: 'USD/KRW',
    value: '1,466원',
    trend: 'up',
    signal: 'caution',
    detail: '변동성 확대. 3월 초 1,498 고점 기록. 강달러 지속 시 환차손 리스크.',
  },
];

const SIGNAL_COLORS: Record<string, string> = {
  positive: 'text-green-400',
  neutral: 'text-blue-400',
  caution: 'text-yellow-400',
  danger: 'text-red-400',
};

const SIGNAL_BG: Record<string, string> = {
  positive: 'bg-green-400/10 border-green-400/30',
  neutral: 'bg-blue-400/10 border-blue-400/30',
  caution: 'bg-yellow-400/10 border-yellow-400/30',
  danger: 'bg-red-400/10 border-red-400/30',
};

const TREND_ICON: Record<string, string> = {
  up: '▲',
  down: '▼',
  stable: '●',
};

// ── 시나리오 정의 (국가+자산군 단위) ─────────────────────────
interface ScenarioWeight {
  country: string;
  assetClass: string;
  weight: number;
}

interface Scenario {
  id: string;
  name: string;
  description: string;
  color: string;
  weights: ScenarioWeight[];
  expectedReturn: number;
  usdRatio: number; // USD 비중 %
}

const SCENARIOS: Scenario[] = [
  {
    id: 'baseline',
    name: '기본 전략 (현행 배당성장)',
    description: '배당성장 40% 코어 + 기술·성장 35% 알파. 올웨더 채권·원자재 방어. 현행 전략 유지.',
    color: '#3B82F6',
    expectedReturn: 10,
    usdRatio: 60,
    weights: [
      { country: '미국', assetClass: '배당주', weight: 22 },
      { country: '미국', assetClass: '기술주', weight: 20 },
      { country: '한국', assetClass: '배당주', weight: 18 },
      { country: '미국', assetClass: '성장주', weight: 9 },
      { country: '전세계', assetClass: '전세계', weight: 7 },
      { country: '미국', assetClass: '채권', weight: 5 },
      { country: '가상', assetClass: '코인', weight: 5 },
      { country: '한국', assetClass: '기술주', weight: 3 },
      { country: '한국', assetClass: '성장주', weight: 3 },
      { country: '한국', assetClass: '원자재', weight: 3 },
      { country: '미국', assetClass: '원자재', weight: 2 },
      { country: '미국', assetClass: '바이오', weight: 2 },
      { country: '한국', assetClass: '인프라', weight: 1 },
    ],
  },
  {
    id: 'alpha',
    name: '공격적 알파 강화',
    description: '경기 호황·강달러 국면. 기술주·성장주 확대, 배당 일부 축소. USD 비중 상향으로 환차익 추구.',
    color: '#10B981',
    expectedReturn: 13,
    usdRatio: 63,
    weights: [
      { country: '미국', assetClass: '기술주', weight: 25 },
      { country: '미국', assetClass: '배당주', weight: 18 },
      { country: '한국', assetClass: '배당주', weight: 14 },
      { country: '미국', assetClass: '성장주', weight: 12 },
      { country: '전세계', assetClass: '전세계', weight: 8 },
      { country: '가상', assetClass: '코인', weight: 6 },
      { country: '한국', assetClass: '기술주', weight: 4 },
      { country: '미국', assetClass: '바이오', weight: 3 },
      { country: '미국', assetClass: '채권', weight: 3 },
      { country: '한국', assetClass: '성장주', weight: 3 },
      { country: '미국', assetClass: '원자재', weight: 2 },
      { country: '한국', assetClass: '원자재', weight: 2 },
    ],
  },
  {
    id: 'defensive',
    name: '방어적 배당 집중',
    description: '경기 둔화·불확실성 국면. 배당주·채권 확대, 기술주 축소. KRW 비중 높여 환리스크 방어.',
    color: '#F59E0B',
    expectedReturn: 7,
    usdRatio: 58,
    weights: [
      { country: '미국', assetClass: '배당주', weight: 24 },
      { country: '한국', assetClass: '배당주', weight: 22 },
      { country: '미국', assetClass: '기술주', weight: 13 },
      { country: '미국', assetClass: '채권', weight: 10 },
      { country: '미국', assetClass: '성장주', weight: 7 },
      { country: '전세계', assetClass: '전세계', weight: 5 },
      { country: '한국', assetClass: '원자재', weight: 5 },
      { country: '미국', assetClass: '원자재', weight: 3 },
      { country: '가상', assetClass: '코인', weight: 3 },
      { country: '한국', assetClass: '인프라', weight: 3 },
      { country: '한국', assetClass: '기술주', weight: 2 },
      { country: '한국', assetClass: '성장주', weight: 2 },
      { country: '미국', assetClass: '바이오', weight: 1 },
    ],
  },
  {
    id: 'stagflation',
    name: '스태그플레이션 방어',
    description: '저성장·고물가. 실물자산(원자재·인프라) 극대화, 배당 유지, 성장자산 최소화. KRW 비중 최대.',
    color: '#EF4444',
    expectedReturn: 5,
    usdRatio: 49,
    weights: [
      { country: '한국', assetClass: '배당주', weight: 24 },
      { country: '미국', assetClass: '배당주', weight: 22 },
      { country: '한국', assetClass: '원자재', weight: 8 },
      { country: '미국', assetClass: '기술주', weight: 8 },
      { country: '미국', assetClass: '채권', weight: 8 },
      { country: '한국', assetClass: '인프라', weight: 8 },
      { country: '미국', assetClass: '원자재', weight: 5 },
      { country: '미국', assetClass: '성장주', weight: 5 },
      { country: '전세계', assetClass: '전세계', weight: 5 },
      { country: '가상', assetClass: '코인', weight: 2 },
      { country: '한국', assetClass: '기술주', weight: 2 },
      { country: '한국', assetClass: '성장주', weight: 2 },
      { country: '미국', assetClass: '바이오', weight: 1 },
    ],
  },
];

// ── 시황 기반 진단 엔진 ─────────────────────────────────────
interface Diagnosis {
  recommendedId: string;
  confidence: number;
  summary: string;
  reasons: string[];
}

function diagnoseMarket(): Diagnosis {
  // 점수 체계: 각 시나리오에 대한 적합도 점수
  const scores: Record<string, number> = {
    baseline: 0,
    alpha: 0,
    defensive: 0,
    stagflation: 0,
  };

  // 1) 유가: 급등 → stagflation/defensive 유리
  // WTI $87-95 (급등)
  scores.stagflation += 3;
  scores.defensive += 2;
  scores.baseline += 0;
  scores.alpha -= 1;

  // 2) 금 사상 최고: 불확실성 → defensive 유리
  scores.defensive += 2;
  scores.stagflation += 2;
  scores.baseline += 0;
  scores.alpha -= 1;

  // 3) 미국 CPI 2.4% (목표 상회, 상방 압력)
  scores.stagflation += 1;
  scores.defensive += 1;
  scores.baseline += 0;
  scores.alpha -= 1;

  // 4) 한국 CPI 2.0% (안정)
  scores.baseline += 1;
  scores.defensive += 0;

  // 5) 금리 동결 (인하 기대 후퇴)
  scores.defensive += 1;
  scores.baseline += 1;
  scores.alpha -= 1;

  // 6) S&P 500 보합, Forward PE 21.8 (고평가)
  scores.defensive += 1;
  scores.baseline += 0;
  scores.alpha -= 1;

  // 7) EPS 성장 14-15% (양호) → 완전한 침체는 아님
  scores.baseline += 2;
  scores.alpha += 1;
  scores.defensive += 0;
  scores.stagflation -= 1;

  // 8) KOSPI +47% YTD 후 -12% 급락 (변동성)
  scores.defensive += 1;
  scores.baseline += 0;
  scores.alpha -= 1;

  // 9) USD/KRW 1,466 (변동성 확대, 강달러)
  scores.defensive += 1;
  scores.stagflation += 1;
  scores.alpha += 0;

  // 최고 점수 시나리오 선택
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const topId = sorted[0][0];
  const topScore = sorted[0][1];
  const maxPossible = 15; // 대략적 최대 점수
  const confidence = Math.min(95, Math.round((topScore / maxPossible) * 100));

  const reasonMap: Record<string, string[]> = {
    defensive: [
      '유가 급등 + 중동 지정학 리스크로 인플레이션 상방 압력',
      '금 가격 사상 최고가 — 시장 불확실성 신호',
      'EPS 성장 14~15%로 양호하나 S&P 500 Forward PE 21.8 고평가 부담',
      'Fed 금리 동결 장기화, 인하 기대 후퇴',
      'KOSPI 급락·USD/KRW 변동성 확대로 환리스크 관리 필요',
    ],
    stagflation: [
      '유가 $87~95로 급등, 인플레이션 재발 위험',
      '미국 CPI 2.4%로 목표 상회, 유가 반영 전이라 추가 상승 가능',
      '금 사상 최고가로 실물자산 선호 뚜렷',
      'Fed 인상 재논의 가능성, 성장자산 부담',
    ],
    baseline: [
      'EPS 성장 14~15%로 펀더멘털 양호',
      '한국 CPI 2.0% 안정, 금리 동결로 정책 불확실성 제한적',
      '기존 배당성장 전략의 올웨더 특성이 현 변동성에 유효',
    ],
    alpha: [
      'EPS 성장률 양호, 기술주 실적 기대감 유지',
      'AI 투자 지속으로 기술주 장기 성장 동력 존재',
    ],
  };

  const summaryMap: Record<string, string> = {
    defensive: '유가 급등과 지정학 불확실성이 단기 핵심 리스크. 배당주·채권 비중을 높이고 기술주 추가 매수를 자제하며, KRW 자산 확대로 환리스크를 낮추는 방어적 전략이 적합합니다.',
    stagflation: '유가·물가 동반 상승으로 스태그플레이션 초기 신호. 원자재·인프라 실물자산 확대와 배당 방어가 핵심입니다.',
    baseline: '펀더멘털은 양호하지만 외부 변수 불확실. 현행 배당성장 올웨더 전략을 유지하며 상황 관망이 적합합니다.',
    alpha: '기업 실적 호조와 기술주 모멘텀이 지속. 성장 베팅을 확대할 수 있는 환경입니다.',
  };

  return {
    recommendedId: topId,
    confidence,
    summary: summaryMap[topId],
    reasons: reasonMap[topId],
  };
}

// ── 유틸리티 ───────────────────────────────────────────────
function calcCurrentWeightsByCountry(assets: Asset[]): Record<string, { value: number; weight: number }> {
  const investmentAssets = assets.filter((a) => a.category !== '부동산');
  const total = investmentAssets.reduce((s, a) => s + a.currentValue, 0);
  const groups: Record<string, number> = {};
  investmentAssets.forEach((a) => {
    const key = `${a.country}_${a.assetClass}`;
    groups[key] = (groups[key] || 0) + a.currentValue;
  });
  const result: Record<string, { value: number; weight: number }> = {};
  for (const [key, val] of Object.entries(groups)) {
    result[key] = { value: val, weight: total > 0 ? (val / total) * 100 : 0 };
  }
  return result;
}

// ── 메인 컴포넌트 ──────────────────────────────────────────
export default function StrategyPage() {
  const { data, loading, refresh } = usePortfolio();
  const diagnosis = useMemo(() => diagnoseMarket(), []);
  const [selectedId, setSelectedId] = useState(diagnosis.recommendedId);

  const scenario = SCENARIOS.find((s) => s.id === selectedId)!;
  const currentWeights = useMemo(() => calcCurrentWeightsByCountry(data.assets), [data.assets]);
  const investmentAssets = getInvestmentAssets(data.assets);
  const totalInvestment = calcTotalValue(investmentAssets);

  // 시나리오 목표 vs 현재 비교
  const comparisonData = useMemo(() => {
    const allKeys = new Set([
      ...Object.keys(currentWeights),
      ...scenario.weights.map((w) => `${w.country}_${w.assetClass}`),
    ]);
    return Array.from(allKeys)
      .map((key) => {
        const [country, assetClass] = key.split('_');
        const current = currentWeights[key]?.weight || 0;
        const target = scenario.weights.find((w) => w.country === country && w.assetClass === assetClass)?.weight || 0;
        return {
          key,
          country,
          assetClass,
          label: `${assetClass} (${country})`,
          현재: Math.round(current * 10) / 10,
          시나리오목표: target,
          gap: target - current,
          currentValue: currentWeights[key]?.value || 0,
          targetValue: totalInvestment * (target / 100),
        };
      })
      .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
  }, [currentWeights, scenario, totalInvestment]);

  // 종목별 조정 가이드
  const assetGuide = useMemo(() => {
    return comparisonData
      .filter((c) => Math.abs(c.gap) > 0.5)
      .map((c) => {
        const adjustAmount = c.targetValue - c.currentValue;
        const matchingAssets = investmentAssets.filter(
          (a) => a.assetClass === c.assetClass && a.country === c.country
        );
        return {
          key: c.key,
          label: c.label,
          assetClass: c.assetClass,
          gap: c.gap,
          adjustAmount,
          assets: matchingAssets.map((a) => ({
            name: a.name,
            account: a.account,
            currentValue: a.currentValue,
            assetSubClass: a.assetSubClass,
          })),
        };
      });
  }, [comparisonData, investmentAssets]);

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">⚙️ 포트폴리오 전략 조정</h1>
          <p className="text-gray-400 text-sm mt-1">경기 시나리오에 따른 자산 배분 전략 시뮬레이션</p>
        </div>
        <RefreshButton onClick={refresh} loading={loading} />
      </div>

      {/* ── 시황 진단 패널 ──────────────────────────────────── */}
      <div className="bg-gray-800 rounded-xl border border-gray-700">
        <div className="p-5 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-white font-semibold">시황 진단</h2>
              <p className="text-gray-500 text-xs mt-0.5">기준일 {MARKET_DATE}</p>
            </div>
            <span className="text-xs text-gray-500 bg-gray-700 px-2 py-1 rounded">
              수동 업데이트 | 주요 지표 변동 시 갱신 권장
            </span>
          </div>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {MARKET_INDICATORS.map((ind) => (
            <div
              key={ind.name}
              className={`p-3 rounded-lg border ${SIGNAL_BG[ind.signal]}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-gray-300 text-xs font-medium">{ind.name}</span>
                <span className={`text-xs ${SIGNAL_COLORS[ind.signal]}`}>
                  {TREND_ICON[ind.trend]} {ind.value}
                </span>
              </div>
              <p className="text-gray-400 text-xs leading-relaxed">{ind.detail}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── 추천 시나리오 배너 ─────────────────────────────── */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-800/80 rounded-xl border-2 border-yellow-500/50 p-5">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
            <span className="text-2xl">🧭</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-white font-semibold">추천 전략: {SCENARIOS.find((s) => s.id === diagnosis.recommendedId)?.name}</h3>
              <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">
                신뢰도 {diagnosis.confidence}%
              </span>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed mb-3">{diagnosis.summary}</p>
            <div className="space-y-1">
              {diagnosis.reasons.map((r, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-gray-400">
                  <span className="text-yellow-500 mt-0.5">•</span>
                  <span>{r}</span>
                </div>
              ))}
            </div>
            {selectedId !== diagnosis.recommendedId && (
              <button
                onClick={() => setSelectedId(diagnosis.recommendedId)}
                className="mt-3 text-xs bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 px-3 py-1.5 rounded-lg transition-colors"
              >
                추천 전략으로 전환
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 시나리오 선택 카드 ────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {SCENARIOS.map((s) => {
          const isRecommended = s.id === diagnosis.recommendedId;
          const isSelected = s.id === selectedId;
          return (
            <button
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className={`text-left p-5 rounded-xl border-2 transition-all relative ${
                isSelected
                  ? 'border-blue-500 bg-gray-800'
                  : 'border-gray-700 bg-gray-800/50 hover:border-gray-500'
              }`}
            >
              {isRecommended && (
                <span className="absolute -top-2 -right-2 text-xs bg-yellow-500 text-gray-900 font-bold px-2 py-0.5 rounded-full">
                  추천
                </span>
              )}
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                <h3 className="text-white font-semibold text-sm">{s.name}</h3>
              </div>
              <p className="text-gray-400 text-xs leading-relaxed">{s.description}</p>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">기대수익률</span>
                  <span className="text-sm font-bold" style={{ color: s.color }}>{s.expectedReturn}%</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500">USD</span>
                  <span className="text-xs text-gray-300">{s.usdRatio}%</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── 현재 vs 시나리오 목표 비중 차트 ──────────────── */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h3 className="text-white font-semibold mb-1">현재 vs {scenario.name} 목표 비중</h3>
        <p className="text-gray-400 text-xs mb-4">부동산 제외 투자 자산 기준 (총 {formatKRW(totalInvestment)}) | USD 목표 비중 {scenario.usdRatio}%</p>
        <div style={{ height: Math.max(320, comparisonData.length * 32) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={comparisonData} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" stroke="#9CA3AF" tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="label" stroke="#9CA3AF" tick={{ fontSize: 11 }} width={120} />
              <Tooltip
                formatter={(v, name) => [`${v}%`, String(name)]}
                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                itemStyle={{ color: '#E5E7EB' }}
              />
              <Legend />
              <Bar dataKey="현재" fill="#6B7280" radius={[0, 4, 4, 0]} />
              <Bar dataKey="시나리오목표" fill={scenario.color} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── 국가+자산군별 조정 테이블 ───────────────────── */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-x-auto">
        <div className="p-5 border-b border-gray-700">
          <h3 className="text-white font-semibold">국가/자산군별 조정 가이드</h3>
          <p className="text-gray-400 text-xs mt-1">양수 = 추가 매수 필요 / 음수 = 비중 초과</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400">
              <th className="text-left p-4">국가</th>
              <th className="text-left p-4">자산군</th>
              <th className="text-right p-4">현재 금액</th>
              <th className="text-right p-4">현재</th>
              <th className="text-right p-4">시나리오 목표</th>
              <th className="text-right p-4">차이</th>
              <th className="text-right p-4">조정 금액</th>
              <th className="text-center p-4">방향</th>
            </tr>
          </thead>
          <tbody>
            {comparisonData.map((row) => {
              const gap = row.gap;
              const adjustAmount = row.targetValue - row.currentValue;
              let direction: string, dirColor: string;
              if (gap > 1) { direction = '매수 ▲'; dirColor = 'text-green-400'; }
              else if (gap < -1) { direction = '축소 ▼'; dirColor = 'text-red-400'; }
              else { direction = '적정 ●'; dirColor = 'text-blue-400'; }

              return (
                <tr key={row.key} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="p-4 text-gray-400">{row.country}</td>
                  <td className="p-4 text-white font-medium">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ASSET_CLASS_COLORS[row.assetClass] || '#6B7280' }} />
                      {row.assetClass}
                    </div>
                  </td>
                  <td className="p-4 text-right text-white">{formatKRW(row.currentValue)}</td>
                  <td className="p-4 text-right text-gray-300">{row.현재.toFixed(1)}%</td>
                  <td className="p-4 text-right text-white font-medium">{row.시나리오목표.toFixed(1)}%</td>
                  <td className={`p-4 text-right font-medium ${gap > 0 ? 'text-green-400' : gap < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                    {gap > 0 ? '+' : ''}{gap.toFixed(1)}%p
                  </td>
                  <td className={`p-4 text-right font-medium ${adjustAmount > 0 ? 'text-green-400' : adjustAmount < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                    {formatFullKRW(Math.round(adjustAmount))}
                  </td>
                  <td className={`p-4 text-center font-medium ${dirColor}`}>{direction}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── 종목별 실행 가이드 ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 매수 가이드 */}
        <div className="bg-gray-800 rounded-xl border border-gray-700">
          <div className="p-5 border-b border-gray-700">
            <h3 className="text-green-400 font-semibold">▲ 매수 대상</h3>
            <p className="text-gray-400 text-xs mt-1">{scenario.name} 시나리오에서 비중을 늘려야 할 자산</p>
          </div>
          <div className="p-4 space-y-4">
            {assetGuide.filter((g) => g.adjustAmount > 0).length === 0 && (
              <p className="text-gray-400 text-sm">매수 대상 없음</p>
            )}
            {assetGuide
              .filter((g) => g.adjustAmount > 0)
              .map((g) => (
                <div key={g.key} className="border-b border-gray-700/50 pb-3 last:border-b-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ASSET_CLASS_COLORS[g.assetClass] || '#6B7280' }} />
                      <span className="text-white font-medium text-sm">{g.label}</span>
                    </div>
                    <span className="text-green-400 font-medium text-sm">+{formatKRW(g.adjustAmount)}</span>
                  </div>
                  {g.assets.length > 0 ? (
                    <div className="ml-5 space-y-1">
                      {g.assets.map((a) => (
                        <div key={`${a.name}-${a.account}`} className="flex items-center justify-between text-xs">
                          <span className="text-gray-300">{a.name} <span className="text-gray-500">({a.assetSubClass})</span></span>
                          <span className="text-gray-400">{formatKRW(a.currentValue)}</span>
                        </div>
                      ))}
                      <p className="text-gray-500 text-xs mt-1">→ 기존 종목 추가 매수 또는 동일 자산군 내 신규 종목 매수 검토</p>
                    </div>
                  ) : (
                    <p className="ml-5 text-gray-500 text-xs">→ 현재 보유 종목 없음. 해당 자산군 신규 편입 필요</p>
                  )}
                </div>
              ))}
          </div>
        </div>

        {/* 축소 가이드 */}
        <div className="bg-gray-800 rounded-xl border border-gray-700">
          <div className="p-5 border-b border-gray-700">
            <h3 className="text-red-400 font-semibold">▼ 축소/관망 대상</h3>
            <p className="text-gray-400 text-xs mt-1">{scenario.name} 시나리오에서 비중을 줄여야 할 자산</p>
          </div>
          <div className="p-4 space-y-4">
            {assetGuide.filter((g) => g.adjustAmount < 0).length === 0 && (
              <p className="text-gray-400 text-sm">축소 대상 없음</p>
            )}
            {assetGuide
              .filter((g) => g.adjustAmount < 0)
              .map((g) => (
                <div key={g.key} className="border-b border-gray-700/50 pb-3 last:border-b-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ASSET_CLASS_COLORS[g.assetClass] || '#6B7280' }} />
                      <span className="text-white font-medium text-sm">{g.label}</span>
                    </div>
                    <span className="text-red-400 font-medium text-sm">{formatKRW(g.adjustAmount)}</span>
                  </div>
                  {g.assets.length > 0 && (
                    <div className="ml-5 space-y-1">
                      {g.assets.map((a) => (
                        <div key={`${a.name}-${a.account}`} className="flex items-center justify-between text-xs">
                          <span className="text-gray-300">{a.name} <span className="text-gray-500">({a.assetSubClass})</span></span>
                          <span className="text-gray-400">{formatKRW(a.currentValue)}</span>
                        </div>
                      ))}
                      <p className="text-gray-500 text-xs mt-1">→ 추가 매수 자제, 자연 리밸런싱 또는 일부 매도 검토</p>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* ── 시나리오별 기대수익 비교 ────────────────────── */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h3 className="text-white font-semibold mb-4">시나리오별 기대수익 비교</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {SCENARIOS.map((s) => {
            const year1 = totalInvestment * (1 + s.expectedReturn / 100);
            const year3 = totalInvestment * Math.pow(1 + s.expectedReturn / 100, 3);
            const year5 = totalInvestment * Math.pow(1 + s.expectedReturn / 100, 5);
            const isRec = s.id === diagnosis.recommendedId;
            return (
              <div
                key={s.id}
                className={`p-4 rounded-lg border ${
                  selectedId === s.id ? 'border-blue-500 bg-gray-700/50' : 'border-gray-700'
                } ${isRec ? 'ring-1 ring-yellow-500/30' : ''}`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-white text-sm font-medium">{s.name}</span>
                  {isRec && <span className="text-yellow-400 text-xs">★</span>}
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400">1년 후</span>
                    <span className="text-white">{formatKRW(year1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">3년 후</span>
                    <span className="text-white">{formatKRW(year3)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">5년 후</span>
                    <span className="text-white font-medium">{formatKRW(year5)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
