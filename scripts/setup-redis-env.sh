#!/bin/bash
# Redis Environment Setup Script
# Safely adds Redis configuration to .env file

set -e

echo "🔧 Redis Environment Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    echo "   Please create .env file first (copy from .env.example)"
    exit 1
fi

# Check if Redis config already exists
if grep -q "REDIS_PASSWORD" .env; then
    echo "⚠️  Redis configuration already exists in .env"
    echo ""
    read -p "   Do you want to regenerate it? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "   Skipping Redis setup"
        exit 0
    fi
    
    # Remove old Redis config
    sed -i.bak '/^# Redis Configuration/d' .env
    sed -i.bak '/^REDIS_PASSWORD=/d' .env
    sed -i.bak '/^REDIS_URL=/d' .env
    sed -i.bak '/^REDIS_PORT=/d' .env
    rm .env.bak
    echo "   ✅ Removed old Redis configuration"
fi

# Generate secure password
REDIS_PASSWORD=$(openssl rand -base64 32)

# Add to .env
echo "" >> .env
echo "# Redis Configuration" >> .env
echo "REDIS_PASSWORD=$REDIS_PASSWORD" >> .env
echo "REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379" >> .env

echo "✅ Redis configuration added to .env"
echo ""
echo "📋 Configuration:"
echo "   REDIS_PASSWORD: ${REDIS_PASSWORD:0:20}... (32 chars)"
echo "   REDIS_URL: redis://:****@redis:6379"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🎯 Next Steps:"
echo ""
echo "1. Restart Docker Compose:"
echo "   docker-compose down && docker-compose up -d"
echo ""
echo "   OR for production:"
echo "   docker-compose -f docker-compose.prod.yml down"
echo "   docker-compose -f docker-compose.prod.yml build app"
echo "   docker-compose -f docker-compose.prod.yml up -d"
echo ""
echo "2. Test Redis connection:"
echo "   node scripts/test-redis.js"
echo ""
echo "3. Check Redis is running:"
echo "   docker ps | grep redis"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✨ Redis is ready to use!"

