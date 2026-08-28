import { decryptSecret } from '@/lib/crypto/secrets';
import { postJson, type OutboundResult } from '../outbound';
import { renderShortForm } from '../render';
import type { NotificationEnvelope, ReminderNotification } from '../types';

export interface NtfyEndpoint {
  id: string;
  url: string;
  secret: string | null;
}

/**
 * Split a topic URL into the server root and the topic name.
 *
 * ntfy behaves differently depending on where you POST. A body sent to the
 * topic URL is treated as the literal message text, which is why a generic
 * webhook pointed at ntfy shows raw JSON on the phone. A body sent to the
 * server root with a `topic` field is parsed as a publish request. This driver
 * uses the second form, so it needs the two parts separately.
 */
export function parseNtfyUrl(url: string): { base: string; topic: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  // postJson already rejects a non-http(s) scheme before connecting, but this
  // function should not hand a URL downstream that it already knows is
  // unusable.
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }

  const segments = parsed.pathname.split('/').filter(Boolean);

  // Exactly one segment. Zero means no topic was given, and more than one is
  // not a topic at all.
  if (segments.length !== 1) {
    return null;
  }

  return { base: `${parsed.origin}/`, topic: segments[0] };
}

/**
 * ntfy renders tags as emoji.
 *
 * An approved exception to the "warmth through craft, not emoji" principle:
 * tags are idiomatic on this platform and make a notification scannable on a
 * lock screen. These are ntfy short-code names, not literal emoji characters.
 */
const IMPORTANT_DATE_TAGS: Record<string, string> = {
  birthday: 'birthday',
  anniversary: 'ring',
  nameday: 'tada',
  memorial: 'candle',
};

export function ntfyTagFor(notification: ReminderNotification): string {
  switch (notification.kind) {
    case 'important_date':
      // Custom types have no predefined key, so they fall back to a neutral tag.
      return (notification.dateType && IMPORTANT_DATE_TAGS[notification.dateType]) || 'calendar';
    case 'important_date_lead':
      return 'alarm_clock';
    case 'contact':
      return 'wave';
    case 'weekly_digest':
      return 'spiral_calendar';
  }
}

/**
 * Publish one notification to one ntfy topic.
 *
 * Everything that varies goes in the JSON body rather than in headers. ntfy
 * does accept UTF-8 headers, but not every library and proxy in the path
 * preserves them, and with Japanese, Russian and Chinese locales plus
 * arbitrary person names, non-ASCII titles are the common case rather than the
 * exception.
 */
export async function sendNtfy(
  endpoint: NtfyEndpoint,
  envelope: NotificationEnvelope
): Promise<OutboundResult> {
  const parsed = parseNtfyUrl(endpoint.url);

  if (!parsed) {
    return { ok: false, code: 'blocked' };
  }

  const { title, body } = await renderShortForm(envelope);

  const payload = JSON.stringify({
    topic: parsed.topic,
    title,
    message: body,
    click: envelope.deepLink,
    tags: [ntfyTagFor(envelope.notification)],
  });

  const headers: Record<string, string> = {};

  if (endpoint.secret) {
    let token: string;

    try {
      token = decryptSecret(endpoint.secret);
    } catch {
      // A stored token that will not decrypt, which is what happens to every
      // stored secret if NEXTAUTH_SECRET is rotated. Report it rather than
      // throwing: this function's contract is to resolve with an outcome, and
      // a throw here would abandon the caller's remaining endpoints. Not
      // 'blocked', because the URL is fine and telling the user to change it
      // would send them after the wrong thing.
      return { ok: false, code: 'unknown' };
    }

    headers.Authorization = `Bearer ${token}`;
  }

  return postJson(parsed.base, payload, headers);
}
