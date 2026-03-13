import { Asset, CategorySummary, PortfolioData } from './types';

export function formatKRW(amount: number): string {
  const absAmount = Math.abs(amount);
  if (absAmount >= 100000000) {
    return `${(amount / 100000000).toFixed(1)}억원`;
  }
  if (absAmount >= 10000) {
    return `${Math.round(amount / 10000).toLocaleString()}만원`;
  }
  return `${amount.toLocaleString()}원`;
}

// 항상 #.##억원 형태로 표시 (백만 단위 정밀도)
export function formatKRWEok(amount: number): string {
  return `${(amount / 100000000).toFixed(2)}억원`;
}

export function formatFullKRW(amount: number): string {
  return `₩${amount.toLocaleString()}`;
}

export function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function filterByCategory(assets: Asset[], category: string): Asset[] {
  return assets.filter((a) => a.category === category);
}

export function calcTotalValue(assets: Asset[]): number {
  return assets.reduce((sum, a) => sum + a.currentValue, 0);
}

export function calcTotalInvested(assets: Asset[]): number {
  return assets.reduce((sum, a) => sum + a.investedAmount, 0);
}

export function calcTotalProfit(assets: Asset[]): number {
  return assets.reduce((sum, a) => sum + a.profit, 0);
}

export function calcOverallProfitRate(assets: Asset[]): number {
  const invested = calcTotalInvested(assets);
  if (invested === 0) return 0;
  return (calcTotalProfit(assets) / invested) * 100;
}

export function calcCategorySummary(data: PortfolioData): CategorySummary[] {
  const colorMap: Record<string, string> = {
    '증권': '#3B82F6',
    '코인': '#8B5CF6',
    '부동산': '#F59E0B',
  };
  const groups = new Map<string, number>();
  data.assets.forEach((a) => {
    groups.set(a.category, (groups.get(a.category) || 0) + a.currentValue);
  });
  return Array.from(groups.entries()).map(([name, value]) => ({
    name, value, color: colorMap[name] || '#6B7280',
  }));
}

// 부동산 제외한 투자 자산만
export function getInvestmentAssets(assets: Asset[]): Asset[] {
  return assets.filter((a) => a.category !== '부동산');
}

export function calcAssetClassSummary(data: PortfolioData, excludeRealEstate = false): CategorySummary[] {
  const colorMap: Record<string, string> = {
    '기술주': '#3B82F6', '배당주': '#10B981', '성장주': '#F59E0B',
    '코인': '#8B5CF6', '부동산': '#EF4444', '채권': '#6B7280',
    '원자재': '#F97316', '바이오': '#EC4899', '인프라': '#14B8A6', '전세계': '#06B6D4',
  };
  const assets = excludeRealEstate ? getInvestmentAssets(data.assets) : data.assets;
  const groups = new Map<string, number>();
  assets.forEach((a) => {
    groups.set(a.assetClass, (groups.get(a.assetClass) || 0) + a.currentValue);
  });
  return Array.from(groups.entries())
    .map(([name, value]) => ({ name, value, color: colorMap[name] || '#6B7280' }))
    .sort((a, b) => b.value - a.value);
}

export const ASSET_CLASS_COLORS: Record<string, string> = {
  '기술주': '#3B82F6', '배당주': '#10B981', '성장주': '#F59E0B',
  '코인': '#8B5CF6', '부동산': '#EF4444', '채권': '#6B7280',
  '원자재': '#F97316', '바이오': '#EC4899', '인프라': '#14B8A6', '전세계': '#06B6D4',
};

export function calcAccountSummary(data: PortfolioData): CategorySummary[] {
  const colorMap: Record<string, string> = {
    '연금저축': '#3B82F6', 'IRP': '#10B981', 'ISA': '#F59E0B',
    '일반': '#8B5CF6', '거래소': '#EF4444', '현물': '#F97316',
  };
  const groups = new Map<string, number>();
  data.assets.forEach((a) => {
    groups.set(a.accountType, (groups.get(a.accountType) || 0) + a.currentValue);
  });
  return Array.from(groups.entries())
    .map(([name, value]) => ({ name, value, color: colorMap[name] || '#6B7280' }))
    .sort((a, b) => b.value - a.value);
}
