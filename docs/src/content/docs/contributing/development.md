---
title: Development Setup
description: Set up a development environment for contributing to Nametag.
sidebar:
  order: 1
---

Nametag supports two development environments. Choose the one that works best for you.

- **Dev Container** (Option A): easiest for new contributors, one-click setup.
- **Local Development** (Option B): best for daily development, faster iteration.

## Option A: Dev Container

Recommended for new contributors. Gets you running quickly with zero local configuration, and works on any OS, including GitHub Codespaces.

**Prerequisites:**

- [VS Code](https://code.visualstudio.com/)
- [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
- Docker Desktop (running)

**Setup:**

1. Fork and clone the repository:

   ```bash
   git clone https://github.com/YOUR_USERNAME/nametag.git
   cd nametag
   ```

2. Open in VS Code:

   ```bash
   code .
   ```

3. When prompted, click **Reopen in Container** (or press F1, then choose "Dev Containers: Reopen in Container").

4. Wait for the container to build. Setup happens automatically:
   - Installs Node.js dependencies
   - Generates the Prisma client
   - Runs database migrations
   - Seeds the database with demo data

5. Start the dev server:

   ```bash
   npm run dev
   ```

6. Access the app at `http://localhost:3000`.

**Demo credentials:**

- Email: `demo@nametag.one`
- Password: `password123`

**Benefits:**

- Consistent environment across all contributors
- No local Node.js installation required
- Works identically on Windows, macOS, and Linux
- Can develop entirely in the browser via GitHub Codespaces
- All tools and extensions pre-configured

## Option B: Local Development

Best for daily work: faster iteration and a more familiar debugging experience. Requires Node.js installed locally, but only runs database services in Docker.

**Prerequisites:**

- Node.js 20+
- Docker and Docker Compose
- Git

**Setup:**

1. Fork and clone the repository:

   ```bash
   git clone https://github.com/YOUR_USERNAME/nametag.git
   cd nametag
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy the environment file:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set at minimum:
   - `NEXTAUTH_SECRET`, generate with `openssl rand -base64 32`
   - `CRON_SECRET`, generate with `openssl rand -base64 16`

   The default values for `DATABASE_URL` and `REDIS_URL` already work with the Docker services below.

4. Start database services only:

   ```bash
   docker-compose -f docker-compose.services.yml up -d
   ```

   This starts PostgreSQL on port 5432 and Redis on port 6379.

5. Set up the database:

   ```bash
   ./scripts/setup-db.sh
   ```

   This runs migrations, generates the Prisma client, and seeds the database with demo data.

6. Start the dev server:

   ```bash
   npm run dev
   ```

7. Access the app at `http://localhost:3000`.

**Demo credentials:**

- Email: `demo@nametag.one`
- Password: `password123`

**Benefits:**

- Native performance, no Docker overhead for Node.js
- Instant hot reload
- Familiar debugging with native Node.js tooling
- Full control over the development environment
- Faster test execution

**Common commands:**

```bash
# Stop database services
docker-compose -f docker-compose.services.yml down

# Start services
docker-compose -f docker-compose.services.yml up -d

# View database logs
docker-compose -f docker-compose.services.yml logs -f db

# Reset database
npx prisma migrate reset
```

## Available npm scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run the TypeScript compiler in check-only mode |
| `npm run test` | Run unit tests in watch mode |
| `npm run test:run` | Run unit tests once |
| `npm run test:coverage` | Run unit tests with coverage |
| `npm run test:e2e` | Run Playwright end-to-end tests |
| `npm run verify` | Lint, typecheck, unit tests, and build |
| `npm run verify:all` | Same as `verify`, plus E2E tests (matches CI) |
| `npm run seed:dev` | Seed the database with demo data |

## Troubleshooting

**Dev Container issues:**

- Make sure Docker Desktop is running.
- Try "Dev Containers: Rebuild Container" from the command palette (F1).
- Check that ports 3000, 5432, and 6379 aren't already in use.

**Local Development issues:**

- Verify your Node.js version: `node --version` (should be 20 or newer).
- Make sure the Docker services are running: `docker-compose -f docker-compose.services.yml ps`.
- Check the database connection: `npx prisma db execute --stdin <<< "SELECT 1"`.
- Clear and reinstall dependencies: `rm -rf node_modules && npm install`.

**Database connection errors:**

- Verify the services are healthy: `docker ps`.
- Check that `.env` has the correct `DATABASE_URL` and `REDIS_URL`.
- Try restarting the services: `docker-compose -f docker-compose.services.yml restart`.

**Port conflicts:**

- Check what's using a port: `lsof -i :3000` (or `:5432`, `:6379`).
- Change the port in `.env`, or stop the conflicting service.

## Development workflow

### Changing the database schema

```bash
# 1. Edit prisma/schema.prisma
# 2. Create and apply a migration
npx prisma migrate dev --name describe_your_change

# 3. Regenerate the Prisma client (usually automatic, but sometimes needed)
npx prisma generate
```

Useful database commands:

```bash
# Open Prisma Studio (database GUI)
npx prisma studio

# Reset the database (deletes all data)
npx prisma migrate reset

# Seed the database
npx prisma db seed
```

### Running tests

```bash
npm run test           # unit tests, watch mode
npm run test:run       # unit tests, single run
npm run test:coverage  # unit tests with coverage
npm run test:e2e       # end-to-end tests
npm run test:e2e:ui    # end-to-end tests with UI
```

### Code quality checks

```bash
npm run lint       # linter
npm run typecheck  # type check
npm run build      # production build, catches many issues
npm run verify     # lint, typecheck, unit tests, and build
npm run verify:all # same as verify, plus E2E tests, matches CI
```

Before submitting a PR, run `npm run verify` (or `npm run verify:all` for larger changes) to catch issues early and save CI time.

### Debugging

**Dev Container:**

- View terminal output directly in VS Code.
- Use VS Code's built-in debugger.
- Inspect data with Prisma Studio: `npx prisma studio`.
- Check the browser console for frontend issues.

**Local Development:**

- Check database logs: `docker-compose -f docker-compose.services.yml logs -f db`.
- Use your IDE's Node.js debugger.
- Inspect data with Prisma Studio: `npx prisma studio`.
- Add console logs or breakpoints as needed.
- Check the browser console for frontend issues.

## Next steps

See [Code Guidelines](/contributing/guidelines/) for coding standards, and [Architecture](/contributing/architecture/) for an overview of how the codebase fits together.
