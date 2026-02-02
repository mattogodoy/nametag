import { describe, it, expect } from 'vitest';
import { countries, getCountryName, getCountryCode } from '@/lib/countries';

describe('Countries utilities', () => {
  describe('countries array', () => {
    it('should contain countries with code and name properties', () => {
      expect(countries.length).toBeGreaterThan(0);

      countries.forEach((country) => {
        expect(country).toHaveProperty('code');
        expect(country).toHaveProperty('name');
        expect(country.code).toMatch(/^[A-Z]{2}$/); // ISO 3166-1 alpha-2
        expect(typeof country.name).toBe('string');
      });
    });

    it('should include common countries', () => {
      const codes = countries.map(c => c.code);

      expect(codes).toContain('US'); // United States
      expect(codes).toContain('GB'); // United Kingdom
      expect(codes).toContain('ES'); // Spain
      expect(codes).toContain('FR'); // France
      expect(codes).toContain('DE'); // Germany
      expect(codes).toContain('JP'); // Japan
      expect(codes).toContain('CN'); // China
    });

    it('should have unique country codes', () => {
      const codes = countries.map(c => c.code);
      const uniqueCodes = new Set(codes);

      expect(codes.length).toBe(uniqueCodes.size);
    });
  });

  describe('getCountryName', () => {
    it('should return country name for valid code', () => {
      expect(getCountryName('ES')).toBe('Spain');
      expect(getCountryName('US')).toBe('United States');
      expect(getCountryName('GB')).toBe('United Kingdom');
      expect(getCountryName('FR')).toBe('France');
    });

    it('should return code if country not found', () => {
      expect(getCountryName('XX')).toBe('XX');
    });

    it('should return null for null input', () => {
      expect(getCountryName(null)).toBe(null);
    });

    it('should return null for undefined input', () => {
      expect(getCountryName(undefined)).toBe(null);
    });

    it('should return null for empty string', () => {
      expect(getCountryName('')).toBe(null);
    });
  });

  describe('getCountryCode', () => {
    it('should return country code for valid name', () => {
      expect(getCountryCode('Spain')).toBe('ES');
      expect(getCountryCode('United States')).toBe('US');
      expect(getCountryCode('United Kingdom')).toBe('GB');
      expect(getCountryCode('France')).toBe('FR');
    });

    it('should return name if country not found', () => {
      expect(getCountryCode('Atlantis')).toBe('Atlantis');
    });

    it('should return null for null input', () => {
      expect(getCountryCode(null)).toBe(null);
    });

    it('should return null for undefined input', () => {
      expect(getCountryCode(undefined)).toBe(null);
    });

    it('should return null for empty string', () => {
      expect(getCountryCode('')).toBe(null);
    });
  });

  describe('round-trip conversion', () => {
    it('should convert code to name and back', () => {
      const testCodes = ['ES', 'US', 'GB', 'FR', 'DE', 'JP'];

      testCodes.forEach((code) => {
        const name = getCountryName(code);
        const backToCode = getCountryCode(name);
        expect(backToCode).toBe(code);
      });
    });
  });
});
