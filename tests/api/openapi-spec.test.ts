import { describe, it, expect } from 'vitest';
import { generateOpenAPISpec } from '../../lib/openapi';

describe('OpenAPI Specification', () => {
  const spec = generateOpenAPISpec();

  it('should be valid OpenAPI 3.1.0', () => {
    expect(spec.openapi).toBe('3.1.0');
  });

  it('should have info with title and version', () => {
    expect(spec.info.title).toBe('Nametag API');
    expect(spec.info.version).toBeDefined();
  });

  it('should have a session security scheme', () => {
    expect(spec.components.securitySchemes.session).toBeDefined();
    expect(spec.components.securitySchemes.session.type).toBe('apiKey');
    expect(spec.components.securitySchemes.session.in).toBe('cookie');
  });

  it('should define all expected tags', () => {
    const tagNames = spec.tags.map((t: { name: string }) => t.name);
    expect(tagNames).toContain('Auth');
    expect(tagNames).toContain('People');
    expect(tagNames).toContain('Groups');
    expect(tagNames).toContain('Relationships');
    expect(tagNames).toContain('Important Dates');
    expect(tagNames).toContain('Dashboard');
    expect(tagNames).toContain('User Settings');
    expect(tagNames).toContain('Billing');
    expect(tagNames).toContain('Deleted Items');
    expect(tagNames).toContain('System');
  });

  it('should have paths for all new endpoints', () => {
    expect(spec.paths['/api/dashboard/stats']).toBeDefined();
    expect(spec.paths['/api/people/{id}/important-dates']).toBeDefined();
    expect(spec.paths['/api/relationships']).toBeDefined();
    expect(spec.paths['/api/relationships/{id}']).toBeDefined();
    expect(spec.paths['/api/user/profile']).toBeDefined();
    expect(spec.paths['/api/openapi.json']).toBeDefined();
    expect(spec.paths['/api/docs']).toBeDefined();
  });

  it('should have GET method on all new read endpoints', () => {
    expect(spec.paths['/api/dashboard/stats'].get).toBeDefined();
    expect(spec.paths['/api/people/{id}/important-dates'].get).toBeDefined();
    expect(spec.paths['/api/relationships'].get).toBeDefined();
    expect(spec.paths['/api/relationships/{id}'].get).toBeDefined();
    expect(spec.paths['/api/user/profile'].get).toBeDefined();
  });

  it('should have POST method on important-dates', () => {
    expect(spec.paths['/api/people/{id}/important-dates'].post).toBeDefined();
  });

  it('should require auth on protected endpoints', () => {
    expect(spec.paths['/api/dashboard/stats'].get.security).toEqual([{ session: [] }]);
    expect(spec.paths['/api/relationships'].get.security).toEqual([{ session: [] }]);
    expect(spec.paths['/api/user/profile'].get.security).toEqual([{ session: [] }]);
  });

  it('should not require auth on public system endpoints', () => {
    expect(spec.paths['/api/openapi.json'].get.security).toBeUndefined();
    expect(spec.paths['/api/docs'].get.security).toBeUndefined();
    expect(spec.paths['/api/health'].get.security).toBeUndefined();
  });

  it('should have all $ref paths resolve to existing schemas', () => {
    const schemaNames = Object.keys(spec.components.schemas);
    const specStr = JSON.stringify(spec);
    const refPattern = /"\$ref"\s*:\s*"#\/components\/schemas\/([^"]+)"/g;
    let match;
    while ((match = refPattern.exec(specStr)) !== null) {
      expect(schemaNames).toContain(match[1]);
    }
  });

  it('should use oneOf for nullable enums instead of mixing null in enum arrays', () => {
    // ReminderIntervalUnit should be a pure string enum
    const reminderUnit = spec.components.schemas.ReminderIntervalUnit;
    expect(reminderUnit.type).toBe('string');
    expect(reminderUnit.enum).not.toContain(null);

    // UpcomingEvent.titleKey should use oneOf
    const titleKey = spec.components.schemas.UpcomingEvent.properties.titleKey;
    expect(titleKey.oneOf).toBeDefined();
    expect(titleKey.oneOf).toHaveLength(2);

    // ImportantDate.reminderType should use oneOf
    const reminderType = spec.components.schemas.ImportantDate.properties.reminderType;
    expect(reminderType.oneOf).toBeDefined();
  });
});
