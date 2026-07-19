'use client';

import { useCallback, useEffect, useMemo, useState, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { MapMarkersResponse } from '@/lib/map/types';
import { filterMarkers, type MapFilterState } from '@/lib/map/filter-markers';
import MapFilters from './MapFilters';

const MapView = dynamic(() => import('./MapView'), { ssr: false });

function MapPageInner() {
  const t = useTranslations('map');
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState<MapMarkersResponse | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const filters: MapFilterState = useMemo(
    () => ({
      query: searchParams.get('q') ?? '',
      groupId: searchParams.get('group') ?? '',
      city: searchParams.get('city') ?? '',
      country: searchParams.get('country') ?? '',
    }),
    [searchParams]
  );
  const focusId = searchParams.get('focus');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/map/markers')
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<MapMarkersResponse>;
      })
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFiltersChange = useCallback(
    (next: MapFilterState) => {
      const params = new URLSearchParams();
      if (next.query) params.set('q', next.query);
      if (next.groupId) params.set('group', next.groupId);
      if (next.city) params.set('city', next.city);
      if (next.country) params.set('country', next.country);
      // Changing filters drops the focus deep link on purpose
      const qs = params.toString();
      router.replace(qs ? `/map?${qs}` : '/map', { scroll: false });
    },
    [router]
  );

  const visibleMarkers = useMemo(
    () => (data ? filterMarkers(data.markers, filters) : []),
    [data, filters]
  );

  if (loadError) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-muted">{t('loadError')}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-muted">{t('loading')}</p>
      </div>
    );
  }

  const showBanner = !bannerDismissed && (data.pendingCount > 0 || data.failedCount > 0);

  return (
    <div className="flex-1 flex flex-col">
      <MapFilters
        filters={filters}
        markers={data.markers}
        groups={data.groups}
        onChange={handleFiltersChange}
      />

      {showBanner && (
        <div className="flex items-center justify-between gap-4 px-4 py-2 bg-surface-elevated border-b border-border text-sm text-muted">
          <span>
            {data.pendingCount > 0 && t('pendingBanner', { count: data.pendingCount })}
            {data.pendingCount > 0 && data.failedCount > 0 && ' '}
            {data.failedCount > 0 && t('failedBanner', { count: data.failedCount })}
          </span>
          <button
            type="button"
            onClick={() => setBannerDismissed(true)}
            className="text-primary hover:text-primary-dark transition-colors"
          >
            {t('dismiss')}
          </button>
        </div>
      )}

      <div className="flex-1 relative min-h-[60vh]">
        {data.markers.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <div className="text-center max-w-md">
              <h2 className="text-lg font-semibold text-foreground mb-2">{t('emptyTitle')}</h2>
              <p className="text-muted">
                {data.geocodingEnabled ? t('emptyDescription') : t('emptyGeocodingDisabled')}
              </p>
            </div>
          </div>
        ) : (
          <MapView markers={visibleMarkers} focusId={focusId} />
        )}
      </div>
    </div>
  );
}

export default function MapPageClient() {
  return (
    <Suspense fallback={null}>
      <MapPageInner />
    </Suspense>
  );
}
