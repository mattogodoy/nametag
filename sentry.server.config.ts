/**
 * Sentry Server Configuration
 * Captures errors on the Node.js server
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,
  
  // Environment
  environment: process.env.NODE_ENV || 'development',
  
  // Only send errors in production
  enabled: process.env.NODE_ENV === 'production',
  
  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1.0,
  
  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
  
  // Server-side integrations
  integrations: [
    Sentry.prismaIntegration(),
  ],
  
  // Filter out sensitive data
  beforeSend(event, hint) {
    // Don't send events in development
    if (process.env.NODE_ENV !== 'production') {
      return null;
    }
    
    // Remove sensitive data
    if (event.user) {
      delete event.user.email;
      delete event.user.ip_address;
    }
    
    // Remove authorization headers
    if (event.request?.headers) {
      delete event.request.headers.authorization;
      delete event.request.headers.cookie;
    }
    
    // Remove database connection strings from breadcrumbs
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
        if (breadcrumb.message?.includes('postgres://')) {
          breadcrumb.message = breadcrumb.message.replace(
            /postgres:\/\/[^@]+@/g,
            'postgres://***:***@'
          );
        }
        return breadcrumb;
      });
    }
    
    return event;
  },
});

