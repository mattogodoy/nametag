#!/bin/bash
# Manual Database Backup Script
# 
# Creates an on-demand database backup with timestamp
# Usage: ./scripts/backup-database.sh [backup-name]

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                                                                  ║"
echo "║                   📦 DATABASE BACKUP TOOL 📦                     ║"
echo "║                                                                  ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

# Configuration
DOCKER_DB_CONTAINER="nametag-db-prod"
DB_USER="${DB_USER:-nametag}"
DB_NAME="${DB_NAME:-nametag_db}"
BACKUP_DIR="./backups/manual"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Custom backup name or use timestamp
if [ -n "$1" ]; then
    BACKUP_NAME="$1"
else
    BACKUP_NAME="backup-$TIMESTAMP"
fi

BACKUP_FILE="$BACKUP_DIR/${BACKUP_NAME}.sql"
COMPRESSED_FILE="$BACKUP_DIR/${BACKUP_NAME}.sql.gz"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Check if database container is running
echo -n "Checking database container... "
if ! docker ps | grep -q $DOCKER_DB_CONTAINER; then
    echo -e "${RED}❌ Not running${NC}"
    echo ""
    echo "Please start the database:"
    echo "  docker-compose -f docker-compose.prod.yml up -d db"
    exit 1
fi
echo -e "${GREEN}✅${NC}"

# Check database connection
echo -n "Testing database connection... "
if ! docker exec $DOCKER_DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c "SELECT 1" > /dev/null 2>&1; then
    echo -e "${RED}❌ Failed${NC}"
    exit 1
fi
echo -e "${GREEN}✅${NC}"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Creating Backup${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo "Container: $DOCKER_DB_CONTAINER"
echo ""

# Create uncompressed backup
echo "Creating backup..."
docker exec $DOCKER_DB_CONTAINER pg_dump -U $DB_USER -d $DB_NAME > "$BACKUP_FILE"

if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}❌ Backup creation failed${NC}"
    exit 1
fi

BACKUP_SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
echo -e "${GREEN}✅ Backup created: $BACKUP_SIZE${NC}"

# Compress backup
echo -n "Compressing backup... "
gzip -c "$BACKUP_FILE" > "$COMPRESSED_FILE"
rm "$BACKUP_FILE"

COMPRESSED_SIZE=$(ls -lh "$COMPRESSED_FILE" | awk '{print $5}')
echo -e "${GREEN}✅ Compressed: $COMPRESSED_SIZE${NC}"

# Validate backup
echo -n "Validating backup... "
if gunzip -c "$COMPRESSED_FILE" | grep -q "PostgreSQL database dump"; then
    echo -e "${GREEN}✅ Valid${NC}"
else
    echo -e "${RED}❌ Invalid${NC}"
    exit 1
fi

# Get database statistics
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Backup Statistics${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo "Tables backed up:"
docker exec $DOCKER_DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c "
SELECT 
    schemaname as schema,
    tablename as table,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
" 2>/dev/null || echo "  (Table stats unavailable)"

echo ""
echo "Record counts:"
for table in User Person Group Relationship ImportantDate; do
    count=$(docker exec $DOCKER_DB_CONTAINER psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM \"$table\";" 2>/dev/null | tr -d ' ' || echo "0")
    printf "  %-20s %s\n" "$table:" "$count"
done

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                                                                  ║"
echo "║                  ✅ BACKUP COMPLETE! ✅                          ║"
echo "║                                                                  ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}Backup saved to:${NC}"
echo "  $COMPRESSED_FILE"
echo ""
echo -e "${BLUE}To restore this backup:${NC}"
echo "  ./scripts/restore-database.sh $COMPRESSED_FILE"
echo ""

