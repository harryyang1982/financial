import { Debt, DebtPayment } from './types';

// ─── 타입 ───

export interface DebtProjection {
  name: string;
  remaining: number;
  interestRate: number;
  monthlyPayment: number;       // 월 상환액 (원금+이자) — 상환기 기준
  monthlyPrincipal: number;     // 월 원금 상환분
  monthlyInterest: number;      // 월 이자분
  graceMonthsLeft: number;      // 남은 거치 개월
  remainingMonths: number;      // 남은 총 개월 (거치+상환)
  completionDate: string;       // 예상 완납일 (YYYY년 MM월)
  totalInterestRemaining: number;
  priority: number;
}

export interface ScenarioResult {
  label: string;
  description: string;
  totalInterest: number;
  completionDate: string;
  monthlySaved: number;
  timeSavedMonths: number;
  timeline: TimelineEvent[];    // 각 대출 완납 이벤트
}

export interface TimelineEvent {
  month: number;
  date: string;
  debtName: string;
  event: 'completed';
  freedPayment: number;         // 완납 후 다른 대출로 돌릴 수 있는 금액
}

// ─── 대출 조건 파싱 ───

interface LoanTerms {
  graceMonths: number;
  repaymentMonths: number;
}

function parseTerms(terms: string): LoanTerms {
  let graceMonths = 0;
  let repaymentMonths = 0;

  const graceMatch = terms.match(/(\d+)년\s*거치/);
  if (graceMatch) graceMonths = parseInt(graceMatch[1]) * 12;

  const repayMatch = terms.match(/(\d+)년\s*(원리금|상환)/);
  if (repayMatch) repaymentMonths = parseInt(repayMatch[1]) * 12;

  // "30년 원리금균등상환" — 거치 없는 패턴
  if (graceMonths === 0 && repaymentMonths === 0) {
    const totalMatch = terms.match(/(\d+)년/);
    if (totalMatch) repaymentMonths = parseInt(totalMatch[1]) * 12;
  }

  return { graceMonths, repaymentMonths };
}

/**
 * 원리금균등상환 월 상환액
 */
function calcAmortization(principal: number, annualRate: number, totalMonths: number): number {
  const r = annualRate / 100 / 12;
  if (r === 0) return principal / totalMonths;
  return principal * (r * Math.pow(1 + r, totalMonths)) / (Math.pow(1 + r, totalMonths) - 1);
}

// ─── 시뮬레이션 엔진 ───

interface SimLoan {
  name: string;
  balance: number;
  rate: number;             // 월 이자율
  annualRate: number;       // 연 이자율 (%)
  graceLeft: number;        // 남은 거치 개월
  repaymentMonths: number;  // 상환 기간 (개월)
  scheduledPayment: number; // 상환기 월 상환액 (원리금균등)
  priority: number;
  paidOff: boolean;
  paidOffMonth: number;
}

/**
 * 거치기간 남은 개월 수 추정
 * 실제 상환 이력에서 원금 납부가 발생한 대출은 이미 상환기 진입으로 간주
 * 거치기간 대출은 남은 거치 개월을 추정 (대출 시작 ~2026년 1월 가정)
 */
function estimateGraceRemaining(
  debt: Debt,
  terms: LoanTerms,
  baseDate: Date
): number {
  if (terms.graceMonths === 0) return 0;

  // 대출 시작 시점 추정: 2026년 1월 (첫 상환 데이터 기준)
  const loanStart = new Date(2026, 0, 1);
  const monthsElapsed = (baseDate.getFullYear() - loanStart.getFullYear()) * 12 +
    (baseDate.getMonth() - loanStart.getMonth());
  const remaining = Math.max(terms.graceMonths - monthsElapsed, 0);
  return remaining;
}

/**
 * 통합 시뮬레이션: 거치→상환 전환, 눈덩이 효과, 추가 상환 모두 반영
 *
 * @param debts - 대출 목록
 * @param extraMonthly - 매월 추가 상환액 (0이면 현행 유지)
 * @param baseDate - 시뮬레이션 시작일
 */
export function simulateRepayment(
  debts: Debt[],
  extraMonthly: number,
  baseDate: Date = new Date()
): {
  totalInterest: number;
  maxMonths: number;
  completionDate: Date;
  timeline: TimelineEvent[];
  loans: SimLoan[];
} {
  // 대출별 시뮬레이션 상태 초기화
  const loans: SimLoan[] = debts.map(d => {
    const terms = parseTerms(d.terms);
    const graceLeft = estimateGraceRemaining(d, terms, baseDate);
    const r = d.interestRate / 100 / 12;

    // 상환기 월 상환액: 거치 종료 시점의 잔액 기준으로 계산
    // (거치기간 동안 이자만 내므로 원금 = 현재 잔액 그대로)
    const scheduledPayment = terms.repaymentMonths > 0
      ? calcAmortization(d.remaining, d.interestRate, terms.repaymentMonths)
      : 0;

    return {
      name: d.name,
      balance: d.remaining,
      rate: r,
      annualRate: d.interestRate,
      graceLeft,
      repaymentMonths: terms.repaymentMonths,
      scheduledPayment,
      priority: d.priority,
      paidOff: false,
      paidOffMonth: 0,
    };
  });

  let totalInterest = 0;
  let month = 0;
  const maxIter = 600;
  const timeline: TimelineEvent[] = [];

  while (loans.some(l => !l.paidOff) && month < maxIter) {
    month++;
    let snowballExtra = 0; // 완납된 대출에서 풀린 상환금

    // 1단계: 각 대출 기본 상환
    for (const loan of loans) {
      if (loan.paidOff) {
        // 이미 완납된 대출의 상환액은 snowball로 누적
        snowballExtra += loan.scheduledPayment;
        continue;
      }

      const interest = loan.balance * loan.rate;
      totalInterest += interest;

      if (loan.graceLeft > 0) {
        // 거치기간: 이자만 납부, 원금 안 줄어듦
        loan.graceLeft--;

        // 거치 끝나면 상환기 상환액 재계산 (잔액 기준)
        if (loan.graceLeft === 0 && loan.repaymentMonths > 0) {
          loan.scheduledPayment = calcAmortization(
            loan.balance, loan.annualRate, loan.repaymentMonths
          );
        }
      } else {
        // 상환기: 원리금균등 상환
        const principalPart = Math.min(loan.scheduledPayment - interest, loan.balance);
        if (principalPart > 0) {
          loan.balance -= principalPart;
        }

        // 완납 체크
        if (loan.balance <= 0) {
          loan.balance = 0;
          loan.paidOff = true;
          loan.paidOffMonth = month;
          timeline.push({
            month,
            date: formatMonth(addMonths(baseDate, month)),
            debtName: loan.name,
            event: 'completed',
            freedPayment: Math.round(loan.scheduledPayment),
          });
        }
      }
    }

    // 2단계: 추가 상환 + snowball 적용 (우선순위 순)
    let availableExtra = extraMonthly + snowballExtra;
    if (availableExtra > 0) {
      // 우선순위 순으로 정렬된 미완납 대출에 추가 상환 적용
      const active = loans
        .filter(l => !l.paidOff && l.graceLeft === 0) // 거치 중인 건 원금 상환 불가
        .sort((a, b) => a.priority - b.priority);

      for (const loan of active) {
        if (availableExtra <= 0) break;
        const payment = Math.min(availableExtra, loan.balance);
        loan.balance -= payment;
        availableExtra -= payment;

        if (loan.balance <= 0) {
          loan.balance = 0;
          loan.paidOff = true;
          loan.paidOffMonth = month;
          timeline.push({
            month,
            date: formatMonth(addMonths(baseDate, month)),
            debtName: loan.name,
            event: 'completed',
            freedPayment: Math.round(loan.scheduledPayment),
          });
        }
      }

      // 거치 중인 대출에도 추가상환 가능 (원금 직접 갚기)
      if (availableExtra > 0) {
        const graceLoans = loans
          .filter(l => !l.paidOff && l.graceLeft > 0)
          .sort((a, b) => a.priority - b.priority);

        for (const loan of graceLoans) {
          if (availableExtra <= 0) break;
          const payment = Math.min(availableExtra, loan.balance);
          loan.balance -= payment;
          availableExtra -= payment;

          if (loan.balance <= 0) {
            loan.balance = 0;
            loan.paidOff = true;
            loan.paidOffMonth = month;
            timeline.push({
              month,
              date: formatMonth(addMonths(baseDate, month)),
              debtName: loan.name,
              event: 'completed',
              freedPayment: Math.round(loan.scheduledPayment),
            });
          }
        }
      }
    }
  }

  return {
    totalInterest: Math.round(totalInterest),
    maxMonths: month,
    completionDate: addMonths(baseDate, month),
    timeline,
    loans,
  };
}

// ─── 공개 API ───

/**
 * 대출별 프로젝션 (현행 유지 기준)
 */
export function calcDebtProjections(
  debts: Debt[],
  _payments: DebtPayment[],
  baseDate: Date = new Date()
): DebtProjection[] {
  const result = simulateRepayment(debts, 0, baseDate);

  return debts.map(debt => {
    const terms = parseTerms(debt.terms);
    const graceLeft = estimateGraceRemaining(debt, terms, baseDate);
    const monthlyRate = debt.interestRate / 100 / 12;
    const simLoan = result.loans.find(l => l.name === debt.name);

    // 상환기 월 상환액
    const scheduledPayment = terms.repaymentMonths > 0
      ? calcAmortization(debt.remaining, debt.interestRate, terms.repaymentMonths)
      : 0;

    // 거치기간: 이자만
    const graceInterest = debt.remaining * monthlyRate;

    // 상환기 첫 달 원금/이자 비율
    const repayInterest = graceLeft > 0 ? graceInterest : debt.remaining * monthlyRate;
    const repayPrincipal = scheduledPayment > 0 ? scheduledPayment - repayInterest : 0;

    // 표시용 월 상환액: 거치 중이면 이자만, 상환기면 원리금균등
    const isGrace = graceLeft > 0;
    const monthlyPayment = isGrace ? Math.round(graceInterest) : Math.round(scheduledPayment);
    const monthlyInterest = Math.round(isGrace ? graceInterest : repayInterest);
    const monthlyPrincipal = Math.round(isGrace ? 0 : Math.max(repayPrincipal, 0));

    const remainingMonths = simLoan?.paidOffMonth || 999;

    // 해당 대출의 총 이자 (시뮬레이션에서 계산)
    // 간이 계산: 거치기간 이자 + 상환기간 총이자
    const graceTotal = graceInterest * graceLeft;
    let repayTotal = 0;
    if (terms.repaymentMonths > 0 && scheduledPayment > 0) {
      repayTotal = scheduledPayment * terms.repaymentMonths - debt.remaining;
    }
    const totalInterestRemaining = Math.round(graceTotal + Math.max(repayTotal, 0));

    return {
      name: debt.name,
      remaining: debt.remaining,
      interestRate: debt.interestRate,
      monthlyPayment,
      monthlyPrincipal,
      monthlyInterest,
      graceMonthsLeft: graceLeft,
      remainingMonths,
      completionDate: remainingMonths >= 999 ? '-' : formatMonth(addMonths(baseDate, remainingMonths)),
      totalInterestRemaining,
      priority: debt.priority,
    };
  });
}

/**
 * 시나리오 비교 (현행 + 추가상환 4가지)
 * - 현행: 거치기간 이자만 + 주담대 원리금균등 → 완납 후 snowball
 * - 추가: 위에 더해 매월 추가 상환 (우선순위 순)
 */
export function calcEarlyPayoffScenarios(
  debts: Debt[],
  _projections: DebtProjection[],
  baseDate: Date = new Date()
): ScenarioResult[] {
  const scenarios: ScenarioResult[] = [];

  // 현행 유지
  const baseline = simulateRepayment(debts, 0, baseDate);
  scenarios.push({
    label: '현행 유지',
    description: '거치기간 이자 + 주담대 원리금균등, 완납 후 snowball',
    totalInterest: baseline.totalInterest,
    completionDate: formatMonth(baseline.completionDate),
    monthlySaved: 0,
    timeSavedMonths: 0,
    timeline: baseline.timeline,
  });

  // 추가 상환 시나리오들
  const extras = [
    { amount: 500000, label: '월 50만원 추가', desc: '매월 50만원 추가 상환 (우선순위 순)' },
    { amount: 1000000, label: '월 100만원 추가', desc: '매월 100만원 추가 상환 (우선순위 순)' },
    { amount: 2000000, label: '월 200만원 추가', desc: '매월 200만원 추가 상환 (우선순위 순)' },
    { amount: 3000000, label: '월 300만원 추가', desc: '매월 300만원 추가 상환 (우선순위 순)' },
  ];

  for (const e of extras) {
    const result = simulateRepayment(debts, e.amount, baseDate);
    scenarios.push({
      label: e.label,
      description: e.desc,
      totalInterest: result.totalInterest,
      completionDate: formatMonth(result.completionDate),
      monthlySaved: baseline.totalInterest - result.totalInterest,
      timeSavedMonths: baseline.maxMonths - result.maxMonths,
      timeline: result.timeline,
    });
  }

  return scenarios;
}

/**
 * 상환 완료 순서 (현행 유지 기준)
 */
export function calcRepaymentOrder(
  debts: Debt[],
  projections: DebtProjection[],
): { name: string; completionDate: string; remaining: number; monthlyPayment: number; priority: number; graceMonthsLeft: number }[] {
  return projections
    .filter(p => p.remainingMonths > 0 && p.remainingMonths < 999)
    .sort((a, b) => a.remainingMonths - b.remainingMonths)
    .map((p) => ({
      name: p.name,
      completionDate: p.completionDate,
      remaining: p.remaining,
      monthlyPayment: p.monthlyPayment,
      priority: p.priority,
      graceMonthsLeft: p.graceMonthsLeft,
    }));
}

// ─── 헬퍼 ───

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
