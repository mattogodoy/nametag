# Dev Container Guide

## Quick Start

The dev container is configured to automatically:
1. Install dependencies (`npm install`)
2. Generate Prisma client
3. Run database migrations
4. Seed the database with demo data
5. Start the Next.js dev server

After opening the container, wait for all these steps to complete, then navigate to http://localhost:3000

## Troubleshooting

### Page loads indefinitely at localhost:3000

**Cause**: The Next.js dev server isn't running.

**Solution**: Open a terminal in VS Code and run:
```bash
npm run dev
```

The dev server should start automatically via VS Code tasks, but if it doesn't, this manual command will work.

### Database connection errors

**Cause**: Database not ready or environment variables not loaded.

**Solution**:
1. Check if PostgreSQL is running:
   ```bash
   pg_isready -U nametag -d nametag_db
   ```

2. If not ready, restart the dev container

### Redis connection errors

Redis is optional for development. The app will fall back to in-memory rate limiting if Redis isn't available.

To check if Redis is running:
```bash
redis-cli -a nametag_dev_password ping
```

## Manual Setup Steps

If automatic setup fails, you can run these commands manually:

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Seed database
npm run seed:dev

# Start dev server
npm run dev
```

## Environment Variables

The dev container loads your `.env` file and overrides only these settings to work with Docker services:

**Overridden (points to Docker services):**
- `DB_HOST=localhost`
- `DB_PORT=5432`
- `DB_NAME=nametag_db`
- `DB_USER=nametag`
- `DB_PASSWORD=nametag_dev_password`
- `REDIS_URL=redis://:nametag_dev_password@localhost:6379`
- `NEXTAUTH_URL=http://localhost:3000`
- `NODE_ENV=development`

**From your .env file:**
- `NEXTAUTH_SECRET` - Your existing secret (preserves session cookies)
- `CRON_SECRET` - Your existing secret
- Any other variables you've set

This means your sessions work seamlessly between local development and dev container!

## Network Configuration

The dev container uses `network_mode: service:db` which means:
- All services (app, db, redis) share the same network namespace
- You can access PostgreSQL at `localhost:5432`
- You can access Redis at `localhost:6379`
- The Next.js app runs on `localhost:3000`

VS Code automatically forwards ports 3000, 5432, and 6379 to your host machine.
