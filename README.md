# Nametag

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](LICENSE)

> **⚠️ Active Development Notice**
>
> Nametag is under active development and may introduce breaking changes between releases. Please read the [release notes](https://github.com/mattogodoy/nametag/releases) carefully before updating to ensure a smooth upgrade process.

Nametag is a personal relationships manager that helps you remember the people in your life and how they're connected. Track birthdays, contact information, how people are connected, and visualize your network as an interactive graph.

![Dashboard](docs/screenshots/sc1.png)
_Dashboard with network overview and statistics_

**[Try the hosted version →](https://nametag.one)**

## Why Nametag?

We all have hundreds of contacts scattered across social media, phone books, and email. But can you remember when you last talked to an old friend? Their kids' names? Their birthday?

Nametag solves this by giving you a single place to manage your personal network. It's like a CRM, but for your actual relationships instead of sales prospects.

## Screenshots

<details>
<summary>View screenshots</summary>

![People Management](docs/screenshots/sc2.png)
![People Creation](docs/screenshots/sc7.png)
_Create and manage your contacts with detailed information_

---

![Person Details](docs/screenshots/sc3.png)
![Relationship Types](docs/screenshots/sc6.png)
_Define and manage custom relationship types_

---

![Person Details](docs/screenshots/sc4.png)
_Keep up-to-date information about the people you care about_

---

![Groups](docs/screenshots/sc5.png)
_Organize people into custom groups_

---

![Light Mode](docs/screenshots/sc8.png)
![Light Mode](docs/screenshots/sc9.png)
_Clean light theme for comfortable daytime use_

</details>

## Features

- Track people with flexible attributes (name, birthday, important dates, and notes for everything else)
- Map relationships between people (family, friends, colleagues)
- Visualize your network with interactive graphs
- Organize contacts into custom groups
- Set reminders for important dates and staying in touch
- Full dark mode support
- Multiple languages (English, Spanish, Japanese, Norwegian, German)
- Mobile-responsive design
- Multi-platform Docker support (AMD64 and ARM64)

## Hosted vs Self-Hosted

**Hosted Service**: We offer a hosted version at [nametag.one](https://nametag.one) with a generous free tier (50 people) and affordable paid plans starting at $1/month. The hosted service helps fund development and maintenance of the open source project.

**Self-Hosting**: You can also run Nametag on your own infrastructure for free with these benefits:

- No account limits - store unlimited contacts
- No email service required - accounts are auto-verified
- Complete data ownership and privacy
- Free forever

This guide covers self-hosting setup.

## Self-Hosting with Docker

The official Docker images support both **AMD64** (x86_64) and **ARM64** (aarch64) architectures, making Nametag compatible with Apple Silicon Macs, Raspberry Pi, and ARM-based servers.

### Quick Start

1. Create a directory for Nametag:

```bash
mkdir nametag && cd nametag
```

2. Create a `docker-compose.yml` file:

```yaml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  app:
    image: ghcr.io/mattogodoy/nametag:latest
    restart: unless-stopped
    ports:
      - "3000:3000"
    env_file:
      - .env
    depends_on:
      - db

  cron:
    image: alpine:3.19
    restart: unless-stopped
    command: >
      sh -c "
        echo '0 8 * * * wget -q -O - --header=\"Authorization: Bearer '\"$$CRON_SECRET\"'\" http://app:3000/api/cron/send-reminders > /proc/1/fd/1 2>&1' > /etc/crontabs/root &&
        echo '0 3 * * * wget -q -O - --header=\"Authorization: Bearer '\"$$CRON_SECRET\"'\" http://app:3000/api/cron/purge-deleted > /proc/1/fd/1 2>&1' >> /etc/crontabs/root &&
        crond -f -l 2
      "
    environment:
      - CRON_SECRET=${CRON_SECRET}
    depends_on:
      - app

volumes:
  postgres_data:
```

3. Create a `.env` file with required variables:

```bash
# Generate secrets with: openssl rand -base64 32

# Database connection
DB_HOST=db
DB_PORT=5432
DB_NAME=nametag_db
DB_USER=nametag
DB_PASSWORD=your-secure-database-password

# Application URL
NEXTAUTH_URL=http://localhost:3000

# NextAuth (must be at least 32 characters)
NEXTAUTH_SECRET=your-nextauth-secret-minimum-32-characters

# Cron authentication
CRON_SECRET=your-cron-secret-minimum-16-characters

# Email (OPTIONAL - only needed for password resets and reminders)
# Self-hosted instances work without email - new accounts are auto-verified

# Option 1: Resend (recommended for simplicity)
# Sign up at https://resend.com if you want email functionality
#RESEND_API_KEY=re_your_api_key
#EMAIL_DOMAIN=yourdomain.com

# Option 2: SMTP (use your own email server)
# If both are configured, SMTP takes precedence over Resend
# Note: Gmail/Outlook will rewrite the "from" address to your authenticated email
#SMTP_HOST=smtp.gmail.com
#SMTP_PORT=587
#SMTP_SECURE=false
#SMTP_REQUIRE_TLS=true
#SMTP_USER=your-email@gmail.com
#SMTP_PASS=your-app-password
#EMAIL_DOMAIN=gmail.com
```

4. Start the services:

```bash
docker compose up -d
```

The database will be automatically set up on first run.

5. Access Nametag at `http://localhost:3000`

### Environment Variables

#### Required

| Variable          | Description                                                       | Example                                 |
| ----------------- | ----------------------------------------------------------------- | --------------------------------------- |
| `DB_HOST`         | PostgreSQL server hostname                                        | `db` or `localhost`                     |
| `DB_PORT`         | PostgreSQL server port                                            | `5432`                                  |
| `DB_NAME`         | PostgreSQL database name                                          | `nametag_db`                            |
| `DB_USER`         | PostgreSQL username                                               | `nametag`                               |
| `DB_PASSWORD`     | PostgreSQL password                                               | `your-secure-password`                  |
| `NEXTAUTH_URL`    | Application URL (for auth, emails, redirects)                     | `https://yourdomain.com`                |
| `NEXTAUTH_SECRET` | Secret for JWT encryption (min 32 chars)                          | Generate with `openssl rand -base64 32` |
| `CRON_SECRET`     | Secret for cron job authentication                                | Generate with `openssl rand -base64 16` |
| `REDIS_URL`       | Redis connection URL (required for SaaS mode, optional otherwise) | `redis://:password@redis:6379`          |
| `REDIS_PASSWORD`  | Redis authentication password                                     | Generate with `openssl rand -base64 32` |

**Advanced database configuration:** Instead of using `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD`, you can provide a full connection string with `DATABASE_URL=postgresql://user:pass@host:5432/db`. If `DATABASE_URL` is set, it takes precedence over the individual variables.

#### Optional

| Variable               | Description                                                           | Default                      |
| ---------------------- | --------------------------------------------------------------------- | ---------------------------- |
| `RESEND_API_KEY`       | API key from [Resend](https://resend.com) for email functionality     | Not required for self-hosted |
| `EMAIL_DOMAIN`         | Verified domain for sending emails (required if using Resend or SMTP) | Not required for self-hosted |
| `SMTP_HOST`            | SMTP server hostname (alternative to Resend)                          | Not set                      |
| `SMTP_PORT`            | SMTP server port (587 for STARTTLS, 465 for SSL)                      | Not set                      |
| `SMTP_SECURE`          | Use SSL/TLS (true for port 465, false for 587)                        | `false`                      |
| `SMTP_USER`            | SMTP username (often your email address)                              | Not set                      |
| `SMTP_PASS`            | SMTP password or app-specific password                                | Not set                      |
| `SMTP_REQUIRE_TLS`     | Require STARTTLS for security                                         | `true`                       |
| `SMTP_FROM`            | Override "from" address (use if server rejects custom addresses)      | Not set                      |
| `DISABLE_REGISTRATION` | Disable user registration after first user                            | `false`                      |
| `NODE_ENV`             | Environment mode                                                      | `production`                 |
| `LOG_LEVEL`            | Logging verbosity                                                     | `info`                       |

### Email Setup (Optional)

Email configuration is **optional for self-hosted instances**. Nametag works perfectly without it:

- **Without email**: New accounts are automatically verified and users can log in immediately. Password resets and contact reminders are unavailable.
- **With email**: Enables password reset functionality and contact reminder emails.

Nametag supports two email providers:

#### Option 1: Resend (Recommended for Simplicity)

1. Sign up for a free Resend account at [resend.com](https://resend.com)
2. Add and verify your domain
3. Create an API key
4. Add to your `.env` file:
   ```bash
   RESEND_API_KEY=re_your_api_key
   EMAIL_DOMAIN=yourdomain.com
   ```

#### Option 2: SMTP (Use Your Own Email Server)

Use any SMTP server (Gmail, Outlook, your own mail server, etc.):

1. Get your SMTP credentials from your email provider
2. Add to your `.env` file:
   ```bash
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_REQUIRE_TLS=true
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   SMTP_FROM=your-email@gmail.com
   EMAIL_DOMAIN=gmail.com
   ```

**Important Notes about "From" Addresses:**

Most SMTP servers restrict which addresses you can send from:

1. **If your SMTP server rejects custom addresses** (error like "Sender address rejected: not owned by user"):
   - Add `SMTP_FROM=your-email@example.com` to your `.env`
   - All emails will use your authenticated address instead of `accounts@`, `reminders@`, etc.
   - Example for matto.io: `SMTP_FROM=matto@matto.io`

2. **For Gmail/Outlook without custom domain**:
   - These providers automatically rewrite to your authenticated email
   - Set `EMAIL_DOMAIN=gmail.com` or `EMAIL_DOMAIN=outlook.com`
   - Display names are preserved, but address becomes `your-email@gmail.com`

3. **For custom domains** (e.g., Google Workspace, custom mail server):
   - If properly configured, you can use `accounts@yourdomain.com`, etc.
   - Set `EMAIL_DOMAIN=yourdomain.com` and don't set `SMTP_FROM`

**Common SMTP Providers:**

- **Gmail**: `smtp.gmail.com:587` (requires [app password](https://support.google.com/accounts/answer/185833))
- **Outlook**: `smtp-mail.outlook.com:587`
- **SendGrid**: `smtp.sendgrid.net:587`
- **Mailgun**: `smtp.mailgun.org:587`

**Provider Precedence**: If both Resend and SMTP are configured, SMTP takes precedence.

**Rate Limiting**: SMTP is configured with connection pooling (max 5 concurrent connections) and rate limiting (5 messages/second). If the rate limit is exceeded, emails are automatically queued and sent with a delay. Note that the queue is in-memory only - if the application restarts, queued messages are lost.

**Note**: The hosted service at [nametag.one](https://nametag.one) requires email verification for security, but self-hosted instances are designed for personal use and auto-verify all accounts.

### Redis Setup

Redis is used for rate limiting authentication endpoints to protect against brute force attacks.

**For SaaS Mode (nametag.one):**

- Redis is **required** and the application will fail to start without it
- Ensures consistent rate limiting across multiple server instances
- Persists rate limits across server restarts

**For Self-Hosted Production:**

- Redis is **optional but recommended**
- Without Redis: Falls back to in-memory rate limiting
- In-memory limitations: Resets on restart, doesn't work across multiple instances
- For single-server deployments, in-memory works fine

**For Development:**

- Redis is **optional**
- In-memory fallback works perfectly for local development

**To run without Redis:**

1. Simply omit `REDIS_URL` from your `.env` file
2. Remove or comment out Redis service from your compose file
3. The app will log a warning and use in-memory rate limiting

**To enable Redis:**
Redis is included in all deployment configurations:

- **Dev Container**: `.devcontainer/docker-compose.yml`
- **Local Development**: `docker-compose.services.yml`
- **Production**: `docker-compose.yml`

### Restricting Registration (Optional)

For public-facing instances, you may want to prevent strangers from creating accounts.

Set `DISABLE_REGISTRATION=true` in your `.env` file. This allows:

- The first user to register normally (when no users exist)
- All subsequent registration attempts are blocked

This is ideal for personal instances where only you (and potentially family members you manually add) should have access. The instance owner can register first, then registration automatically closes.

To allow additional users later, set `DISABLE_REGISTRATION=false` and restart the service.

### Reverse Proxy (Production)

For production deployments, use a reverse proxy like Nginx or Caddy with SSL:

**Caddy example:**

```
yourdomain.com {
    reverse_proxy localhost:3000
}
```

**Nginx example:**

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Tech Stack

- **Framework**: Next.js
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis for rate limiting
- **Styling**: Tailwind CSS
- **Graphs**: D3.js for network visualization
- **Auth**: NextAuth.js
- **Email**: Resend or SMTP (nodemailer)

## Contributing & Development

Want to contribute? We support two development environments:

### Option 1: Dev Container (Easiest for new contributors)

Perfect for getting started quickly with zero configuration.

1. Install [VS Code](https://code.visualstudio.com/) and the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
2. Clone the repository
3. Open in VS Code and click "Reopen in Container" when prompted
4. Wait for automatic setup to complete (database migration & seeding)
5. The dev server starts automatically - open `http://localhost:3000`

**Note:** If the dev server doesn't start automatically, open a terminal in VS Code and run `npm run dev`

### Option 2: Local Development (Best for daily development)

Faster iteration and better debugging experience.

1. **Prerequisites:** Node.js 20+ and Docker
2. Clone the repository
3. Install dependencies: `npm install`
4. Start database services: `docker compose -f docker-compose.services.yml up -d`
5. Set up database: `./scripts/setup-db.sh`
6. Start dev server: `npm run dev`
7. Open `http://localhost:3000`

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed setup instructions, code guidelines, and how to submit pull requests.

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

**Before submitting a PR**, run these verification commands locally:
- `npm run verify` - Quick verification (lint, typecheck, unit tests, build)
- `npm run verify:all` - Full verification including E2E tests

All PRs automatically run these checks via GitHub Actions. See [docs/PR_WORKFLOW.md](docs/PR_WORKFLOW.md) for details.

## Roadmap

ℹ️ _Contributions to any of these items are very welcome! Items that require the most help will have the **[HELP NEEDED]** tag. If you want to contribute to an item that does not have a PR or Issue associated to it, please create it yoursef._

### To do

Future features and improvements, ordered by priority:

- [x] Improve development setup to make contributors' lives easier [[PR #25](https://github.com/mattogodoy/nametag/pull/25)]
- [ ] Implement CardDAV support [[Issue #15](https://github.com/mattogodoy/nametag/issues/15)]
- [ ] **[HELP NEEDED]** Mobile app (Native apps for Android and iOS are preferred)
- [ ] Add journaling capabilities [[Issue #28](https://github.com/mattogodoy/nametag/issues/28)]
- [ ] API for third-party integrations
- [ ] Add support for SQLite databases
- [ ] Implement OIDC [[Issue #10](https://github.com/mattogodoy/nametag/issues/10)]
- [ ] Add notification support [[Issue #6](https://github.com/mattogodoy/nametag/issues/6)]
- [ ] Add photos to contacts [[Issue #19](https://github.com/mattogodoy/nametag/issues/19)]
- [ ] Add custom template titles for important dates [[Issue #23](https://github.com/mattogodoy/nametag/issues/23)]
- [ ] Add map to show people's locations [[Issue #26](https://github.com/mattogodoy/nametag/issues/26)]
- [ ] Support multi-user groups [[Issue #37](https://github.com/mattogodoy/nametag/issues/37)]
- [ ] Immich integration [[Issue #46](https://github.com/mattogodoy/nametag/issues/46)]
- [ ] **[HELP NEEDED]** Additional language translations (French, German, Portuguese, etc.)
- [ ] **[HELP NEEDED]** UI/UX improvements and accessibility enhancements
- [ ] **[HELP NEEDED]** Documentation improvements (API, deployment, functionality, development, etc) [[Issue #29](https://github.com/mattogodoy/nametag/issues/29)]

### Done

Features and improvements that have already been implemented:

- [x] ~~SMTP support~~ [[Issue #4](https://github.com/mattogodoy/nametag/issues/4), [PR #21](https://github.com/mattogodoy/nametag/pull/21)]
- [x] ~~Option to disable registration~~ [[Issue #9](https://github.com/mattogodoy/nametag/issues/9), [PR #17](https://github.com/mattogodoy/nametag/pull/17)]
- [x] ~~ARM build for docker images~~ [[Issue #14](https://github.com/mattogodoy/nametag/issues/14), [PR #18](https://github.com/mattogodoy/nametag/pull/18)]

## License

Licensed under the [GNU Affero General Public License v3.0](LICENSE). This ensures that if you modify and deploy Nametag, you must make your source code available.

## Support

- **Hosted version**: For support with the hosted service, email support@nametag.one
- **Self-hosting**: Open an issue on GitHub
- **Security issues**: See [SECURITY.md](SECURITY.md)

## Support Development

If you find Nametag useful and want to support its development, you can buy me a coffee! ☕

<a href="https://www.buymeacoffee.com/mattogodoy" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

---

Built with care for people who care about people.
