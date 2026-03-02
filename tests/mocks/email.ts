import { vi } from 'vitest';

export const mockResendSend = vi.fn();
export const mockResendBatchSend = vi.fn();

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: mockResendSend,
    },
    batch: {
      send: mockResendBatchSend,
    },
  })),
}));

export function resetEmailMocks() {
  mockResendSend.mockReset();
  mockResendSend.mockResolvedValue({ data: { id: 'test-email-id' }, error: null });
  mockResendBatchSend.mockReset();
  mockResendBatchSend.mockResolvedValue({ data: { data: [{ id: 'test-batch-id' }] }, error: null });
}

export function mockEmailSuccess() {
  mockResendSend.mockResolvedValue({ data: { id: 'test-email-id' }, error: null });
}

export function mockEmailError(message: string = 'Email send failed') {
  mockResendSend.mockResolvedValue({ data: null, error: { message } });
}

export function mockEmailThrow(message: string = 'Network error') {
  mockResendSend.mockRejectedValue(new Error(message));
}

export function mockBatchSuccess(count: number) {
  mockResendBatchSend.mockResolvedValue({
    data: { data: Array.from({ length: count }, (_, i) => ({ id: `batch-${i}` })) },
    error: null,
  });
}

export function mockBatchError(message: string = 'Batch send failed') {
  mockResendBatchSend.mockResolvedValue({ data: null, error: { message } });
}
