'use client';

import Image from 'next/image';
import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

interface OidcSignInButtonProps {
  mode?: 'signin' | 'signup';
  displayName?: string;
  iconUrl?: string | null;
}

export function OidcSignInButton({
  mode = 'signin',
  displayName = 'OIDC Provider',
  iconUrl = null,
}: OidcSignInButtonProps) {
  const t = useTranslations('auth');
  const tCommon = useTranslations('common');
  const [isLoading, setIsLoading] = useState(false);
  const [iconFailed, setIconFailed] = useState(false);

  const handleOidcSignIn = async () => {
    setIsLoading(true);
    try {
      await signIn('oidc', { callbackUrl: '/dashboard' });
    } catch (error) {
      console.error('OIDC sign-in error:', error);
      setIsLoading(false);
    }
  };

  // Reuse existing localized Google labels and swap provider brand.
  const baseText =
    mode === 'signin' ? t('signInWithGoogle') : t('signUpWithGoogle');
  const buttonText = baseText.replace('Google', displayName);

  return (
    <button
      type="button"
      onClick={handleOidcSignIn}
      disabled={isLoading}
      className="w-full flex items-center justify-center gap-3 px-4 py-2 border border-border rounded-lg shadow-sm bg-surface hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {isLoading ? (
        <span className="text-sm font-medium text-foreground">
          {tCommon('loading')}
        </span>
      ) : (
        <>
          {iconUrl && !iconFailed ? (
            <Image
              src={iconUrl}
              alt={`${displayName} icon`}
              width={20}
              height={20}
              unoptimized
              className="w-5 h-5 rounded-sm object-contain"
              onError={() => setIconFailed(true)}
            />
          ) : (
            <div className="w-5 h-5 rounded-sm bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
              O
            </div>
          )}
          <span className="text-sm font-medium text-foreground">
            {buttonText}
          </span>
        </>
      )}
    </button>
  );
}
