import { vi } from 'vitest';

export const mockResendSend = vi.fn();

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: mockResendSend,
    },
  })),
}));

export function resetEmailMocks() {
  mockResendSend.mockReset();
  mockResendSend.mockResolvedValue({ data: { id: 'test-email-id' }, error: null });
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
