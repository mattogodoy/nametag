'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { getLocalDateString } from '@/lib/date-format';

function stripToDigits(phone: string): string {
  const stripped = phone.replace(/[^\d+]/g, '');
  return stripped.startsWith('+') ? stripped.slice(1) : stripped;
}

function ChatBubbleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

function SignalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.917 1.04 5.591 2.77 7.67l-.924 3.405 3.522-.946A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm5.789 17.037c-.25.704-1.47 1.304-2.04 1.379-.544.073-1.227.103-1.98-.125a18.36 18.36 0 01-1.794-.663c-3.157-1.365-5.22-4.558-5.378-4.769-.158-.21-1.29-1.718-1.29-3.277 0-1.558.816-2.326 1.106-2.643.29-.316.632-.395.843-.395.21 0 .422.002.606.011.195.01.456-.074.713.544.264.632.895 2.185.974 2.343.079.158.132.342.026.553-.105.21-.158.342-.316.527-.158.184-.333.41-.474.553-.158.158-.323.329-.139.645.184.316.82 1.353 1.76 2.192 1.209 1.079 2.228 1.413 2.544 1.571.316.158.501.132.685-.079.184-.21.79-.922 1.001-1.238.21-.316.422-.263.711-.158.29.106 1.837.867 2.153 1.025.316.158.527.237.606.369.079.132.079.764-.171 1.468z" />
    </svg>
  );
}

interface MessagingLinksProps {
  phoneNumber: string;
  personId: string;
}

export default function MessagingLinks({ phoneNumber, personId }: MessagingLinksProps) {
  const t = useTranslations('people.messagingLinks');
  const tPeople = useTranslations('people');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const menuRef = useRef<HTMLSpanElement>(null);
  const digits = stripToDigits(phoneNumber);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
        setShowConfirm(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  if (!digits) return null;

  const apps = [
    {
      name: 'WhatsApp',
      href: `https://wa.me/${digits}`,
      icon: WhatsAppIcon,
      label: t('openWhatsApp'),
    },
    {
      name: 'Telegram',
      href: `https://t.me/+${digits}`,
      icon: TelegramIcon,
      label: t('openTelegram'),
    },
    {
      name: 'Signal',
      href: `https://signal.me/#p/+${digits}`,
      icon: SignalIcon,
      label: t('openSignal'),
    },
  ];

  function handleAppClick() {
    setShowConfirm(true);
  }

  async function handleUpdateLastContact() {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/people/${personId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastContact: getLocalDateString() }),
      });
      if (!response.ok) throw new Error('Failed to update');
      toast.success(tPeople('lastContactUpdated'));
      router.refresh();
    } catch {
      toast.error(tPeople('lastContactUpdateError'));
    } finally {
      setIsUpdating(false);
      setOpen(false);
      setShowConfirm(false);
    }
  }

  function handleDismiss() {
    setOpen(false);
    setShowConfirm(false);
  }

  return (
    <span className="relative inline-flex" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="p-1 text-muted hover:text-foreground transition-colors rounded-md hover:bg-surface-elevated"
        aria-label={t('sendMessage')}
        title={t('sendMessage')}
      >
        <ChatBubbleIcon className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-xl z-50">
          {!showConfirm ? (
            <div className="w-40 py-1">
              {apps.map(({ name, href, icon: Icon, label }) => (
                <a
                  key={name}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleAppClick}
                  className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-surface-elevated transition-colors flex items-center gap-2.5"
                  aria-label={label}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {name}
                </a>
              ))}
            </div>
          ) : (
            <div className="w-56 p-3">
              <p className="text-sm text-foreground mb-3">
                {t('updateLastContactPrompt')}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleUpdateLastContact}
                  disabled={isUpdating}
                  className="flex-1 px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {isUpdating ? t('updating') : t('yes')}
                </button>
                <button
                  onClick={handleDismiss}
                  disabled={isUpdating}
                  className="flex-1 px-3 py-1.5 text-sm font-medium rounded-md border border-border text-foreground hover:bg-surface-elevated transition-colors disabled:opacity-50"
                >
                  {t('no')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </span>
  );
}
