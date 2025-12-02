#!/bin/bash

# Script to set up the database (run this after docker-compose up)

echo "🚀 Setting up Letho database..."
echo ""

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 5

# Run migrations
echo "📦 Running Prisma migrations..."
npx prisma migrate deploy

# Generate Prisma Client
echo "🔧 Generating Prisma Client..."
npx prisma generate

# Seed database
echo "🌱 Seeding database..."
npx prisma db seed

echo ""
echo "✅ Database setup complete!"
echo ""
echo "Demo credentials:"
echo "Email: demo@letho.app"
echo "Password: password123"
