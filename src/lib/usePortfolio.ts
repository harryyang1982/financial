'use client';

import { useState, useEffect, useCallback } from 'react';
import { PortfolioData } from './types';
import { mockData } from './mock-data';

export function usePortfolio() {
  const [data, setData] = useState<PortfolioData>(mockData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sheets');
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
      setError('데이터를 불러오지 못했습니다. 목 데이터를 표시합니다.');
      setData(mockData);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData };
}
