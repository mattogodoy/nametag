import {
  registerSchema, forgotPasswordSchema, resetPasswordSchema,
  resendVerificationSchema, checkVerificationSchema, nativeLoginSchema, nativeRefreshSchema,
} from '../validations';
import { zodBody, jsonBody, ref400, ref401, refMessage, resp, jsonResponse } from './helpers';

export function authPaths(): Record<string, Record<string, unknown>> {
  return {
    '/api/auth/native/login': {
      post: {
        tags: ['Auth'],
        summary: 'Native app sign-in',
        description:
          'Signs in a native app with email and password and returns an access token (one hour) ' +
          'and a refresh token. Every error includes a machine-readable `code`.',
        requestBody: zodBody(nativeLoginSchema),
        responses: {
          '200': jsonResponse('Signed in', { $ref: '#/components/schemas/NativeSession' }),
          '400': jsonResponse('Invalid body (code validation_failed)', { $ref: '#/components/schemas/CodedError' }),
          '401': jsonResponse('Wrong email or password (code invalid_credentials)', { $ref: '#/components/schemas/CodedError' }),
          '403': jsonResponse('Code account_locked, email_not_verified or password_login_disabled', { $ref: '#/components/schemas/CodedError' }),
          '429': jsonResponse('Too many attempts (code rate_limited); see Retry-After', { $ref: '#/components/schemas/CodedError' }),
        },
      },
    },
    '/api/auth/native/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Refresh a native app session',
        description:
          'Exchanges a refresh token for a new access and refresh token pair. The old refresh token ' +
          'stops working. Replaying it within 60 seconds returns a fresh pair (lost response); ' +
          'replaying it later signs the device out.',
        requestBody: zodBody(nativeRefreshSchema),
        responses: {
          '200': jsonResponse('New tokens', { $ref: '#/components/schemas/NativeSession' }),
          '400': jsonResponse('Invalid body (code validation_failed)', { $ref: '#/components/schemas/CodedError' }),
          '401': jsonResponse('Session expired or revoked (code session_expired)', { $ref: '#/components/schemas/CodedError' }),
          '429': jsonResponse('Too many attempts (code rate_limited)', { $ref: '#/components/schemas/CodedError' }),
        },
      },
    },
    '/api/auth/native/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Sign out a native app',
        description: 'Deletes the calling device session. Requires a device access token.',
        security: [{ deviceSession: [] }],
        responses: {
          '204': { description: 'Signed out' },
          '400': jsonResponse('Not called with a device token (code not_a_device_session)', { $ref: '#/components/schemas/CodedError' }),
          '401': ref401(),
        },
      },
    },
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
