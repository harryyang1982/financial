import { MarketData, MarketIndicatorData } from './market-types';
import { FALLBACK_MARKET_DATA } from './market-fallback';

// ── Yahoo Finance ────────────────────────────────────────
async function fetchYahoo(symbol: string): Promise<{ price: number; prevClose: number } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const meta = json.chart?.result?.[0]?.meta;
    if (!meta) return null;
    return {
      price: meta.regularMarketPrice ?? meta.previousClose,
      prevClose: meta.chartPreviousClose ?? meta.previousClose,
    };
  } catch {
    return null;
  }
}

// ── FRED (US CPI, Fed Funds Rate) ────────────────────────
async function fetchFred(seriesId: string): Promise<{ value: number; prevValue: number } | null> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) return null;
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&sort_order=desc&limit=2&api_key=${apiKey}&file_type=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const json = await res.json();
    const obs = json.observations;
    if (!obs || obs.length < 2) return null;
    return {
      value: parseFloat(obs[0].value),
      prevValue: parseFloat(obs[1].value),
    };
  } catch {
    return null;
  }
}

// ── Bank of Korea ECOS ───────────────────────────────────
async function fetchBok(statCode: string, itemCode: string): Promise<{ value: number; prevValue: number } | null> {
  const apiKey = process.env.BOK_API_KEY;
  if (!apiKey) return null;
  try {
    const now = new Date();
    const endMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    // 6개월 전부터 조회
    const startDate = new Date(now);
    startDate.setMonth(startDate.getMonth() - 6);
    const startMonth = `${startDate.getFullYear()}${String(startDate.getMonth() + 1).padStart(2, '0')}`;

    const url = `https://ecos.bok.or.kr/api/StatisticSearch/${apiKey}/json/kr/1/2/${statCode}/M/${startMonth}/${endMonth}/${itemCode}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const json = await res.json();
    const rows = json.StatisticSearch?.row;
    if (!rows || rows.length < 2) return null;
    return {
      value: parseFloat(rows[rows.length - 1].DATA_VALUE),
      prevValue: parseFloat(rows[rows.length - 2].DATA_VALUE),
    };
  } catch {
    return null;
  }
}

// ── 신호 분류 ────────────────────────────────────────────
function classifyTrend(current: number, previous: number, thresholdPct: number = 1): 'up' | 'down' | 'stable' {
  const change = ((current - previous) / previous) * 100;
  if (change > thresholdPct) return 'up';
  if (change < -thresholdPct) return 'down';
  return 'stable';
}

type Signal = 'positive' | 'neutral' | 'caution' | 'danger';

function classifyWti(value: number): { signal: Signal; detail: string } {
  if (value > 90) return { signal: 'danger', detail: `$${value.toFixed(0)}/bbl — 고유가 구간. 인플레이션 상방 압력 및 지정학 리스크.` };
  if (value > 75) return { signal: 'caution', detail: `$${value.toFixed(0)}/bbl — 상승 구간. 물가 전이 효과 모니터링 필요.` };
  if (value > 60) return { signal: 'neutral', detail: `$${value.toFixed(0)}/bbl — 안정 구간. 경제 활동에 부담 제한적.` };
  return { signal: 'positive', detail: `$${value.toFixed(0)}/bbl — 저유가. 소비 여력 확대, 물가 안정 기여.` };
}

function classifyGold(value: number): { signal: Signal; detail: string } {
  if (value > 4000) return { signal: 'caution', detail: `$${value.toLocaleString()}/oz — 사상 최고가권. 안전자산 수요 급증, 불확실성 반영.` };
  if (value > 3000) return { signal: 'neutral', detail: `$${value.toLocaleString()}/oz — 상승 추세. 인플레 헤지 수요 지속.` };
  return { signal: 'positive', detail: `$${value.toLocaleString()}/oz — 안정 구간. 리스크 선호 심리 양호.` };
}

function classifyCpi(value: number, country: string): { signal: Signal; detail: string } {
  if (value > 3.5) return { signal: 'danger', detail: `${value.toFixed(1)}% — ${country} 물가 급등. 긴축 정책 강화 가능성.` };
  if (value > 2.5) return { signal: 'caution', detail: `${value.toFixed(1)}% — ${country} 물가 목표 상회. 상방 압력 잠재.` };
  if (value > 1.5) return { signal: 'neutral', detail: `${value.toFixed(1)}% — ${country} 물가 안정 구간.` };
  return { signal: 'positive', detail: `${value.toFixed(1)}% — ${country} 물가 둔화. 완화적 통화정책 여지.` };
}

function classifyRate(value: number, trend: 'up' | 'down' | 'stable', country: string): { signal: Signal; detail: string } {
  const formatted = value.toFixed(2);
  if (trend === 'up') return { signal: 'caution', detail: `${formatted}% — ${country} 금리 인상 기조. 성장자산 부담.` };
  if (trend === 'down') return { signal: 'positive', detail: `${formatted}% — ${country} 금리 인하. 유동성 확대 기대.` };
  return { signal: 'neutral', detail: `${formatted}% — ${country} 금리 동결. 정책 불확실성 제한적.` };
}

function classifyUsdKrw(value: number): { signal: Signal; detail: string } {
  if (value > 1450) return { signal: 'danger', detail: `${value.toLocaleString()}원 — 강달러 극심. 환차손 리스크 높음.` };
  if (value > 1350) return { signal: 'caution', detail: `${value.toLocaleString()}원 — 강달러 구간. 환리스크 관리 필요.` };
  if (value > 1250) return { signal: 'neutral', detail: `${value.toLocaleString()}원 — 환율 안정 구간.` };
  return { signal: 'positive', detail: `${value.toLocaleString()}원 — 원화 강세. 해외 자산 매수 유리.` };
}

// ── 메인 fetcher ─────────────────────────────────────────
export async function fetchMarketData(): Promise<MarketData> {
  const fallback = (id: string) => FALLBACK_MARKET_DATA.indicators.find(i => i.id === id);

  // 모든 API를 병렬 호출
  const [wti, gold, sp500, kospi, usdkrw, usCpi, usRate, krCpi, krRate] = await Promise.all([
    fetchYahoo('CL=F'),
    fetchYahoo('GC=F'),
    fetchYahoo('^GSPC'),
    fetchYahoo('^KS11'),
    fetchYahoo('KRW=X'),
    fetchFred('CPIAUCSL'),    // US CPI (YoY는 별도 계산 필요, 여기선 최근값 사용)
    fetchFred('FEDFUNDS'),
    fetchBok('021Y125', '0'),  // 한국 CPI
    fetchBok('722Y001', '0101000'), // 한국 기준금리
  ]);

  let liveCount = 0;
  const indicators: MarketIndicatorData[] = [];

  // WTI
  if (wti) {
    liveCount++;
    const trend = classifyTrend(wti.price, wti.prevClose);
    const cls = classifyWti(wti.price);
    indicators.push({ id: 'wti', name: 'WTI 유가', value: wti.price, displayValue: `$${wti.price.toFixed(1)}/bbl`, previousValue: wti.prevClose, trend, ...cls });
  } else {
    indicators.push(fallback('wti')!);
  }

  // Gold
  if (gold) {
    liveCount++;
    const trend = classifyTrend(gold.price, gold.prevClose);
    const cls = classifyGold(gold.price);
    indicators.push({ id: 'gold', name: '금 가격', value: gold.price, displayValue: `$${Math.round(gold.price).toLocaleString()}/oz`, previousValue: gold.prevClose, trend, ...cls });
  } else {
    indicators.push(fallback('gold')!);
  }

  // US CPI — FRED CPIAUCSL은 인덱스이므로 YoY 계산
  if (usCpi) {
    liveCount++;
    // 간략히: 전월 대비 변화율 × 12로 연율화 (정확한 YoY는 12개월 전 데이터 필요)
    const yoy = ((usCpi.value - usCpi.prevValue) / usCpi.prevValue) * 12 * 100;
    const trend = classifyTrend(usCpi.value, usCpi.prevValue, 0.1);
    const cls = classifyCpi(yoy, '미국');
    indicators.push({ id: 'us_cpi', name: '미국 CPI', value: yoy, displayValue: `${yoy.toFixed(1)}%`, previousValue: usCpi.prevValue, trend, ...cls });
  } else {
    indicators.push(fallback('us_cpi')!);
  }

  // Korea CPI
  if (krCpi) {
    liveCount++;
    const trend = classifyTrend(krCpi.value, krCpi.prevValue, 0.3);
    const cls = classifyCpi(krCpi.value, '한국');
    indicators.push({ id: 'kr_cpi', name: '한국 CPI', value: krCpi.value, displayValue: `${krCpi.value.toFixed(1)}%`, previousValue: krCpi.prevValue, trend, ...cls });
  } else {
    indicators.push(fallback('kr_cpi')!);
  }

  // US Rate
  if (usRate) {
    liveCount++;
    const trend = classifyTrend(usRate.value, usRate.prevValue, 0.1);
    const cls = classifyRate(usRate.value, trend, '미국');
    const lo = (Math.floor(usRate.value * 4) / 4).toFixed(2);
    const hi = (Math.ceil(usRate.value * 4) / 4).toFixed(2);
    indicators.push({ id: 'us_rate', name: '미국 금리', value: usRate.value, displayValue: `${lo}~${hi}%`, previousValue: usRate.prevValue, trend, ...cls });
  } else {
    indicators.push(fallback('us_rate')!);
  }

  // Korea Rate
  if (krRate) {
    liveCount++;
    const trend = classifyTrend(krRate.value, krRate.prevValue, 0.1);
    const cls = classifyRate(krRate.value, trend, '한국');
    indicators.push({ id: 'kr_rate', name: '한국 금리', value: krRate.value, displayValue: `${krRate.value.toFixed(2)}%`, previousValue: krRate.prevValue, trend, ...cls });
  } else {
    indicators.push(fallback('kr_rate')!);
  }

  // S&P 500
  if (sp500) {
    liveCount++;
    const trend = classifyTrend(sp500.price, sp500.prevClose);
    const pe = sp500.price / 270; // 대략적 PE 추정 (EPS ~270 기준)
    let signal: Signal = 'neutral';
    let detail = `${sp500.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}pt.`;
    if (pe > 23) { signal = 'caution'; detail += ` Forward PE ${pe.toFixed(1)} 고평가 부담.`; }
    else if (pe > 20) { signal = 'neutral'; detail += ` Forward PE ${pe.toFixed(1)} 적정 수준.`; }
    else { signal = 'positive'; detail += ` Forward PE ${pe.toFixed(1)} 저평가 매력.`; }
    indicators.push({ id: 'sp500', name: 'S&P 500', value: sp500.price, displayValue: sp500.price.toLocaleString(undefined, { maximumFractionDigits: 0 }), previousValue: sp500.prevClose, trend, signal, detail });
  } else {
    indicators.push(fallback('sp500')!);
  }

  // KOSPI
  if (kospi) {
    liveCount++;
    const trend = classifyTrend(kospi.price, kospi.prevClose);
    let signal: Signal = 'neutral';
    let detail = `${kospi.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}pt.`;
    const changePct = ((kospi.price - kospi.prevClose) / kospi.prevClose) * 100;
    if (changePct < -3) { signal = 'danger'; detail += ` 급락 (${changePct.toFixed(1)}%). 변동성 확대.`; }
    else if (changePct < -1) { signal = 'caution'; detail += ` 하락세 (${changePct.toFixed(1)}%).`; }
    else if (changePct > 3) { signal = 'caution'; detail += ` 급등 (${changePct.toFixed(1)}%). 과열 주의.`; }
    else { signal = 'neutral'; detail += ` 보합권 (${changePct > 0 ? '+' : ''}${changePct.toFixed(1)}%).`; }
    indicators.push({ id: 'kospi', name: 'KOSPI', value: kospi.price, displayValue: kospi.price.toLocaleString(undefined, { maximumFractionDigits: 0 }), previousValue: kospi.prevClose, trend, signal, detail });
  } else {
    indicators.push(fallback('kospi')!);
  }

  // USD/KRW
  if (usdkrw) {
    liveCount++;
    const trend = classifyTrend(usdkrw.price, usdkrw.prevClose, 0.5);
    const cls = classifyUsdKrw(usdkrw.price);
    indicators.push({ id: 'usdkrw', name: 'USD/KRW', value: usdkrw.price, displayValue: `${Math.round(usdkrw.price).toLocaleString()}원`, previousValue: usdkrw.prevClose, trend, ...cls });
  } else {
    indicators.push(fallback('usdkrw')!);
  }

  return {
    indicators,
    fetchedAt: new Date().toISOString(),
    source: liveCount > 0 ? 'live' : 'fallback',
  };
}
