/**
 * Formats a person's name with optional nickname
 * Format: "Name 'Nickname' Surname"
 * Examples:
 * - "John Smith" (no nickname)
 * - "Charles 'Charlie' Brown" (with nickname)
 * - "John" (only name)
 */
export function formatPersonName(
  name: string,
  surname?: string | null,
  nickname?: string | null
): string {
  const parts: string[] = [name];

  if (nickname) {
    parts.push(`'${nickname}'`);
  }

  if (surname) {
    parts.push(surname);
  }

  return parts.join(' ');
}

/**
 * Formats a person's full name for display
 * Same as formatPersonName but with a person object
 */
export function formatFullName(person: {
  name: string;
  surname?: string | null;
  nickname?: string | null;
}): string {
  return formatPersonName(person.name, person.surname, person.nickname);
}
