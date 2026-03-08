import { NextResponse } from 'next/server';
import { fetchPortfolioData } from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await fetchPortfolioData();
    return NextResponse.json(data);
  } catch (error) {
    console.error('API /api/sheets error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch portfolio data' },
      { status: 500 }
    );
  }
}
