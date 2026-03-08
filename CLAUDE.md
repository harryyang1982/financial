# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (Next.js)
npm run build    # Production build
npm run lint     # ESLint
```

## Architecture

Personal finance dashboard built with **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS**, and **Recharts**. All UI is in Korean. Dark mode is the default theme.

### Data Flow

1. **Google Sheets** is the sole data source (no database). Two spreadsheets: one for investments, one for debts.
2. **`src/lib/google-sheets.ts`** — Server-side fetcher using `googleapis`. Reads multiple named sheets (`현재 투자상태`, `포트폴리오 비중 2026`, `성장 전망`, debt sheets) and parses KRW-formatted strings into typed objects.
3. **`src/app/api/sheets/route.ts`** — Single API route (`GET /api/sheets`) that returns all portfolio data. 5-minute revalidation cache.
4. **`src/lib/usePortfolio.ts`** — Client-side hook that fetches `/api/sheets`. Falls back to **mock data** (`src/lib/mock-data.ts`) when credentials are missing or fetch fails.
5. All pages are `'use client'` components that consume `usePortfolio()`.

### Key Types (`src/lib/types.ts`)

- `Asset` — Unified investment record (stocks, crypto, real estate) with fields like `category`, `assetClass`, `accountType`, `currency`
- `AllocationTarget` / `SubAllocationTarget` — Target vs current portfolio weights
- `GrowthRecord` — Year-over-year projection data
- `Debt` / `DebtPayment` / `DebtSummary` — Loan tracking
- `PortfolioData` — Top-level container combining all of the above

### Asset Categories

Assets are grouped by `category` field: `증권` (securities), `코인` (crypto), `부동산` (real estate). Further classified by `assetClass` (기술주, 배당주, 성장주, 채권, 원자재, etc.) and `accountType` (연금저축, IRP, ISA, 일반, 거래소).

### Pages

- `/` — Dashboard with summary cards, donut charts (category & asset class breakdown)
- `/stocks` — Securities detail table
- `/deposits` — Account-type breakdown
- `/real-estate` — Real estate detail
- `/crypto` — Crypto detail
- `/debts` — Debt tracking and payment history
- `/portfolio` — Target vs current allocation analysis
- `/projections` — Growth projections chart

### Utility Functions (`src/lib/utils.ts`)

`formatKRW()` auto-scales amounts to 만원/억원. `calcCategorySummary()`, `calcAssetClassSummary()`, `calcAccountSummary()` aggregate assets into chart-ready `CategorySummary[]` arrays. `getInvestmentAssets()` excludes 부동산 from investment calculations.

## Environment Variables

- `GOOGLE_SERVICE_ACCOUNT_EMAIL` — Google service account email
- `GOOGLE_PRIVATE_KEY` — Service account private key (newlines as `\n`)
- `GOOGLE_SPREADSHEET_ID` — Main investment spreadsheet
- `GOOGLE_DEBT_SPREADSHEET_ID` — Optional; debt tracking spreadsheet

Without credentials, the app falls back to mock data automatically.
