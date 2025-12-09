/**
 * Application-wide constants
 * Centralizes magic numbers and configuration values for consistency
 */

/**
 * Security-related constants
 */
export const SECURITY = {
  // Password hashing
  BCRYPT_ROUNDS: 10,

  // Token expiration times (in hours)
  TOKEN_EXPIRY_HOURS: 24,
  PASSWORD_RESET_EXPIRY_HOURS: 1,
  EMAIL_VERIFY_EXPIRY_HOURS: 24,

  // Password requirements
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,

  // Session configuration
  SESSION_MAX_AGE_DAYS: 30,
  SESSION_UPDATE_AGE_DAYS: 1,

  // Request limits
  MAX_REQUEST_SIZE_BYTES: 1 * 1024 * 1024, // 1MB
  MAX_REQUEST_SIZE_MB: 1,
} as const;

/**
 * Rate limiting configurations
 * Maps to rateLimitConfigs in lib/rate-limit.ts
 */
export const RATE_LIMITS = {
  // Login attempts
  LOGIN_MAX_ATTEMPTS: 5,
  LOGIN_WINDOW_MINUTES: 15,

  // Registration attempts
  REGISTER_MAX_ATTEMPTS: 3,
  REGISTER_WINDOW_MINUTES: 60,

  // Password reset attempts
  FORGOT_PASSWORD_MAX_ATTEMPTS: 3,
  FORGOT_PASSWORD_WINDOW_MINUTES: 60,

  // Reset password attempts
  RESET_PASSWORD_MAX_ATTEMPTS: 5,
  RESET_PASSWORD_WINDOW_MINUTES: 60,

  // Email verification resend attempts
  RESEND_VERIFICATION_MAX_ATTEMPTS: 3,
  RESEND_VERIFICATION_WINDOW_MINUTES: 15,
} as const;

/**
 * Email-related constants
 */
export const EMAIL = {
  // Cooldown period between password reset emails (in seconds)
  PASSWORD_RESET_COOLDOWN_SECONDS: 60,

  // Cooldown period between verification emails (in seconds)
  EMAIL_VERIFY_COOLDOWN_SECONDS: 60,
} as const;

/**
 * Pagination defaults
 */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

/**
 * Validation limits
 */
export const VALIDATION = {
  // Name fields
  NAME_MIN_LENGTH: 1,
  NAME_MAX_LENGTH: 100,

  // Description/notes fields
  DESCRIPTION_MAX_LENGTH: 500,
  NOTES_MAX_LENGTH: 10000,

  // Relationship type fields
  RELATIONSHIP_TYPE_NAME_MAX_LENGTH: 50,
  RELATIONSHIP_TYPE_LABEL_MAX_LENGTH: 50,

  // Important date fields
  IMPORTANT_DATE_TITLE_MAX_LENGTH: 100,
  REMINDER_INTERVAL_MIN: 1,
  REMINDER_INTERVAL_MAX: 99,
} as const;

/**
 * Database query timeouts (in milliseconds)
 */
export const TIMEOUTS = {
  DEFAULT_QUERY_TIMEOUT: 10000, // 10 seconds
  LONG_QUERY_TIMEOUT: 30000, // 30 seconds
  EXTERNAL_API_TIMEOUT: 10000, // 10 seconds
} as const;

/**
 * Cron job schedules
 */
export const CRON = {
  // Reminder emails sent daily at 8 AM
  REMINDER_SCHEDULE: '0 8 * * *',
} as const;

/**
 * Graph visualization limits
 */
export const GRAPH = {
  MAX_NODES_WARNING: 100,
  MAX_NODES_LIMIT: 500,
  DEFAULT_DEGREES_OF_SEPARATION: 2,
} as const;

/**
 * Feature flags (can be overridden by environment variables)
 */
export const FEATURES = {
  GRAPH_VISUALIZATION: true,
  DATA_EXPORT: true,
  DATA_IMPORT: true,
  EMAIL_REMINDERS: true,
  SOFT_DELETE: false, // Not implemented yet
} as const;

/**
 * HTTP Status Codes
 * Standard HTTP status codes used throughout the application
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * Audit log action types
 */
export const AUDIT_ACTIONS = {
  // Authentication
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  LOGOUT: 'LOGOUT',
  REGISTER: 'REGISTER',
  EMAIL_VERIFIED: 'EMAIL_VERIFIED',

  // Password management
  PASSWORD_CHANGE: 'PASSWORD_CHANGE',
  PASSWORD_RESET_REQUEST: 'PASSWORD_RESET_REQUEST',
  PASSWORD_RESET_COMPLETE: 'PASSWORD_RESET_COMPLETE',

  // Profile changes
  PROFILE_UPDATE: 'PROFILE_UPDATE',
  EMAIL_CHANGE: 'EMAIL_CHANGE',

  // Data operations
  DATA_EXPORT: 'DATA_EXPORT',
  DATA_IMPORT: 'DATA_IMPORT',
  ACCOUNT_DELETE: 'ACCOUNT_DELETE',

  // Security events
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
} as const;

