---
title: Configuration
description: Full reference of environment variables and deployment modes.
sidebar:
  order: 2
---

Nametag is configured entirely through environment variables, typically set in a `.env` file next to your `docker-compose.yml`. This page is the full reference. For a shorter path to a running instance, see [Installation](/self-hosting/installation/).

## Deployment modes

Nametag behaves differently depending on `NODE_ENV` and `SAAS_MODE`. Almost every self-hosted instance runs in the second mode below.

### Development (`NODE_ENV=development`)

For local development and testing. Redis is optional (falls back to in-memory rate limiting), email verification is disabled, billing is hidden, and OIDC is available if configured.

### Production / self-hosted (default)

This is the default mode when `NODE_ENV` is `production` or unset, and `SAAS_MODE` is not `true`. It's what you get by following [Installation](/self-hosting/installation/).

- Redis is optional but recommended (in-memory fallback otherwise)
- New accounts are auto-verified, no email required
- Billing is hidden, all features are unlimited
- OIDC is available if configured, password login can be disabled once it is
- Google OAuth is not available (self-hosted instances use OIDC instead)

### SaaS mode (`SAAS_MODE=true`)

Reserved for the hosted service at nametag.one. Redis becomes mandatory, email verification is required, billing and usage limits are enforced, and Google OAuth is enabled instead of generic OIDC. You should not set `SAAS_MODE=true` on a self-hosted instance.

### Multi-user instances and outbound notification destinations

Any signed-in user can configure a notification destination (ntfy today, webhooks in a later release) pointing at any URL, including one on your local network, and then use the "Send a test" button on it. In self-hosted mode, the outbound request policy deliberately allows private and internal addresses, any port, and plain HTTP, because pointing Nametag at a LAN ntfy server is a normal and expected setup. That same permissiveness means a user can point a destination at `http://10.0.0.5:8080/x` and immediately learn, from the response, whether that host is reachable, whether that port is open, and whether it refused the connection, timed out, or answered with an error. The response body of the target is never read back, so this cannot be used to pull data out of an internal service, but it works as a liveness and port scanner against anything else on the same network as your Nametag instance.

If you run Nametag for yourself alone, this doesn't matter: you're the only one who could point it at anything. If you run it for other people you don't fully trust with your network, treat this as a real exposure and choose one of:

- Run the instance single-user, or only invite people you'd trust with direct access to the network Nametag runs on.
- Restrict Nametag's outbound network egress at the firewall or container network level, so it cannot reach your LAN or cloud metadata endpoints regardless of what a user configures.
- Keep the instance off any network segment where something sensitive is reachable.

This is a deliberate trade-off in how self-hosted mode works, not a bug to be patched. SaaS mode does not have this exposure: `nametag.one` requires HTTPS and refuses private and internal addresses outright, because there the destination is not something we trust the way a self-hosting operator trusts their own network.

## Database configuration

Nametag supports two ways to point at your Postgres database.

**Method 1: individual variables (recommended).** Set `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and optionally `DB_PASSWORD` separately. This is the friendlier option if you're not used to connection strings.

**Method 2: connection string (advanced).** Set `DATABASE_URL=postgresql://user:password@host:5432/database` directly.

If `DATABASE_URL` is set, it takes precedence over the individual `DB_*` variables. The application requires either a complete `DATABASE_URL`, or all of `DB_HOST`, `DB_PORT`, `DB_NAME`, and `DB_USER` (with `DB_PASSWORD` optional). If neither is provided, the app refuses to start and logs a clear error.

## Required variables

| Variable | Description | Example |
| --- | --- | --- |
| `DB_HOST` | PostgreSQL server hostname | `db` or `localhost` |
| `DB_PORT` | PostgreSQL server port | `5432` |
| `DB_NAME` | PostgreSQL database name | `nametag_db` |
| `DB_USER` | PostgreSQL username | `nametag` |
| `DB_PASSWORD` | PostgreSQL password | `your-secure-password` |
| `NEXTAUTH_URL` | Application URL, used for auth, emails, and redirects | `https://yourdomain.com` |
| `NEXTAUTH_SECRET` | Secret for JWT encryption, minimum 32 characters | Generate with `openssl rand -base64 32` |
| `CRON_SECRET` | Secret for authenticating cron job requests, minimum 16 characters | Generate with `openssl rand -base64 16` |

`REDIS_URL` and `REDIS_PASSWORD` are required only in SaaS mode. For self-hosted instances they're optional. See [Redis](/self-hosting/redis/) for the full explanation of when you need it.

## Optional variables

| Variable | Description | Default |
| --- | --- | --- |
| `RESEND_API_KEY` | API key from Resend for email functionality | Not required for self-hosted |
| `EMAIL_DOMAIN` | Verified domain for sending emails, required if using Resend or SMTP | Not required for self-hosted |
| `SMTP_HOST` | SMTP server hostname, alternative to Resend | Not set |
| `SMTP_PORT` | SMTP server port, 587 for STARTTLS or 465 for SSL | Not set |
| `SMTP_SECURE` | Use SSL/TLS, `true` for port 465, `false` for 587 | `false` |
| `SMTP_USER` | SMTP username, often your email address | Not set |
| `SMTP_PASS` | SMTP password or app-specific password | Not set |
| `SMTP_REQUIRE_TLS` | Require STARTTLS | `true` |
| `SMTP_FROM` | Override the "from" address if your server rejects custom ones | Not set |
| `PHOTO_STORAGE_PATH` | Custom path for photo storage | `/app/data/photos` |
| `PHOTO_SIZE` | Max photo dimensions in pixels (square, 64 to 4096). Smaller images keep their original size. | `256` |
| `PHOTO_QUALITY` | JPEG quality for opaque photos, 1 to 100 | `80` |
| `OIDC_ISSUER_URL` | OIDC provider issuer URL, enables SSO login | Not set |
| `OIDC_CLIENT_ID` | OIDC client ID registered with your provider | Not set |
| `OIDC_CLIENT_SECRET` | OIDC client secret | Not set |
| `OIDC_DISPLAY_NAME` | Label shown on the SSO login button | `SSO` |
| `DISABLE_PASSWORD_LOGIN` | Hide the password form, requires OIDC to be fully configured | `false` |
| `DISABLE_REGISTRATION` | Disable registration after the first user | `false` |
| `GEOCODER_URL` | Nominatim-compatible geocoder used to place addresses on the map | `https://nominatim.openstreetmap.org` |
| `DISABLE_GEOCODING` | Disable all address geocoding instance-wide | `false` |
| `REDIS_URL` | Redis connection URL | Not set (in-memory fallback) |
| `REDIS_PASSWORD` | Redis authentication password | Not set |
| `NODE_ENV` | Environment mode: `development`, `production`, or `test` | `production` |
| `LOG_LEVEL` | Logging verbosity: `debug`, `info`, `warn`, or `error` | `info` |
| `VAPID_PUBLIC_KEY` | Public key for browser push notifications | Not set |
| `VAPID_PRIVATE_KEY` | Private key for browser push notifications | Not set |
| `VAPID_SUBJECT` | Contact URI for push services: a `mailto:` address or an `https:` URL | Not set |
| `TRUSTED_PROXY_HEADER` | Which header your reverse proxy manages for the client IP: `x-forwarded-for`, `x-real-ip`, or `cf-connecting-ip` | `x-forwarded-for` |
| `TRUSTED_PROXY_COUNT` | Number of trusted reverse proxy hops in front of the app, used to pick the real client IP out of `X-Forwarded-For` for rate limiting (ignored when `TRUSTED_PROXY_HEADER` is `x-real-ip`) | `1` |

## Web push notifications (VAPID)

`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` are optional, but they must be set together. A partial set (one or two of the three) is treated as a mistake rather than a valid "push half-enabled" state: the app refuses to start with a clear error instead of silently leaving the channel disabled.

Generate a keypair with:

```bash
npm run generate-vapid-keys
```

This prints a `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` pair to add to your `.env` file, plus a reminder to set `VAPID_SUBJECT` to a contact a push service can reach you at if there's a problem with your traffic. Either a `mailto:` address or an `https:` URL works, as RFC 8292 allows both.

Leave all three unset and the push channel stays hidden in Settings. Email reminders are unaffected either way.

Replacing the keys later invalidates every existing browser subscription at once. Each device has to turn push back on from Settings to start receiving notifications again, so only rotate them when you mean to force that.

The old subscription rows are not removed automatically when you do this. A push service reports a genuinely dead subscription differently from one that just has the wrong key, so the cleanup that prunes dead subscriptions does not fire on a key mismatch. Each device still needs to re-subscribe. After 10 consecutive failed nightly runs against the same device, Nametag stops attempting delivery to it automatically instead of retrying forever. The row is not deleted: re-subscribing that device, or removing it from Settings, are still the only ways to clear it out.

## Trusted proxy configuration and rate limiting

Most rate limits in Nametag (login, registration, password reset, and more) key on the client's IP address. A Web `Request` handler has no direct access to the TCP peer address, so the only source for that IP is a header set by whatever reverse proxy sits in front of the app, and that header can be set by the client itself if the proxy does not manage it. Two settings tell the app how to trust it: `TRUSTED_PROXY_HEADER` (which header) and `TRUSTED_PROXY_COUNT` (how many hops, when that header is a chain).

If no trusted client IP can be determined at all, requests that carry no other identifier fall into one shared bucket. That bucket is per process rather than per deployment, and it allows more than the per-IP limit for the same endpoint, so a single caller cannot deny login or password reset to everyone on the instance. How much more depends on what the endpoint costs: login and the token-checking endpoints are widened generously, because being hammered only costs this server's own CPU, while the endpoints that send mail to an address the caller supplies are widened only slightly, so an instance in this state cannot be turned into a mail cannon aimed at many different people. Nametag logs a JSON line with the event `rate_limit.no_trusted_client_ip` when this happens, repeated every 15 minutes with a count of affected requests, so it is worth alerting on: it means rate limiting is running in a degraded mode and `TRUSTED_PROXY_COUNT` or `TRUSTED_PROXY_HEADER` probably needs attention.

Forwarded addresses are accepted with a port (`203.0.113.7:54321`, which Azure App Service emits) and in bracketed IPv6 form (`[2001:db8::1]`, `[2001:db8::1]:443`, which some HAProxy and IIS configurations emit). The port is discarded, since it changes per connection.

Registration, password reset, and verification resend carry a second limit keyed on the **email address** instead of the IP, because an attacker with a pool of addresses can rotate past any IP-based limit and mail-bomb one person. That second limit is set well above the IP one, so an ordinary user is stopped by their own IP limit long before reaching it. It does mean a determined attacker can occupy someone else's address bucket for the window, but only by actually sending that many emails to them, which is the thing the limit exists to stop.

**This is only meaningful if the app is unreachable except through that proxy.** Trusting a header assumes every request genuinely passed through it. The default `docker-compose.yml` publishes the app's port on every interface, which lets anyone who can reach the host skip the proxy, and the header it sets, entirely. See [Reverse Proxy](/self-hosting/reverse-proxy/#trusted-proxy-configuration) for how to bind that port to localhost once you have a proxy in front.

### TRUSTED_PROXY_HEADER: which header your proxy manages

This cannot be inferred from a request. A proxy that appends to `X-Forwarded-For` and a proxy that only replaces `X-Real-IP` (and never touches `X-Forwarded-For`) can each produce a request that is indistinguishable, by header content alone, from the other: in the second case, whatever `X-Forwarded-For` a client sends passes straight through untouched, so it looks exactly like a value the first kind of proxy would have produced. Guessing which topology applies is wrong for one of the two no matter which way the guess goes, so `TRUSTED_PROXY_HEADER` makes the operator say which one is true instead.

- **`x-forwarded-for`** (default): matches both documented reverse-proxy configs (nginx with `proxy_add_x_forwarded_for`, Caddy). Use this unless you have specifically confirmed your proxy manages `X-Real-IP` or is Cloudflare. See [Reverse Proxy](/self-hosting/reverse-proxy/#which-header-does-your-proxy-actually-manage) for how to check your own proxy's configuration rather than assume.
- **`x-real-ip`**: for a proxy that replaces `X-Real-IP` (via something like `proxy_set_header X-Real-IP $remote_addr;`) but does not also manage `X-Forwarded-For`. In this mode `X-Forwarded-For` is ignored entirely, since it would be wholly client-supplied; `TRUSTED_PROXY_COUNT` also does not apply, since `X-Real-IP` carries a single replaced value, not a chain of appended hops. **Do not use this behind Cloudflare**: an origin proxy's `X-Real-IP` records the Cloudflare edge address, not the visitor, so every visitor through the same edge shares one bucket. See [Cloudflare](/self-hosting/reverse-proxy/#cloudflare) for the correct option.
- **`cf-connecting-ip`**: for deployments behind Cloudflare, which overwrites `CF-Connecting-IP` with the visitor's address on every request rather than appending to it, so there is no hop count to get wrong (`TRUSTED_PROXY_COUNT` does not apply here either). This mode's entire security model is that the origin refuses connections that did not come from Cloudflare; see [Cloudflare](/self-hosting/reverse-proxy/#cloudflare) for why that precondition is not optional and the three ways to enforce it.

**If your proxy sets none of these headers**, or `TRUSTED_PROXY_HEADER` points at one your proxy never touches, every request resolves to no trusted IP. Rate limits with no other identifier fall back to a single shared bucket for the whole instance, and a warning naming both settings is logged, then repeated every 15 minutes with a count of affected requests for as long as the condition lasts. This is a fail-safe degradation, not a silently trusted attacker value.

### TRUSTED_PROXY_COUNT: how many hops to trust

Only applies when `TRUSTED_PROXY_HEADER` is `x-forwarded-for` (the default). The app counts from the right: the client's real address is the Nth entry from the end, where N is `TRUSTED_PROXY_COUNT`, because each proxy hop appends its own view of the connection to the end of the header rather than replacing it. Reading from the left, which looks like the natural choice, is exactly what an attacker-supplied value would occupy.

The default of `1` matches both reverse-proxy configurations in these docs: a single nginx or Caddy instance terminating TLS directly in front of the app. See [Reverse Proxy](/self-hosting/reverse-proxy/) for the concrete number to use with additional layers such as a load balancer. If that additional layer is specifically Cloudflare, `TRUSTED_PROXY_HEADER=cf-connecting-ip` above is a better fit than counting it as a hop; see [Cloudflare](/self-hosting/reverse-proxy/#cloudflare).

Getting the count wrong produces the same symptom in both directions: a warning in the logs, and requests falling into a single shared rate-limit bucket for the whole instance.

- **Too low** (for example `0` with a proxy actually in front, or `1` with two proxies in front): the app cannot find enough trustworthy header entries, so every unauthenticated request with no other identifier collapses into the shared bucket. A warning is logged and then repeated every 15 minutes for as long as it continues, so it is safe to alert on; watch for it after changing your proxy setup.
- **Too high** (for example `2` with only one proxy): this causes both problems at once, not just one. An attacker who supplies extra `X-Forwarded-For` entries gets an entry that a client, not a proxy, put there, the exact spoofing this setting exists to prevent. An honest client, who normally sends no `X-Forwarded-For` of their own, has too few entries for the configured count and also falls into the shared bucket, exactly like the "too low" case above.

A proxy that writes something other than a bare IP address to whichever header is configured, such as an `ip:port` pair (seen on some Azure App Service configurations) or a bracketed IPv6 literal (seen on some HAProxy and IIS setups), also resolves to no trusted IP. Nametag validates that the resolved value is a plain IP address before trusting it, rather than assuming the format.

## Rotating NEXTAUTH_SECRET

`NEXTAUTH_SECRET` is also the base for the encryption key that protects every stored ntfy access token (see `lib/crypto/secrets.ts`). Rotating it has the same one-way consequence as rotating the VAPID keys above, for tokens instead of subscriptions: every access token encrypted under the old secret can no longer be decrypted under the new one.

A destination with a token that can no longer be decrypted fails every night with the same generic error a self-hoster would see for any other unreachable destination, since the failure carries no information that would point at the real cause. It counts toward auto-disable like any other failure and switches off after 10 consecutive failed runs. Re-enabling it from Settings clears the counter but not the underlying token, so it fails again the same way and disables itself again, on a loop.

There is no in-place way to re-encrypt a stored token with a new key. The only fix is to remove the affected destination in Settings and add it again with its access token, which encrypts it under the current `NEXTAUTH_SECRET`. Destinations with no access token (public ntfy topics) are unaffected, since there is nothing to decrypt.

## Value constraints and defaults

Some variables are validated against a specific range or format at startup. If a value falls outside these bounds, the app falls back to the default rather than starting with an invalid value.

| Variable | Constraint | Default |
| --- | --- | --- |
| `PHOTO_SIZE` | Integer, 64 to 4096 (max output dimensions in pixels, square; images smaller than this are not upscaled) | `256` |
| `PHOTO_QUALITY` | Integer, 1 to 100 (JPEG compression quality) | `80` |
| `DB_PORT` | Integer, 1 to 65535 | None, required |
| `LOG_LEVEL` | One of `debug`, `info`, `warn`, `error` | `info` |
| `NEXTAUTH_SECRET` | String, minimum 32 characters | None, required |
| `CRON_SECRET` | String, minimum 16 characters | None, required |

## Request and timeout limits

These limits aren't set through environment variables, they're fixed in the application, but they're worth knowing if you're troubleshooting uploads or slow responses:

| Limit | Value |
| --- | --- |
| Default API request body size | 1 MB |
| Next.js proxy body size (raised for photo uploads) | 50 MB |
| Database query timeout, default | 10 seconds |
| Database query timeout, long-running queries | 30 seconds |
| External API timeout (e.g. geocoder requests) | 10 seconds |

If you're running Nametag behind your own reverse proxy (nginx, Caddy, Traefik), make sure its own body size limit is at least 50 MB too, otherwise photo uploads will be rejected before they even reach Nametag.

Detailed setup for each of these areas lives on its own page:

- [Email](/self-hosting/email/): Resend and SMTP, provider-specific notes
- [Authentication](/self-hosting/authentication/): OIDC, registration control, password login
- [Redis](/self-hosting/redis/): when it's needed and how to configure it
- [Map & Geocoding](/self-hosting/map-geocoding/): geocoder configuration and privacy

## Generating secrets

`NEXTAUTH_SECRET` and `CRON_SECRET` should both be random, unique strings. Generate them with:

```bash
openssl rand -base64 32   # for NEXTAUTH_SECRET
openssl rand -base64 16   # for CRON_SECRET
```

Don't reuse the same value for both, and don't reuse secrets across instances.
