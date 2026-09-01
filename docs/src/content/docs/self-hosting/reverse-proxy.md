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

## Trusted proxy configuration

Nametag's rate limiting (login, registration, password reset, and more) identifies a client by IP address. A Web `Request` handler has no direct access to the TCP connection, so the only source for that address is a header your reverse proxy sets, and that header is otherwise attacker-controlled. Two settings tell the app how to trust it correctly: `TRUSTED_PROXY_COUNT` and `TRUSTED_PROXY_HEADER` (see [Configuration](/self-hosting/configuration/#trusted-proxy-configuration-and-rate-limiting)).

**This only works if the app cannot be reached except through that proxy.** Trusting a header only means something if every request genuinely passed through the proxy that sets it. The `app` service in `docker-compose.yml` publishes port 3000 on every interface by default (`3000:3000`), which anyone on the same network, or the same host, can connect to directly, bypassing your proxy and the header it sets entirely. If you run a reverse proxy in front of Nametag, bind the app's port to localhost instead, so only the proxy on the same host can reach it:

```yaml
ports:
  - "127.0.0.1:3000:3000"
```

The compose file ships with a commented example of this next to the `3000:3000` line. This is not something `TRUSTED_PROXY_COUNT` or `TRUSTED_PROXY_HEADER` can protect against by itself: they change which header, and which entry in it, is trusted, not who is allowed to talk to the app directly.

### Which header does your proxy actually manage?

This is not something Nametag can reliably detect from a request: a proxy that appends to `X-Forwarded-For`, and a proxy that only replaces `X-Real-IP` and never touches `X-Forwarded-For` at all, can each produce a request that looks like a valid instance of the other. In the second case, whatever `X-Forwarded-For` a client sends passes straight through untouched, and nothing distinguishes "the proxy added this" from "the client sent exactly this." Guessing is wrong for one of the two setups no matter which way you guess, so you tell Nametag which header your proxy manages with `TRUSTED_PROXY_HEADER`, rather than have it infer one.

To find out which one is true for your proxy, look at your own config, not at this page's examples:

- **Nginx**: look for a `proxy_set_header` line. `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` (or the `proxy_add_x_forwarded_for` directive) means your proxy manages `X-Forwarded-For`, use the default. `proxy_set_header X-Real-IP $remote_addr;` **with no line handling `X-Forwarded-For`** means your proxy only manages `X-Real-IP`; set `TRUSTED_PROXY_HEADER=x-real-ip`. The example config below sets both, which means `X-Forwarded-For` is managed (use the default) even though `X-Real-IP` is also set.
- **Caddy**: `reverse_proxy` manages `X-Forwarded-For` automatically and does not set `X-Real-IP` at all. Use the default.
- **Cloudflare**: has its own, better option. See [Cloudflare](#cloudflare) below rather than picking between the two headers above.
- **Any other proxy** (Traefik, HAProxy, a cloud load balancer, etc.): check its documentation or its own configuration for which of these two headers it sets, the same way. If it sets neither, or you cannot tell, treat it as unconfigured: see below.

**If your proxy sets neither header** (or you leave `TRUSTED_PROXY_HEADER` pointed at a header your proxy never touches), Nametag cannot determine a trustworthy client IP for any request. Every rate limit with no other identifier (see [Configuration](/self-hosting/configuration/#trusted-proxy-configuration-and-rate-limiting) for which routes have one) falls back to a single shared bucket for the whole instance, and a warning naming both settings is logged, then repeated every 15 minutes for as long as the condition lasts. This degrades rate limiting; it does not silently trust an attacker-supplied value.

The Nginx config in the [Nginx](#nginx) section above sets both `X-Real-IP` and `X-Forwarded-For`, but only `X-Forwarded-For` is managed the way Nametag needs (appended to, not replaced from a single value): `X-Real-IP` is set there too, but that is incidental to what Nametag reads. Use the default `TRUSTED_PROXY_HEADER` (`x-forwarded-for`) with that config, not `x-real-ip`, even though the header is present.

### TRUSTED_PROXY_COUNT: how many hops to trust

`TRUSTED_PROXY_COUNT` only applies when `TRUSTED_PROXY_HEADER` is `x-forwarded-for` (the default). It counts entries in that header from the right: the client's real address is the `TRUSTED_PROXY_COUNT`th entry from the end, because each proxy hop appends its own view of the connection to the end of the header rather than replacing it. Both configurations above add exactly one trusted hop, so the default of `1` matches both as written. You only need to change it if you add another hop in front of the one shown here, for example a CDN or a separate load balancer terminating TLS before it reaches this Nginx or Caddy instance. In that case, set `TRUSTED_PROXY_COUNT=2`. If that additional hop is specifically Cloudflare, see [Cloudflare](#cloudflare) below for a better option than counting hops at all.

`TRUSTED_PROXY_COUNT` does not apply in `x-real-ip` or `cf-connecting-ip` mode: both carry a single value a proxy replaces or overwrites, not a chain of appended hops, so there is nothing to count. A count of `0` still disables trust entirely regardless of which header is configured.

Getting the count wrong in `x-forwarded-for` mode has a real cost in either direction, and both directions produce the same symptom (a warning in the logs and a shared bucket), so read the warning as "check this number," not as pointing to one direction specifically:

- **Too low** (for example `0`, or `1` with two proxies in front): the app cannot trust any part of the header, so every rate limit with no other identifier degrades to a single instance-wide shared bucket for every client.
- **Too high** (for example `2` with only one proxy): this produces both failure modes at once, not just one. A request from an attacker who supplies extra `X-Forwarded-For` entries gets an entry that a client, not a proxy, put there, the exact spoofing this setting exists to prevent. A request from an honest client, who normally sends no `X-Forwarded-For` at all, has too few entries for the configured count and also falls back to the shared bucket, exactly like the "too low" case.

A proxy that writes something other than a bare IP address to whichever header is configured also resolves to no trusted IP and falls back to the shared bucket. This includes an `ip:port` pair (some Azure App Service configurations do this) and a bracketed IPv6 literal from some HAProxy or IIS setups. Nametag validates the resolved value is a plain IP address before trusting it, rather than assuming the format.

## Cloudflare

If Cloudflare sits in front of your origin, `cf-connecting-ip` is the better choice over the header/count combination above, and it is what nametag.one itself uses.

**Recommended: `TRUSTED_PROXY_HEADER=cf-connecting-ip`.** Cloudflare overwrites `CF-Connecting-IP` with the visitor's address on every request rather than appending to it, so there is no hop count to get right or wrong, and no need to recount if you later add or remove a layer (for example, an additional reverse proxy between Cloudflare and the app). `TRUSTED_PROXY_COUNT` is ignored in this mode.

This mode's entire security model depends on one thing this setting cannot enforce by itself: **the origin must refuse any connection that did not come from Cloudflare.** If the app is reachable directly, by IP or by a domain that bypasses Cloudflare, anyone can set `CF-Connecting-IP` to whatever they like and Nametag will trust it completely; there is no chain or count to disagree with them the way there is in `x-forwarded-for` mode with a wrong count. This is not optional hardening for this mode, it **is** the security boundary. Enforce it one of these ways:

- Restrict your origin firewall to [Cloudflare's published IP ranges](https://www.cloudflare.com/ips/), so only Cloudflare's edge can reach the app.
- Enable [Authenticated Origin Pulls](https://developers.cloudflare.com/ssl/origin-configuration/authenticated-origin-pull/) (mTLS from the edge), so the origin verifies every connection is actually from Cloudflare.
- Use a [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) so the origin has no public address at all.

**Alternative: leave `TRUSTED_PROXY_HEADER` at its default (`x-forwarded-for`)** and set `TRUSTED_PROXY_COUNT` to match your topology: `2` if Cloudflare reaches your origin through this reverse proxy (Cloudflare, then the proxy, then the app), or `1` if Cloudflare reaches the app directly with no other proxy in between. This works, but the count silently becomes wrong if you ever add or remove a layer, which `cf-connecting-ip` mode does not suffer from.

**`x-real-ip` is the wrong choice behind Cloudflare, and it is worth naming because it looks plausible.** An origin Nginx setting `proxy_set_header X-Real-IP $remote_addr;` records the address of whatever connected to it directly, which behind Cloudflare is the **Cloudflare edge**, not the visitor. Every visitor arriving through the same edge node would then share a single rate-limit bucket, since they would all resolve to the same `X-Real-IP` value. Use `cf-connecting-ip` or the `x-forwarded-for` count instead.

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
