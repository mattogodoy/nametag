'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTranslations } from 'next-intl';
import type { MapMarker } from '@/lib/map/types';

// OpenFreeMap hosted styles: free, no API key, commercial use permitted.
const DARK_STYLE = 'https://tiles.openfreemap.org/styles/dark';
const LIGHT_STYLE = 'https://tiles.openfreemap.org/styles/positron';

const SOURCE_ID = 'people';
const FOCUS_ZOOM = 15;

interface MapViewProps {
  markers: MapMarker[];
  focusId: string | null;
}

interface MarkerProperties {
  id: string;
  personId: string;
  personName: string;
  label: string;
}

function useIsDarkTheme(): boolean {
  const [isDark, setIsDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );
  useEffect(() => {
    const root = document.documentElement;
    const update = () => setIsDark(root.classList.contains('dark'));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return isDark;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

function toGeoJSON(markers: MapMarker[]): GeoJSON.FeatureCollection<GeoJSON.Point, MarkerProperties> {
  return {
    type: 'FeatureCollection',
    features: markers.map((marker) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [marker.longitude, marker.latitude] },
      properties: {
        id: marker.id,
        personId: marker.personId,
        personName: marker.personName,
        label: marker.label,
      },
    })),
  };
}

export default function MapView({ markers, focusId }: MapViewProps) {
  const t = useTranslations('map');
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const currentStyleRef = useRef<string | null>(null);
  const markersRef = useRef<MapMarker[]>(markers);
  const focusHandledRef = useRef(false);
  const isDark = useIsDarkTheme();
  const translationsRef = useRef({ viewContact: t('viewContact'), directions: t('directions') });
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  // Keep "latest value" refs in sync via effects rather than during render,
  // since the map init effect below registers event handlers once (empty
  // deps) and reads these refs later, outside of render.
  useEffect(() => {
    markersRef.current = markers;
  }, [markers]);

  useEffect(() => {
    translationsRef.current = { viewContact: t('viewContact'), directions: t('directions') };
  }, [t]);

  // Initialize the map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    if (!isWebGLAvailable()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reflecting a one-time platform capability check into UI state is intentional
      setWebglUnavailable(true);
      return;
    }

    const initialStyle = document.documentElement.classList.contains('dark') ? DARK_STYLE : LIGHT_STYLE;
    currentStyleRef.current = initialStyle;

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: initialStyle,
        center: [0, 20],
        zoom: 1.5,
        attributionControl: { compact: true },
      });
    } catch {
      // The feature-detection probe above can pass while the real context
      // creation still fails (e.g. some driver/blocklist combinations).
      setWebglUnavailable(true);
      return;
    }
    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    const addDataLayers = () => {
      if (map.getSource(SOURCE_ID)) return;
      const primary =
        getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#2563EB';
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: toGeoJSON(markersRef.current),
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      });

      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': primary,
          'circle-opacity': 0.85,
          'circle-radius': ['step', ['get', 'point_count'], 16, 10, 22, 50, 28],
        },
      });

      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-size': 12,
        },
        paint: { 'text-color': '#ffffff' },
      });

      map.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: SOURCE_ID,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': primary,
          'circle-radius': 7,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });
    };

    // Fires after initial style load AND after every setStyle (theme switch)
    map.on('style.load', addDataLayers);

    map.on('click', 'clusters', (event) => {
      const features = map.queryRenderedFeatures(event.point, { layers: ['clusters'] });
      const clusterId = Number(features[0]?.properties?.cluster_id);
      if (!Number.isFinite(clusterId)) return;
      const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource;
      const geometry = features[0].geometry as GeoJSON.Point;
      const center = geometry.coordinates as [number, number];
      source
        .getClusterExpansionZoom(clusterId)
        .then((zoom) => {
          if (prefersReducedMotion()) {
            map.jumpTo({ center, zoom });
          } else {
            map.easeTo({ center, zoom });
          }
        })
        .catch(() => {
          // The source can be removed between the click and this promise resolving
          // (e.g. a theme switch triggers setStyle), making the rejection safe to ignore.
        });
    });

    map.on('click', 'unclustered-point', (event) => {
      const feature = event.features?.[0];
      if (!feature) return;
      const props = feature.properties as unknown as MarkerProperties;
      const geometry = feature.geometry as GeoJSON.Point;
      openPopup(map, geometry.coordinates as [number, number], props, translationsRef.current);
    });

    for (const layer of ['clusters', 'unclustered-point']) {
      map.on('mouseenter', layer, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', layer, () => {
        map.getCanvas().style.cursor = '';
      });
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Switch style on theme change (layers re-added via the style.load handler)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const nextStyle = isDark ? DARK_STYLE : LIGHT_STYLE;
    if (currentStyleRef.current === nextStyle) return;
    currentStyleRef.current = nextStyle;
    map.setStyle(nextStyle);
  }, [isDark]);

  // Push marker updates into the source
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(toGeoJSON(markers));
    }
  }, [markers]);

  // Handle the ?focus= deep link once, after the map and data exist
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusId || focusHandledRef.current) return;
    const target = markers.find((marker) => marker.id === focusId);
    if (!target) return;
    focusHandledRef.current = true;

    const apply = () => {
      map.jumpTo({ center: [target.longitude, target.latitude], zoom: FOCUS_ZOOM });
      openPopup(
        map,
        [target.longitude, target.latitude],
        { id: target.id, personId: target.personId, personName: target.personName, label: target.label },
        translationsRef.current
      );
    };
    if (map.isStyleLoaded()) {
      apply();
    } else {
      map.once('style.load', apply);
    }
  }, [focusId, markers]);

  // Fit bounds to visible markers when there is no focus target
  useEffect(() => {
    const map = mapRef.current;
    if (!map || focusId || markers.length === 0) return;
    const bounds = new maplibregl.LngLatBounds();
    for (const marker of markers) {
      bounds.extend([marker.longitude, marker.latitude]);
    }
    map.fitBounds(bounds, { padding: 64, maxZoom: 12, animate: !prefersReducedMotion() });
  }, [markers, focusId]);

  if (webglUnavailable) {
    return (
      <div className="absolute inset-0 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <p className="text-muted">{t('webglUnavailable')}</p>
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className="absolute inset-0" aria-label={t('title')} role="application" />;
}

// Popup content is built with DOM APIs and textContent (never innerHTML with
// user data) so person names cannot inject markup.
function openPopup(
  map: maplibregl.Map,
  coordinates: [number, number],
  props: MarkerProperties,
  labels: { viewContact: string; directions: string }
): void {
  const container = document.createElement('div');
  container.className = 'space-y-1';

  const name = document.createElement('div');
  name.className = 'font-semibold text-sm';
  name.textContent = props.personName;
  container.appendChild(name);

  const label = document.createElement('div');
  label.className = 'text-xs opacity-70 capitalize';
  label.textContent = props.label;
  container.appendChild(label);

  const links = document.createElement('div');
  links.className = 'flex gap-3 pt-1 text-xs';

  const contactLink = document.createElement('a');
  contactLink.href = `/people/${encodeURIComponent(props.personId)}`;
  contactLink.textContent = labels.viewContact;
  contactLink.className = 'underline';
  links.appendChild(contactLink);

  const directionsLink = document.createElement('a');
  directionsLink.href = `https://www.google.com/maps?q=${coordinates[1]},${coordinates[0]}`;
  directionsLink.target = '_blank';
  directionsLink.rel = 'noopener noreferrer';
  directionsLink.textContent = labels.directions;
  directionsLink.className = 'underline';
  links.appendChild(directionsLink);

  container.appendChild(links);

  new maplibregl.Popup({ closeButton: true, offset: 12 }).setLngLat(coordinates).setDOMContent(container).addTo(map);
}
