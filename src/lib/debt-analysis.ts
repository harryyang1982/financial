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
  totalPenalty: number;         // 총 중도상환수수료
  completionDate: string;
  monthlySaved: number;
  timeSavedMonths: number;
  totalMonthlyPayment: number;  // 월 총 납부액 (기본 상환 + 추가 상환)
  maxMonths: number;            // 완납까지 총 개월 수
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
  // 중도상환수수료
  prepayPenaltyRate: number;   // 수수료율 (0.0065 = 0.65%)
  penaltyTotalMonths: number;  // 수수료 적용 총 기간 (36개월)
  penaltyMonthsLeft: number;   // 남은 수수료 적용 개월
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
  baseDate: Date = new Date(),
  useSnowball: boolean = true
): {
  totalInterest: number;
  totalPenalty: number;
  maxMonths: number;
  completionDate: Date;
  timeline: TimelineEvent[];
  loans: SimLoan[];
} {
  // 대출별 시뮬레이션 상태 초기화
  const loanStart = new Date(2026, 0, 1);
  const monthsFromStart = (baseDate.getFullYear() - loanStart.getFullYear()) * 12 +
    (baseDate.getMonth() - loanStart.getMonth());

  const loans: SimLoan[] = debts.map(d => {
    const terms = parseTerms(d.terms);
    const graceLeft = estimateGraceRemaining(d, terms, baseDate);
    const r = d.interestRate / 100 / 12;

    // 상환기 월 상환액: 거치 종료 시점의 잔액 기준으로 계산
    // (거치기간 동안 이자만 내므로 원금 = 현재 잔액 그대로)
    const scheduledPayment = terms.repaymentMonths > 0
      ? calcAmortization(d.remaining, d.interestRate, terms.repaymentMonths)
      : 0;

    // 중도상환수수료: 주택담보대출만 적용 (0.65%, 3년, 잔여기간 비례 감소)
    const hasPenalty = d.name.includes('주택담보');
    const penaltyTotalMonths = 36;
    const penaltyMonthsLeft = hasPenalty
      ? Math.max(penaltyTotalMonths - monthsFromStart, 0)
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
      prepayPenaltyRate: hasPenalty ? 0.0065 : 0,
      penaltyTotalMonths: hasPenalty ? penaltyTotalMonths : 0,
      penaltyMonthsLeft,
    };
  });

  let totalInterest = 0;
  let totalPenalty = 0;
  let month = 0;
  const maxIter = 600;
  const timeline: TimelineEvent[] = [];

  // ── 고정 목표 월 상환액 계산 (초기 스케줄 합계 + 추가 상환액) ──
  // extraMonthly > 0 일 때: 매월 총 납부액을 이 목표에 맞춤
  // 스케줄 상환이 늘면 추가분 줄고, 대출 완납되면 여유분 다시 늘어남
  let initialBaseline = 0;
  for (const loan of loans) {
    if (loan.graceLeft > 0) {
      initialBaseline += loan.balance * loan.rate; // 거치: 이자만
    } else {
      initialBaseline += loan.scheduledPayment;    // 상환기: 원리금
    }
  }
  const targetMonthly = initialBaseline + extraMonthly;

  while (loans.some(l => !l.paidOff) && month < maxIter) {
    month++;

    // 1단계: 각 대출 기본 상환
    for (const loan of loans) {
      if (loan.paidOff) continue;

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

    // 2단계: 추가 상환 적용
    // extraMonthly > 0 → 고정 목표 방식: 목표 - 이번 달 스케줄 = 여유분
    // extraMonthly = 0 && useSnowball → 완납된 대출 상환액만 snowball
    // extraMonthly = 0 && !useSnowball → 추가 없음
    let availableExtra = 0;
    if (extraMonthly > 0) {
      // 고정 목표 방식: 이번 달 활성 대출의 스케줄 합계 계산
      let currentScheduled = 0;
      for (const loan of loans) {
        if (loan.paidOff) continue;
        if (loan.graceLeft > 0) {
          currentScheduled += loan.balance * loan.rate;
        } else {
          currentScheduled += loan.scheduledPayment;
        }
      }
      availableExtra = Math.max(0, targetMonthly - currentScheduled);
    } else if (useSnowball) {
      // 기존 snowball 방식 (현행 유지 + snowball 시나리오용)
      for (const loan of loans) {
        if (loan.paidOff) availableExtra += loan.scheduledPayment;
      }
    }

    if (availableExtra > 0) {
      // 우선순위 순으로 정렬 — 거치 중이든 상환 중이든 우선순위대로
      const active = loans
        .filter(l => !l.paidOff)
        .sort((a, b) => a.priority - b.priority);

      for (const loan of active) {
        if (availableExtra <= 0) break;

        let effectivePayment: number;
        let penalty = 0;

        const gross = Math.min(availableExtra, loan.balance * 1.01);
        if (loan.prepayPenaltyRate > 0 && loan.penaltyMonthsLeft > 0) {
          const currentRate = loan.prepayPenaltyRate * (loan.penaltyMonthsLeft / loan.penaltyTotalMonths);
          const maxPrincipal = Math.min(gross / (1 + currentRate), loan.balance);
          effectivePayment = maxPrincipal;
          penalty = effectivePayment * currentRate;
          availableExtra -= (effectivePayment + penalty);
        } else {
          effectivePayment = Math.min(gross, loan.balance);
          availableExtra -= effectivePayment;
        }

        loan.balance -= effectivePayment;
        totalPenalty += penalty;

        if (loan.balance <= 100) {
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

        if (availableExtra <= 0) break;
      }
    }

    // 중도상환수수료 잔여기간 차감
    for (const loan of loans) {
      if (loan.penaltyMonthsLeft > 0) loan.penaltyMonthsLeft--;
    }
  }

  return {
    totalInterest: Math.round(totalInterest),
    totalPenalty: Math.round(totalPenalty),
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
  // snowball 없이 각 대출의 순수 스케줄 기준 프로젝션
  const result = simulateRepayment(debts, 0, baseDate, false);

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
 * 초기 월 납부 총액 계산 (거치 중이면 이자만, 상환기면 원리금균등 + 추가상환)
 */
function calcInitialMonthlyTotal(debts: Debt[], extraMonthly: number, baseDate: Date): number {
  let total = 0;
  for (const d of debts) {
    const terms = parseTerms(d.terms);
    const graceLeft = estimateGraceRemaining(d, terms, baseDate);
    const monthlyRate = d.interestRate / 100 / 12;
    if (graceLeft > 0) {
      total += d.remaining * monthlyRate; // 이자만
    } else if (terms.repaymentMonths > 0) {
      total += calcAmortization(d.remaining, d.interestRate, terms.repaymentMonths);
    }
  }
  return Math.round(total + extraMonthly);
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

  // 현행 유지 (snowball 없음 — 각 대출 독립 상환)
  const baseline = simulateRepayment(debts, 0, baseDate, false);
  scenarios.push({
    label: '현행 유지',
    description: '거치기간 이자 + 주담대 원리금균등 (각 대출 독립 상환)',
    totalInterest: baseline.totalInterest,
    totalPenalty: baseline.totalPenalty,
    completionDate: formatMonth(baseline.completionDate),
    monthlySaved: 0,
    timeSavedMonths: 0,
    totalMonthlyPayment: calcInitialMonthlyTotal(debts, 0, baseDate),
    maxMonths: baseline.maxMonths,
    timeline: baseline.timeline,
  });

  // 추가 상환 시나리오들
  const extras = [
    { amount: 500000, label: '월 50만원 추가', desc: '고정 목표 상환 — 스케줄 변동 시 추가분 자동 조절' },
    { amount: 1000000, label: '월 100만원 추가', desc: '고정 목표 상환 — 스케줄 변동 시 추가분 자동 조절' },
    { amount: 2000000, label: '월 200만원 추가', desc: '고정 목표 상환 — 스케줄 변동 시 추가분 자동 조절' },
    { amount: 3000000, label: '월 300만원 추가', desc: '고정 목표 상환 — 스케줄 변동 시 추가분 자동 조절' },
  ];

  for (const e of extras) {
    const result = simulateRepayment(debts, e.amount, baseDate);
    scenarios.push({
      label: e.label,
      description: e.desc,
      totalInterest: result.totalInterest,
      totalPenalty: result.totalPenalty,
      completionDate: formatMonth(result.completionDate),
      monthlySaved: baseline.totalInterest - result.totalInterest,
      timeSavedMonths: baseline.maxMonths - result.maxMonths,
      totalMonthlyPayment: calcInitialMonthlyTotal(debts, e.amount, baseDate),
      maxMonths: result.maxMonths,
      timeline: result.timeline,
    });
  }

  return scenarios;
}

/**
 * 단일 시나리오 계산 (커스텀 추가 상환액)
 */
export function calcSingleScenario(
  debts: Debt[],
  extraMonthly: number,
  baselineInterest: number,
  baselineMonths: number,
  baseDate: Date = new Date()
): ScenarioResult {
  const result = simulateRepayment(debts, extraMonthly, baseDate);
  const amountMan = Math.round(extraMonthly / 10000);
  const label = `월 ${amountMan}만원 추가`;
  return {
    label,
    description: `고정 목표 상환 — 스케줄 변동 시 추가분 자동 조절`,
    totalInterest: result.totalInterest,
    totalPenalty: result.totalPenalty,
    completionDate: formatMonth(result.completionDate),
    monthlySaved: baselineInterest - result.totalInterest,
    timeSavedMonths: baselineMonths - result.maxMonths,
    totalMonthlyPayment: calcInitialMonthlyTotal(debts, extraMonthly, baseDate),
    maxMonths: result.maxMonths,
    timeline: result.timeline,
  };
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

// ─── 월별 상환 스케줄 ───

export interface LoanMonthlyDetail {
  name: string;
  principalPaid: number;
  interestPaid: number;
  penaltyPaid: number;
  balance: number;
}

export interface MonthlyScheduleRow {
  month: number;
  date: string;
  loans: LoanMonthlyDetail[];
  totalPrincipalPaid: number;
  totalInterestPaid: number;
  totalPenaltyPaid: number;
  totalPayment: number;
  totalRemainingDebt: number;
  repaymentRate: number;
  debtRatio: number;
  equityRate: number;
  netWorth: number;
}

/**
 * 시나리오별 월별 상환 스케줄 생성
 */
export function generateMonthlySchedule(
  debts: Debt[],
  extraMonthly: number,
  useSnowball: boolean,
  totalAssets: number,
  apartmentValue: number,
  baseDate: Date = new Date()
): MonthlyScheduleRow[] {
  const loanStart = new Date(2026, 0, 1);
  const monthsFromStart = (baseDate.getFullYear() - loanStart.getFullYear()) * 12 +
    (baseDate.getMonth() - loanStart.getMonth());
  const totalOriginalPrincipal = debts.reduce((s, d) => s + d.principal, 0);

  const loans = debts.map(d => {
    const terms = parseTerms(d.terms);
    const graceLeft = estimateGraceRemaining(d, terms, baseDate);
    const scheduledPayment = terms.repaymentMonths > 0
      ? calcAmortization(d.remaining, d.interestRate, terms.repaymentMonths) : 0;
    const hasPenalty = d.name.includes('주택담보');
    return {
      name: d.name,
      balance: d.remaining,
      rate: d.interestRate / 100 / 12,
      annualRate: d.interestRate,
      graceLeft,
      repaymentMonths: terms.repaymentMonths,
      scheduledPayment,
      priority: d.priority,
      paidOff: false,
      prepayPenaltyRate: hasPenalty ? 0.0065 : 0,
      penaltyTotalMonths: hasPenalty ? 36 : 0,
      penaltyMonthsLeft: hasPenalty ? Math.max(36 - monthsFromStart, 0) : 0,
    };
  });

  const schedule: MonthlyScheduleRow[] = [];
  let month = 0;
  const mortgageIdx = loans.findIndex(l => l.name.includes('주택담보'));

  // ── 고정 목표 월 상환액 (simulateRepayment과 동일 로직) ──
  let schedInitialBaseline = 0;
  for (const loan of loans) {
    if (loan.graceLeft > 0) {
      schedInitialBaseline += loan.balance * loan.rate;
    } else {
      schedInitialBaseline += loan.scheduledPayment;
    }
  }
  const schedTargetMonthly = schedInitialBaseline + extraMonthly;

  while (loans.some(l => !l.paidOff) && month < 600) {
    month++;
    const details = loans.map(() => ({ principalPaid: 0, interestPaid: 0, penaltyPaid: 0 }));

    // Step 1: 정기 상환
    for (let i = 0; i < loans.length; i++) {
      const loan = loans[i];
      if (loan.paidOff) continue;
      const interest = loan.balance * loan.rate;
      details[i].interestPaid = interest;

      if (loan.graceLeft > 0) {
        loan.graceLeft--;
        if (loan.graceLeft === 0 && loan.repaymentMonths > 0) {
          loan.scheduledPayment = calcAmortization(loan.balance, loan.annualRate, loan.repaymentMonths);
        }
      } else {
        const principalPart = Math.min(loan.scheduledPayment - interest, loan.balance);
        if (principalPart > 0) {
          loan.balance -= principalPart;
          details[i].principalPaid = principalPart;
        }
        if (loan.balance <= 100) { loan.balance = 0; loan.paidOff = true; }
      }
    }

    // Step 2: 추가 상환 (고정 목표 방식 or snowball)
    let availableExtra = 0;
    if (extraMonthly > 0) {
      let currentScheduled = 0;
      for (const loan of loans) {
        if (loan.paidOff) continue;
        if (loan.graceLeft > 0) {
          currentScheduled += loan.balance * loan.rate;
        } else {
          currentScheduled += loan.scheduledPayment;
        }
      }
      availableExtra = Math.max(0, schedTargetMonthly - currentScheduled);
    } else if (useSnowball) {
      for (const loan of loans) {
        if (loan.paidOff) availableExtra += loan.scheduledPayment;
      }
    }

    if (availableExtra > 0) {
      const sorted = loans
        .map((l, i) => ({ loan: l, idx: i }))
        .filter(x => !x.loan.paidOff)
        .sort((a, b) => a.loan.priority - b.loan.priority);

      for (const { loan, idx } of sorted) {
        if (availableExtra <= 0) break;
        const gross = Math.min(availableExtra, loan.balance * 1.01);
        let effective: number, penalty = 0;

        if (loan.prepayPenaltyRate > 0 && loan.penaltyMonthsLeft > 0) {
          const rate = loan.prepayPenaltyRate * (loan.penaltyMonthsLeft / loan.penaltyTotalMonths);
          effective = Math.min(gross / (1 + rate), loan.balance);
          penalty = effective * rate;
          availableExtra -= (effective + penalty);
        } else {
          effective = Math.min(gross, loan.balance);
          availableExtra -= effective;
        }

        loan.balance -= effective;
        details[idx].principalPaid += effective;
        details[idx].penaltyPaid += penalty;
        if (loan.balance <= 100) { loan.balance = 0; loan.paidOff = true; }
        if (availableExtra <= 0) break;
      }
    }

    for (const loan of loans) {
      if (loan.penaltyMonthsLeft > 0) loan.penaltyMonthsLeft--;
    }

    // Metrics
    const totalRemaining = loans.reduce((s, l) => s + l.balance, 0);
    const mortgageBalance = mortgageIdx >= 0 ? loans[mortgageIdx].balance : 0;
    const tPrincipal = details.reduce((s, d) => s + d.principalPaid, 0);
    const tInterest = details.reduce((s, d) => s + d.interestPaid, 0);
    const tPenalty = details.reduce((s, d) => s + d.penaltyPaid, 0);

    schedule.push({
      month,
      date: formatMonth(addMonths(baseDate, month)),
      loans: loans.map((l, i) => ({
        name: l.name,
        principalPaid: Math.round(details[i].principalPaid),
        interestPaid: Math.round(details[i].interestPaid),
        penaltyPaid: Math.round(details[i].penaltyPaid),
        balance: Math.round(l.balance),
      })),
      totalPrincipalPaid: Math.round(tPrincipal),
      totalInterestPaid: Math.round(tInterest),
      totalPenaltyPaid: Math.round(tPenalty),
      totalPayment: Math.round(tPrincipal + tInterest + tPenalty),
      totalRemainingDebt: Math.round(totalRemaining),
      repaymentRate: Number(((totalOriginalPrincipal - totalRemaining) / totalOriginalPrincipal * 100).toFixed(2)),
      debtRatio: totalAssets > 0 ? Number((totalRemaining / totalAssets * 100).toFixed(1)) : 0,
      equityRate: apartmentValue > 0 ? Number(((apartmentValue - mortgageBalance) / apartmentValue * 100).toFixed(1)) : 0,
      netWorth: Math.round(totalAssets - totalRemaining),
    });
  }

  return schedule;
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
