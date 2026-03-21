'use client';

import { useState, useEffect, useCallback } from 'react';
import { MarketData } from './market-types';
import { FALLBACK_MARKET_DATA } from './market-fallback';

export function useMarket() {
  const [data, setData] = useState<MarketData>(FALLBACK_MARKET_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/market');
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
      setError('시황 데이터를 불러오지 못했습니다.');
      setData(FALLBACK_MARKET_DATA);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { market: data, marketLoading: loading, marketError: error, refreshMarket: fetchData };
}
