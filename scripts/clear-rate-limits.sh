#!/bin/bash
# Clear Rate Limits Script
# 
# Usage:
#   ./scripts/clear-rate-limits.sh              # Clear all rate limits
#   ./scripts/clear-rate-limits.sh login        # Clear login rate limits
#   ./scripts/clear-rate-limits.sh register IP  # Clear specific IP for register

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔧 Redis Rate Limit Cleaner"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ Error: .env file not found${NC}"
    exit 1
fi

# Get Redis password from .env
REDIS_PASSWORD=$(grep "^REDIS_PASSWORD=" .env | cut -d '=' -f2)

if [ -z "$REDIS_PASSWORD" ]; then
    echo -e "${RED}❌ Error: REDIS_PASSWORD not found in .env${NC}"
    exit 1
fi

# Check if Redis container is running
if ! docker ps | grep -q nametag-redis-prod; then
    echo -e "${RED}❌ Error: Redis container (nametag-redis-prod) is not running${NC}"
    echo "   Start it with: docker-compose -f docker-compose.prod.yml up -d redis"
    exit 1
fi

# Function to clear rate limits
clear_pattern() {
    local pattern=$1
    echo -e "${YELLOW}🔍 Searching for keys matching: $pattern${NC}"
    
    # Get keys matching pattern
    keys=$(docker exec nametag-redis-prod redis-cli -a "$REDIS_PASSWORD" --scan --pattern "$pattern" 2>&1 | grep -v "Warning" | grep -v "AUTH")
    
    if [ -z "$keys" ]; then
        echo -e "${YELLOW}ℹ️  No keys found matching pattern: $pattern${NC}"
        return
    fi
    
    # Count keys
    count=$(echo "$keys" | wc -l | tr -d ' ')
    echo -e "${GREEN}✅ Found $count key(s)${NC}"
    echo ""
    
    # Show keys
    echo "Keys to be deleted:"
    echo "$keys" | sed 's/^/  • /'
    echo ""
    
    # Ask for confirmation
    read -p "Delete these keys? (y/N): " -n 1 -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}⚠️  Cancelled${NC}"
        return
    fi
    
    # Delete keys
    echo "$keys" | while read -r key; do
        if [ -n "$key" ]; then
            docker exec nametag-redis-prod redis-cli -a "$REDIS_PASSWORD" DEL "$key" 2>&1 | grep -v "Warning" | grep -v "AUTH" > /dev/null
            echo -e "${GREEN}✅ Deleted: $key${NC}"
        fi
    done
    
    echo ""
    echo -e "${GREEN}✅ Cleared $count rate limit(s)${NC}"
}

# Parse arguments
if [ $# -eq 0 ]; then
    # No arguments - clear all rate limits
    echo "🗑️  Clearing ALL rate limits..."
    echo ""
    clear_pattern "ratelimit:*"
    
elif [ $# -eq 1 ]; then
    # One argument - clear specific type
    type=$1
    echo "🗑️  Clearing rate limits for type: $type"
    echo ""
    clear_pattern "ratelimit:$type:*"
    
elif [ $# -eq 2 ]; then
    # Two arguments - clear specific type and IP/identifier
    type=$1
    identifier=$2
    echo "🗑️  Clearing rate limits for type: $type, identifier: $identifier"
    echo ""
    clear_pattern "ratelimit:$type:$identifier*"
    
else
    echo -e "${RED}❌ Error: Too many arguments${NC}"
    echo ""
    echo "Usage:"
    echo "  $0                    # Clear all rate limits"
    echo "  $0 login              # Clear login rate limits"
    echo "  $0 register 192.168.1.1  # Clear specific IP for register"
    echo ""
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Done!${NC}"
echo ""
echo "Rate limit types:"
echo "  • login           - Login attempts (5 per 15 min)"
echo "  • register        - Registration attempts (3 per hour)"
echo "  • forgot-password - Password reset requests (3 per hour)"
echo "  • reset-password  - Password reset attempts (5 per hour)"
echo "  • api             - General API calls (100 per 15 min)"
echo ""

