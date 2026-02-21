/**
 * Retry utility with exponential backoff for CardDAV operations
 */

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  shouldRetry?: (error: unknown) => boolean;
}

/**
 * Type guard: check if an error has an HTTP status code.
 */
function hasHttpStatus(error: unknown): error is { status: number } {
  return typeof error === 'object' && error !== null && 'status' in error
    && typeof (error as Record<string, unknown>).status === 'number';
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffFactor: 2,
  shouldRetry: (error: unknown) => {
    // Retry on network errors, timeouts, and 5xx server errors
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      // Network errors
      if (
        message.includes('network') ||
        message.includes('timeout') ||
        message.includes('econnrefused') ||
        message.includes('enotfound')
      ) {
        return true;
      }
    }

    // Check for HTTP status codes
    if (hasHttpStatus(error)) {
      // Retry on 5xx server errors and 429 rate limiting
      return error.status >= 500 || error.status === 429;
    }

    return false;
  },
};

/**
 * Execute a function with retry logic and exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;
  let delay = opts.initialDelay;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if this is the last attempt or if we shouldn't retry this error
      if (attempt === opts.maxAttempts || !opts.shouldRetry(error)) {
        throw error;
      }

      // Wait before retrying
      await sleep(delay);

      // Exponential backoff
      delay = Math.min(delay * opts.backoffFactor, opts.maxDelay);
    }
  }

  throw lastError;
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Categorize CardDAV errors for better user feedback
 */
export enum ErrorCategory {
  AUTH = 'auth',
  NETWORK = 'network',
  SERVER = 'server',
  RATE_LIMIT = 'rate_limit',
  MALFORMED = 'malformed',
  NOT_FOUND = 'not_found',
  UNKNOWN = 'unknown',
}

export interface CategorizedError {
  category: ErrorCategory;
  message: string;
  originalError: unknown;
  userMessage: string;
}

/**
 * Categorize an error for user-friendly display
 */
export function categorizeError(error: unknown): CategorizedError {
  const errorMessage =
    error instanceof Error ? error.message : String(error);

  // Check for HTTP status codes
  if (hasHttpStatus(error)) {
    // Authentication errors
    if (error.status === 401 || error.status === 403) {
      return {
        category: ErrorCategory.AUTH,
        message: errorMessage,
        originalError: error,
        userMessage: 'carddav.errors.authFailed',
      };
    }

    // Rate limiting
    if (error.status === 429) {
      return {
        category: ErrorCategory.RATE_LIMIT,
        message: errorMessage,
        originalError: error,
        userMessage: 'carddav.errors.rateLimited',
      };
    }

    // Server errors
    if (error.status >= 500) {
      return {
        category: ErrorCategory.SERVER,
        message: errorMessage,
        originalError: error,
        userMessage: 'carddav.errors.serverError',
      };
    }

    // Not found
    if (error.status === 404) {
      return {
        category: ErrorCategory.NOT_FOUND,
        message: errorMessage,
        originalError: error,
        userMessage: 'carddav.errors.notFound',
      };
    }
  }

  // Network errors
  const messageLower = errorMessage.toLowerCase();
  if (
    messageLower.includes('network') ||
    messageLower.includes('timeout') ||
    messageLower.includes('econnrefused') ||
    messageLower.includes('enotfound') ||
    messageLower.includes('dns')
  ) {
    return {
      category: ErrorCategory.NETWORK,
      message: errorMessage,
      originalError: error,
      userMessage: 'carddav.errors.networkError',
    };
  }

  // Malformed data
  if (
    messageLower.includes('parse') ||
    messageLower.includes('malformed') ||
    messageLower.includes('invalid')
  ) {
    return {
      category: ErrorCategory.MALFORMED,
      message: errorMessage,
      originalError: error,
      userMessage: 'carddav.errors.malformedData',
    };
  }

  // Unknown error
  return {
    category: ErrorCategory.UNKNOWN,
    message: errorMessage,
    originalError: error,
    userMessage: 'carddav.errors.unknown',
  };
}
