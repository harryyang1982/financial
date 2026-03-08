import { PortfolioData } from './types';

export const mockData: PortfolioData = {
  assets: [
    { category: '코인', name: '비트코인', account: '업비트', accountType: '거래소', quantity: 0.062, avgPrice: 132305956, investedAmount: 8206481, currentValue: 6162337, profit: -2044144, profitRate: -24.91, country: '가상', assetClass: '코인', assetSubClass: '비트코인', currency: 'KRW', type: '코인' },
    { category: '코인', name: '이더리움', account: '업비트', accountType: '거래소', quantity: 0.639, avgPrice: 4267424, investedAmount: 2728841, currentValue: 1837804, profit: -891037, profitRate: -32.65, country: '가상', assetClass: '코인', assetSubClass: '알트코인', currency: 'KRW', type: '코인' },
    { category: '증권', name: '삼성전자', account: '한투', accountType: 'ISA', quantity: 6, avgPrice: 125329, investedAmount: 751974, currentValue: 1129200, profit: 377226, profitRate: 50.16, country: '한국', assetClass: '기술주', assetSubClass: '테크', currency: 'KRW', type: '개별주' },
    { category: '증권', name: '팔란티어', account: '한투', accountType: '일반', quantity: 100, avgPrice: 43112, investedAmount: 4311200, currentValue: 23342818, profit: 19031618, profitRate: 441.45, country: '미국', assetClass: '기술주', assetSubClass: 'AI', currency: 'USD', type: '개별주' },
    { category: '부동산', name: '집', account: '신한', accountType: '현물', quantity: 1, avgPrice: 1200000000, investedAmount: 1200000000, currentValue: 1300000000, profit: 100000000, profitRate: 8.33, country: '한국', assetClass: '부동산', assetSubClass: '집값', currency: 'KRW', type: '현물' },
  ],
  allocationTargets: [
    { country: '가상', assetClass: '코인', currentValue: 8000141, currentWeight: 5.2, targetWeight: 5.0, targetAmount160: 8000000, gap160: -141, targetAmount180: 9000000, gap180: 999859 },
    { country: '미국', assetClass: '기술주', currentValue: 39665165, currentWeight: 25.6, targetWeight: 20.0, targetAmount160: 32000000, gap160: -7665165, targetAmount180: 36000000, gap180: -3665165 },
    { country: '미국', assetClass: '배당주', currentValue: 27035378, currentWeight: 17.5, targetWeight: 22.0, targetAmount160: 35200000, gap160: 8164622, targetAmount180: 39600000, gap180: 12564622 },
  ],
  subAllocationTargets: [
    { country: '가상', assetClass: '코인', assetSubClass: '비트코인', currentValue: 6162337, currentWeight: 4.0, targetWeight: 3.85, targetAmount160: 6160000, gap160: -2337, targetAmount180: 6930000 },
    { country: '가상', assetClass: '코인', assetSubClass: '알트코인', currentValue: 1837804, currentWeight: 1.2, targetWeight: 1.2, targetAmount160: 1840000, gap160: 2196, targetAmount180: 2070000 },
  ],
  growthRecords: [
    { year: '2027', returnRate: 10, amount: 203111806, contribution: 30000000, inflation: 3, presentValue: 197572393, dividendIncome: 3454932, dividendReinvest: 206566737, withdrawal: 0 },
    { year: '2028', returnRate: 10, amount: 261323411, contribution: 31000000, inflation: 3, presentValue: 250499632, dividendIncome: 4667367, dividendReinvest: 265990778, withdrawal: 0 },
    { year: '2029', returnRate: 10, amount: 327789856, contribution: 32000000, inflation: 3, presentValue: 313856050, dividendIncome: 6147215, dividendReinvest: 333937071, withdrawal: 0 },
  ],
  debts: [
    { name: '교직원공제회', principal: 98500000, paid: 3667290, remaining: 94832710, interestPaid: 176060, paidRate: 3.723, interestRate: 4.7, terms: '2년 거치 8년 원리금 상환', priority: 1 },
    { name: '사학연금', principal: 18600000, paid: 800000, remaining: 17800000, interestPaid: 0, paidRate: 4.301, interestRate: 4.24, terms: '2년 거치 5년 원리금 상환', priority: 3 },
    { name: '주택담보대출', principal: 600000000, paid: 1035482, remaining: 598964518, interestPaid: 2443277, paidRate: 0.173, interestRate: 4.889, terms: '30년 원리금균등상환', priority: 2 },
  ],
  debtPayments: [
    { date: '2026-02-15', category: '교직원 공제회', amount: 343350, principal: 343350, interest: 0 },
    { date: '2026-02-19', category: '교직원 공제회', amount: 200000, principal: 124170, interest: 75830 },
    { date: '2026-02-06', category: '사학연금', amount: 800000, principal: 800000, interest: 0 },
    { date: '2026-03-04', category: '하나은행 주담대', amount: 3178759, principal: 735482, interest: 2443277 },
  ],
  debtSummary: { totalDebt: 717100000, equity: 601035482, remainingDebt: 711597228, totalPaid: 5502772, equityRate: 50.09, paidRate: 0.77 },
};
