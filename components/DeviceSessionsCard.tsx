'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import { formatDate, type DateFormat } from '@/lib/date-format';

interface DeviceSession {
  id: string;
  name: string;
  platform: 'IOS' | 'ANDROID';
  appVersion: string;
  lastUsedAt: string;
  createdAt: string;
  current: boolean;
}

type PendingAction = { kind: 'one'; session: DeviceSession } | { kind: 'all' } | null;

export default function DeviceSessionsCard({ dateFormat }: { dateFormat: DateFormat }) {
  const t = useTranslations('settings.security.devices');
  const [sessions, setSessions] = useState<DeviceSession[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [pending, setPending] = useState<PendingAction>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/user/sessions')
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { sessions: DeviceSession[] };
        if (!cancelled) setSessions(body.sessions);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const confirm = async () => {
    if (!pending) return;
    setIsWorking(true);
    setActionError(null);
    const url = pending.kind === 'one' ? `/api/user/sessions/${pending.session.id}` : '/api/user/sessions';
    try {
      const res = await fetch(url, { method: 'DELETE' });
      if (!res.ok && res.status !== 404) throw new Error(String(res.status));
      setSessions((current) =>
        pending.kind === 'one' ? (current ?? []).filter((s) => s.id !== pending.session.id) : []
      );
      setPending(null);
    } catch {
      setActionError(t('signOutError'));
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="bg-surface shadow rounded-lg p-6 mt-6">
      <h2 className="text-xl font-bold text-foreground mb-2">{t('title')}</h2>
      <p className="text-muted mb-6">{t('description')}</p>

      {loadError && <p className="text-muted">{t('loadError')}</p>}

      {sessions && sessions.length === 0 && <p className="text-muted">{t('empty')}</p>}

      {sessions && sessions.length > 0 && (
        <>
          <ul className="divide-y divide-border">
            {sessions.map((session) => (
              <li key={session.id} className="flex items-center justify-between gap-4 py-4">
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">{session.name}</p>
                  <p className="text-sm text-muted">
                    {session.platform === 'IOS' ? t('platformIos') : t('platformAndroid')}
                    {' · '}
                    {t('version', { version: session.appVersion })}
                  </p>
                  <p className="text-sm text-muted">
                    {t('lastUsed', { date: formatDate(session.lastUsedAt, dateFormat) })}
                    {' · '}
                    {t('signedIn', { date: formatDate(session.createdAt, dateFormat) })}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => setPending({ kind: 'one', session })}
                  aria-label={`${t('signOut')}: ${session.name}`}
                >
                  {t('signOut')}
                </Button>
              </li>
            ))}
          </ul>
          {sessions.length >= 2 && (
            <div className="mt-4">
              <Button variant="secondary" onClick={() => setPending({ kind: 'all' })}>
                {t('signOutAll')}
              </Button>
            </div>
          )}
        </>
      )}

      <ConfirmationModal
        isOpen={pending !== null}
        onClose={() => {
          setPending(null);
          setActionError(null);
        }}
        onConfirm={confirm}
        title={
          pending?.kind === 'one'
            ? t('confirmSignOutTitle', { name: pending.session.name })
            : t('confirmSignOutAllTitle')
        }
        confirmText={t('signOut')}
        cancelText={t('cancel')}
        isLoading={isWorking}
        loadingText={t('signingOut')}
        error={actionError}
        variant="danger"
      >
        <p>{pending?.kind === 'one' ? t('confirmSignOutBody') : t('confirmSignOutAllBody')}</p>
      </ConfirmationModal>
    </div>
  );
}
