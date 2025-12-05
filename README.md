# NameTag

A personal relationships manager to help you remember the people in your life, their connections, and important details.

## Features

- Manage contacts with detailed information (name, birthday, phone, address, notes)
- Track relationships between people (family, friends, colleagues)
- Visualize your network with interactive graphs
- Organize contacts into custom groups
- Dashboard with statistics and overview

## Tech Stack

- **Frontend & Backend**: Next.js 15 with TypeScript
- **UI**: Tailwind CSS
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Graph Visualization**: D3.js (planned)
- **Deployment**: Docker with docker-compose

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Node.js 20+ (for local development without Docker)

### Development with Docker (Recommended)

1. Clone the repository
2. Copy the environment variables:
   ```bash
   cp .env.example .env
   ```

3. Start the application:
   ```bash
   docker-compose up
   ```

4. Set up the database (first time only):
   ```bash
   npx prisma migrate dev --name init
   npx prisma db seed
   ```

   Or use the setup script:
   ```bash
   ./scripts/setup-db.sh
   ```

5. The app will be available at [http://localhost:3000](http://localhost:3000)

6. Demo login credentials:
   - Email: `demo@nametag.one`
   - Password: `password123`

For detailed database setup instructions, see [DATABASE_SETUP.md](DATABASE_SETUP.md)

### Local Development (Without Docker)

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up your database and update `.env` with your DATABASE_URL

3. Run Prisma migrations:
   ```bash
   npx prisma migrate dev
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## Database Commands

```bash
# Generate Prisma Client
npx prisma generate

# Create a migration
npx prisma migrate dev --name migration_name

# Open Prisma Studio (database GUI)
npx prisma studio

# Reset database
npx prisma migrate reset
```

## Docker Commands

```bash
# Start services
docker-compose up

# Start in detached mode
docker-compose up -d

# Stop services
docker-compose down

# Rebuild containers
docker-compose build

# View logs
docker-compose logs -f app
```

## Project Structure

```
/app                    # Next.js app directory
  /api                 # API routes
/components            # React components
  /ui                  # Reusable UI components
  /graphs              # Network graph components
/lib                   # Utility functions
  /prisma              # Prisma client
  /auth                # Authentication utilities
/prisma                # Prisma schema and migrations
/public                # Static assets
```

## Development Stages

This project is being built in stages:

1. ✅ **Project Setup & Infrastructure** - Docker, Next.js, Tailwind, Prisma
2. ✅ **Database Schema** - Core data models
3. ⏳ **Authentication** - User registration and login
4. ⏳ **Person Management** - CRUD operations
5. ⏳ **Groups** - Category management
6. ⏳ **Relationships** - Connection system
7. ⏳ **Graph Visualization** - D3.js components
8. ⏳ **Person Details Graph** - Individual network view
9. ⏳ **Dashboard** - Overview and statistics
10. ⏳ **Settings** - User preferences
11. ⏳ **Polish** - UX refinement

## License

Private project - All rights reserved
