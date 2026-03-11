'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';

interface BackLinkProps {
  fallbackHref: string;
  children: React.ReactNode;
  className?: string;
}

const subscribe = () => () => {};

export default function BackLink({ fallbackHref, children, className }: BackLinkProps) {
  const href = useSyncExternalStore(
    subscribe,
    () => sessionStorage.getItem(`backLink:${fallbackHref}`) || fallbackHref,
    () => fallbackHref,
  );

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
