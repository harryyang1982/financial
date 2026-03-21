import { NextResponse } from 'next/server';
import { fetchMarketData } from '@/lib/market-fetcher';

export const revalidate = 3600; // 1시간 캐시

export async function GET() {
  try {
    const data = await fetchMarketData();
    return NextResponse.json(data);
  } catch (error) {
    console.error('API /api/market error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch market data' },
      { status: 500 }
    );
  }
}
