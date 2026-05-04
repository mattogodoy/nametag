import { describe, it, expect } from 'vitest';
import { AppError, ExternalServiceError } from '@/lib/errors';

describe('AppError', () => {
  it('exposes code, statusCode, context, and cause', () => {
    const cause = new Error('underlying');
    const err = new AppError('something broke', {
      code: 'custom_code',
      statusCode: 418,
      cause,
      context: { personId: 'p-1' },
    });

    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('AppError');
    expect(err.message).toBe('something broke');
    expect(err.code).toBe('custom_code');
    expect(err.statusCode).toBe(418);
    expect(err.context).toEqual({ personId: 'p-1' });
    expect(err.cause).toBe(cause);
  });

  it('defaults code to app_error and context to {}', () => {
    const err = new AppError('bare');
    expect(err.code).toBe('app_error');
    expect(err.context).toEqual({});
    expect(err.statusCode).toBeUndefined();
  });
});

describe('ExternalServiceError', () => {
  it('auto-derives code from service', () => {
    const err = new ExternalServiceError({
      message: 'CardDAV UPDATE failed: 400 Bad Request',
      service: 'carddav',
      endpoint: 'https://example.com/contacts/abc.vcf',
      method: 'PUT',
      status: 400,
      body: '<?xml version="1.0"?><error>bad property</error>',
      context: { personId: 'p-1' },
    });

    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(ExternalServiceError);
    expect(err.name).toBe('ExternalServiceError');
    expect(err.code).toBe('carddav_error');
    expect(err.statusCode).toBe(400);
    expect(err.service).toBe('carddav');
    expect(err.endpoint).toBe('https://example.com/contacts/abc.vcf');
    expect(err.method).toBe('PUT');
    expect(err.status).toBe(400);
    expect(err.body).toContain('bad property');
    expect(err.context).toEqual({ personId: 'p-1' });
  });

  it('passes cause through to AppError', () => {
    const cause = new Error('network died');
    const err = new ExternalServiceError({
      message: 'resend send failed',
      service: 'resend',
      cause,
    });
    expect(err.cause).toBe(cause);
    expect(err.code).toBe('resend_error');
  });
});
