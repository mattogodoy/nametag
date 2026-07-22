---
title: CardDAV Sync
description: Sync contacts with Google, iCloud, Outlook, and other CardDAV servers.
sidebar:
  order: 14
---

Nametag can keep itself in sync with your contacts on an external server using CardDAV, the standard protocol behind Google Contacts, iCloud, Outlook, and many other address books. Sync is bidirectional: changes made in Nametag flow to the server, and changes made on the server flow back into Nametag.

## Supported providers

### Google Contacts

- Server URL: `https://www.googleapis.com/.well-known/carddav`
- Requires an app-specific password. Generate one at **myaccount.google.com > Security > App passwords**.

### iCloud

- Server URL: `https://contacts.icloud.com/`
- Requires an app-specific password. Generate one at **appleid.apple.com > Sign-In and Security > App-Specific Passwords**.

### Outlook / Office 365

- Server URL: `https://outlook.office365.com/`
- Uses your regular password, or an app password if you have two-factor authentication enabled.

### Nextcloud / Radicale

- Server URL: whatever your instance provides.
- Uses your regular credentials.

### Any standard CardDAV server

If your provider isn't listed, enter its server URL and your credentials directly. Nametag speaks standard CardDAV, so most self-hosted and business address book servers work.

## Setting up a connection

Go to **Settings > CardDAV**. Select a provider preset, or enter a custom server URL. Enter your username and password, then use **Test Connection** to confirm everything works before saving.

## Sync settings

Once connected, you can configure:

- **Auto-sync interval**: how often Nametag checks for changes, from every 60 seconds up to once every 24 hours.
- **Auto-export**: automatically push newly created Nametag contacts to your CardDAV server, without a manual export step.
- **Import mode**: how new contacts discovered on the server are handled:
  - **Manual**: review each one before importing.
  - **Notify**: show a notification badge so you know new contacts are waiting.
  - **Auto**: import new contacts immediately, no review needed.

## Conflict resolution

If a contact has changed on both sides (in Nametag and on the CardDAV server) since the last sync, Nametag can't just pick one side automatically. It creates a conflict instead.

Go to **CardDAV > Conflicts** to see a side-by-side comparison of both versions. For each conflict, choose **Keep Local** to preserve your Nametag version, or **Keep Remote** to accept the server's version.

## Pending imports

New contacts found on the CardDAV server that don't yet exist in Nametag show up as pending imports. Review them and choose which ones to bring in, rather than importing everything automatically.

Contacts that already exist in Nametag (matched by their vCard UID) are marked with an "Already in Nametag" badge. You can still select these contacts and check the **Update existing contact** option to overwrite the existing record with the data from the import. This is useful when re-importing a VCF file with updated information for a contact you already have.

## Bulk export

If you're setting up sync for the first time and already have contacts in Nametag, use bulk export to push your existing contacts to the CardDAV server in batches.

## Sync technical details

| Setting | Value |
| --- | --- |
| Retry attempts | max 3 |
| Retry initial delay | 1 second |
| Retry backoff factor | 2x |
| Retry max delay | 10 seconds |
| Export batch size | 50 contacts per batch |
| Delay between export batches | 100ms |
| Auto-sync interval range | 60 seconds to 24 hours (default: 12 hours) |
| Cron inter-user delay | 200ms between users |

## Troubleshooting

- **Wrong password type**: Google and iCloud require an app-specific password, not your regular account password. If sign-in fails, double-check you generated one and are using it here.
- **Two-factor authentication**: if 2FA is enabled on your account, you'll typically need an app password even for providers that otherwise accept a regular password, like Outlook.
- **Server URL format**: make sure the URL matches what your provider expects, including the trailing slash where shown above. A slightly wrong URL is one of the most common reasons a connection test fails.
