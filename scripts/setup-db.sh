#!/bin/bash

# Script to set up the database (run this after docker-compose up)

CONTAINER_NAME="nametag-app"

echo "🚀 Setting up NameTag database..."
echo ""

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "❌ Error: Container '${CONTAINER_NAME}' is not running."
    echo "   Please run 'docker-compose up -d' first."
    exit 1
fi

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 5

# Run migrations
echo "📦 Running Prisma migrations..."
docker exec ${CONTAINER_NAME} npx prisma migrate deploy

# Generate Prisma Client
echo "🔧 Generating Prisma Client..."
docker exec ${CONTAINER_NAME} npx prisma generate

# Seed database
echo "🌱 Seeding database..."
docker exec ${CONTAINER_NAME} npx prisma db seed

echo ""
echo "✅ Database setup complete!"
echo ""
echo "Demo credentials:"
echo "Email: demo@nametag.one"
echo "Password: password123"
