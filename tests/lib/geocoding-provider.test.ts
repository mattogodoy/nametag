import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: { GEOCODER_URL: 'https://geocoder.test' },
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
});
