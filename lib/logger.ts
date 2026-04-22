import pino from 'pino';
import { getContext } from './logging/context';
import { AppError, ExternalServiceError } from './errors';

type LogContext = Record<string, unknown>;

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

function boundKeys(self: pino.Logger): Set<string> {
  try {
    return new Set(Object.keys(self.bindings()));
  } catch {
    return new Set<string>();
  }
}

export const pinoOptions: pino.LoggerOptions = {
  level: LOG_LEVEL,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  mixin(_mergeObj: object, _num: number, self: pino.Logger) {
    try {
      const ctx = getContext() ?? {};
      const bound = boundKeys(self);
      if (bound.size === 0) return ctx;
      // Drop context keys that the child logger already has as bindings so
      // those bindings win over ALS context in the final JSON output.
      const filtered: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(ctx)) {
        if (!bound.has(k)) filtered[k] = v;
      }
      return filtered;
    } catch {
      return {};
    }
  },
  // Explicit log-call fields (mergeObject) take precedence over ALS context
  // (mixinObject) when both carry the same key.
  mixinMergeStrategy(mergeObject, mixinObject) {
    return { ...mixinObject, ...mergeObject };
  },
  serializers: {
    err: (err: unknown) => {
      const base = pino.stdSerializers.err(err as Error);
      if (err instanceof AppError) {
        const enriched: Record<string, unknown> = {
          ...err.context,
          ...base,
          code: err.code,
          statusCode: err.statusCode,
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
