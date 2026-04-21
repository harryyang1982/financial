import { google } from 'googleapis';
import { PortfolioData, Asset, AllocationTarget, SubAllocationTarget, GrowthRecord, Debt, DebtPayment, DebtSummary } from './types';
import { mockData } from './mock-data';

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !key) {
    return null;
  }

  return new google.auth.JWT({
    email,
    key: key.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}

async function getSheetData(sheetName: string, range: string, spreadsheetId?: string): Promise<string[][]> {
  const auth = getAuth();
  if (!auth) {
    throw new Error('NO_CREDENTIALS');
  }

  const sheets = google.sheets({ version: 'v4', auth });
  const sid = spreadsheetId || process.env.GOOGLE_SPREADSHEET_ID;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sid,
    range: `${sheetName}!${range}`,
  });

  return (response.data.values as string[][]) || [];
}

function parseKRW(value: string | undefined): number {
  if (!value) return 0;
  const cleaned = value.replace(/[₩,\s]/g, '');
  return Number(cleaned) || 0;
}

function parsePercent(value: string | undefined): number {
  if (!value || value === '#DIV/0!') return 0;
  return Number(value.replace(/[%,\s]/g, '')) || 0;
}

function parseAssets(rows: string[][]): Asset[] {
  return rows
    .filter((row) => row[0] && row[1] && row[0] !== '' && row[1] !== '대범주')
    .filter((row) => {
      const invested = parseKRW(row[6]);
      return invested > 0;
    })
    .map((row) => ({
      category: row[0] || '',
      name: row[1] || '',
      account: row[2] || '',
      accountType: row[3] || '',
      quantity: parseKRW(row[4]),
      avgPrice: parseKRW(row[5]),
      investedAmount: parseKRW(row[6]),
      currentValue: parseKRW(row[7]),
      profit: parseKRW(row[8]),
      profitRate: parsePercent(row[9]),
      country: row[10] || '',
      assetClass: row[11] || '',
      assetSubClass: row[12] || '',
      currency: row[13] || 'KRW',
      type: row[14] || '',
    }));
}

// "포트폴리오 비중 2026" 시트 - 상단 대범주 테이블 (row 2~19)
function parseAllocationTargets(rows: string[][]): AllocationTarget[] {
  const targets: AllocationTarget[] = [];
  let lastCountry = '';

  for (const row of rows) {
    if (!row[1]) continue; // 자산대범주가 없으면 skip
    const country = row[0] || lastCountry;
    if (country.includes('총계') || row[1] === '자산대범주') continue;
    if (lastCountry !== '' || row[0]) lastCountry = row[0] || lastCountry;

    targets.push({
      country,
      assetClass: row[1],
      currentValue: parseKRW(row[2]),
      currentWeight: parsePercent(row[3]),
      targetWeight: parsePercent(row[4]),
      targetAmount180: parseKRW(row[5]),
      gap180: parseKRW(row[6]),
      targetAmount200: parseKRW(row[7]),
      gap200: parseKRW(row[8]),
    });
  }

  return targets;
}

// "포트폴리오 비중 2026" 시트 - 하단 세부 포트폴리오 (row 25+)
function parseSubAllocationTargets(rows: string[][]): SubAllocationTarget[] {
  const targets: SubAllocationTarget[] = [];
  let lastCountry = '';
  let lastClass = '';

  for (const row of rows) {
    if (!row[2]) continue; // 자산중범주가 없으면 skip
    if (row[2] === '자산중범주') continue;
    const country = row[0] || lastCountry;
    const assetClass = row[1] || lastClass;
    if (country.includes('총계') || assetClass.includes('총계')) continue;
    if (row[0]) lastCountry = row[0];
    if (row[1]) lastClass = row[1];

    targets.push({
      country,
      assetClass,
      assetSubClass: row[2],
      currentValue: parseKRW(row[3]),
      currentWeight: parsePercent(row[4]),
      targetWeight: parsePercent(row[5]),
      targetAmount180: parseKRW(row[6]),
      gap180: parseKRW(row[7]),
      targetAmount200: parseKRW(row[8]),
    });
  }

  return targets;
}

function parseGrowth(rows: string[][]): GrowthRecord[] {
  return rows
    .filter((row) => row[0] && /^\d{4}$/.test(row[0]))
    .map((row) => ({
      year: row[0],
      returnRate: parsePercent(row[1]),
      amount: parseKRW(row[2]),
      contribution: parseKRW(row[3]),
      inflation: parsePercent(row[4]),
      presentValue: parseKRW(row[5]),
      dividendIncome: parseKRW(row[6]),
      dividendReinvest: parseKRW(row[7]),
      withdrawal: parseKRW(row[8]),
    }));
}

function parseDebts(rows: string[][]): Debt[] {
  return rows
    .filter((row) => row[0] && row[0] !== '대출 종류' && row[0] !== '')
    .map((row) => ({
      name: row[0] || '',
      principal: parseKRW(row[1]),
      paid: parseKRW(row[2]),
      remaining: parseKRW(row[3]),
      interestPaid: parseKRW(row[4]),
      paidRate: parsePercent(row[5]),
      interestRate: parsePercent(row[6]),
      terms: row[7] || '',
      priority: Number(row[8]) || 0,
    }))
    .filter((d) => d.principal > 0);
}

function parseDebtSummary(rows: string[][]): DebtSummary | null {
  // Summary is in columns K-P of row 3 (index 0 after header skip)
  for (const row of rows) {
    const totalDebt = parseKRW(row[10]);
    if (totalDebt > 0) {
      return {
        totalDebt,
        equity: parseKRW(row[11]),
        remainingDebt: parseKRW(row[12]),
        totalPaid: parseKRW(row[13]),
        equityRate: parsePercent(row[14]),
        paidRate: parsePercent(row[15]),
      };
    }
  }
  return null;
}

function parseDebtPayments(rows: string[][]): DebtPayment[] {
  return rows
    .filter((row) => row[0] && /^\d{4}-/.test(row[0]))
    .map((row) => ({
      date: row[0],
      category: row[1] || '',
      amount: parseKRW(row[2]),
      principal: parseKRW(row[3]),
      interest: parseKRW(row[4]),
    }))
    .filter((p) => p.amount > 0);
}

export async function fetchPortfolioData(): Promise<PortfolioData> {
  try {
    const debtSpreadsheetId = process.env.GOOGLE_DEBT_SPREADSHEET_ID;

    const [assetRows, portfolioTopRows, portfolioSubRows, growthRows, debtRows, debtPaymentRows] = await Promise.all([
      getSheetData('현재 투자상태', 'A1:O100'),
      getSheetData('포트폴리오 비중 2026', 'A3:I20'),   // 대범주 테이블
      getSheetData('포트폴리오 비중 2026', 'A25:I60'),   // 세부 포트폴리오
      getSheetData('성장 전망', 'A1:I50'),
      debtSpreadsheetId ? getSheetData('시트1', 'A2:P10', debtSpreadsheetId) : Promise.resolve([]),
      debtSpreadsheetId ? getSheetData('시트2', 'A2:E50', debtSpreadsheetId) : Promise.resolve([]),
    ]);

    return {
      assets: parseAssets(assetRows),
      allocationTargets: parseAllocationTargets(portfolioTopRows),
      subAllocationTargets: parseSubAllocationTargets(portfolioSubRows),
      growthRecords: parseGrowth(growthRows),
      debts: parseDebts(debtRows),
      debtPayments: parseDebtPayments(debtPaymentRows),
      debtSummary: parseDebtSummary(debtRows),
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'NO_CREDENTIALS') {
      console.warn('Google Sheets credentials not configured. Using mock data.');
    } else {
      console.error('Failed to fetch from Google Sheets:', error);
    }
    return mockData;
  }
}
