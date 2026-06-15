'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

interface OidcSignInButtonProps {
  name: string;
  mode?: 'signin' | 'signup';
}

export function OidcSignInButton({ name, mode = 'signin' }: OidcSignInButtonProps) {
  const t = useTranslations('auth');
  const tCommon = useTranslations('common');
  const [isLoading, setIsLoading] = useState(false);

  const handleOidcSignIn = async () => {
    setIsLoading(true);
    try {
      await signIn('oidc', { callbackUrl: '/dashboard' });
    } catch (error) {
      console.error('OIDC sign-in error:', error);
      setIsLoading(false);
    }
  };

  const buttonText = mode === 'signin'
    ? t('signInWith', { provider: name })
    : t('signUpWith', { provider: name });

  return (
    <button
      type="button"
      onClick={handleOidcSignIn}
      disabled={isLoading}
      className="w-full flex items-center justify-center gap-3 px-4 py-2 border border-border rounded-lg shadow-sm bg-surface hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      <span className="text-sm font-medium text-foreground">
        {isLoading ? tCommon('loading') : buttonText}
      </span>
    </button>
  );
}
