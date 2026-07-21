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
// MapLibre scales animation time with camera distance, so long jumps (world
// view to one city) can run for several seconds. Cap all camera animations.
const CAMERA_ANIMATION_MS = 1000;

// Photo marker icons: rendered offscreen at 2x devicePixelRatio (48px bitmap
// for a 24px displayed icon), matching how the network graph draws person
// nodes (filled/ringed circle, photo clipped on top).
const ICON_BITMAP_SIZE = 48;
const ICON_PIXEL_RATIO = 2; // 48 / 2 = 24px displayed icon
const ICON_RING_WIDTH = 4; // bitmap-space; 2px at display scale
const ICON_FILL_RADIUS = 22; // bitmap-space; leaves room for the ring to stay inside the canvas
// Same fallback grays the network graph uses for ungrouped nodes.
const RING_FALLBACK_LIGHT = '#d1d5db';
const RING_FALLBACK_DARK = '#4b5563';

type PhotoEntry = HTMLImageElement | 'loading' | 'error';

function iconIdFor(personId: string): string {
  return `person-${personId}`;
}

function ringColorFor(marker: MapMarker, isDark: boolean): string {
  return marker.groupColor ?? (isDark ? RING_FALLBACK_DARK : RING_FALLBACK_LIGHT);
}

/** Draws a circle-clipped photo with a colored ring onto an offscreen canvas, like the network graph's person nodes. */
function compositeIcon(image: HTMLImageElement, ringColor: string): ImageData | null {
  const canvas = document.createElement('canvas');
  canvas.width = ICON_BITMAP_SIZE;
  canvas.height = ICON_BITMAP_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const center = ICON_BITMAP_SIZE / 2;

  ctx.beginPath();
  ctx.arc(center, center, ICON_FILL_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = ringColor;
  ctx.fill();
  ctx.lineWidth = ICON_RING_WIDTH;
  ctx.strokeStyle = ringColor;
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.arc(center, center, ICON_FILL_RADIUS, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(
    image,
    center - ICON_FILL_RADIUS,
    center - ICON_FILL_RADIUS,
    ICON_FILL_RADIUS * 2,
    ICON_FILL_RADIUS * 2,
  );
  ctx.restore();

  return ctx.getImageData(0, 0, ICON_BITMAP_SIZE, ICON_BITMAP_SIZE);
}

interface MapViewProps {
  markers: MapMarker[];
  focusId: string | null;
  /**
   * Serialized filter state ("|"-joined values). The camera fits to the
   * visible markers whenever it changes, and also on arrival when it starts
   * out non-empty (a shared pre-filtered URL). Only an initially-empty
   * filter state keeps the world view.
   */
  filtersKey: string;
}

/** True when every segment of the "|"-joined filter key is empty. */
function isEmptyFiltersKey(key: string): boolean {
  return key.split('|').every((part) => part === '');
}

interface MarkerProperties {
  id: string;
  personId: string;
  personName: string;
  label: string;
  addressText?: string;
  /** Registered icon image id, present only once the person's photo icon has loaded */
  iconId?: string;
  /** First group's color, used for the plain dot when there is no photo icon yet */
  dotColor?: string;
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

function toGeoJSON(
  markers: MapMarker[],
  registeredIconPersonIds: ReadonlySet<string>
): GeoJSON.FeatureCollection<GeoJSON.Point, MarkerProperties> {
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
        // Omitted rather than null: null-valued GeoJSON properties do not
        // survive the round trip through queryRenderedFeatures reliably.
        ...(marker.addressText ? { addressText: marker.addressText } : {}),
        ...(marker.hasPhoto && registeredIconPersonIds.has(marker.personId)
          ? { iconId: iconIdFor(marker.personId) }
          : {}),
        ...(marker.groupColor ? { dotColor: marker.groupColor } : {}),
      },
    })),
  };
}

export default function MapView({ markers, focusId, filtersKey }: MapViewProps) {
  const t = useTranslations('map');
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const currentStyleRef = useRef<string | null>(null);
  const markersRef = useRef<MapMarker[]>(markers);
  const focusHandledRef = useRef<string | null>(null);
  const appliedFiltersKeyRef = useRef<string | null>(null);
  const isDark = useIsDarkTheme();
  const isDarkRef = useRef(isDark);
  const translationsRef = useRef({ viewContact: t('viewContact'), directions: t('directions') });
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  // Photo marker icon caches. These live for the component's lifetime (not
  // per map instance) so a theme switch or style reload only has to
  // re-register already-composited bitmaps, never re-fetch photos.
  const photoElementCacheRef = useRef(new Map<string, PhotoEntry>());
  const bitmapCacheRef = useRef(new Map<string, ImageData>());
  // personId -> ring color currently registered as a map image, scoped to
  // the CURRENT style: custom images do not survive setStyle, so this is
  // cleared and rebuilt every time the style (re)loads.
  const registeredColorRef = useRef(new Map<string, string>());
  const ensureIconsRef = useRef<(() => void) | null>(null);
  const pendingSourceUpdateRef = useRef(false);

  // Keep "latest value" refs in sync via effects rather than during render,
  // since the map init effect below registers event handlers once (empty
  // deps) and reads these refs later, outside of render.
  useEffect(() => {
    markersRef.current = markers;
  }, [markers]);

  useEffect(() => {
    translationsRef.current = { viewContact: t('viewContact'), directions: t('directions') };
  }, [t]);

  useEffect(() => {
    isDarkRef.current = isDark;
  }, [isDark]);

  // Initialize the map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    // Per-map-instance disposed flag. Deliberately a closure variable and
    // NOT a shared ref: async photo loads started by one map instance can
    // complete after a StrictMode unmount/remount cycle, and a shared ref
    // reset by the new mount would let the stale closure operate on the
    // removed map (whose style is gone, crashing hasImage/addImage).
    let mapDisposed = false;

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

    // Coalesces synchronous or rapid-fire icon updates (a batch of photo
    // loads finishing around the same time) into a single setData call.
    const scheduleSourceUpdate = () => {
      if (pendingSourceUpdateRef.current) return;
      pendingSourceUpdateRef.current = true;
      queueMicrotask(() => {
        pendingSourceUpdateRef.current = false;
        if (mapDisposed) return;
        const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
        if (!source) return;
        source.setData(toGeoJSON(markersRef.current, new Set(registeredColorRef.current.keys())));
      });
    };

    const registerBitmap = (personId: string, bitmap: ImageData, color: string) => {
      const iconId = iconIdFor(personId);
      if (map.hasImage(iconId)) {
        map.updateImage(iconId, bitmap);
      } else {
        map.addImage(iconId, bitmap, { pixelRatio: ICON_PIXEL_RATIO });
      }
      registeredColorRef.current.set(personId, color);
    };

    // Loads and composites each photo marker's icon (from cache when
    // possible) and registers it as a map image. Re-entrant and safe to call
    // repeatedly: markers already registered with the current ring color are
    // skipped, so this never loops. Called on marker changes, when a photo
    // finishes loading, and on every style reload (setStyle drops custom
    // images, so re-registering from the bitmap cache is required, but never
    // re-fetches the photo itself).
    const ensureIcons = () => {
      if (mapDisposed) return;
      let didRegisterAny = false;
      for (const marker of markersRef.current) {
        if (!marker.hasPhoto) continue;
        const personId = marker.personId;
        const color = ringColorFor(marker, isDarkRef.current);
        if (registeredColorRef.current.get(personId) === color && map.hasImage(iconIdFor(personId))) {
          continue;
        }

        const bitmapKey = `${personId}:${color}`;
        const cachedBitmap = bitmapCacheRef.current.get(bitmapKey);
        if (cachedBitmap) {
          registerBitmap(personId, cachedBitmap, color);
          didRegisterAny = true;
          continue;
        }

        const photoEntry = photoElementCacheRef.current.get(personId);
        if (photoEntry === 'error') continue; // permanently falls back to the dot for this session
        if (photoEntry === 'loading') continue; // already in flight; onload will re-run ensureIcons
        if (photoEntry instanceof HTMLImageElement) {
          const bitmap = compositeIcon(photoEntry, color);
          if (bitmap) {
            bitmapCacheRef.current.set(bitmapKey, bitmap);
            registerBitmap(personId, bitmap, color);
            didRegisterAny = true;
          }
          continue;
        }

        // Not cached yet: kick off a same-origin photo fetch (canvas
        // compositing stays untainted).
        photoElementCacheRef.current.set(personId, 'loading');
        const img = new Image();
        // The caches are shared across map instances on purpose (photos and
        // bitmaps stay valid), but re-entry goes through ensureIconsRef so
        // it always runs against the LIVE map instance, which self-guards
        // with its own mapDisposed flag.
        img.onload = () => {
          photoElementCacheRef.current.set(personId, img);
          ensureIconsRef.current?.();
        };
        img.onerror = () => {
          photoElementCacheRef.current.set(personId, 'error');
        };
        img.src = `/api/photos/${personId}`;
      }
      if (didRegisterAny) scheduleSourceUpdate();
    };
    ensureIconsRef.current = ensureIcons;

    const addDataLayers = () => {
      if (map.getSource(SOURCE_ID)) return;
      // Custom images do not survive setStyle; every registration here is
      // for the fresh style, even if the underlying bitmap was cached.
      registeredColorRef.current.clear();
      const primary =
        getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#2563EB';

      ensureIcons();

      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: toGeoJSON(markersRef.current, new Set(registeredColorRef.current.keys())),
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

      // Plain colored dot: markers without a photo, or whose photo icon
      // has not registered yet (upgrades to the photo layer once ready).
      map.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: SOURCE_ID,
        filter: ['all', ['!', ['has', 'point_count']], ['!', ['has', 'iconId']]],
        paint: {
          'circle-color': ['coalesce', ['get', 'dotColor'], primary],
          'circle-radius': 7,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

      // Circular photo thumbnail, ringed with the person's first group
      // color, matching the network graph's person nodes.
      map.addLayer({
        id: 'unclustered-photo',
        type: 'symbol',
        source: SOURCE_ID,
        filter: ['all', ['!', ['has', 'point_count']], ['has', 'iconId']],
        layout: {
          'icon-image': ['get', 'iconId'],
          'icon-size': 1,
          'icon-allow-overlap': true,
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
            map.easeTo({ center, zoom, duration: CAMERA_ANIMATION_MS });
          }
        })
        .catch(() => {
          // The source can be removed between the click and this promise resolving
          // (e.g. a theme switch triggers setStyle), making the rejection safe to ignore.
        });
    });

    const handleUnclusteredClick = (event: maplibregl.MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature) return;
      const props = feature.properties as unknown as MarkerProperties;
      const geometry = feature.geometry as GeoJSON.Point;
      openPopup(map, geometry.coordinates as [number, number], props, translationsRef.current);
    };

    map.on('click', 'unclustered-point', handleUnclusteredClick);
    map.on('click', 'unclustered-photo', handleUnclusteredClick);

    for (const layer of ['clusters', 'unclustered-point', 'unclustered-photo']) {
      map.on('mouseenter', layer, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', layer, () => {
        map.getCanvas().style.cursor = '';
      });
    }

    // Captured once for the cleanup below: it is always the same Map
    // instance for the component's lifetime (only ever mutated, never
    // reassigned), so reading it via this local satisfies the lint rule
    // without changing behavior.
    const registeredColors = registeredColorRef.current;

    return () => {
      mapDisposed = true;
      ensureIconsRef.current = null;
      // Registered images belonged to this map instance; a remount starts
      // from an empty style with no custom images.
      registeredColors.clear();
      map.remove();
      mapRef.current = null;
      // The popup and camera state died with the map; let the focus and
      // filter-fit effects re-apply on the next map instance (StrictMode
      // remounts in dev, for example).
      focusHandledRef.current = null;
      appliedFiltersKeyRef.current = null;
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

  // Push marker updates into the source, and load/register any newly
  // visible photo icons (upgrading their markers from dot to photo once
  // ready; see ensureIcons in the map init effect).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    ensureIconsRef.current?.();
    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(toGeoJSON(markers, new Set(registeredColorRef.current.keys())));
    }
  }, [markers]);

  // Handle the ?focus= deep link once, after the map and data exist
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusId || focusHandledRef.current === focusId) return;
    const target = markers.find((marker) => marker.id === focusId);
    if (!target) return;
    focusHandledRef.current = focusId;

    // Camera moves and popups do not depend on the style being loaded, so
    // apply immediately. Waiting for style.load here is a race: MapLibre's
    // isStyleLoaded() can still report false after the event already fired,
    // in which case a once('style.load') listener never runs.
    map.jumpTo({ center: [target.longitude, target.latitude], zoom: FOCUS_ZOOM });
    openPopup(
      map,
      [target.longitude, target.latitude],
      {
        id: target.id,
        personId: target.personId,
        personName: target.personName,
        label: target.label,
        ...(target.addressText ? { addressText: target.addressText } : {}),
      },
      translationsRef.current
    );
  }, [focusId, markers]);

  // Fit the camera to the visible markers whenever the user changes filters,
  // including clearing them back to "all". Arriving with filters already in
  // the URL fits immediately; only an initially-empty filter state keeps the
  // world view on arrival.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || focusId) {
      appliedFiltersKeyRef.current = filtersKey;
      return;
    }
    const previous = appliedFiltersKeyRef.current;
    appliedFiltersKeyRef.current = filtersKey;
    if (previous === filtersKey) return;
    if (previous === null && isEmptyFiltersKey(filtersKey)) return;
    if (markers.length === 0) return;
    const bounds = new maplibregl.LngLatBounds();
    for (const marker of markers) {
      bounds.extend([marker.longitude, marker.latitude]);
    }
    map.fitBounds(bounds, {
      padding: 64,
      maxZoom: 12,
      duration: CAMERA_ANIMATION_MS,
      animate: !prefersReducedMotion(),
    });
  }, [markers, focusId, filtersKey]);

  if (webglUnavailable) {
    return (
      <div className="absolute inset-0 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <p className="text-muted">{t('webglUnavailable')}</p>
        </div>
      </div>
    );
  }

  // MapLibre's stylesheet forces position: relative on its container, which
  // would override Tailwind's `absolute` and collapse the element to zero
  // height. Positioning lives on an outer div we own; MapLibre gets a child
  // sized with h-full/w-full, which its position override cannot break.
  return (
    <div className="absolute inset-0" aria-label={t('title')} role="application">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
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
  // MapLibre popups have a white background regardless of app theme, so the
  // text color must be explicit; inheriting the dark theme's light text
  // would render white-on-white.
  container.className = 'space-y-1 text-gray-900';

  const name = document.createElement('div');
  name.className = 'font-semibold text-sm';
  name.textContent = props.personName;
  container.appendChild(name);

  const label = document.createElement('div');
  label.className = 'text-xs opacity-70 capitalize';
  label.textContent = props.label;
  container.appendChild(label);

  if (typeof props.addressText === 'string' && props.addressText.length > 0) {
    const addressLine = document.createElement('div');
    addressLine.className = 'text-xs max-w-56';
    addressLine.textContent = props.addressText;
    container.appendChild(addressLine);
  }

  const links = document.createElement('div');
  links.className = 'flex gap-3 pt-1 text-xs';

  const contactLink = document.createElement('a');
  contactLink.href = `/people/${encodeURIComponent(props.personId)}`;
  contactLink.textContent = labels.viewContact;
  contactLink.className = 'underline text-blue-700';
  links.appendChild(contactLink);

  const directionsLink = document.createElement('a');
  directionsLink.href = `https://www.google.com/maps?q=${coordinates[1]},${coordinates[0]}`;
  directionsLink.target = '_blank';
  directionsLink.rel = 'noopener noreferrer';
  directionsLink.textContent = labels.directions;
  directionsLink.className = 'underline text-blue-700';
  links.appendChild(directionsLink);

  container.appendChild(links);

  new maplibregl.Popup({ closeButton: true, offset: 12 }).setLngLat(coordinates).setDOMContent(container).addTo(map);
}
