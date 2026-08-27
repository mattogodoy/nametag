'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

interface Device {
  id: string;
  userAgent: string | null;
}

interface Props {
  emailEnabled: boolean;
  emailAvailable: boolean;
  pushAvailable: boolean;
  devices: Device[];
}

type PushState = 'unsupported' | 'blocked' | 'available' | 'subscribed';

/**
 * Turn a raw User-Agent into something a person recognises.
 *
 * Deliberately crude. The goal is only to let someone tell two of their own
 * devices apart in a list, not to build a device database.
 */
function describeDevice(userAgent: string | null, t: ReturnType<typeof useTranslations>): string {
  if (!userAgent) return t('pushDeviceUnknown');

  const browser =
    /Edg\//.test(userAgent) ? 'Edge'
    : /Chrome\//.test(userAgent) ? 'Chrome'
    : /Firefox\//.test(userAgent) ? 'Firefox'
    : /Safari\//.test(userAgent) ? 'Safari'
    : t('pushDeviceBrowser');

  const os =
    /iPhone|iPad/.test(userAgent) ? 'iOS'
    : /Android/.test(userAgent) ? 'Android'
    : /Macintosh/.test(userAgent) ? 'macOS'
    : /Windows/.test(userAgent) ? 'Windows'
    : /Linux/.test(userAgent) ? 'Linux'
    : '';

  return os ? t('pushDeviceLabel', { browser, os }) : browser;
}

/** The applicationServerKey must be a Uint8Array, not the base64url string. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(normalized);
  // `new Uint8Array(array)` (rather than `Uint8Array.from`) so the backing
  // buffer is typed as ArrayBuffer, matching PushSubscriptionOptionsInit's
  // applicationServerKey, instead of the wider ArrayBufferLike.
  return new Uint8Array([...raw].map((char) => char.charCodeAt(0)));
}

/**
 * iOS only delivers web push to an installed PWA (16.4 and later). Offering a
 * permission button in Safari would produce a prompt that cannot work, so the
 * install hint is shown instead.
 */
function isIosWithoutInstall(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
  const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent);
  // jsdom has no matchMedia, so guard the call rather than assume it exists.
  const standalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  return isIos && !standalone;
}

export default function NotificationChannelsCard({
  emailEnabled,
  emailAvailable,
  pushAvailable,
  devices,
}: Props) {
  const t = useTranslations('settings.notifications');
  const [email, setEmail] = useState(emailEnabled);
  const [deviceList, setDeviceList] = useState(devices);
  const [pushState, setPushState] = useState<PushState>('unsupported');
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reflecting a one-time platform capability check into UI state is intentional
    setIosHint(isIosWithoutInstall());

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushState('unsupported');
      return;
    }

    if (Notification.permission === 'denied') {
      setPushState('blocked');
      return;
    }

    void navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setPushState(subscription ? 'subscribed' : 'available'))
      .catch(() => setPushState('available'));
  }, []);

  async function toggleEmail(next: boolean) {
    setEmail(next);
    const response = await fetch('/api/notifications/email', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: next }),
    });

    if (!response.ok) {
      setEmail(!next);
      toast.error(t('channelEmail'));
    }
  }

  async function enablePush() {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      setPushState('blocked');
      return;
    }

    const keyResponse = await fetch('/api/notifications/push/public-key');
    if (!keyResponse.ok) {
      toast.error(t('pushNotConfigured'));
      return;
    }
    const { publicKey } = (await keyResponse.json()) as { publicKey: string };

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    const response = await fetch('/api/notifications/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription.toJSON()),
    });

    if (!response.ok) {
      toast.error(t('pushNotConfigured'));
      return;
    }

    setPushState('subscribed');
    setDeviceList((current) => [
      ...current,
      { id: 'pending', userAgent: navigator.userAgent },
    ]);
  }

  async function removeDevice(id: string) {
    const response = await fetch(`/api/notifications/push/subscriptions/${id}`, {
      method: 'DELETE',
    });

    if (response.ok) {
      setDeviceList((current) => current.filter((device) => device.id !== id));
    }
  }

  return (
    <div className="bg-surface shadow rounded-lg p-6">
      <h2 className="text-xl font-bold text-foreground mb-4">{t('channelsTitle')}</h2>
      <p className="text-muted mb-6">{t('channelsDescription')}</p>

      <div className="flex items-center justify-between py-3 border-b border-border">
        <span className="text-foreground">{t('channelEmail')}</span>
        <button
          type="button"
          role="switch"
          aria-label={t('channelEmail')}
          aria-checked={email}
          aria-disabled={!emailAvailable}
          disabled={!emailAvailable}
          onClick={() => void toggleEmail(!email)}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed ${
            email ? 'bg-primary' : 'bg-muted'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
              email ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      <div className="py-3">
        <span className="text-foreground">{t('channelPush')}</span>

        {!pushAvailable && <p className="text-sm text-muted mt-2">{t('pushNotConfigured')}</p>}

        {pushAvailable && iosHint && <p className="text-sm text-muted mt-2">{t('pushIosHint')}</p>}

        {pushAvailable && !iosHint && pushState === 'unsupported' && (
          <p className="text-sm text-muted mt-2">{t('pushUnsupported')}</p>
        )}

        {pushAvailable && !iosHint && pushState === 'blocked' && (
          <p className="text-sm text-muted mt-2">{t('pushBlocked')}</p>
        )}

        {pushAvailable && !iosHint && pushState === 'available' && (
          <button
            type="button"
            onClick={() => void enablePush()}
            className="mt-2 px-3 py-1 rounded-md border border-border"
          >
            {t('pushEnable')}
          </button>
        )}

        {pushAvailable && pushState === 'subscribed' && (
          <p className="text-sm text-muted mt-2">{t('pushEnabled')}</p>
        )}

        <h3 className="text-sm font-medium text-foreground mt-4 mb-2">{t('pushDevices')}</h3>

        {deviceList.length === 0 ? (
          <p className="text-sm text-muted">{t('pushNoDevices')}</p>
        ) : (
          <ul className="space-y-2">
            {deviceList.map((device) => (
              <li key={device.id} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{describeDevice(device.userAgent, t)}</span>
                <button
                  type="button"
                  onClick={() => void removeDevice(device.id)}
                  className="text-muted hover:text-foreground"
                >
                  {t('pushRemove')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
