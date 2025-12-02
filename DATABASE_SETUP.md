# Database Setup Guide

This guide explains how to set up the Name Tag database with Docker.

## Initial Setup

### 1. Start Docker Services

First, make sure Docker Desktop is running, then start the services:

```bash
docker-compose up -d
```

This will start:
- PostgreSQL database on port 5432
- Next.js application on port 3000

### 2. Run Database Migrations

Once the containers are running, create the database schema:

```bash
npx prisma migrate dev --name init
```

This creates all the tables defined in the Prisma schema.

### 3. Seed the Database

Populate the database with test data:

```bash
npx prisma db seed
```

This will create:
- A demo user account (demo@nametag.one / password123)
- 3 groups (Family, Friends, Work)
- 7 people with various relationships
- Multiple relationships demonstrating the network graph

### Alternative: Run Setup Script

You can run all steps at once using the setup script:

```bash
./scripts/setup-db.sh
```

## Database Schema Overview

### Tables

1. **users** - User accounts with authentication
2. **people** - Contact information for people in your network
3. **groups** - Categories for organizing people
4. **person_groups** - Many-to-many relationship between people and groups
5. **relationships** - Connections between people

### Relationship Types

- PARENT
- CHILD
- SIBLING
- SPOUSE
- PARTNER
- FRIEND
- COLLEAGUE
- ACQUAINTANCE
- RELATIVE
- OTHER

## Useful Commands

### View Database

Open Prisma Studio (database GUI):

```bash
npx prisma studio
```

### Create a New Migration

After modifying the schema:

```bash
npx prisma migrate dev --name migration_name
```

### Reset Database

To clear all data and re-run migrations:

```bash
npx prisma migrate reset
```

This will:
1. Drop all tables
2. Recreate tables from migrations
3. Run seed script automatically

### Generate Prisma Client

After schema changes:

```bash
npx prisma generate
```

## Demo Data

After seeding, you'll have:

- **Demo User**: demo@nametag.one
- **Password**: password123

The demo data includes a small family network:
- John Smith (brother, software engineer)
- Sarah Johnson (John's wife, teacher)
- Emma Smith (their daughter, 9 years old)
- Lucas Smith (their son, 6 years old)
- Mike Chen (friend from college)
- Jessica Martinez (work colleague)
- David Brown (neighbor and friend)

These people are connected with various relationship types to demonstrate the network graph functionality.
