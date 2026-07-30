import OfflineNotice from '@/components/OfflineNotice';

/**
 * Served by the service worker whenever a navigation fails. Deliberately does
 * no database work and requires no session, because it has to render for an
 * unauthenticated visitor and from cache with no network.
 */
export default function OfflinePage() {
  return <OfflineNotice />;
}
