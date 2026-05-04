export interface AppErrorOptions {
  code?: string;
  statusCode?: number;
  cause?: unknown;
  context?: Record<string, unknown>;
}

export class AppError extends Error {
  readonly code: string;
  readonly statusCode?: number;
  readonly context: Record<string, unknown>;

  constructor(message: string, opts: AppErrorOptions = {}) {
    super(message, { cause: opts.cause });
    this.name = 'AppError';
    this.code = opts.code ?? 'app_error';
    this.statusCode = opts.statusCode;
    this.context = opts.context ?? {};
  }
}

export interface ExternalServiceErrorOptions {
  message: string;
  service: string;
  endpoint?: string;
  method?: string;
  status?: number;
  body?: string;
  cause?: unknown;
  context?: Record<string, unknown>;
}

export class ExternalServiceError extends AppError {
  readonly service: string;
  readonly endpoint?: string;
  readonly method?: string;
  readonly status?: number;
  readonly body?: string;

  constructor(opts: ExternalServiceErrorOptions) {
    super(opts.message, {
      code: `${opts.service}_error`,
      statusCode: opts.status,
      cause: opts.cause,
      context: opts.context,
    });
    this.name = 'ExternalServiceError';
    this.service = opts.service;
    this.endpoint = opts.endpoint;
    this.method = opts.method;
    this.status = opts.status;
    this.body = opts.body;
  }
}
