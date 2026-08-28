---
title: Reverse Proxy
description: Put Nametag behind Caddy or Nginx with SSL.
sidebar:
  order: 6
---

For any instance reachable from outside your own network, put a reverse proxy in front of the Nametag container to handle TLS termination and serve the app on a real domain instead of a bare port.

By default, the `app` service listens on port 3000. Your proxy forwards requests to that port and handles HTTPS itself.

## Caddy

[Caddy](https://caddyserver.com) is the simplest option: it provisions and renews Let's Encrypt certificates automatically, no extra configuration needed.

```
yourdomain.com {
    reverse_proxy localhost:3000
}
```

That's the entire `Caddyfile`. If Nametag's `app` container is on the same Docker network as Caddy rather than reachable via `localhost`, point at the container name instead:

```
yourdomain.com {
    reverse_proxy app:3000
}
```

## Nginx

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

Add a second `server` block listening on port 80 that redirects to HTTPS, or handle that redirect at your certificate provider if you're using a tool like Certbot. Obtain certificates with [Let's Encrypt](https://letsencrypt.org/) and Certbot if you don't already have them:

```bash
certbot certonly --standalone -d yourdomain.com
```

## Trusted proxy count

Nametag's rate limiting (login, registration, password reset, and more) identifies a client by IP address, read from the `X-Forwarded-For` header your proxy sets. That header is otherwise attacker-controlled, so the app needs to know how many proxy hops to trust before it can pick out the real client address: set with `TRUSTED_PROXY_COUNT` (see [Configuration](/self-hosting/configuration/#trusted-proxy-count-and-rate-limiting)).

**This only works if the app cannot be reached except through that proxy.** Counting hops in a header only means something if every request genuinely passed through the proxy that adds them. The `app` service in `docker-compose.yml` publishes port 3000 on every interface by default (`3000:3000`), which anyone on the same network, or the same host, can connect to directly, bypassing your proxy and the header it sets entirely. If you run a reverse proxy in front of Nametag, bind the app's port to localhost instead, so only the proxy on the same host can reach it:

```yaml
ports:
  - "127.0.0.1:3000:3000"
```

The compose file ships with a commented example of this next to the `3000:3000` line. This is not something `TRUSTED_PROXY_COUNT` can protect against by itself: it changes which header entry is trusted, not who is allowed to talk to the app directly.

Both configurations above add exactly one trusted hop, and both explicitly manage `X-Forwarded-For`:

- **Caddy**'s `reverse_proxy` appends to `X-Forwarded-For` automatically.
- **Nginx**'s `proxy_add_x_forwarded_for` (used above) appends to any existing value rather than replacing it.

`X-Forwarded-For` is the only header Nametag trusts for this. **`X-Real-IP` is never trusted for rate limiting**, even though Nginx's config above also sets it. A proxy that manages `X-Real-IP` but not `X-Forwarded-For` is not a supported configuration: Nametag has no way to tell that setup apart, from the header content alone, from one where a client is forging `X-Forwarded-For` directly, so it resolves to no trusted IP rather than risk trusting the wrong one. The practical effect is a request that falls back to the shared bucket and a warning in the logs, not a silently trusted attacker value, but the underlying misconfiguration still needs fixing: make sure your proxy sets `X-Forwarded-For`, not just `X-Real-IP`.

`TRUSTED_PROXY_COUNT` defaults to `1`, which matches both of these as written. You only need to change it if you add another hop in front of the one shown here, for example a CDN or a separate load balancer terminating TLS before it reaches this Nginx or Caddy instance. In that case, set `TRUSTED_PROXY_COUNT=2`. Getting the count wrong in either direction has a real cost, and both directions produce the same symptom (a warning in the logs and a shared bucket), so read the warning as "check this number," not as pointing to one direction specifically:

- **Too low** (for example `0`, or `1` with two proxies in front): the app cannot trust any part of the header, so every rate limit with no other identifier degrades to a single instance-wide shared bucket for every client.
- **Too high** (for example `2` with only one proxy): this produces both failure modes at once, not just one. A request from an attacker who supplies extra `X-Forwarded-For` entries gets an entry that a client, not a proxy, put there, the exact spoofing this setting exists to prevent. A request from an honest client, who normally sends no `X-Forwarded-For` at all, has too few entries for the configured count and also falls back to the shared bucket, exactly like the "too low" case.

A proxy that writes something other than a bare IP address to `X-Forwarded-For` or `X-Real-IP` also resolves to no trusted IP and falls back to the shared bucket. This includes an `ip:port` pair (some Azure App Service configurations do this) and a bracketed IPv6 literal from some HAProxy or IIS setups. Nametag validates the resolved value is a plain IP address before trusting it, rather than assuming the format.

## After adding a proxy

Once Nametag is served over `https://yourdomain.com`, update your `.env`:

```bash
NEXTAUTH_URL=https://yourdomain.com
```

`NEXTAUTH_URL` is used to build authentication callback URLs, links in reminder emails, and the OIDC callback path, so it needs to match the address users actually reach the app at. If you're using [OIDC](/self-hosting/authentication/), remember to also update the callback URL registered with your provider to `https://yourdomain.com/api/auth/callback/oidc`.

## Docker networking notes

If your proxy and Nametag run as separate Docker Compose projects, put them on a shared external network so the proxy can reach the app by container name without exposing Nametag's port publicly. The production `docker-compose.yml` in the repository already defines a `proxy` network for exactly this: attach your reverse proxy container to `nametag-network` (external) instead of publishing `3000:3000` directly to the host.

## HTTPS and app installation

Nametag can be installed to a phone home screen or desktop as an app, but browsers only offer that for sites served over HTTPS. `localhost` is the one exception.

If you reach your instance over plain HTTP, the effect is uneven rather than total. iOS Safari honors `apple-mobile-web-app-capable` and "Add to Home Screen" regardless of HTTPS, so an iPhone or iPad user still gets a standalone app icon that opens without browser chrome. What you lose over HTTP: the service worker will not register, so there is no offline fallback page, and Android and desktop get no install prompt at all, since Chrome requires HTTPS for `beforeinstallprompt`. Nothing logs an error, because from the browser's point of view nothing is wrong.

Terminating TLS at your reverse proxy, as described above, is enough. See [Installing the App](/features/install/) for what installation gets you.
