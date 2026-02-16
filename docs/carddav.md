# CardDAV Integration Guide

Nametag supports bidirectional sync with CardDAV servers, allowing you to keep your contacts synchronized with Google Contacts, iCloud, Outlook, Nextcloud, and other CardDAV-compatible services.

## Table of Contents

- [Overview](#overview)
- [Supported Providers](#supported-providers)
- [Setup](#setup)
  - [Google Contacts](#google-contacts)
  - [iCloud](#icloud)
  - [Outlook / Office 365](#outlook--office-365)
  - [Nextcloud / Radicale](#nextcloud--radicale)
- [Features](#features)
- [Usage](#usage)
- [Troubleshooting](#troubleshooting)
- [Technical Details](#technical-details)

## Overview

The CardDAV integration allows you to:

- **Sync contacts bidirectionally** between Nametag and your CardDAV server
- **Import contacts** from your existing CardDAV account
- **Export contacts** from Nametag to your CardDAV server
- **Auto-export** new contacts created in Nametag
- **Resolve conflicts** when the same contact is edited in both places
- **Background sync** to keep everything up to date automatically

## Supported Providers

| Provider | Status | Notes |
|----------|--------|-------|
| Google Contacts | ✅ Supported | Requires app-specific password |
| iCloud | ✅ Supported | Requires app-specific password |
| Outlook / Office 365 | ✅ Supported | Uses regular password |
| Nextcloud | ✅ Supported | Uses regular password |
| Radicale | ✅ Supported | Uses regular password |

## Setup

### Google Contacts

1. **Navigate to Settings → CardDAV** in Nametag
2. **Select "Google Contacts"** from the provider dropdown
3. **Enter your Gmail address** as the username
4. **Create an app-specific password**:
   - Go to [Google Account Settings](https://myaccount.google.com/apppasswords)
   - Select "Mail" and "Other (Custom name)"
   - Name it "Nametag" and generate
   - Copy the 16-character password
5. **Paste the app password** into Nametag
6. **Click "Test Connection"** to verify
7. **Click "Save Connection"**

**Server URL**: `https://www.googleapis.com/.well-known/carddav` (auto-filled)

### iCloud

1. **Navigate to Settings → CardDAV** in Nametag
2. **Select "iCloud Contacts"** from the provider dropdown
3. **Enter your Apple ID** as the username
4. **Create an app-specific password**:
   - Go to [Apple ID Account](https://appleid.apple.com/)
   - Sign in and go to Security section
   - Under "App-Specific Passwords", click "Generate Password"
   - Name it "Nametag" and generate
   - Copy the password shown
5. **Paste the app password** into Nametag
6. **Click "Test Connection"** to verify
7. **Click "Save Connection"**

**Server URL**: `https://contacts.icloud.com/` (auto-filled)

**Note**: If you have two-factor authentication enabled (recommended), you MUST use an app-specific password.

### Outlook / Office 365

1. **Navigate to Settings → CardDAV** in Nametag
2. **Select "Outlook/Office 365"** from the provider dropdown
3. **Enter your Outlook email** as the username
4. **Enter your account password**
5. **Click "Test Connection"** to verify
6. **Click "Save Connection"**

**Server URL**: `https://outlook.office365.com/` (auto-filled)

**Note**: If you have two-factor authentication enabled, you may need to create an app password in your Microsoft account settings.

### Nextcloud / Radicale

1. **Navigate to Settings → CardDAV** in Nametag
2. **Select "Nextcloud/Radicale"** from the provider dropdown
3. **Enter your server URL**:
   - Nextcloud: `https://your-domain.com/remote.php/dav`
   - Radicale: `https://your-domain.com/`
4. **Enter your username**
5. **Enter your password**
6. **Click "Test Connection"** to verify
7. **Click "Save Connection"**

## Features

### Bidirectional Sync

Changes made in Nametag are pushed to your CardDAV server, and changes made on your CardDAV server (e.g., editing a contact on your iPhone) are pulled into Nametag.

**Sync includes**:
- Name fields (first, middle, last, prefix, suffix, nickname)
- Phone numbers (multiple, with types: mobile, home, work, fax)
- Email addresses (multiple, with types: home, work, other)
- Physical addresses (multiple, with full details)
- Websites/URLs (multiple)
- Instant messaging handles
- Geographic locations (latitude/longitude)
- Organization and job title
- Important dates (birthday, anniversary, etc.)
- Notes (with markdown support)
- Groups/categories
- Custom fields (X- properties)

**Nametag-specific features** (not synced to CardDAV):
- Relationships between people
- Last contact date and reminders
- Full relationship graph

### Automatic Sync

Background sync runs automatically three times a day (at 2:00, 10:00, and 18:00 UTC). You can also sync manually at any time from the CardDAV settings page. Automatic sync can be disabled if you prefer manual-only sync.

### Import Modes

Choose how new contacts from CardDAV are handled:

1. **Manual** (default): Review contacts before importing
2. **Notify**: Show a notification when new contacts are found
3. **Auto**: Automatically import new contacts without review

### Conflict Resolution

When the same contact is edited in both Nametag and on your CardDAV server between syncs, a conflict occurs. You'll be prompted to choose:

- **Keep Local**: Use the version from Nametag
- **Keep Remote**: Use the version from your CardDAV server
- **Merge**: Manually select fields from each version (future feature)

## Usage

### Initial Import

After connecting your CardDAV account:

1. Navigate to **CardDAV → Import**
2. Review the list of contacts from your server
3. Select contacts to import (or use "Select All")
4. Optionally assign contacts to groups
5. Click "Import Selected"

### Bulk Export

To export existing Nametag contacts to CardDAV:

1. Navigate to **CardDAV → Export**
2. Review the list of un-exported contacts
3. Select contacts to export (or use "Select All")
4. Click "Export Selected"
5. Wait for the export to complete

**Note**: Exports are rate-limited (50 contacts per batch with 100ms delays) to avoid overwhelming servers.

### Manual Sync

To sync immediately:

1. Navigate to **Settings → CardDAV**
2. Click the **"Sync Now"** button
3. Wait for sync to complete
4. Review the results (imported/exported/updated counts)

### Sync Settings

Configure sync behavior in **Settings → CardDAV**:

- **Enable automatic sync**: Toggle background sync on/off (syncs three times a day when enabled)
- **Auto-export new contacts**: Automatically push new Nametag contacts to CardDAV
- **Import mode**: How to handle new contacts from server

### Resolving Conflicts

When conflicts are detected:

1. Navigate to **CardDAV → Conflicts**
2. Review each conflict side-by-side
3. Choose which version to keep
4. Click "Keep Local" or "Keep Remote"
5. The conflict is resolved and sync continues

## Troubleshooting

### Connection Failed

**Symptom**: "Connection failed" or "Unable to connect to server"

**Solutions**:
1. Verify your server URL is correct
2. Check that you have an active internet connection
3. For Google and iCloud, ensure you're using an app-specific password (not your regular password)
4. Try the "Test Connection" button to diagnose the issue
5. Check firewall settings if self-hosting

### Authentication Failed

**Symptom**: "Authentication failed" error

**Solutions**:
1. Double-check your username and password
2. For Google: Use your full Gmail address (not just username)
3. For iCloud: Use your Apple ID email address
4. For Google and iCloud: Generate a fresh app-specific password
5. Ensure two-factor authentication is properly configured

### Sync Not Working

**Symptom**: Changes not appearing after sync

**Solutions**:
1. Check that "Enable automatic sync" is turned on
2. Click "Sync Now" to trigger a manual sync
4. Check for conflicts that need resolution
5. Review the "Last Sync" time in settings

### Contacts Not Importing

**Symptom**: Import shows 0 contacts

**Solutions**:
1. Verify you have contacts in your CardDAV account
2. Check that contacts aren't already imported
3. Ensure the CardDAV server is accessible
4. Try disconnecting and reconnecting

### Server Unavailable

**Symptom**: "The CardDAV server is experiencing issues"

**Solutions**:
1. Wait a few minutes and try again (temporary server issue)
2. Check the provider's status page:
   - [Google Workspace Status](https://www.google.com/appsstatus)
   - [iCloud System Status](https://www.apple.com/support/systemstatus/)
   - [Microsoft 365 Status](https://status.office365.com/)
3. For self-hosted: Check server logs and ensure service is running

### Rate Limiting

**Symptom**: "Too many requests" error

**Solutions**:
1. Wait a few minutes before trying again
2. Export/import in smaller batches
4. The system automatically retries with exponential backoff

### Malformed Data

**Symptom**: "Invalid data received from server" or sync errors

**Solutions**:
1. Some contacts may have corrupted vCard data
2. Try editing the problem contact directly in your CardDAV service
3. Skip the problematic contact for now
4. Report the issue with the contact's vCard data for investigation

## Technical Details

### vCard Standard

Nametag implements vCard 4.0 (RFC 6350) for maximum compatibility.

**Supported vCard properties**:
- `FN` - Formatted Name
- `N` - Structured Name (surname;given;middle;prefix;suffix)
- `NICKNAME`
- `TEL` - Telephone numbers (multiple, with TYPE)
- `EMAIL` - Email addresses (multiple, with TYPE)
- `ADR` - Addresses (multiple, with TYPE)
- `URL` - Websites (multiple, with TYPE)
- `IMPP` - Instant messaging (multiple protocols)
- `GEO` - Geographic location (geo:lat,lon)
- `ORG` - Organization
- `TITLE` - Job title
- `ROLE` - Role
- `BDAY` - Birthday
- `ANNIVERSARY` - Important dates (multiple)
- `NOTE` - Notes
- `PHOTO` - Photo URL or base64
- `GENDER` - Gender
- `CATEGORIES` - Groups (comma-separated)
- `UID` - Unique identifier
- `X-*` - Custom fields

**Nametag extensions**:
- `X-NAMETAG-RELATIONSHIPS` - Relationship graph (JSON)
- `X-NAMETAG-SECOND-LASTNAME` - Spanish naming convention
- `X-NAMETAG-CONTACT-REMINDER` - Reminder settings
- Plus any custom X- fields you add

### Data Privacy

- Passwords are encrypted with bcrypt before storage
- Communication uses HTTPS (required)
- No contact data is shared with third parties
- Sync happens directly between Nametag and your CardDAV server
- You can disconnect at any time (local data is preserved)

### Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────────┐
│   Nametag   │ ◄─────► │ CardDAV Sync │ ◄─────► │  CardDAV Server │
│  Database   │         │    Engine    │         │  (Google/iCloud)│
└─────────────┘         └──────────────┘         └─────────────────┘
       │                        │
       │                        │
       ▼                        ▼
┌─────────────┐         ┌──────────────┐
│ Conflict    │         │  Background  │
│ Resolution  │         │  Cron Job    │
└─────────────┘         └──────────────┘
```

**Sync Process**:
1. Background cron job runs three times a day (at 2:00, 10:00, and 18:00 UTC)
2. Fetches changes from CardDAV server using sync tokens (incremental)
3. Compares local and remote changes using ETags and timestamps
4. Detects conflicts when both changed since last sync
5. Imports new contacts (based on import mode setting)
6. Exports local changes to server
7. Updates sync token for next incremental sync

**Error Handling**:
- Automatic retry with exponential backoff (3 attempts)
- Retries network errors, timeouts, 5xx server errors, 429 rate limiting
- Does not retry auth errors or malformed data
- User-friendly error messages based on error category
- All errors logged to connection for troubleshooting

### Performance

- **Incremental sync**: Only fetches changes since last sync
- **Batch operations**: Exports in batches of 50 with 100ms delays
- **Rate limiting**: Built-in delays to respect server limits
- **Conflict caching**: Conflicts stored in database for async resolution
- **Background processing**: Sync doesn't block UI operations

### Limitations

- **Relationship data**: Nametag's relationship graph is not synced (stored as X- extension for reference)
- **Markdown notes**: Other clients may not render markdown formatting
- **Group metadata**: Only group names sync (not colors or descriptions)
- **Photos**: Photos sync as URLs or base64, not all clients support both
- **Name fields**: Some clients may not support all name components (prefix, suffix, middle name)

---

**Need help?** If you encounter issues not covered here, please check the [GitHub Issues](https://github.com/anthropics/claude-code/issues) or contact support.
