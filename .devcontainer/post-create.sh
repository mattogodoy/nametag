#!/bin/bash
set -e

echo "🚀 Setting up Nametag development environment..."
echo ""

ENV_FILE=".env"

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Error: .env file not found. This should have been created by initialize.sh"
    exit 1
fi

source "$ENV_FILE"

echo "📦 Installing dependencies..."
npm install

echo ""
echo "🧬 Generating Prisma Client..."
npx prisma generate

echo ""
echo "⏳ Waiting for database to be ready..."
max_attempts=30
attempt=0

wait_for_db() {
    while [ $attempt -lt $max_attempts ]; do
        if node -e "
            const { Client } = require('pg');
            const client = new Client({ connectionString: process.env.DATABASE_URL });
            client.connect()
                .then(() => client.query('SELECT 1'))
                .then(() => { client.end(); process.exit(0); })
                .catch(() => { client.end(); process.exit(1); });
        " 2>/dev/null; then
            echo "✅ Database is ready"
            return 0
        fi
        
        attempt=$((attempt + 1))
        echo "   Attempt ${attempt}/${max_attempts} - Database not ready yet..."
        sleep 2
    done
    
    echo "⚠️  Database may not be ready, but continuing with migrations..."
    return 1
}

wait_for_db

echo ""
echo "📦 Running Prisma migrations..."
npx prisma migrate deploy || npx prisma migrate dev --name init

echo ""
echo "🌱 Seeding database..."
npx prisma db seed || echo "⚠️  Seeding failed or already seeded"

echo ""
echo "✅ Development environment setup complete!"
echo ""
echo "📋 Demo credentials:"
echo "   Email: demo@nametag.one"
echo "   Password: password123"
echo ""
echo "🌐 App will be available at http://localhost:3000"
echo ""
