import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { NotificationEnvelope } from '../../../lib/notifications/types';

const mocks = vi.hoisted(() => ({ postJson: vi.fn(), decryptSecret: vi.fn() }));

vi.mock('../../../lib/notifications/outbound', () => ({ postJson: mocks.postJson }));
vi.mock('../../../lib/crypto/secrets', () => ({
  decryptSecret: mocks.decryptSecret,
  encryptSecret: vi.fn(),
}));

import { sendNtfy, parseNtfyUrl, ntfyTagFor } from '../../../lib/notifications/channels/ntfy';

function envelope(
  notification: NotificationEnvelope['notification'],
  locale: NotificationEnvelope['locale'] = 'en'
): NotificationEnvelope {
  return {
    userId: 'user-1',
    userEmail: 'user@example.com',
    locale,
    notification,
    unsubscribeUrl: 'https://app.test/unsubscribe?token=tok',
    deepLink: 'https://app.test/people/person-1',
    stamp: { model: 'person', id: 'person-1', field: 'lastContactReminderSent' },
    logMeta: {},
  };
}

const contact = envelope({
  kind: 'contact',
  personId: 'person-1',
  personName: 'Ana Torres',
  lastContactFormatted: null,
  intervalText: '3 months',
});

describe('parseNtfyUrl', () => {
  it('splits a topic URL into base and topic', () => {
    expect(parseNtfyUrl('https://ntfy.sh/my-topic')).toEqual({
      base: 'https://ntfy.sh/',
      topic: 'my-topic',
    });
  });

  it('handles a self-hosted server on a custom port', () => {
    expect(parseNtfyUrl('http://ntfy.lan:8080/alerts')).toEqual({
      base: 'http://ntfy.lan:8080/',
      topic: 'alerts',
    });
  });

  it('tolerates a trailing slash', () => {
    expect(parseNtfyUrl('https://ntfy.sh/my-topic/')).toEqual({
      base: 'https://ntfy.sh/',
      topic: 'my-topic',
    });
  });

  it('rejects a URL with no topic', () => {
    expect(parseNtfyUrl('https://ntfy.sh/')).toBeNull();
    expect(parseNtfyUrl('https://ntfy.sh')).toBeNull();
  });

  it('rejects a URL with a nested path, which is not a topic', () => {
    expect(parseNtfyUrl('https://ntfy.sh/a/b')).toBeNull();
  });

  it('rejects a malformed URL', () => {
    expect(parseNtfyUrl('not a url')).toBeNull();
  });

  it('rejects a non-http(s) scheme', () => {
    expect(parseNtfyUrl('ftp://ntfy.sh/my-topic')).toBeNull();
  });
});

describe('ntfyTagFor', () => {
  it('maps each predefined important date type to its own tag', () => {
    const base = { kind: 'important_date', personId: 'p', personName: 'A', dateTitle: 'T', formattedDate: 'D', date: '2026-08-26' } as const;

    expect(ntfyTagFor({ ...base, dateType: 'birthday' })).toBe('birthday');
    expect(ntfyTagFor({ ...base, dateType: 'anniversary' })).toBe('ring');
    expect(ntfyTagFor({ ...base, dateType: 'nameday' })).toBe('tada');
    expect(ntfyTagFor({ ...base, dateType: 'memorial' })).toBe('candle');
  });

  it('falls back to calendar for a custom or missing type', () => {
    const base = { kind: 'important_date', personId: 'p', personName: 'A', dateTitle: 'T', formattedDate: 'D', date: '2026-08-26' } as const;

    expect(ntfyTagFor({ ...base, dateType: null })).toBe('calendar');
    expect(ntfyTagFor({ ...base, dateType: 'first-met' })).toBe('calendar');
  });

  it('maps the other kinds', () => {
    expect(ntfyTagFor(contact.notification)).toBe('wave');
    expect(
      ntfyTagFor({
        kind: 'important_date_lead',
        personId: 'p',
        personName: 'A',
        dateTitle: 'T',
        formattedDate: 'D',
        date: '2026-08-26',
        daysUntil: 3,
      })
    ).toBe('alarm_clock');
    expect(ntfyTagFor({ kind: 'weekly_digest', rows: [], overflowCount: 0 })).toBe('spiral_calendar');
  });
});

describe('sendNtfy', () => {
  beforeEach(() => {
    mocks.postJson.mockReset();
    mocks.decryptSecret.mockReset();
    mocks.postJson.mockResolvedValue({ ok: true });
    mocks.decryptSecret.mockImplementation((v: string) => `decrypted-${v}`);
  });

  it('posts ntfy JSON publish format to the server root, not the topic URL', async () => {
    await sendNtfy({ id: 'ep-1', url: 'https://ntfy.sh/my-topic', secret: null }, contact);

    const [url, body] = mocks.postJson.mock.calls[0];
    expect(url).toBe('https://ntfy.sh/');

    const payload = JSON.parse(body as string);
    expect(payload).toEqual({
      topic: 'my-topic',
      title: 'Ana Torres',
      message: 'Time to catch up',
      click: 'https://app.test/people/person-1',
      tags: ['wave'],
    });
  });

  it('sends non-ASCII names in the JSON body rather than a header', async () => {
    await sendNtfy(
      { id: 'ep-1', url: 'https://ntfy.sh/my-topic', secret: null },
      envelope(
        {
          kind: 'contact',
          personId: 'person-1',
          personName: '山田太郎',
          lastContactFormatted: null,
          intervalText: '3か月',
        },
        'ja-JP'
      )
    );

    const [, body, headers] = mocks.postJson.mock.calls[0];
    expect(JSON.parse(body as string).title).toBe('山田太郎');
    expect(JSON.stringify(headers)).not.toContain('山田太郎');
  });

  it('attaches a decrypted access token as a bearer header', async () => {
    await sendNtfy({ id: 'ep-1', url: 'https://ntfy.sh/t', secret: 'enc' }, contact);

    expect(mocks.decryptSecret).toHaveBeenCalledWith('enc');
    expect(mocks.postJson.mock.calls[0][2]).toMatchObject({
      Authorization: 'Bearer decrypted-enc',
    });
  });

  it('sends no Authorization header when there is no token', async () => {
    await sendNtfy({ id: 'ep-1', url: 'https://ntfy.sh/t', secret: null }, contact);

    expect(mocks.postJson.mock.calls[0][2]).not.toHaveProperty('Authorization');
  });

  it('reports blocked for an unparseable topic URL without attempting a request', async () => {
    const result = await sendNtfy({ id: 'ep-1', url: 'https://ntfy.sh/', secret: null }, contact);

    expect(result).toEqual({ ok: false, code: 'blocked' });
    expect(mocks.postJson).not.toHaveBeenCalled();
  });

  it('passes an outbound failure straight through', async () => {
    mocks.postJson.mockResolvedValue({ ok: false, code: 'http_5xx' });

    expect(await sendNtfy({ id: 'ep-1', url: 'https://ntfy.sh/t', secret: null }, contact)).toEqual({
      ok: false,
      code: 'http_5xx',
    });
  });

  it('resolves rather than rejecting when the stored token will not decrypt', async () => {
    mocks.decryptSecret.mockImplementation(() => {
      throw new Error('bad decrypt');
    });

    const result = await sendNtfy({ id: 'ep-1', url: 'https://ntfy.sh/t', secret: 'enc' }, contact);

    expect(result).toEqual({ ok: false, code: 'unknown' });
    expect(mocks.postJson).not.toHaveBeenCalled();
  });
});
