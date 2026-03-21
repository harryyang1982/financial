// ── 시황 데이터 타입 ──────────────────────────────────────

export interface MarketIndicatorData {
  id: string;
  name: string;
  value: number;
  displayValue: string;
  previousValue: number;
  trend: 'up' | 'down' | 'stable';
  signal: 'positive' | 'neutral' | 'caution' | 'danger';
  detail: string;
}

export interface MarketData {
  indicators: MarketIndicatorData[];
  fetchedAt: string;
  source: 'live' | 'fallback';
}
