# Audit Logging Implementation Guide

**Status**: 📋 Not Implemented Yet  
**Effort**: 4-6 hours (basic) | 6-10 hours (with advanced features)  
**Priority**: High (Security & Compliance)

- [ ] Create AuditLog Prisma model
- [ ] Implement audit logging for:
  - [ ] Login attempts (success/failure)
  - [ ] Password changes
  - [ ] Email changes
  - [ ] Account deletions
  - [ ] Data exports
  - [ ] Sensitive data access
- [ ] Add audit log viewing in admin panel
- [ ] Set up alerts for suspicious activities

---

## 🔍 What is Audit Logging?

**Audit logging** is a security feature that records significant events and user actions in your application. It creates an **immutable trail** of "who did what, when, where, and how" - essentially a security camera for your application.

Think of it like a security log in a building where you track:
- Who entered (user authentication)
- What they accessed (viewed data)
- What they changed (created, updated, deleted)
- When suspicious activity occurred (failed logins, permission errors)

---

## 🎯 Why Is It Useful?

### 1. **Security & Forensics**
- **Detect breaches**: "Someone accessed 1,000 user records at 3am - is this legitimate?"
- **Investigate incidents**: "How did this data get deleted? Who had access?"
- **Track attackers**: "This IP tried to login 50 times in 5 minutes"

### 2. **Compliance & Legal**
Many regulations **require** audit logs:
- **GDPR** (Europe): Must track who accessed personal data
- **HIPAA** (Healthcare): Must log access to medical records  
- **SOX** (Financial): Must track financial data changes
- **PCI DSS** (Payments): Must log access to payment data

### 3. **Accountability**
- **User actions**: "Who deleted my person record?"
- **Admin actions**: "Who changed the user's permissions?"
- **Data integrity**: "When was this relationship last modified?"

### 4. **Debugging**
- **Reproduce issues**: "What actions led to this bug?"
- **Performance**: "Why is this user's account slow?" (too many queries)
- **Data quality**: "How did this invalid data get in?"

### 5. **Analytics**
- **Usage patterns**: "What features are most used?"
- **User behavior**: "How long does registration take?"
- **System health**: "How many failed API calls?"

---

## 🏗️ How Does It Work?

### High-Level Architecture

```
User Action → Application Code → Audit Logger → Database
                     ↓
              Security Events
              (login, delete, etc.)
```

### Core Components

1. **Audit Log Table** (Database)
   - Stores all audit events
   - Optimized for writes (high volume)
   - Never deleted (immutable)

2. **Audit Logger** (Code)
   - Captures events throughout your app
   - Enriches data (IP, user agent, context)
   - Writes to database asynchronously

3. **Audit Viewer** (Dashboard)
   - Query and filter logs
   - Export for compliance
   - Alert on suspicious patterns

---

## 📊 What Should You Log?

### **Authentication Events** ✅ Critical
```
✓ User login (success/failure)
✓ User logout
✓ Password changes
✓ Password reset requests
✓ Email verification
✓ Account lockouts
✓ Session expiration
✓ 2FA events (if implemented)
```

### **Authorization Events** ✅ Critical
```
✓ Permission denied (403 errors)
✓ Unauthorized access attempts
✓ Role changes
✓ Admin actions
```

### **Data Modification Events** 🔶 High Priority
```
✓ Create: New person, group, relationship
✓ Update: Changed person details
✓ Delete: Removed relationship
✓ Bulk operations: Import/export
```

### **Sensitive Data Access** 🔶 High Priority
```
✓ View user profile
✓ Access financial data
✓ Download exports
✓ Search queries (especially PII)
```

### **System Events** 🔵 Medium Priority
```
✓ Configuration changes
✓ API rate limit exceeded
✓ Errors and exceptions
✓ Database migrations
```

---

## 🛠️ Implementation Steps

### **Step 1: Design the Database Schema** (30 mins)

Create an `AuditLog` table in `prisma/schema.prisma`:

```prisma
model AuditLog {
  id          String   @id @default(cuid())
  createdAt   DateTime @default(now())
  
  // Who
  userId      String?  // null for anonymous actions
  user        User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  
  // What
  action      String   // 'USER_LOGIN', 'PERSON_DELETED', etc.
  resource    String   // 'user', 'person', 'group', etc.
  resourceId  String?  // The ID of the affected resource
  
  // Context
  method      String?  // 'GET', 'POST', 'DELETE'
  path        String?  // '/api/people/123'
  statusCode  Int?     // 200, 404, 500
  
  // Where
  ipAddress   String?
  userAgent   String?
  
  // Details
  metadata    Json?    // Additional context (old values, new values, etc.)
  
  // Result
  success     Boolean  @default(true)
  errorMessage String?
  
  @@index([userId])
  @@index([action])
  @@index([createdAt])
  @@index([resource, resourceId])
  @@map("audit_logs")
}
```

**Why this schema?**
- **Indexed fields** for fast queries
- **Flexible metadata** (JSON) for event-specific data
- **Nullable fields** for different event types
- **Immutable** (no update/delete operations)

**Run migration:**
```bash
npx prisma migrate dev --name add_audit_logs
```

---

### **Step 2: Create the Audit Logger** (1 hour)

Create `lib/audit-logger.ts`:

```typescript
import { prisma } from './prisma';
import { logger } from './logger';

export type AuditAction =
  // Authentication
  | 'USER_LOGIN'
  | 'USER_LOGIN_FAILED'
  | 'USER_LOGOUT'
  | 'USER_REGISTERED'
  | 'PASSWORD_CHANGED'
  | 'PASSWORD_RESET_REQUESTED'
  | 'PASSWORD_RESET_COMPLETED'
  | 'EMAIL_VERIFIED'
  | 'EMAIL_VERIFICATION_SENT'
  
  // Authorization
  | 'ACCESS_DENIED'
  | 'PERMISSION_DENIED'
  
  // Data - Person
  | 'PERSON_CREATED'
  | 'PERSON_UPDATED'
  | 'PERSON_DELETED'
  | 'PERSON_VIEWED'
  
  // Data - Group
  | 'GROUP_CREATED'
  | 'GROUP_UPDATED'
  | 'GROUP_DELETED'
  | 'GROUP_MEMBER_ADDED'
  | 'GROUP_MEMBER_REMOVED'
  
  // Data - Relationship
  | 'RELATIONSHIP_CREATED'
  | 'RELATIONSHIP_UPDATED'
  | 'RELATIONSHIP_DELETED'
  
  // Data - User
  | 'USER_PROFILE_UPDATED'
  | 'USER_SETTINGS_CHANGED'
  | 'USER_ACCOUNT_DELETED'
  | 'USER_DATA_EXPORTED'
  | 'USER_DATA_IMPORTED'
  
  // System
  | 'API_RATE_LIMIT_EXCEEDED'
  | 'API_REQUEST'
  | 'API_ERROR';

export type AuditResource = 
  | 'user'
  | 'person'
  | 'group'
  | 'relationship'
  | 'important_date'
  | 'relationship_type'
  | 'session'
  | 'api'
  | 'system';

interface AuditLogEntry {
  userId?: string;
  action: AuditAction;
  resource: AuditResource;
  resourceId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  success?: boolean;
  error?: Error;
}

class AuditLogger {
  /**
   * Log an audit event
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: entry.userId,
          action: entry.action,
          resource: entry.resource,
          resourceId: entry.resourceId,
          method: entry.method,
          path: entry.path,
          statusCode: entry.statusCode,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
          metadata: entry.metadata || {},
          success: entry.success ?? true,
          errorMessage: entry.error?.message,
        },
      });

      // Also log to application logger for real-time monitoring
      if (!entry.success || entry.error) {
        logger.warn('Audit log entry (failed)', {
          action: entry.action,
          userId: entry.userId,
          error: entry.error?.message,
        });
      }
    } catch (error) {
      // Don't let audit logging failures break the application
      logger.error('Failed to write audit log', {
        action: entry.action,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Log authentication event
   */
  async logAuth(
    action: Extract<AuditAction, 'USER_LOGIN' | 'USER_LOGIN_FAILED' | 'USER_LOGOUT' | 'USER_REGISTERED'>,
    userId: string | undefined,
    request: Request,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      userId,
      action,
      resource: 'user',
      resourceId: userId,
      ipAddress: this.getClientIp(request),
      userAgent: request.headers.get('user-agent') || undefined,
      metadata,
      success: !action.includes('FAILED'),
    });
  }

  /**
   * Log data modification event
   */
  async logDataChange(
    action: AuditAction,
    resource: AuditResource,
    resourceId: string,
    userId: string,
    request: Request,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      userId,
      action,
      resource,
      resourceId,
      method: request.method,
      path: new URL(request.url).pathname,
      ipAddress: this.getClientIp(request),
      userAgent: request.headers.get('user-agent') || undefined,
      metadata,
    });
  }

  /**
   * Log API request (for general tracking)
   */
  async logApiRequest(
    request: Request,
    statusCode: number,
    userId?: string,
    success = true
  ): Promise<void> {
    // Only log failed requests or important endpoints
    const path = new URL(request.url).pathname;
    const shouldLog = 
      !success || 
      statusCode >= 400 ||
      path.includes('/api/user/') ||
      path.includes('/api/auth/');

    if (!shouldLog) return;

    await this.log({
      userId,
      action: 'API_REQUEST',
      resource: 'api',
      method: request.method,
      path,
      statusCode,
      ipAddress: this.getClientIp(request),
      userAgent: request.headers.get('user-agent') || undefined,
      success,
    });
  }

  /**
   * Extract client IP from request
   */
  private getClientIp(request: Request): string {
    const forwardedFor = request.headers.get('x-forwarded-for');
    if (forwardedFor) {
      return forwardedFor.split(',')[0].trim();
    }

    const realIp = request.headers.get('x-real-ip');
    if (realIp) {
      return realIp;
    }

    return 'unknown';
  }
}

// Export singleton instance
export const auditLogger = new AuditLogger();
```

---

### **Step 3: Instrument Your Code** (2-3 hours)

Add audit logging to critical endpoints.

#### Example 1: Authentication

Update `app/api/auth/register/route.ts`:

```typescript
import { auditLogger } from '@/lib/audit-logger';

export async function POST(request: Request) {
  try {
    // ... existing registration code ...
    
    const user = await prisma.user.create({
      data: { /* ... */ }
    });

    // ✅ Audit log
    await auditLogger.logAuth('USER_REGISTERED', user.id, request, {
      email: user.email,
      name: user.name,
    });

    return NextResponse.json({ message: 'User registered' });
  } catch (error) {
    // ✅ Log failure
    await auditLogger.logAuth('USER_REGISTERED', undefined, request, {
      error: error.message,
    });
    
    throw error;
  }
}
```

#### Example 2: Data Deletion

Update `app/api/people/[id]/route.ts`:

```typescript
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get person data before deletion (for audit trail)
    const person = await prisma.person.findUnique({
      where: { id: params.id },
      select: { name: true, surname: true, userId: true },
    });

    if (!person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    // Delete person
    await prisma.person.delete({ where: { id: params.id } });

    // ✅ Audit log
    await auditLogger.logDataChange(
      'PERSON_DELETED',
      'person',
      params.id,
      session.user.id,
      request,
      {
        personName: `${person.name} ${person.surname || ''}`.trim(),
        deletedAt: new Date().toISOString(),
      }
    );

    return NextResponse.json({ message: 'Person deleted' });
  } catch (error) {
    // Log failure
    await auditLogger.log({
      userId: session.user.id,
      action: 'PERSON_DELETED',
      resource: 'person',
      resourceId: params.id,
      success: false,
      error: error as Error,
      ipAddress: auditLogger.getClientIp(request),
    });

    throw error;
  }
}
```

#### Example 3: Failed Login

Update `lib/auth.ts`:

```typescript
import { auditLogger } from './audit-logger';

// Inside authorize function
async authorize(credentials) {
  // ... existing code ...

  if (!user) {
    // ✅ Log failed login (user not found)
    await auditLogger.logAuth('USER_LOGIN_FAILED', undefined, request, {
      email: credentials.email,
      reason: 'User not found',
    });
    return null;
  }

  const passwordMatch = await bcrypt.compare(
    credentials.password,
    user.password
  );

  if (!passwordMatch) {
    // ✅ Log failed login (wrong password)
    await auditLogger.logAuth('USER_LOGIN_FAILED', user.id, request, {
      email: user.email,
      reason: 'Invalid password',
    });
    return null;
  }

  // ✅ Log successful login
  await auditLogger.logAuth('USER_LOGIN', user.id, request, {
    email: user.email,
  });

  return user;
}
```

---

### **Step 4: Add Middleware for Automatic Logging** (1 hour)

Update `proxy.ts` to automatically log API requests:

```typescript
import { auditLogger } from '@/lib/audit-logger';
import { auth } from '@/lib/auth';

export async function proxy(request: NextRequest) {
  const startTime = Date.now();
  const response = NextResponse.next();
  
  // Get user ID from session (if authenticated)
  const session = await auth();
  const userId = session?.user?.id;

  // Add audit ID to response
  const auditId = crypto.randomUUID();
  response.headers.set('x-audit-id', auditId);

  // Log after response completes (async, don't block)
  const duration = Date.now() - startTime;
  const statusCode = response.status;
  
  // Async logging (fire and forget)
  auditLogger.logApiRequest(
    request,
    statusCode,
    userId,
    statusCode < 400
  ).catch((error) => {
    console.error('Failed to log API request:', error);
  });

  return response;
}
```

---

### **Step 5: Create Audit Log Viewer** (1-2 hours)

Create `app/admin/audit-logs/page.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

interface AuditLog {
  id: string;
  createdAt: string;
  userId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  ipAddress: string | null;
  success: boolean;
  user?: {
    email: string;
    name: string;
  };
}

export default function AuditLogsPage() {
  const { data: session } = useSession();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filters, setFilters] = useState({
    action: '',
    userId: '',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    fetchLogs();
  }, [filters]);

  async function fetchLogs() {
    const params = new URLSearchParams(filters);
    const response = await fetch(`/api/admin/audit-logs?${params}`);
    const data = await response.json();
    setLogs(data.logs);
  }

  async function exportLogs() {
    const params = new URLSearchParams(filters);
    const response = await fetch(`/api/admin/audit-logs/export?${params}`);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${Date.now()}.csv`;
    a.click();
  }

  // Only allow admin users
  if (!session?.user) {
    return <div>Access denied</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Audit Logs</h1>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-4 gap-4">
          <select
            value={filters.action}
            onChange={(e) => setFilters({ ...filters, action: e.target.value })}
            className="border rounded px-3 py-2"
          >
            <option value="">All Actions</option>
            <option value="USER_LOGIN">User Login</option>
            <option value="PERSON_DELETED">Person Deleted</option>
            {/* Add more actions */}
          </select>

          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            className="border rounded px-3 py-2"
            placeholder="Start Date"
          />

          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            className="border rounded px-3 py-2"
            placeholder="End Date"
          />

          <button
            onClick={exportLogs}
            className="bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left">Timestamp</th>
              <th className="px-4 py-3 text-left">User</th>
              <th className="px-4 py-3 text-left">Action</th>
              <th className="px-4 py-3 text-left">Resource</th>
              <th className="px-4 py-3 text-left">IP Address</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t border-gray-200 dark:border-gray-700">
                <td className="px-4 py-3">
                  {new Date(log.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  {log.user ? `${log.user.name} (${log.user.email})` : 'Anonymous'}
                </td>
                <td className="px-4 py-3">
                  <code className="text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                    {log.action}
                  </code>
                </td>
                <td className="px-4 py-3">{log.resource}</td>
                <td className="px-4 py-3">{log.ipAddress}</td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      log.success
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {log.success ? 'Success' : 'Failed'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

Create the API endpoint `app/api/admin/audit-logs/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const session = await auth();
  
  // Check if user is admin (you'll need to add this field)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const userId = searchParams.get('userId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  const where: any = {};

  if (action) where.action = action;
  if (userId) where.userId = userId;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  const logs = await prisma.auditLog.findMany({
    where,
    include: {
      user: {
        select: {
          email: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100, // Limit results
  });

  return NextResponse.json({ logs });
}
```

---

### **Step 6: Add Alerting** (Optional, 1-2 hours)

Create `lib/audit-analyzer.ts`:

```typescript
import { prisma } from './prisma';
import { logger } from './logger';

interface SuspiciousActivity {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  metadata: Record<string, any>;
}

export class AuditAnalyzer {
  /**
   * Check for brute force login attempts
   */
  async checkBruteForce(ipAddress: string): Promise<SuspiciousActivity | null> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const failedLogins = await prisma.auditLog.count({
      where: {
        action: 'USER_LOGIN_FAILED',
        ipAddress,
        createdAt: { gte: fiveMinutesAgo },
      },
    });

    if (failedLogins > 5) {
      return {
        type: 'BRUTE_FORCE_ATTEMPT',
        severity: 'high',
        description: `${failedLogins} failed login attempts from ${ipAddress} in last 5 minutes`,
        metadata: { ipAddress, failedLogins },
      };
    }

    return null;
  }

  /**
   * Check for unusual data access patterns
   */
  async checkUnusualAccess(userId: string): Promise<SuspiciousActivity | null> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const personViews = await prisma.auditLog.count({
      where: {
        userId,
        action: 'PERSON_VIEWED',
        createdAt: { gte: oneHourAgo },
      },
    });

    if (personViews > 100) {
      return {
        type: 'UNUSUAL_DATA_ACCESS',
        severity: 'medium',
        description: `User ${userId} accessed ${personViews} person records in last hour`,
        metadata: { userId, personViews },
      };
    }

    return null;
  }

  /**
   * Check for bulk deletions
   */
  async checkBulkDeletions(userId: string): Promise<SuspiciousActivity | null> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const deletions = await prisma.auditLog.count({
      where: {
        userId,
        action: { contains: 'DELETED' },
        createdAt: { gte: fiveMinutesAgo },
      },
    });

    if (deletions > 10) {
      return {
        type: 'BULK_DELETION',
        severity: 'critical',
        description: `User ${userId} deleted ${deletions} items in last 5 minutes`,
        metadata: { userId, deletions },
      };
    }

    return null;
  }

  /**
   * Send alert (integrate with your notification system)
   */
  async sendAlert(activity: SuspiciousActivity): Promise<void> {
    logger.warn('Suspicious activity detected', {
      type: activity.type,
      severity: activity.severity,
      description: activity.description,
      metadata: activity.metadata,
    });

    // TODO: Send email, Slack notification, etc.
    // await sendEmail({
    //   to: 'admin@example.com',
    //   subject: `Security Alert: ${activity.type}`,
    //   body: activity.description,
    // });
  }
}

export const auditAnalyzer = new AuditAnalyzer();
```

Run analyzer periodically:

```typescript
// lib/audit-scheduler.ts
import { auditAnalyzer } from './audit-analyzer';

export async function runSecurityChecks() {
  // Get recent unique IPs
  const recentLogs = await prisma.auditLog.findMany({
    where: {
      createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
    },
    distinct: ['ipAddress'],
    select: { ipAddress: true },
  });

  for (const log of recentLogs) {
    if (log.ipAddress) {
      const bruteForce = await auditAnalyzer.checkBruteForce(log.ipAddress);
      if (bruteForce) {
        await auditAnalyzer.sendAlert(bruteForce);
      }
    }
  }
}

// Run every 5 minutes
setInterval(runSecurityChecks, 5 * 60 * 1000);
```

---

## 📈 Best Practices

### 1. **Performance**
- ✅ Log **asynchronously** (don't block requests)
- ✅ Batch writes when possible
- ✅ Use database indexes
- ✅ Archive old logs (>90 days) to separate table

Example archiving:
```typescript
// Archive logs older than 90 days
async function archiveOldLogs() {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  
  // Move to archive table or export to S3
  const oldLogs = await prisma.auditLog.findMany({
    where: { createdAt: { lt: ninetyDaysAgo } },
  });
  
  // Export to file or archive database
  // Then delete from main table
  await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: ninetyDaysAgo } },
  });
}
```

### 2. **Privacy**
- ❌ DON'T log passwords (even hashed)
- ❌ DON'T log full credit card numbers
- ✅ DO redact sensitive fields (mask email: `u***@example.com`)
- ✅ DO comply with GDPR (delete user logs on request)

Example redaction:
```typescript
function redactEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local[0]}***@${domain}`;
}

function redactSensitiveData(data: any): any {
  if (data.password) delete data.password;
  if (data.email) data.email = redactEmail(data.email);
  if (data.creditCard) data.creditCard = '****-****-****-' + data.creditCard.slice(-4);
  return data;
}
```

### 3. **Security**
- ✅ Logs should be **immutable** (no updates/deletes)
- ✅ Restrict access (admin only)
- ✅ Encrypt sensitive metadata
- ✅ Regular backups

### 4. **Retention**
```
High-security events (auth, deletions): 7 years (compliance)
General audit logs: 90 days
Debug logs: 30 days
```

---

## 💡 Real-World Examples

### Example 1: Security Breach Investigation
```
Time: 2025-03-15 02:30 AM
Event: User "attacker@evil.com" accessed 500 person records

Query:
  SELECT * FROM audit_logs 
  WHERE action = 'PERSON_VIEWED'
  AND userId = 'abc123'
  AND createdAt > '2025-03-15 02:00:00'
  
Result: Identified compromised account, revoked access, 
        forced password reset for affected users
```

### Example 2: GDPR Compliance
```
User Request: "What data do you have about me?"

Query audit logs:
  - All times user data was accessed
  - All times user data was modified
  - All API calls made by user
  
Generate report showing full audit trail
```

### Example 3: Debugging
```
User: "My relationship disappeared!"

Query:
  SELECT * FROM audit_logs
  WHERE resource = 'relationship'
  AND resourceId = 'rel_456'
  ORDER BY createdAt DESC
  
Result: Found that relationship was deleted by userId 'xyz789'
        on 2025-03-10 at 14:23:15. Metadata shows it was 
        accidental bulk delete. Restored from backup.
```

---

## 📊 Effort Breakdown (Total: 4-6 hours)

| Task | Estimated Time |
|------|----------------|
| 1. Database schema | 30 mins |
| 2. Audit logger library | 1 hour |
| 3. Instrument critical endpoints | 2-3 hours |
| 4. Add middleware | 1 hour |
| 5. Create viewer UI | 1-2 hours |
| 6. Testing | 1 hour |
| **Total (Basic)** | **4-6 hours** |
| 7. Alerting (optional) | +2 hours |
| 8. Analytics dashboard (optional) | +2-4 hours |
| **Total (Advanced)** | **6-10 hours** |

---

## ✅ Implementation Checklist

When implementing, follow this checklist:

- [ ] **Step 1**: Add `AuditLog` model to Prisma schema
- [ ] **Step 1**: Run migration: `npx prisma migrate dev --name add_audit_logs`
- [ ] **Step 2**: Create `lib/audit-logger.ts`
- [ ] **Step 2**: Add audit types and interfaces
- [ ] **Step 3**: Add audit logging to authentication endpoints
  - [ ] Login (success/failure)
  - [ ] Registration
  - [ ] Password reset
  - [ ] Email verification
- [ ] **Step 3**: Add audit logging to data modification endpoints
  - [ ] Person CRUD
  - [ ] Group CRUD
  - [ ] Relationship CRUD
  - [ ] User profile updates
  - [ ] Data export/import
- [ ] **Step 4**: Update `proxy.ts` with automatic logging
- [ ] **Step 5**: Create audit log viewer UI
  - [ ] Admin page at `/admin/audit-logs`
  - [ ] Filter by action, user, date
  - [ ] Export to CSV
- [ ] **Step 5**: Create API endpoint `/api/admin/audit-logs`
- [ ] **Step 6** (Optional): Add security alerting
  - [ ] Brute force detection
  - [ ] Unusual access patterns
  - [ ] Bulk operations
- [ ] **Testing**: Test all audit logging
- [ ] **Testing**: Verify logs are created correctly
- [ ] **Testing**: Test viewer UI and filters
- [ ] **Documentation**: Update README with audit logging info

---

## 🎯 Summary

**Audit Logging = Security Camera for Your App**

### Why?
- ✅ Detect security breaches
- ✅ Comply with regulations (GDPR, HIPAA)
- ✅ Debug production issues
- ✅ Track user accountability

### What to log?
- ✅ Authentication (login/logout)
- ✅ Data modifications (create/update/delete)
- ✅ Access to sensitive data
- ✅ Security events (failures, errors)

### How?
1. Create database table (`AuditLog` model)
2. Add audit logger utility (`lib/audit-logger.ts`)
3. Instrument your code (add `auditLogger.log()` calls)
4. Build viewer UI (`/admin/audit-logs`)
5. Set up alerts (optional)

### Result
Peace of mind knowing you can answer "who did what, when" for any security incident or compliance audit! 🛡️

---

## 📚 Additional Resources

- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- [GDPR Audit Log Requirements](https://gdpr.eu/data-processing-agreement/)
- [Prisma JSON Fields](https://www.prisma.io/docs/concepts/components/prisma-schema/data-model#json-fields)
- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)

---

**Ready to implement? Follow the steps above and you'll have comprehensive audit logging in 4-6 hours!** 🚀

