import { z } from 'zod';
import { env } from '@/lib/env';
import type { AddressFields } from './hash';

export interface GeocodeResult {
  latitude: number;
  longitude: number;
}

/** Transient provider failure (network, 5xx, rate limit). Safe to retry later. */
export class GeocodingProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeocodingProviderError';
  }
}

const nominatimResponseSchema = z.array(z.object({ lat: z.string(), lon: z.string() }));

// Identify ourselves to the provider, required by the OSM Nominatim usage policy.
const USER_AGENT = 'Nametag (+https://github.com/mattogodoy/nametag)';

async function search(params: URLSearchParams): Promise<GeocodeResult | null> {
  params.set('format', 'jsonv2');
  params.set('limit', '1');
  const base = env.GEOCODER_URL.replace(/\/+$/, '');

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
    throw new GeocodingProviderError(`Geocoder responded with status ${response.status}`);
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
}

/**
 * Geocode an address against the configured Nominatim-compatible provider.
 * Tries a structured query first, then falls back to free text, which copes
 * better with unusual formats. Returns null when the provider finds nothing.
 */
export async function geocodeAddress(address: AddressFields): Promise<GeocodeResult | null> {
  const street = [address.streetLine1, address.streetLine2].filter(Boolean).join(', ');

  const structured = new URLSearchParams();
  if (street) structured.set('street', street);
  if (address.locality) structured.set('city', address.locality);
  if (address.region) structured.set('state', address.region);
  if (address.postalCode) structured.set('postalcode', address.postalCode);
  if (address.country) structured.set('country', address.country);

  const freeText = [street, address.locality, address.region, address.postalCode, address.country]
    .filter(Boolean)
    .join(', ');

  if ([...structured.keys()].length > 0) {
    try {
      const result = await search(structured);
      if (result) return result;
    } catch (error) {
      if (!(error instanceof GeocodingProviderError)) throw error;
      // Structured query failed transiently: fall through to the free-text
      // attempt below rather than aborting, unless there is nothing to try.
      if (!freeText) throw error;
    }
  }

  if (!freeText) return null;

  return search(new URLSearchParams({ q: freeText }));
}
