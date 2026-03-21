// ── 시황 진단 엔진 (동적 스코어링) ──────────────────────

import { MarketData, MarketIndicatorData } from './market-types';

export type RebalanceUrgency = 'low' | 'medium' | 'high';

export interface Diagnosis {
  recommendedId: string;
  recommendedName: string;
  confidence: number;
  summary: string;
  reasons: string[];
  rebalanceUrgency: RebalanceUrgency;
  rebalanceNote: string;
}

const SCENARIO_NAMES: Record<string, string> = {
  baseline: '기본 전략 (현행 배당성장)',
  alpha: '공격적 알파 강화',
  defensive: '방어적 배당 집중',
  stagflation: '스태그플레이션 방어',
};

type Scores = { baseline: number; alpha: number; defensive: number; stagflation: number };

interface ScoringResult {
  scores: Partial<Scores>;
  reason?: string;
}

// ── 지표별 동적 스코어링 규칙 ─────────────────────────────
const SCORING_RULES: Record<string, (ind: MarketIndicatorData) => ScoringResult> = {
  wti: (ind) => {
    if (ind.value > 90) return { scores: { stagflation: 3, defensive: 2, alpha: -1 }, reason: `WTI $${ind.value.toFixed(0)}/bbl 급등 — 인플레이션 상방 압력 및 지정학 리스크` };
    if (ind.value > 75) return { scores: { stagflation: 1, defensive: 1, baseline: 1 }, reason: `WTI $${ind.value.toFixed(0)}/bbl 상승 구간 — 물가 전이 모니터링 필요` };
    if (ind.value > 60) return { scores: { baseline: 1, alpha: 1 }, reason: `WTI $${ind.value.toFixed(0)}/bbl 안정 — 경제 활동 부담 제한적` };
    return { scores: { alpha: 2, baseline: 1, stagflation: -1 }, reason: `WTI $${ind.value.toFixed(0)}/bbl 저유가 — 소비 여력 확대` };
  },

  gold: (ind) => {
    if (ind.value > 4000) return { scores: { defensive: 2, stagflation: 2, alpha: -1 }, reason: `금 $${Math.round(ind.value).toLocaleString()}/oz 사상 최고가권 — 불확실성 신호` };
    if (ind.value > 3000) return { scores: { defensive: 1, stagflation: 1 }, reason: `금 $${Math.round(ind.value).toLocaleString()}/oz 상승 — 인플레 헤지 수요` };
    return { scores: { baseline: 1, alpha: 1 }, reason: `금 안정 구간 — 리스크 선호 양호` };
  },

  us_cpi: (ind) => {
    if (ind.value > 3.5) return { scores: { stagflation: 2, defensive: 1, alpha: -2 }, reason: `미국 CPI ${ind.value.toFixed(1)}% 급등 — 긴축 강화 가능성` };
    if (ind.value > 2.5) return { scores: { stagflation: 1, defensive: 1, alpha: -1 }, reason: `미국 CPI ${ind.value.toFixed(1)}% 목표 상회 — 상방 압력` };
    if (ind.value > 1.5) return { scores: { baseline: 1 }, reason: `미국 CPI ${ind.value.toFixed(1)}% 안정 구간` };
    return { scores: { alpha: 1, baseline: 1, defensive: -1 }, reason: `미국 CPI ${ind.value.toFixed(1)}% 둔화 — 완화 정책 여지` };
  },

  kr_cpi: (ind) => {
    if (ind.value > 3.0) return { scores: { stagflation: 1, defensive: 1 }, reason: `한국 CPI ${ind.value.toFixed(1)}% 상승 — 물가 압력` };
    if (ind.value > 1.5) return { scores: { baseline: 1 }, reason: `한국 CPI ${ind.value.toFixed(1)}% 안정` };
    return { scores: { alpha: 1, baseline: 1 }, reason: `한국 CPI ${ind.value.toFixed(1)}% 둔화 — 완화 여지` };
  },

  us_rate: (ind) => {
    if (ind.trend === 'up') return { scores: { defensive: 2, stagflation: 1, alpha: -1 }, reason: `미국 금리 ${ind.displayValue} 인상 기조 — 성장자산 부담` };
    if (ind.trend === 'down') return { scores: { alpha: 2, baseline: 1 }, reason: `미국 금리 ${ind.displayValue} 인하 — 유동성 확대 기대` };
    return { scores: { defensive: 1, baseline: 1, alpha: -1 }, reason: `미국 금리 ${ind.displayValue} 동결 — 인하 기대 후퇴` };
  },

  kr_rate: (ind) => {
    if (ind.trend === 'up') return { scores: { defensive: 1, stagflation: 1 }, reason: `한국 금리 ${ind.displayValue} 인상` };
    if (ind.trend === 'down') return { scores: { alpha: 1, baseline: 1 }, reason: `한국 금리 ${ind.displayValue} 인하 — 완화적 기조` };
    return { scores: { baseline: 1 } };
  },

  sp500: (ind) => {
    const changePct = ((ind.value - ind.previousValue) / ind.previousValue) * 100;
    const pe = ind.value / 270;
    if (pe > 23) {
      return { scores: { defensive: 1, alpha: -1 }, reason: `S&P 500 Forward PE ${pe.toFixed(1)} 고평가 — 밸류에이션 부담` };
    }
    if (changePct < -5) return { scores: { defensive: 2, alpha: -1 }, reason: `S&P 500 급락 ${changePct.toFixed(1)}% — 리스크 회피` };
    if (pe < 18) return { scores: { alpha: 2, baseline: 1 }, reason: `S&P 500 Forward PE ${pe.toFixed(1)} 저평가 매력` };
    return { scores: { baseline: 1, alpha: 1 }, reason: `S&P 500 적정 수준 — EPS 성장 양호` };
  },

  kospi: (ind) => {
    const changePct = ((ind.value - ind.previousValue) / ind.previousValue) * 100;
    if (changePct < -5) return { scores: { defensive: 2, alpha: -1 }, reason: `KOSPI 급락 ${changePct.toFixed(1)}% — 단기 변동성 확대` };
    if (changePct > 5) return { scores: { alpha: 1, defensive: 1 }, reason: `KOSPI 급등 ${changePct.toFixed(1)}% — 과열 주의` };
    return { scores: { baseline: 1 } };
  },

  usdkrw: (ind) => {
    if (ind.value > 1450) return { scores: { defensive: 1, stagflation: 1 }, reason: `USD/KRW ${Math.round(ind.value).toLocaleString()}원 — 강달러 극심, 환리스크 관리 필요` };
    if (ind.value > 1350) return { scores: { defensive: 1 }, reason: `USD/KRW ${Math.round(ind.value).toLocaleString()}원 — 강달러 구간` };
    if (ind.value < 1250) return { scores: { alpha: 1, baseline: 1 }, reason: `USD/KRW ${Math.round(ind.value).toLocaleString()}원 — 원화 강세, 해외 매수 유리` };
    return { scores: { baseline: 1 } };
  },
};

// ── 시나리오별 요약 생성 ──────────────────────────────────
const SUMMARY_TEMPLATES: Record<string, string> = {
  defensive: '시장 불확실성이 높은 구간입니다. 배당주·채권 비중을 높이고 기술주 추가 매수를 자제하며, KRW 자산 확대로 환리스크를 낮추는 방어적 전략이 적합합니다.',
  stagflation: '유가·물가 동반 상승으로 스태그플레이션 신호가 감지됩니다. 원자재·인프라 실물자산 확대와 배당 방어가 핵심입니다.',
  baseline: '펀더멘털은 양호하지만 외부 변수 불확실합니다. 현행 배당성장 올웨더 전략을 유지하며 상황 관망이 적합합니다.',
  alpha: '기업 실적 호조와 성장 모멘텀이 지속되고 있습니다. 성장 베팅을 확대할 수 있는 환경입니다.',
};

export function diagnoseMarket(market: MarketData): Diagnosis {
  const scores: Scores = { baseline: 0, alpha: 0, defensive: 0, stagflation: 0 };
  const reasons: string[] = [];
  let scoredIndicators = 0;

  for (const ind of market.indicators) {
    const rule = SCORING_RULES[ind.id];
    if (!rule) continue;
    const result = rule(ind);
    scoredIndicators++;
    for (const [key, val] of Object.entries(result.scores)) {
      scores[key as keyof Scores] += val as number;
    }
    if (result.reason) reasons.push(result.reason);
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const topId = sorted[0][0];
  const topScore = sorted[0][1];
  // 동적으로 maxPossible 계산 (지표 수 × 평균 최대 점수 2)
  const maxPossible = Math.max(scoredIndicators * 2, 1);
  const confidence = Math.min(95, Math.round((topScore / maxPossible) * 100));

  let rebalanceUrgency: RebalanceUrgency;
  let rebalanceNote: string;
  if (topId === 'stagflation') {
    rebalanceUrgency = 'high';
    rebalanceNote = '월 1회 리밸런싱 검토 권장 — 스태그플레이션 신호로 빠른 대응 필요';
  } else if (topId === 'defensive') {
    rebalanceUrgency = 'medium';
    rebalanceNote = '분기 1회 리밸런싱 검토 권장 — 불확실성 확대 구간';
  } else {
    rebalanceUrgency = 'low';
    rebalanceNote = '연 1회 정기 리밸런싱 유지 — 시장 안정적';
  }

  return {
    recommendedId: topId,
    recommendedName: SCENARIO_NAMES[topId],
    confidence,
    summary: SUMMARY_TEMPLATES[topId],
    reasons,
    rebalanceUrgency,
    rebalanceNote,
  };
}
