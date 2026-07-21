import { z } from 'zod';
import { env } from '@/lib/env';
import type { AddressFields } from './hash';
import { enqueueGeocodeRequest } from './queue';

export interface GeocodeResult {
  latitude: number;
  longitude: number;
}

/** Transient provider failure (network, 5xx, rate limit). Safe to retry later. */
export class GeocodingProviderError extends Error {
  /** HTTP status when the provider responded (e.g. 429); undefined for network errors */
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'GeocodingProviderError';
    this.status = status;
  }
}

const nominatimResponseSchema = z.array(z.object({ lat: z.string(), lon: z.string() }));

// Identify ourselves to the provider, required by the OSM Nominatim usage policy.
const USER_AGENT = 'Nametag (+https://github.com/mattogodoy/nametag)';

// Every HTTP request goes through the rate-limit queue individually. Wrapping
// anything coarser (a whole address, which may need a structured attempt plus
// a free-text fallback) lets bursts of back-to-back requests through and gets
// the instance 429-banned by the public Nominatim.
async function search(params: URLSearchParams): Promise<GeocodeResult | null> {
  params.set('format', 'jsonv2');
  params.set('limit', '1');
  const base = env.GEOCODER_URL.replace(/\/+$/, '');

  return enqueueGeocodeRequest(async () => {
    let response: Response;
    try {
      response = await fetch(`${base}/search?${params.toString()}`, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      });
    } catch (error) {
      throw new GeocodingProviderError(
        error instanceof Error ? error.message : 'Network error contacting geocoder'
      );
    }

    if (!response.ok) {
      throw new GeocodingProviderError(`Geocoder responded with status ${response.status}`, response.status);
    }

    const parsed = nominatimResponseSchema.safeParse(await response.json());
    if (!parsed.success || parsed.data.length === 0) {
      return null;
    }

    const latitude = Number.parseFloat(parsed.data[0].lat);
    const longitude = Number.parseFloat(parsed.data[0].lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }
    return { latitude, longitude };
  });
}

/**
 * Geocode an address against the configured Nominatim-compatible provider.
 * Tries a structured query first, then falls back to free text, which copes
 * better with unusual formats. Returns null when the provider finds nothing.
 */
export async function geocodeAddress(address: AddressFields): Promise<GeocodeResult | null> {
  const line2 = address.streetLine2?.trim() || null;
  let firstTransientError: GeocodingProviderError | null = null;

  // Runs one lookup in the cascade. A 429 aborts the whole cascade (the
  // provider wants LESS traffic); other transient errors are remembered and
  // the cascade continues, so one flaky attempt cannot mask a fallback that
  // would have succeeded.
  const attempt = async (params: URLSearchParams): Promise<GeocodeResult | null> => {
    try {
      return await search(params);
    } catch (error) {
      if (!(error instanceof GeocodingProviderError)) throw error;
      if (error.status === 429) throw error;
      firstTransientError ??= error;
      return null;
    }
  };

  // 1. Structured query, first street line only. Nominatim's street
  // parameter expects "housenumber streetname"; unit numbers, building
  // names, or free-form annotations in the second line only break the
  // match, so the second line never participates here.
  const structured = new URLSearchParams();
  if (address.streetLine1) structured.set('street', address.streetLine1);
  if (address.locality) structured.set('city', address.locality);
  if (address.region) structured.set('state', address.region);
  if (address.postalCode) structured.set('postalcode', address.postalCode);
  if (address.country) structured.set('country', address.country);

  if ([...structured.keys()].length > 0) {
    const result = await attempt(structured);
    if (result) return result;
  }

  // 2. Free text including the second line: the only query where legitimate
  // second-line content (building names, neighborhoods, colonias) can
  // contribute or disambiguate.
  const withoutLine2 = [
    address.streetLine1,
    address.locality,
    address.region,
    address.postalCode,
    address.country,
  ]
    .filter(Boolean)
    .join(', ');
  const withLine2 = [
    address.streetLine1,
    line2,
    address.locality,
    address.region,
    address.postalCode,
    address.country,
  ]
    .filter(Boolean)
    .join(', ');

  if (withLine2) {
    const result = await attempt(new URLSearchParams({ q: withLine2 }));
    if (result) return result;
  }

  // 3. Free text without the second line: rescues addresses whose second
  // line is noise the provider chokes on (annotations, unit numbers).
  if (line2 && withoutLine2) {
    const result = await attempt(new URLSearchParams({ q: withoutLine2 }));
    if (result) return result;
  }

  // Exhausted without a hit. If any attempt failed transiently, surface the
  // error so the caller keeps the address pending instead of caching a
  // permanent failure the provider never actually asserted.
  if (firstTransientError) throw firstTransientError;
  return null;
}
