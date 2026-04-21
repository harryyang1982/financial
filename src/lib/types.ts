// 시트 "현재 투자상태"의 각 행에 대응하는 통합 자산 타입
export interface Asset {
  category: string;       // 대범주: 코인, 증권, 부동산
  name: string;           // 자산명
  account: string;        // 계좌/거래소
  accountType: string;    // 계좌종류: 연금저축, IRP, ISA, 일반, 거래소, 현물
  quantity: number;        // 보유수
  avgPrice: number;       // 평단
  investedAmount: number;  // 투자금액
  currentValue: number;    // 현재가
  profit: number;          // 총 수익
  profitRate: number;      // 총 수익률 (%)
  country: string;         // 투자 국가
  assetClass: string;      // 자산대범주: 코인, 성장주, 배당주, 기술주, 채권, 원자재, 부동산 등
  assetSubClass: string;   // 자산중범주
  currency: string;        // 통화: KRW, USD
  type: string;            // 형태: ETF, 개별주, 코인, 현물
}

export interface CategorySummary {
  name: string;
  value: number;
  color: string;
}

// 포트폴리오 비중 2026 시트 - 자산대범주별 목표
export interface AllocationTarget {
  country: string;         // 투자 국가
  assetClass: string;      // 자산대범주
  currentValue: number;    // 현재가
  currentWeight: number;   // 현재 비중 (%)
  targetWeight: number;    // 목표 비중 (%)
  targetAmount180: number; // 1.8억 기준 목표
  gap180: number;          // 1.8억 기준 추가 금액
  targetAmount200: number; // 2.0억 기준 목표
  gap200: number;          // 2.0억 기준 추가 금액
}

// 포트폴리오 비중 2026 시트 - 자산중범주별 목표
export interface SubAllocationTarget {
  country: string;
  assetClass: string;
  assetSubClass: string;
  currentValue: number;
  currentWeight: number;
  targetWeight: number;
  targetAmount180: number;
  gap180: number;
  targetAmount200: number;
}

// 성장 전망 시트
export interface GrowthRecord {
  year: string;
  returnRate: number;
  amount: number;
  contribution: number;
  inflation: number;
  presentValue: number;
  dividendIncome: number;
  dividendReinvest: number;
  withdrawal: number;
}

// 부채 (대출) 정보
export interface Debt {
  name: string;           // 대출 종류
  principal: number;      // 원금
  paid: number;           // 상환액
  remaining: number;      // 잔금
  interestPaid: number;   // 상환 이자
  paidRate: number;       // 상환율 (%)
  interestRate: number;   // 금리 (%)
  terms: string;          // 상환 조건
  priority: number;       // 상환 우선순위
}

// 부채 상환 내역
export interface DebtPayment {
  date: string;           // 일자
  category: string;       // 종류
  amount: number;         // 금액
  principal: number;      // 원금
  interest: number;       // 이자
}

// 부채 요약
export interface DebtSummary {
  totalDebt: number;      // 총부채
  equity: number;         // 자본
  remainingDebt: number;  // 잔여 부채
  totalPaid: number;      // 상환액
  equityRate: number;     // 아파트 지분율 (%)
  paidRate: number;       // 상환율 (%)
}

export interface PortfolioData {
  assets: Asset[];
  allocationTargets: AllocationTarget[];
  subAllocationTargets: SubAllocationTarget[];
  growthRecords: GrowthRecord[];
  debts: Debt[];
  debtPayments: DebtPayment[];
  debtSummary: DebtSummary | null;
}
