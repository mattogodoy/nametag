import {
  registerSchema, forgotPasswordSchema, resetPasswordSchema,
  resendVerificationSchema, checkVerificationSchema,
} from '../validations';
import { zodBody, jsonBody, ref400, refMessage, resp } from './helpers';

export function authPaths(): Record<string, Record<string, unknown>> {
  return {
    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new account',
        description: 'Creates a new user account. May send a verification email if email verification is enabled.',
        requestBody: zodBody(registerSchema),
        responses: {
          '201': {
            description: 'Account created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    user: {
                      type: 'object',
                      properties: { id: { type: 'string' }, email: { type: 'string' }, name: { type: 'string' } },
                    },
                  },
                },
              },
            },
          },
          '400': ref400(),
          '429': resp('Rate limited'),
        },
      },
    },
    '/api/auth/verify-email': {
      post: {
        tags: ['Auth'],
        summary: 'Verify email address',
        description: 'Confirms the user\'s email using the token sent during registration.',
        requestBody: jsonBody({
          type: 'object',
          properties: { token: { type: 'string' } },
          required: ['token'],
        }),
        responses: {
          '200': refMessage(),
          '400': ref400(),
        },
      },
    },
    '/api/auth/forgot-password': {
      post: {
        tags: ['Auth'],
        summary: 'Request password reset',
        description: 'Sends a password reset email to the specified address if the account exists.',
        requestBody: zodBody(forgotPasswordSchema),
        responses: {
          '200': refMessage(),
          '429': resp('Rate limited'),
        },
      },
    },
    '/api/auth/reset-password': {
      post: {
        tags: ['Auth'],
        summary: 'Reset password with token',
        description: 'Sets a new password using a valid reset token.',
        requestBody: zodBody(resetPasswordSchema),
        responses: {
          '200': refMessage(),
          '400': ref400(),
        },
      },
    },
    '/api/auth/check-verification': {
      post: {
        tags: ['Auth'],
        summary: 'Check if an email is verified',
        description: 'Returns whether the given email address has been verified.',
        requestBody: zodBody(checkVerificationSchema),
        responses: {
          '200': {
            description: 'Verification status',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { verified: { type: 'boolean' } },
                },
              },
            },
          },
        },
      },
    },
    '/api/auth/resend-verification': {
      post: {
        tags: ['Auth'],
        summary: 'Resend verification email',
        description: 'Sends a new verification email to the specified address.',
        requestBody: zodBody(resendVerificationSchema),
        responses: {
          '200': refMessage(),
          '429': resp('Rate limited'),
        },
      },
    },
    '/api/auth/registration-status': {
      get: {
        tags: ['Auth'],
        summary: 'Check if registration is enabled',
        description: 'Returns whether new user registration is currently allowed on this instance.',
        responses: {
          '200': {
            description: 'Registration status',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    enabled: { type: 'boolean' },
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/auth/available-providers': {
      get: {
        tags: ['Auth'],
        summary: 'List available authentication providers',
        description: 'Returns which login methods (credentials, OIDC, Google OAuth) are enabled on this instance.',
        responses: {
          '200': {
            description: 'Available providers',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    providers: {
                      type: 'object',
                      properties: {
                        credentials: { type: 'boolean' },
                        google: { type: 'boolean' },
                        oidc: {
                          type: 'object',
                          properties: {
                            enabled: { type: 'boolean' },
                            name: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}
