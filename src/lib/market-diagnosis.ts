// ── 시황 진단 엔진 (strategy 페이지 & 대시보드 공용) ──────────

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

export const MARKET_DATE = '2026.03.12';

const SCENARIO_NAMES: Record<string, string> = {
  baseline: '기본 전략 (현행 배당성장)',
  alpha: '공격적 알파 강화',
  defensive: '방어적 배당 집중',
  stagflation: '스태그플레이션 방어',
};

export function diagnoseMarket(): Diagnosis {
  const scores: Record<string, number> = {
    baseline: 0,
    alpha: 0,
    defensive: 0,
    stagflation: 0,
  };

  // 1) 유가: 급등 → stagflation/defensive 유리
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

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const topId = sorted[0][0];
  const topScore = sorted[0][1];
  const maxPossible = 15;
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
    summary: summaryMap[topId],
    reasons: reasonMap[topId],
    rebalanceUrgency,
    rebalanceNote,
  };
}
