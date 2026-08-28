import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import type { NotificationEnvelope } from '../../../lib/notifications/types';

const mocks = vi.hoisted(() => ({ postJson: vi.fn(), decryptSecret: vi.fn() }));

vi.mock('../../../lib/notifications/outbound', () => ({ postJson: mocks.postJson }));
vi.mock('../../../lib/crypto/secrets', () => ({
  decryptSecret: mocks.decryptSecret,
  encryptSecret: vi.fn(),
}));

import { sendWebhook } from '../../../lib/notifications/channels/webhook';

const envelope: NotificationEnvelope = {
  userId: 'user-1',
  userEmail: 'user@example.com',
  locale: 'en',
  notification: {
    kind: 'important_date',
    personId: 'person-1',
    personName: 'Ana Torres',
    dateTitle: 'Birthday',
    formattedDate: 'August 26, 2026',
    date: '2026-08-26',
    dateType: 'birthday',
  },
  unsubscribeUrl: 'https://app.test/unsubscribe?token=SECRET-TOKEN',
  deepLink: 'https://app.test/people/person-1',
  stamp: { model: 'importantDate', id: 'date-1', field: 'lastReminderSent' },
  logMeta: {},
};

const endpoint = { id: 'ep-1', url: 'https://hooks.test/nametag', secret: 'encrypted' };
const now = new Date('2026-08-26T09:00:00.000Z');

describe('sendWebhook', () => {
  beforeEach(() => {
    mocks.postJson.mockReset();
    mocks.decryptSecret.mockReset();
    mocks.postJson.mockResolvedValue({ ok: true });
    mocks.decryptSecret.mockReturnValue('plain-secret');
  });

  it('posts a payload describing the event', async () => {
    await sendWebhook(endpoint, envelope, now);

    const [url, body] = mocks.postJson.mock.calls[0];
    expect(url).toBe('https://hooks.test/nametag');

    expect(JSON.parse(body as string)).toEqual({
      event: 'reminder.important_date',
      occurredAt: '2026-08-26T09:00:00.000Z',
      title: 'Ana Torres',
      body: 'Birthday today',
      url: 'https://app.test/people/person-1',
      data: {
        personId: 'person-1',
        personName: 'Ana Torres',
        dateTitle: 'Birthday',
        dateType: 'birthday',
        formattedDate: 'August 26, 2026',
        date: '2026-08-26',
      },
    });
  });

  it('never leaks the unsubscribe token, which is an email-only credential', async () => {
    await sendWebhook(endpoint, envelope, now);

    const [, body, headers] = mocks.postJson.mock.calls[0];
    expect(body).not.toContain('SECRET-TOKEN');
    expect(JSON.stringify(headers)).not.toContain('SECRET-TOKEN');
  });

  it('never sends the signing secret itself', async () => {
    await sendWebhook(endpoint, envelope, now);

    const [, body, headers] = mocks.postJson.mock.calls[0];
    expect(body).not.toContain('plain-secret');
    expect(JSON.stringify(headers)).not.toContain('plain-secret');
  });

  it('signs the timestamp and body with the decrypted secret', async () => {
    await sendWebhook(endpoint, envelope, now);

    const [, body, headers] = mocks.postJson.mock.calls[0];
    const timestamp = (headers as Record<string, string>)['X-Nametag-Timestamp'];

    expect(timestamp).toBe('1787734800');

    const expected = createHmac('sha256', 'plain-secret')
      .update(`${timestamp}.${body}`)
      .digest('hex');

    expect((headers as Record<string, string>)['X-Nametag-Signature']).toBe(`sha256=${expected}`);
  });

  it('sends exactly the fixed header set and nothing else', async () => {
    await sendWebhook(endpoint, envelope, now);

    const headers = mocks.postJson.mock.calls[0][2] as Record<string, string>;

    expect(Object.keys(headers).sort()).toEqual([
      'User-Agent',
      'X-Nametag-Event',
      'X-Nametag-Signature',
      'X-Nametag-Timestamp',
    ]);
    expect(headers['X-Nametag-Event']).toBe('reminder.important_date');
    expect(headers['User-Agent']).toMatch(/^Nametag\/\d+\.\d+\.\d+ \(\+https:\/\/nametag\.one\)$/);
  });

  it('does not let a person name influence a header', async () => {
    await sendWebhook(
      endpoint,
      {
        ...envelope,
        notification: {
          ...envelope.notification,
          personName: 'Ana\r\nX-Injected: yes',
        } as NotificationEnvelope['notification'],
      },
      now
    );

    const headers = mocks.postJson.mock.calls[0][2] as Record<string, string>;

    expect(headers).not.toHaveProperty('X-Injected');
    expect(Object.keys(headers)).toHaveLength(4);
  });

  it('refuses to send when the endpoint has no secret rather than sending unsigned', async () => {
    const result = await sendWebhook({ ...endpoint, secret: null }, envelope, now);

    expect(result).toEqual({ ok: false, code: 'blocked' });
    expect(mocks.postJson).not.toHaveBeenCalled();
  });

  it('names the event after the notification kind', async () => {
    await sendWebhook(
      endpoint,
      {
        ...envelope,
        notification: { kind: 'weekly_digest', rows: [], overflowCount: 0 },
      },
      now
    );

    expect(JSON.parse(mocks.postJson.mock.calls[0][1] as string).event).toBe(
      'reminder.weekly_digest'
    );
  });

  it('passes an outbound failure straight through', async () => {
    mocks.postJson.mockResolvedValue({ ok: false, code: 'http_4xx' });

    expect(await sendWebhook(endpoint, envelope, now)).toEqual({ ok: false, code: 'http_4xx' });
  });

  it('surfaces a 429 as http_429 rather than collapsing it into a generic failure', async () => {
    // `endpoint-health.ts` deliberately excludes http_429 from the
    // consecutive-failure counter that drives auto-disable: a receiver's own
    // rate limit is transient, and a hobby webhook endpoint that trips it is
    // exactly the case that protection exists for. That exclusion is keyed
    // on this exact string, so a driver that remapped 429 into 'http_4xx' or
    // 'unknown' here would silently defeat it and let a rate-limited hobby
    // receiver get auto-disabled anyway. This test only pins that sendWebhook
    // passes the code through unchanged; the auto-disable behaviour itself is
    // covered in tests/lib/notifications/endpoint-health.test.ts.
    mocks.postJson.mockResolvedValue({ ok: false, code: 'http_429' });

    expect(await sendWebhook(endpoint, envelope, now)).toEqual({ ok: false, code: 'http_429' });
  });

  it('resolves rather than throwing when the stored secret will not decrypt', async () => {
    // Every stored secret enters this state after NEXTAUTH_SECRET is rotated,
    // which is a documented operator action, not an edge case. sendWebhook's
    // contract is to resolve with an outcome so a per-endpoint failure never
    // aborts the caller's remaining endpoints; a throw here would break that,
    // the same trap sendNtfy's matching guard exists to avoid.
    mocks.decryptSecret.mockImplementation(() => {
      throw new Error('bad decrypt');
    });

    const result = await sendWebhook(endpoint, envelope, now);

    expect(result).toEqual({ ok: false, code: 'unknown' });
    expect(mocks.postJson).not.toHaveBeenCalled();
  });
});
