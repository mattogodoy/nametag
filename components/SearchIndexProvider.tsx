'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import type MiniSearch from 'minisearch';
import { createSearchIndex, searchIndex as performSearch } from '@/lib/search-index';
import type { SearchDocument, PersonSearchResult } from '@/lib/search-index';

interface SearchIndexContextType {
  search: (query: string) => PersonSearchResult[];
  isReady: boolean;
  refreshIndex: () => void;
}

const SearchIndexContext = createContext<SearchIndexContextType | undefined>(undefined);

async function fetchAndBuildIndex(
  indexRef: React.RefObject<MiniSearch<SearchDocument> | null>,
  setIsReady: (ready: boolean) => void,
) {
  try {
    const response = await fetch('/api/people/search-index');
    if (!response.ok) return;
    const data = await response.json();

    indexRef.current = createSearchIndex(data.people);
    setIsReady(true);
  } catch {
    // Silently fail; search falls back to server-side
  }
}

export function SearchIndexProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [isReady, setIsReady] = useState(false);
  const indexRef = useRef<MiniSearch<SearchDocument> | null>(null);

  useEffect(() => {
    if (session?.user) {
      fetchAndBuildIndex(indexRef, setIsReady);
    }
  }, [session]);

  const search = useCallback((query: string): PersonSearchResult[] => {
    if (!indexRef.current) return [];
    return performSearch(indexRef.current, query);
  }, []);

  const refreshIndex = useCallback(() => {
    fetchAndBuildIndex(indexRef, setIsReady);
  }, []);

  return (
    <SearchIndexContext.Provider value={{ search, isReady, refreshIndex }}>
      {children}
    </SearchIndexContext.Provider>
  );
}

export function useSearchIndex() {
  const context = useContext(SearchIndexContext);
  if (!context) {
    throw new Error('useSearchIndex must be used within a SearchIndexProvider');
  }
  return context;
}
