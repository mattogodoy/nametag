import { describe, it, expect } from 'vitest';
import {
  TIER_LIMITS,
  TIER_INFO,
  getTierLimit,
  isUnlimited,
} from '@/lib/billing/constants';

describe('billing/constants', () => {
  describe('TIER_LIMITS', () => {
    it('should define limits for FREE tier', () => {
      expect(TIER_LIMITS.FREE).toEqual({
        maxPeople: 50,
        maxGroups: 10,
        maxReminders: 5,
      });
    });

    it('should define limits for PERSONAL tier', () => {
      expect(TIER_LIMITS.PERSONAL).toEqual({
        maxPeople: 1000,
        maxGroups: 500,
        maxReminders: 100,
      });
    });

    it('should define unlimited for PRO tier', () => {
      expect(TIER_LIMITS.PRO.maxPeople).toBe(Infinity);
      expect(TIER_LIMITS.PRO.maxGroups).toBe(Infinity);
      expect(TIER_LIMITS.PRO.maxReminders).toBe(Infinity);
    });

    it('should have increasing limits from FREE to PRO', () => {
      expect(TIER_LIMITS.FREE.maxPeople).toBeLessThan(TIER_LIMITS.PERSONAL.maxPeople);
      expect(TIER_LIMITS.PERSONAL.maxPeople).toBeLessThan(TIER_LIMITS.PRO.maxPeople);
    });
  });

  describe('TIER_INFO', () => {
    it('should define info for all tiers', () => {
      expect(TIER_INFO.FREE).toBeDefined();
      expect(TIER_INFO.PERSONAL).toBeDefined();
      expect(TIER_INFO.PRO).toBeDefined();
    });

    it('should have correct names', () => {
      expect(TIER_INFO.FREE.name).toBe('Free');
      expect(TIER_INFO.PERSONAL.name).toBe('Personal');
      expect(TIER_INFO.PRO.name).toBe('Pro');
    });

    it('should have null prices for FREE tier', () => {
      expect(TIER_INFO.FREE.monthlyPrice).toBeNull();
      expect(TIER_INFO.FREE.yearlyPrice).toBeNull();
    });

    it('should have correct prices for PERSONAL tier', () => {
      expect(TIER_INFO.PERSONAL.monthlyPrice).toBe(1);
      expect(TIER_INFO.PERSONAL.yearlyPrice).toBe(10);
    });

    it('should have correct prices for PRO tier', () => {
      expect(TIER_INFO.PRO.monthlyPrice).toBe(2);
      expect(TIER_INFO.PRO.yearlyPrice).toBe(20);
    });

    it('should have features array for each tier', () => {
      expect(Array.isArray(TIER_INFO.FREE.features)).toBe(true);
      expect(Array.isArray(TIER_INFO.PERSONAL.features)).toBe(true);
      expect(Array.isArray(TIER_INFO.PRO.features)).toBe(true);
      expect(TIER_INFO.FREE.features.length).toBeGreaterThan(0);
    });

    it('should have descriptions for each tier', () => {
      expect(TIER_INFO.FREE.description).toBeTruthy();
      expect(TIER_INFO.PERSONAL.description).toBeTruthy();
      expect(TIER_INFO.PRO.description).toBeTruthy();
    });
  });

  describe('getTierLimit', () => {
    it('should return correct limit for people', () => {
      expect(getTierLimit('FREE', 'people')).toBe(50);
      expect(getTierLimit('PERSONAL', 'people')).toBe(1000);
      expect(getTierLimit('PRO', 'people')).toBe(Infinity);
    });

    it('should return correct limit for groups', () => {
      expect(getTierLimit('FREE', 'groups')).toBe(10);
      expect(getTierLimit('PERSONAL', 'groups')).toBe(500);
      expect(getTierLimit('PRO', 'groups')).toBe(Infinity);
    });

    it('should return correct limit for reminders', () => {
      expect(getTierLimit('FREE', 'reminders')).toBe(5);
      expect(getTierLimit('PERSONAL', 'reminders')).toBe(100);
      expect(getTierLimit('PRO', 'reminders')).toBe(Infinity);
    });
  });

  describe('isUnlimited', () => {
    it('should return false for FREE tier', () => {
      expect(isUnlimited('FREE', 'people')).toBe(false);
      expect(isUnlimited('FREE', 'groups')).toBe(false);
      expect(isUnlimited('FREE', 'reminders')).toBe(false);
    });

    it('should return false for PERSONAL tier', () => {
      expect(isUnlimited('PERSONAL', 'people')).toBe(false);
      expect(isUnlimited('PERSONAL', 'groups')).toBe(false);
      expect(isUnlimited('PERSONAL', 'reminders')).toBe(false);
    });

    it('should return true for PRO tier', () => {
      expect(isUnlimited('PRO', 'people')).toBe(true);
      expect(isUnlimited('PRO', 'groups')).toBe(true);
      expect(isUnlimited('PRO', 'reminders')).toBe(true);
    });
  });
});
