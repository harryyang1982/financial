import { Debt, DebtPayment } from './types';

export interface DebtProjection {
  name: string;
  remaining: number;
  interestRate: number;
  monthlyPayment: number;       // 월 상환액 (원금+이자)
  monthlyPrincipal: number;     // 월 원금 상환분
  monthlyInterest: number;      // 월 이자분
  remainingMonths: number;      // 남은 개월 수
  completionDate: string;       // 예상 완납일 (YYYY-MM)
  totalInterestRemaining: number; // 남은 총 이자
  priority: number;
}

export interface EarlyPayoffComparison {
  label: string;
  description: string;
  totalInterest: number;
  completionDate: string;       // 마지막 대출 완납일
  monthlySaved: number;         // 절약 이자
  timeSavedMonths: number;      // 단축 개월
}

export interface RepaymentTimeline {
  month: string;                // YYYY-MM
  debtName: string;
  event: 'payment' | 'completed';
  remainingAfter: number;
  cumulativePaid: number;
}

/**
 * 월별 상환액 계산 (상환 내역 기반)
 */
export function calcMonthlyPayments(payments: DebtPayment[]): Map<string, { principal: number; interest: number; count: number }> {
  const byCategory = new Map<string, { principal: number; interest: number; count: number }>();

  payments.forEach((p) => {
    // category 이름 정규화 (공백/약칭 차이 대응)
    const key = normalizeDebtName(p.category);
    const existing = byCategory.get(key) || { principal: 0, interest: 0, count: 0 };
    existing.principal += p.principal;
    existing.interest += p.interest;
    existing.count += 1;
    byCategory.set(key, existing);
  });

  return byCategory;
}

/**
 * 대출명 정규화 (상환 내역의 category와 Debt의 name 매칭용)
 */
function normalizeDebtName(name: string): string {
  if (name.includes('공제회') || name.includes('교직원')) return '교직원공제회';
  if (name.includes('사학') || name.includes('연금')) return '사학연금';
  if (name.includes('주담대') || name.includes('주택') || name.includes('하나')) return '주택담보대출';
  return name;
}

/**
 * 원리금균등상환 월 상환액 계산
 */
function calcAmortizationPayment(principal: number, annualRate: number, totalMonths: number): number {
  const monthlyRate = annualRate / 100 / 12;
  if (monthlyRate === 0) return principal / totalMonths;
  return principal * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) /
    (Math.pow(1 + monthlyRate, totalMonths) - 1);
}

/**
 * 상환 조건에서 총 상환 개월 수 파싱
 */
function parseTermsMonths(terms: string): { graceMonths: number; repaymentMonths: number } {
  let graceMonths = 0;
  let repaymentMonths = 0;

  const graceMatch = terms.match(/(\d+)년\s*거치/);
  if (graceMatch) graceMonths = parseInt(graceMatch[1]) * 12;

  const repayMatch = terms.match(/(\d+)년\s*(원리금|상환)/);
  if (repayMatch) repaymentMonths = parseInt(repayMatch[1]) * 12;

  // "30년 원리금균등상환" 같은 패턴
  if (graceMonths === 0 && repaymentMonths === 0) {
    const totalMatch = terms.match(/(\d+)년/);
    if (totalMatch) repaymentMonths = parseInt(totalMatch[1]) * 12;
  }

  return { graceMonths, repaymentMonths };
}

/**
 * 대출별 상환 프로젝션 계산
 */
export function calcDebtProjections(
  debts: Debt[],
  payments: DebtPayment[],
  baseDate: Date = new Date()
): DebtProjection[] {
  const monthlyData = calcMonthlyPayments(payments);
  // 상환 내역이 있는 기간(월 수) 계산
  const months = getDistinctMonths(payments);
  const numMonths = Math.max(months.length, 1);

  return debts.map((debt) => {
    const paymentData = monthlyData.get(normalizeDebtName(debt.name));
    const { repaymentMonths } = parseTermsMonths(debt.terms);
    const monthlyRate = debt.interestRate / 100 / 12;

    let monthlyPayment: number;
    let monthlyPrincipal: number;
    let monthlyInterest: number;

    // 원리금균등상환 조건이 있으면 공식 기반 월 상환액 계산
    const scheduledPayment = repaymentMonths > 0
      ? calcAmortizationPayment(debt.principal, debt.interestRate, repaymentMonths)
      : 0;

    if (paymentData && paymentData.count > 0) {
      // 실제 상환 데이터 기반 평균
      const avgPrincipal = paymentData.principal / numMonths;
      const avgInterest = paymentData.interest / numMonths;
      const avgPayment = avgPrincipal + avgInterest;

      // 실제 평균 상환액이 이자도 못 덮으면, 스케줄 기반으로 폴백
      const currentInterest = debt.remaining * monthlyRate;
      if (avgPayment < currentInterest && scheduledPayment > 0) {
        monthlyPayment = scheduledPayment;
        monthlyInterest = currentInterest;
        monthlyPrincipal = monthlyPayment - monthlyInterest;
      } else {
        monthlyPrincipal = avgPrincipal;
        monthlyInterest = avgInterest;
        monthlyPayment = avgPayment;
      }
    } else if (scheduledPayment > 0) {
      // 상환 조건 기반 계산
      monthlyPayment = scheduledPayment;
      monthlyInterest = debt.remaining * monthlyRate;
      monthlyPrincipal = monthlyPayment - monthlyInterest;
    } else {
      // 기본값
      monthlyInterest = debt.remaining * monthlyRate;
      monthlyPrincipal = 0;
      monthlyPayment = monthlyInterest;
    }

    // 남은 개월 수 계산 (원리금균등 기준 amortization)
    let remainingMonths: number;
    let totalInterestRemaining = 0;

    if (monthlyPrincipal > 0) {
      // 시뮬레이션으로 정확한 개월 수 & 이자 계산
      let balance = debt.remaining;
      remainingMonths = 0;
      while (balance > 0 && remainingMonths < 600) {
        const interest = balance * monthlyRate;
        const principalPart = Math.min(monthlyPayment - interest, balance);
        if (principalPart <= 0) {
          remainingMonths = 999;
          break;
        }
        totalInterestRemaining += interest;
        balance -= principalPart;
        remainingMonths++;
      }
    } else {
      remainingMonths = 999; // 원금 상환 없으면 무한
    }

    const completionDate = addMonths(baseDate, remainingMonths);

    return {
      name: debt.name,
      remaining: debt.remaining,
      interestRate: debt.interestRate,
      monthlyPayment: Math.round(monthlyPayment),
      monthlyPrincipal: Math.round(monthlyPrincipal),
      monthlyInterest: Math.round(monthlyInterest),
      remainingMonths,
      completionDate: remainingMonths >= 999 ? '-' : formatMonth(completionDate),
      totalInterestRemaining: Math.round(totalInterestRemaining),
      priority: debt.priority,
    };
  });
}

/**
 * 조기 상환 비교 분석
 * - 현행 유지
 * - 추가 상환 시나리오들
 */
export function calcEarlyPayoffScenarios(
  debts: Debt[],
  projections: DebtProjection[],
  baseDate: Date = new Date()
): EarlyPayoffComparison[] {
  const scenarios: EarlyPayoffComparison[] = [];

  // 1. 현행 유지 — 전체 시뮬레이션으로 통일
  const currentResult = simulateWithExtra(debts, projections, 0, baseDate);
  const currentTotalInterest = currentResult.totalInterest;
  const currentMaxMonths = currentResult.maxMonths;

  scenarios.push({
    label: '현행 유지',
    description: '현재 상환 페이스 유지',
    totalInterest: currentTotalInterest,
    completionDate: formatMonth(currentResult.completionDate),
    monthlySaved: 0,
    timeSavedMonths: 0,
  });

  // 2. 월 50만원 추가 상환 (우선순위 순)
  const extraAmounts = [500000, 1000000, 2000000];
  const extraLabels = ['월 50만원 추가', '월 100만원 추가', '월 200만원 추가'];
  const extraDescs = ['매월 50만원 추가 상환 (우선순위 순)', '매월 100만원 추가 상환 (우선순위 순)', '매월 200만원 추가 상환 (우선순위 순)'];

  extraAmounts.forEach((extraMonthly, i) => {
    const result = simulateWithExtra(debts, projections, extraMonthly, baseDate);
    scenarios.push({
      label: extraLabels[i],
      description: extraDescs[i],
      totalInterest: result.totalInterest,
      completionDate: formatMonth(result.completionDate),
      monthlySaved: currentTotalInterest - result.totalInterest,
      timeSavedMonths: currentMaxMonths - result.maxMonths,
    });
  });

  return scenarios;
}

/**
 * 추가 상환 시뮬레이션 (우선순위 순서대로 추가 상환)
 */
function simulateWithExtra(
  debts: Debt[],
  projections: DebtProjection[],
  extraMonthly: number,
  baseDate: Date
): { totalInterest: number; maxMonths: number; completionDate: Date } {
  // 우선순위 순 정렬
  const sorted = [...debts].sort((a, b) => a.priority - b.priority);
  const projMap = new Map(projections.map(p => [p.name, p]));

  // 각 대출의 잔액, 월 기본 상환액
  const balances = sorted.map(d => ({
    name: d.name,
    balance: d.remaining,
    rate: d.interestRate / 100 / 12,
    basePayment: projMap.get(d.name)?.monthlyPayment || 0,
  }));

  let totalInterest = 0;
  let month = 0;
  const maxIter = 600;

  while (balances.some(b => b.balance > 0) && month < maxIter) {
    let extraRemaining = extraMonthly;
    month++;

    // 기본 상환 적용
    for (const b of balances) {
      if (b.balance <= 0) continue;
      const interest = b.balance * b.rate;
      totalInterest += interest;
      const principalPart = Math.min(b.basePayment - interest, b.balance);
      b.balance -= Math.max(principalPart, 0);
    }

    // 추가 상환 적용 (우선순위 순)
    for (const b of balances) {
      if (b.balance <= 0 || extraRemaining <= 0) continue;
      const payment = Math.min(extraRemaining, b.balance);
      b.balance -= payment;
      extraRemaining -= payment;
    }
  }

  return {
    totalInterest: Math.round(totalInterest),
    maxMonths: month,
    completionDate: addMonths(baseDate, month),
  };
}

/**
 * 상환 완료 순서 타임라인 생성
 */
export function calcRepaymentOrder(
  debts: Debt[],
  projections: DebtProjection[],
): { name: string; completionDate: string; remaining: number; monthlyPayment: number; priority: number }[] {
  return projections
    .filter(p => p.remainingMonths > 0 && p.remainingMonths < 999)
    .sort((a, b) => a.remainingMonths - b.remainingMonths)
    .map((p, idx) => ({
      name: p.name,
      completionDate: p.completionDate,
      remaining: p.remaining,
      monthlyPayment: p.monthlyPayment,
      priority: p.priority,
      order: idx + 1,
    }));
}

// --- 헬퍼 ---

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function formatMonth(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}년 ${m}월`;
}

function getDistinctMonths(payments: DebtPayment[]): string[] {
  const months = new Set<string>();
  payments.forEach(p => {
    const m = p.date.substring(0, 7); // YYYY-MM
    months.add(m);
  });
  return Array.from(months).sort();
}
