import { MarketData } from './market-types';

// 현재 하드코딩된 값을 fallback으로 보존 (API 실패 시 사용)
export const FALLBACK_MARKET_DATA: MarketData = {
  indicators: [
    { id: 'wti', name: 'WTI 유가', value: 91, displayValue: '$91/bbl', previousValue: 80, trend: 'up', signal: 'danger', detail: '이란-미국 갈등으로 호르무즈 해협 위기. 지정학 불확실성 지속.' },
    { id: 'gold', name: '금 가격', value: 5141, displayValue: '$5,141/oz', previousValue: 4800, trend: 'up', signal: 'caution', detail: '사상 최고가. 안전자산 수요 급증.' },
    { id: 'us_cpi', name: '미국 CPI', value: 2.4, displayValue: '2.4%', previousValue: 2.3, trend: 'stable', signal: 'caution', detail: 'Fed 목표 2% 상회. 유가 급등 반영 전.' },
    { id: 'kr_cpi', name: '한국 CPI', value: 2.0, displayValue: '2.0%', previousValue: 2.0, trend: 'stable', signal: 'neutral', detail: '물가 안정 구간.' },
    { id: 'us_rate', name: '미국 금리', value: 3.625, displayValue: '3.50~3.75%', previousValue: 3.625, trend: 'stable', signal: 'neutral', detail: 'Fed 동결 지속. 인하 기대 후퇴.' },
    { id: 'kr_rate', name: '한국 금리', value: 2.5, displayValue: '2.50%', previousValue: 2.5, trend: 'stable', signal: 'neutral', detail: '5회 연속 동결.' },
    { id: 'sp500', name: 'S&P 500', value: 5800, displayValue: '5,800', previousValue: 5810, trend: 'stable', signal: 'neutral', detail: 'Forward PE 21.8. EPS 성장 14~15% 전망.' },
    { id: 'kospi', name: 'KOSPI', value: 2600, displayValue: '2,600', previousValue: 2700, trend: 'down', signal: 'caution', detail: '반도체 랠리 후 급락. 단기 변동성 확대.' },
    { id: 'usdkrw', name: 'USD/KRW', value: 1466, displayValue: '1,466원', previousValue: 1420, trend: 'up', signal: 'caution', detail: '변동성 확대. 강달러 지속 시 환차손 리스크.' },
  ],
  fetchedAt: '2026-03-12T00:00:00Z',
  source: 'fallback',
};
