import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: { GEOCODER_URL: 'https://geocoder.test' },
}));

// Run queued requests immediately: the provider routes every HTTP request
// through the rate-limit queue, which would otherwise add real delays here.
vi.mock('../../lib/geocoding/queue', () => ({
  enqueueGeocodeRequest: <T,>(task: () => Promise<T>) => task(),
}));

import { geocodeAddress, GeocodingProviderError } from '../../lib/geocoding/provider';

const address = {
  streetLine1: '123 Main St',
  streetLine2: null,
  locality: 'Springfield',
  region: 'IL',
  postalCode: '62701',
  country: 'US',
};

/** URLSearchParams encodes spaces as '+', which decodeURIComponent leaves alone. */
function decodedUrl(url: string): string {
  return decodeURIComponent(url.replace(/\+/g, ' '));
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('geocodeAddress', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('sends a structured query with a User-Agent and returns coordinates', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([{ lat: '39.7817', lon: '-89.6501' }]));

    const result = await geocodeAddress(address);

    expect(result).toEqual({ latitude: 39.7817, longitude: -89.6501 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('https://geocoder.test/search?');
    expect(url).toContain('street=123+Main+St');
    expect(url).toContain('city=Springfield');
    expect(url).toContain('format=jsonv2');
    expect(url).toContain('limit=1');
    const headers = init.headers as Record<string, string>;
    expect(headers['User-Agent']).toContain('Nametag');
  });

  it('falls back to a free-text query when the structured query is empty', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([{ lat: '1.5', lon: '2.5' }]));

    const result = await geocodeAddress(address);

    expect(result).toEqual({ latitude: 1.5, longitude: 2.5 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [secondUrl] = fetchMock.mock.calls[1] as [string];
    expect(secondUrl).toContain('q=');
  });

  it('returns null when both queries find nothing', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    expect(await geocodeAddress(address)).toBeNull();
  });

  it('throws GeocodingProviderError on HTTP errors', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'boom' }, 503));
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'boom' }, 503));
    await expect(geocodeAddress(address)).rejects.toBeInstanceOf(GeocodingProviderError);
  });

  it('returns null on malformed provider payloads', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ unexpected: true }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ unexpected: true }));
    expect(await geocodeAddress(address)).toBeNull();
  });

  it('falls back to free-text when the structured query fails transiently', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: 'boom' }, 503))
      .mockResolvedValueOnce(jsonResponse([{ lat: '1.5', lon: '2.5' }]));

    const result = await geocodeAddress(address);

    expect(result).toEqual({ latitude: 1.5, longitude: 2.5 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [secondUrl] = fetchMock.mock.calls[1] as [string];
    expect(secondUrl).toContain('q=');
  });

  it('rejects with GeocodingProviderError when both structured and free-text queries fail', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: 'boom' }, 503))
      .mockResolvedValueOnce(jsonResponse({ error: 'boom' }, 503));

    await expect(geocodeAddress(address)).rejects.toBeInstanceOf(GeocodingProviderError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('exposes the HTTP status on provider errors', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'slow down' }, 429));

    const error = await geocodeAddress(address).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(GeocodingProviderError);
    expect((error as GeocodingProviderError).status).toBe(429);
  });

  it('does not attempt the free-text fallback when rate limited', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'slow down' }, 429));

    await expect(geocodeAddress(address)).rejects.toBeInstanceOf(GeocodingProviderError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('never sends the second address line in the structured query', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([{ lat: '39.78', lon: '-89.65' }]));

    const result = await geocodeAddress({ ...address, streetLine2: 'works at Random Company' });

    expect(result).toEqual({ latitude: 39.78, longitude: -89.65 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('street=123+Main+St');
    expect(url).not.toContain('Random');
  });

  it('lets a meaningful second line contribute via free text before dropping it', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([{ lat: '19.43', lon: '-99.13' }]));

    const result = await geocodeAddress({ ...address, streetLine2: 'Colonia Centro' });

    expect(result).toEqual({ latitude: 19.43, longitude: -99.13 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [secondUrl] = fetchMock.mock.calls[1] as [string];
    expect(decodedUrl(secondUrl)).toContain('Colonia Centro');
  });

  it('retries the free-text query without a noisy second line as a last resort', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([{ lat: '39.78', lon: '-89.65' }]));

    const result = await geocodeAddress({ ...address, streetLine2: 'works at Random Company' });

    expect(result).toEqual({ latitude: 39.78, longitude: -89.65 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [secondUrl] = fetchMock.mock.calls[1] as [string];
    const [thirdUrl] = fetchMock.mock.calls[2] as [string];
    expect(decodedUrl(secondUrl)).toContain('Random Company');
    expect(decodedUrl(thirdUrl)).not.toContain('Random Company');
    expect(decodedUrl(thirdUrl)).toContain('123 Main St');
  });

  it('skips the third attempt when there is no second line', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([])).mockResolvedValueOnce(jsonResponse([]));

    expect(await geocodeAddress(address)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('surfaces a transient error instead of a permanent failure when later attempts find nothing', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: 'boom' }, 503))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]));

    await expect(
      geocodeAddress({ ...address, streetLine2: 'Suite 12' })
    ).rejects.toBeInstanceOf(GeocodingProviderError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
