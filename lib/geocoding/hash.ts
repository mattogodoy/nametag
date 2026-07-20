import { createHash } from 'node:crypto';

export interface AddressFields {
  streetLine1: string | null;
  streetLine2: string | null;
  locality: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
}

function normalizePart(part: string | null): string {
  return (part ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizedParts(address: AddressFields): string[] {
  return [
    address.streetLine1,
    address.streetLine2,
    address.locality,
    address.region,
    address.postalCode,
    address.country,
  ].map(normalizePart);
}

/**
 * Stable hash of the address text fields. Used to detect when an address
 * needs (re-)geocoding and as the key for GeocodeCache.
 */
export function buildAddressHash(address: AddressFields): string {
  return createHash('sha256').update(normalizedParts(address).join('|')).digest('hex');
}

/** An address with no text content can never be geocoded. */
export function hasGeocodableContent(address: AddressFields): boolean {
  return normalizedParts(address).some((part) => part.length > 0);
}
