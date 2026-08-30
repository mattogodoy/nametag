import { describe, it, expect } from 'vitest';
import { RunCircuitBreaker } from '../../../lib/notifications/circuit';

describe('RunCircuitBreaker', () => {
  it('trips on codes that cost wall-clock time', () => {
    // These are the codes the run actually waits on: a timeout burns the full
    // TIMEOUT_MS, and DNS or connection failures burn the resolver or TCP
    // handshake. Retrying them per envelope is what turned one account with
    // five blackholed destinations and twenty reminders into ~500 seconds of
    // work on a shared pool.
    for (const code of ['timeout', 'dns', 'refused', 'tls', 'blocked'] as const) {
      const circuit = new RunCircuitBreaker();
      circuit.record('dest-1', code);
      expect(circuit.trippedCode('dest-1')).toBe(code);
    }
  });

  it('does NOT trip on codes where the destination answered promptly', () => {
    // Both are genuinely transient (a receiver rate-limiting one message may
    // accept the next) and neither costs any waiting, so there is nothing to
    // save and real behaviour to lose. Catches widening UNREACHABLE_CODES to
    // "any failure", which would make one 429 silence a working destination
    // for the rest of the night.
    for (const code of ['http_429', 'http_5xx', 'http_4xx', 'unexpected_response'] as const) {
      const circuit = new RunCircuitBreaker();
      circuit.record('dest-1', code);
      expect(circuit.trippedCode('dest-1')).toBeNull();
    }
  });

  it('keeps destinations independent', () => {
    const circuit = new RunCircuitBreaker();
    circuit.record('dest-1', 'timeout');

    expect(circuit.trippedCode('dest-1')).toBe('timeout');
    expect(circuit.trippedCode('dest-2')).toBeNull();
  });

  it('starts closed', () => {
    expect(new RunCircuitBreaker().trippedCode('dest-1')).toBeNull();
    expect(new RunCircuitBreaker().size).toBe(0);
  });
});
