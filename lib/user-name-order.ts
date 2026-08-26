export type NameOrder = 'WESTERN' | 'EASTERN';

let pending: Promise<NameOrder> | null = null;

/**
 * The signed-in user's name order, fetched at most once per page load.
 *
 * NavigationSearch mounts and unmounts every time the mobile search field is
 * opened and closed, and each mount used to issue its own profile request.
 * The value only changes through /api/user/name-order, which clears this cache
 * on success, so holding it for the life of the page is safe.
 */
export function fetchNameOrder(): Promise<NameOrder> {
  if (!pending) {
    pending = fetch('/api/user/profile')
      .then((res) => {
        // An error response still carries a JSON body, which would otherwise
        // read as "no preference set" and cache the default for the whole page.
        if (!res.ok) throw new Error(`Profile lookup failed with ${res.status}`);
        return res.json();
      })
      .then((data): NameOrder => {
        if (!data.user) throw new Error('Profile response carried no user');
        return data.user.nameOrder === 'EASTERN' ? 'EASTERN' : 'WESTERN';
      })
      .catch((): NameOrder => {
        // A failed lookup is not cached, so the next read tries again.
        pending = null;
        return 'WESTERN';
      });
  }

  return pending;
}

/** Drop the cached value so the next read reflects a changed preference. */
export function clearNameOrderCache(): void {
  pending = null;
}
