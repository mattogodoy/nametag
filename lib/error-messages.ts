/**
 * Centralized error messages for consistent user experience
 * 
 * Benefits:
 * - Easier to maintain and update messages
 * - Consistent wording across the application
 * - Easier to internationalize (i18n) in the future
 * - Type-safe error messages
 */

export const ErrorMessages = {
  /**
   * Authentication and authorization errors
   */
  AUTH: {
    INVALID_CREDENTIALS: 'Invalid email or password',
    EMAIL_NOT_VERIFIED: 'Please verify your email before logging in',
    ACCOUNT_LOCKED: 'Account locked due to multiple failed login attempts. Please contact support.',
    SESSION_EXPIRED: 'Your session has expired. Please log in again.',
    UNAUTHORIZED: 'You must be logged in to access this resource',
    FORBIDDEN: 'You do not have permission to access this resource',
    TOKEN_INVALID: 'Invalid or expired token',
    TOKEN_EXPIRED: 'Token has expired. Please request a new one.',
  },

  /**
   * Validation errors
   */
  VALIDATION: {
    REQUIRED_FIELD: (field: string) => `${field} is required`,
    INVALID_FORMAT: (field: string) => `Invalid ${field} format`,
    MIN_LENGTH: (field: string, min: number) => 
      `${field} must be at least ${min} characters`,
    MAX_LENGTH: (field: string, max: number) => 
      `${field} must be less than ${max} characters`,
    INVALID_EMAIL: 'Invalid email address',
    INVALID_DATE: 'Invalid date format',
    INVALID_URL: 'Invalid URL format',
    INVALID_COLOR: 'Invalid color format (use #RRGGBB)',
  },

  /**
   * Password errors
   */
  PASSWORD: {
    TOO_SHORT: (min: number) => `Password must be at least ${min} characters`,
    TOO_LONG: (max: number) => `Password must be less than ${max} characters`,
    REQUIRES_UPPERCASE: 'Password must contain at least one uppercase letter',
    REQUIRES_LOWERCASE: 'Password must contain at least one lowercase letter',
    REQUIRES_NUMBER: 'Password must contain at least one number',
    REQUIRES_SPECIAL: 'Password must contain at least one special character',
    CURRENT_INCORRECT: 'Current password is incorrect',
    RESET_EXPIRED: 'Password reset link has expired. Please request a new one.',
    RESET_COOLDOWN: (seconds: number) => 
      `Please wait ${seconds} seconds before requesting another password reset`,
  },

  /**
   * Email errors
   */
  EMAIL: {
    ALREADY_EXISTS: 'An account with this email already exists',
    NOT_FOUND: 'No account found with this email address',
    VERIFICATION_SENT: 'Verification email sent. Please check your inbox.',
    VERIFICATION_EXPIRED: 'Email verification link has expired. Please request a new one.',
    ALREADY_VERIFIED: 'Email address is already verified',
    SEND_FAILED: 'Failed to send email. Please try again later.',
    VERIFY_COOLDOWN: (seconds: number) => 
      `Please wait ${seconds} seconds before requesting another verification email`,
  },

  /**
   * Database/Resource errors
   */
  RESOURCE: {
    NOT_FOUND: (resource: string) => `${resource} not found`,
    ALREADY_EXISTS: (resource: string) => `${resource} already exists`,
    CREATE_FAILED: (resource: string) => `Failed to create ${resource}`,
    UPDATE_FAILED: (resource: string) => `Failed to update ${resource}`,
    DELETE_FAILED: (resource: string) => `Failed to delete ${resource}`,
    FORBIDDEN: (resource: string) => `You do not have permission to access this ${resource}`,
  },

  /**
   * Person-specific errors
   */
  PERSON: {
    NOT_FOUND: 'Person not found',
    ALREADY_EXISTS: 'A person with this name already exists',
    RELATIONSHIP_REQUIRED: 'Relationship to user is required for direct connections',
    BASE_CONNECTION_NOT_FOUND: 'Base connection person not found',
    CANNOT_DELETE_WITH_RELATIONSHIPS: 'Cannot delete person with existing relationships. Delete relationships first or choose to delete orphaned connections.',
  },

  /**
   * Group-specific errors
   */
  GROUP: {
    NOT_FOUND: 'Group not found',
    ALREADY_EXISTS: 'A group with this name already exists',
    NAME_REQUIRED: 'Group name is required',
    CANNOT_DELETE_WITH_MEMBERS: 'Cannot delete group with members. Remove members first.',
  },

  /**
   * Relationship-specific errors
   */
  RELATIONSHIP: {
    NOT_FOUND: 'Relationship not found',
    ALREADY_EXISTS: 'Relationship already exists between these people',
    SAME_PERSON: 'Cannot create relationship with the same person',
    TYPE_NOT_FOUND: 'Relationship type not found',
    CIRCULAR_DEPENDENCY: 'Circular relationship dependency detected',
  },

  /**
   * Rate limiting errors
   */
  RATE_LIMIT: {
    EXCEEDED: (minutes: number) => 
      `Too many attempts. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
    LOGIN_EXCEEDED: 'Too many login attempts. Please try again later.',
    REGISTRATION_EXCEEDED: 'Too many registration attempts. Please try again later.',
  },

  /**
   * Import/Export errors
   */
  DATA: {
    IMPORT_FAILED: 'Failed to import data. Please check the file format.',
    EXPORT_FAILED: 'Failed to export data. Please try again.',
    INVALID_FORMAT: 'Invalid data format. Please use the correct file format.',
    FILE_TOO_LARGE: (maxMB: number) => `File too large. Maximum size is ${maxMB}MB.`,
    PARSE_ERROR: 'Failed to parse data file. Please check the file format.',
  },

  /**
   * General server errors
   */
  SERVER: {
    INTERNAL_ERROR: 'Something went wrong. Please try again later.',
    SERVICE_UNAVAILABLE: 'Service temporarily unavailable. Please try again later.',
    DATABASE_ERROR: 'Database error. Please try again later.',
    NETWORK_ERROR: 'Network error. Please check your connection.',
    TIMEOUT: 'Request timed out. Please try again.',
  },

  /**
   * Request errors
   */
  REQUEST: {
    INVALID_JSON: 'Invalid JSON in request body',
    PAYLOAD_TOO_LARGE: (maxMB: number) => `Request body too large. Maximum size is ${maxMB}MB.`,
    MISSING_HEADER: (header: string) => `Missing required header: ${header}`,
    INVALID_METHOD: (method: string) => `Method ${method} not allowed`,
  },

  /**
   * Feature-specific errors
   */
  FEATURE: {
    NOT_IMPLEMENTED: 'This feature is not yet implemented',
    DISABLED: 'This feature is currently disabled',
    REQUIRES_UPGRADE: 'This feature requires an account upgrade',
  },
} as const;

/**
 * Success messages
 */
export const SuccessMessages = {
  AUTH: {
    REGISTERED: 'Account created successfully. Please check your email to verify your account.',
    LOGIN: 'Logged in successfully',
    LOGOUT: 'Logged out successfully',
    EMAIL_VERIFIED: 'Email verified successfully. You can now log in.',
    PASSWORD_RESET_SENT: 'Password reset email sent. Please check your inbox.',
    PASSWORD_RESET: 'Password reset successfully. You can now log in with your new password.',
    PASSWORD_CHANGED: 'Password changed successfully',
  },

  PROFILE: {
    UPDATED: 'Profile updated successfully',
    EMAIL_CHANGED: 'Email address updated successfully',
    THEME_CHANGED: 'Theme updated successfully',
    SETTINGS_UPDATED: 'Settings updated successfully',
  },

  PERSON: {
    CREATED: 'Person created successfully',
    UPDATED: 'Person updated successfully',
    DELETED: 'Person deleted successfully',
  },

  GROUP: {
    CREATED: 'Group created successfully',
    UPDATED: 'Group updated successfully',
    DELETED: 'Group deleted successfully',
    MEMBER_ADDED: 'Member added to group successfully',
    MEMBER_REMOVED: 'Member removed from group successfully',
  },

  RELATIONSHIP: {
    CREATED: 'Relationship created successfully',
    UPDATED: 'Relationship updated successfully',
    DELETED: 'Relationship deleted successfully',
  },

  DATA: {
    EXPORTED: 'Data exported successfully',
    IMPORTED: 'Data imported successfully',
  },
} as const;

