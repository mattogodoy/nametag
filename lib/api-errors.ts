import { NextResponse } from 'next/server';
import type { z } from 'zod';

/**
 * Every machine-readable error code the API can return. A code is never
 * renamed, removed or reused once shipped (tests/api/error-codes-snapshot.json
 * enforces it). Clients that meet an unknown code fall back to the generic
 * code for the HTTP status.
 */
export const API_ERRORS = {
  // Generic, one per status
  bad_request: { status: 400, description: 'The request could not be processed.' },
  unauthorized: { status: 401, description: 'Authentication is missing or invalid.' },
  forbidden: { status: 403, description: 'The caller may not perform this action.' },
  not_found: { status: 404, description: 'The resource does not exist or is not visible to the caller.' },
  conflict: { status: 409, description: 'The request conflicts with the current state.' },
  payload_too_large: { status: 413, description: 'The request body is too large.' },
  rate_limited: { status: 429, description: 'Too many requests. Retry after the Retry-After header.' },
  internal_error: { status: 500, description: 'Unexpected server error.' },
  service_unavailable: { status: 503, description: 'A dependency such as the database is unavailable.' },

  // Request plumbing
  validation_failed: { status: 400, description: 'The body failed validation. See fields.' },
  invalid_json: { status: 400, description: 'The body is not valid JSON.' },
  invalid_origin: { status: 403, description: 'The request origin is not allowed.' },
  invalid_query: { status: 400, description: 'A query parameter is invalid. params.param names it.' },

  // Native auth (shipped in 0.2a/0.2b)
  invalid_credentials: { status: 401, description: 'Wrong email or password.' },
  account_locked: { status: 403, description: 'Too many failed sign-ins; the account is temporarily locked.' },
  email_not_verified: { status: 403, description: 'The email address has not been verified.' },
  password_login_disabled: { status: 403, description: 'Password sign-in is disabled on this server.' },
  session_expired: { status: 401, description: 'The device session expired or was revoked.' },
  invalid_token: { status: 401, description: 'The bearer token is unknown or malformed.' },
  access_token_expired: { status: 401, description: 'The access token expired. Refresh it.' },
  invalid_code: { status: 401, description: 'The sign-in code is unknown, expired or the verifier does not match.' },
  interactive_session_required: { status: 403, description: 'This action needs a browser or device session, not an API token.' },
  not_a_device_session: { status: 400, description: 'The caller is not a device session.' },

  // Plan limits
  plan_limit_reached: { status: 403, description: 'The plan limit for a resource is reached. params.resource, params.limit.' },
  subscription_required: { status: 403, description: 'An active paid subscription is required.' },

  // Duplicates
  group_name_taken: { status: 409, description: 'A group with this name already exists.' },
  relationship_type_name_taken: { status: 409, description: 'A relationship type with this name already exists. params.name when it is the inverse.' },
  custom_field_name_taken: { status: 409, description: 'A custom field with this name already exists.' },
  important_date_type_exists: { status: 409, description: 'The person already has a date of this type. params.type.' },
  relationship_exists: { status: 409, description: 'This relationship already exists.' },
  email_in_use: { status: 409, description: 'The email address is already used by another account.' },
  already_group_member: { status: 409, description: 'The person is already in this group.' },

  // Invalid by meaning
  self_relationship: { status: 400, description: 'A person cannot be related to, or dismissed with, themselves.' },
  relationship_type_required: { status: 400, description: 'A relationship type is required.' },
  invalid_person_ids: { status: 400, description: 'One or more person IDs are invalid.' },
  name_needs_alphanumeric: { status: 400, description: 'The name must contain at least one letter or digit.' },
  reorder_incomplete: { status: 400, description: 'A reorder must include every active item exactly once.' },
  invalid_confirmation: { status: 400, description: 'The confirmation text does not match.' },

  // Account and password
  wrong_password: { status: 400, description: 'The password is incorrect.' },
  password_required: { status: 400, description: 'A password is required.' },
  oauth_account_no_password: { status: 400, description: 'The account signs in with a provider and has no password.' },

  // Uploads and imports
  photo_missing: { status: 400, description: 'No photo file was provided.' },
  photo_too_large: { status: 413, description: 'The photo is too large. params.maxBytes.' },
  unsupported_file_type: { status: 400, description: 'The file type is not supported here.' },
  invalid_vcard: { status: 400, description: 'The vCard file could not be parsed.' },

  // Features
  feature_disabled: { status: 403, description: 'The feature is turned off. params.feature, params.scope (instance or user).' },

  // CardDAV
  conflict_already_resolved: { status: 409, description: 'The sync conflict was already resolved.' },
  carddav_auth_failed: { status: 400, description: 'The CardDAV server rejected the credentials.' },
  carddav_unreachable: { status: 502, description: 'The CardDAV server could not be reached or failed.' },

  // Sync
  sync_cursor_expired: { status: 410, description: 'The sync cursor is older than retained deletions. Discard the cache and sync from cursor 0.' },

  // Notification endpoints (shipped before 0.3; the web reads these)
  invalid: { status: 400, description: 'Notification endpoint: the request or URL is invalid.' },
  duplicate: { status: 409, description: 'Notification endpoint: that destination is already added.' },
  dns: { status: 400, description: 'Notification endpoint: the host name did not resolve.' },
  policy: { status: 400, description: 'Notification endpoint: the address is not allowed.' },
  blocked: { status: 400, description: 'Notification endpoint: the address is blocked.' },
  credentials_in_url: { status: 400, description: 'Notification endpoint: the URL contains a username or password.' },
  not_ntfy: { status: 400, description: 'Notification endpoint: the server is not an ntfy server.' },
  too_long: { status: 400, description: 'Notification endpoint: the URL is too long.' },
  endpoint_limit_reached: { status: 409, description: 'Notification endpoint: the per-user limit is reached. params.limit.' },
} as const satisfies Record<string, { status: number; description: string }>;

export type ApiErrorCode = keyof typeof API_ERRORS;
export type ApiErrorParams = Record<string, string | number | boolean>;

export interface ApiErrorField {
  path: string;
  issue: 'required' | 'too_long' | 'too_short' | 'invalid_format' | 'invalid_value';
  params?: ApiErrorParams;
}

const GENERIC_CODE_BY_STATUS: Record<number, ApiErrorCode> = {
  400: 'bad_request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict',
  413: 'payload_too_large',
  429: 'rate_limited',
  500: 'internal_error',
  503: 'service_unavailable',
};

export function genericCodeFor(status: number): ApiErrorCode {
  return GENERIC_CODE_BY_STATUS[status] ?? (status >= 500 ? 'internal_error' : 'bad_request');
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  params?: ApiErrorParams,
  init?: { headers?: Record<string, string> }
): NextResponse {
  const body = params ? { error: message, code, params } : { error: message, code };
  return NextResponse.json(body, { status: API_ERRORS[code].status, headers: init?.headers });
}

/**
 * Zod 4 only attaches `input` to an issue when parsing with `reportInput`, so
 * a missing value is recognised by the default invalid_type message instead.
 */
const MISSING_VALUE_MESSAGE = /received undefined$/;

/** Map Zod issues to per-field, client-localizable issue codes. */
export function zodIssuesToFields(issues: readonly z.core.$ZodIssue[]): ApiErrorField[] {
  return issues.map((issue): ApiErrorField => {
    const path = issue.path.map(String).join('.');
    switch (issue.code) {
      case 'invalid_type':
        return MISSING_VALUE_MESSAGE.test(issue.message)
          ? { path, issue: 'required' }
          : { path, issue: 'invalid_value' };
      case 'too_big':
        return { path, issue: 'too_long', params: { max: Number(issue.maximum) } };
      case 'too_small':
        return { path, issue: 'too_short', params: { min: Number(issue.minimum) } };
      case 'invalid_format':
        return { path, issue: 'invalid_format' };
      default:
        return { path, issue: 'invalid_value' };
    }
  });
}

/**
 * 400 validation_failed response. `details` keeps the legacy array the web
 * reads; `fields` is the client-localizable form. Pass `details` to keep a
 * route's historical details shape.
 */
export function validationFailed(
  issues: readonly z.core.$ZodIssue[],
  message = 'Validation failed',
  details?: unknown
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      code: 'validation_failed' satisfies ApiErrorCode,
      details:
        details ??
        issues.map((issue) => ({
          field: issue.path.map(String).join('.'),
          message: issue.message,
        })),
      fields: zodIssuesToFields(issues),
    },
    { status: 400 }
  );
}
