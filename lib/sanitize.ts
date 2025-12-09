import DOMPurify from 'isomorphic-dompurify';

/**
 * HTML Sanitization utilities to prevent XSS attacks
 * 
 * These functions sanitize user-generated content before:
 * - Storing in the database
 * - Displaying to users
 * - Sending in emails
 */

/**
 * Sanitize HTML content, allowing only safe tags
 * Use this for rich text content where some HTML is acceptable
 */
export function sanitizeHtml(dirty: string | null | undefined): string | null {
  if (!dirty) return null;
  
  const clean = DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
  });
  
  return clean || null;
}

/**
 * Strip all HTML tags, leaving only plain text
 * Use this for fields that should not contain any HTML
 * (e.g., names, titles, short descriptions)
 */
export function sanitizePlainText(dirty: string | null | undefined): string | null {
  if (!dirty) return null;
  
  // Remove all HTML tags
  const clean = DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
  
  // Also decode HTML entities
  return clean.trim() || null;
}

/**
 * Sanitize email content
 * More permissive than sanitizeHtml but still safe
 */
export function sanitizeEmail(dirty: string | null | undefined): string | null {
  if (!dirty) return null;
  
  const clean = DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'style'],
    ALLOW_DATA_ATTR: false,
  });
  
  return clean || null;
}

/**
 * Escape special HTML characters in a string
 * Use this for dynamically building HTML strings
 */
export function escapeHtml(unsafe: string | null | undefined): string {
  if (!unsafe) return '';
  
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Sanitize a person's name (plain text, no HTML)
 */
export function sanitizeName(name: string | null | undefined): string | null {
  return sanitizePlainText(name);
}

/**
 * Sanitize notes/descriptions (allow some formatting)
 */
export function sanitizeNotes(notes: string | null | undefined): string | null {
  return sanitizeHtml(notes);
}

/**
 * Sanitize group/relationship type name (plain text)
 */
export function sanitizeLabel(label: string | null | undefined): string | null {
  return sanitizePlainText(label);
}

/**
 * Batch sanitize an object's string fields
 * Useful for sanitizing API request bodies
 */
export function sanitizeObject<T extends Record<string, any>>(
  obj: T,
  fields: Array<keyof T>,
  sanitizer: (value: string | null | undefined) => string | null = sanitizePlainText
): T {
  const sanitized = { ...obj };
  
  for (const field of fields) {
    if (typeof sanitized[field] === 'string') {
      sanitized[field] = sanitizer(sanitized[field] as string) as T[keyof T];
    }
  }
  
  return sanitized;
}

