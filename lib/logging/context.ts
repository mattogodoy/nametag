import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export interface LogContext {
  requestId: string;
  userId?: string;
  jobId?: string;
  [k: string]: unknown;
}

const als = new AsyncLocalStorage<LogContext>();

export function runWithContext<T>(ctx: Partial<LogContext>, fn: () => T): T {
  const base = als.getStore();
  const merged: LogContext = {
    ...(base ?? {}),
    ...ctx,
    requestId: ctx.requestId ?? base?.requestId ?? randomUUID(),
  };
  return als.run(merged, fn);
}

export function updateContext(fields: Partial<LogContext>): void {
  const store = als.getStore();
  if (store) Object.assign(store, fields);
}

export function getContext(): LogContext | undefined {
  return als.getStore();
}
