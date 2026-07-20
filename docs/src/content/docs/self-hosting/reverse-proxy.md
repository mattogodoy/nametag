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

## After adding a proxy

Once Nametag is served over `https://yourdomain.com`, update your `.env`:

```bash
NEXTAUTH_URL=https://yourdomain.com
```

`NEXTAUTH_URL` is used to build authentication callback URLs, links in reminder emails, and the OIDC callback path, so it needs to match the address users actually reach the app at. If you're using [OIDC](/self-hosting/authentication/), remember to also update the callback URL registered with your provider to `https://yourdomain.com/api/auth/callback/oidc`.

## Docker networking notes

If your proxy and Nametag run as separate Docker Compose projects, put them on a shared external network so the proxy can reach the app by container name without exposing Nametag's port publicly. The production `docker-compose.yml` in the repository already defines a `proxy` network for exactly this: attach your reverse proxy container to `nametag-network` (external) instead of publishing `3000:3000` directly to the host.
