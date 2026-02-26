'use client';

import { useRouter } from 'next/navigation';

interface BackLinkProps {
  fallbackHref: string;
  children: React.ReactNode;
  className?: string;
}

export default function BackLink({ fallbackHref, children, className }: BackLinkProps) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
        } else {
          router.push(fallbackHref);
        }
      }}
      className={className}
    >
      {children}
    </button>
  );
}
