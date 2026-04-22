import pino from 'pino';
import { getContext } from './logging/context';
import { AppError, ExternalServiceError } from './errors';

type LogContext = Record<string, unknown>;

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

export const pinoOptions: pino.LoggerOptions = {
  level: LOG_LEVEL,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  mixin() {
    return getContext() ?? {};
  },
  serializers: {
    err: (err: unknown) => {
      const base = pino.stdSerializers.err(err as Error);
      if (err instanceof AppError) {
        const enriched: Record<string, unknown> = {
          ...base,
          code: err.code,
          statusCode: err.statusCode,
          ...err.context,
        };
        if (err instanceof ExternalServiceError) {
          enriched.service = err.service;
          enriched.endpoint = err.endpoint;
          enriched.method = err.method;
          enriched.status = err.status;
          enriched.body = err.body;
        }
        return enriched;
      }
      return base;
    },
  },
};

if (process.env.NODE_ENV !== 'production') {
  pinoOptions.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:HH:MM:ss.l',
      ignore: 'pid,hostname',
    },
  };
}

export const logger = pino(pinoOptions);

export function createModuleLogger(module: string) {
  return logger.child({ module });
}

const securityLog = logger.child({ module: 'security' });

export const securityLogger = {
  rateLimitExceeded: (ip: string, endpoint: string, context?: LogContext) => {
    securityLog.warn(
      { type: 'RATE_LIMIT_EXCEEDED', ip, endpoint, ...context },
      'Rate limit exceeded'
    );
  },
  authFailure: (ip: string, reason: string, context?: LogContext) => {
    securityLog.warn(
      { type: 'AUTH_FAILURE', ip, reason, ...context },
      'Authentication failure'
    );
  },
  suspiciousActivity: (ip: string, activity: string, context?: LogContext) => {
    securityLog.warn(
      { type: 'SUSPICIOUS_ACTIVITY', ip, activity, ...context },
      'Suspicious activity detected'
    );
  },
};
