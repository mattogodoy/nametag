#!/bin/bash
# Database Restore Script
# 
# Restores database from a backup file
# Usage: ./scripts/restore-database.sh <backup-file>

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                                                                  ║"
echo "║                  🔄 DATABASE RESTORE TOOL 🔄                     ║"
echo "║                                                                  ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

# Check arguments
if [ -z "$1" ]; then
    echo -e "${RED}❌ Error: Backup file not specified${NC}"
    echo ""
    echo "Usage: $0 <backup-file>"
    echo ""
    echo "Examples:"
    echo "  $0 backups/manual/backup-20231209.sql.gz"
    echo "  $0 backups/daily/nametag_db-latest.sql.gz"
    echo ""
    echo "Available backups:"
    find backups -name "*.sql.gz" -o -name "*.sql" 2>/dev/null | head -10
    echo ""
    exit 1
fi

BACKUP_FILE="$1"

# Verify backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}❌ Error: Backup file not found: $BACKUP_FILE${NC}"
    exit 1
fi

# Configuration
DOCKER_DB_CONTAINER="nametag-db-prod"
DB_USER="${DB_USER:-nametag}"
DB_NAME="${DB_NAME:-nametag_db}"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Pre-Restore Checks${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Display backup info
BACKUP_SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
BACKUP_DATE=$(ls -l "$BACKUP_FILE" | awk '{print $6, $7, $8}')

echo "Backup file: $BACKUP_FILE"
echo "Size: $BACKUP_SIZE"
echo "Date: $BACKUP_DATE"
echo ""

# Check if compressed
IS_COMPRESSED=false
if [[ "$BACKUP_FILE" == *.gz ]]; then
    IS_COMPRESSED=true
    echo "Format: Compressed (gzip)"
else
    echo "Format: Uncompressed SQL"
fi
echo ""

# Check database container
echo -n "Checking database container... "
if ! docker ps | grep -q $DOCKER_DB_CONTAINER; then
    echo -e "${RED}❌ Not running${NC}"
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

# Get current database stats
CURRENT_USER_COUNT=$(docker exec $DOCKER_DB_CONTAINER psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM \"User\";" 2>/dev/null | tr -d ' ' || echo "0")

echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}⚠️  WARNING ⚠️${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "This will:"
echo "  1. STOP the application"
echo "  2. DROP the current database: $DB_NAME"
echo "  3. RESTORE from backup: $BACKUP_FILE"
echo "  4. RESTART the application"
echo ""
echo "Current database stats:"
echo "  • Users: $CURRENT_USER_COUNT"
echo ""
echo -e "${RED}ALL CURRENT DATA WILL BE LOST!${NC}"
echo ""
read -p "Are you absolutely sure you want to continue? (type 'YES' to confirm): " -r
echo ""

if [ "$REPLY" != "YES" ]; then
    echo -e "${YELLOW}Restore cancelled.${NC}"
    exit 0
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Restore Process${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Step 1: Stop application
echo "1. Stopping application..."
docker-compose -f docker-compose.prod.yml stop app cron 2>/dev/null || true
echo -e "${GREEN}   ✅ Application stopped${NC}"

# Step 2: Drop existing database
echo "2. Dropping existing database..."
docker exec $DOCKER_DB_CONTAINER psql -U $DB_USER -c "DROP DATABASE IF EXISTS $DB_NAME;" > /dev/null 2>&1
echo -e "${GREEN}   ✅ Database dropped${NC}"

# Step 3: Create new database
echo "3. Creating fresh database..."
docker exec $DOCKER_DB_CONTAINER psql -U $DB_USER -c "CREATE DATABASE $DB_NAME;" > /dev/null 2>&1
echo -e "${GREEN}   ✅ Database created${NC}"

# Step 4: Restore from backup
echo "4. Restoring from backup..."
if [ "$IS_COMPRESSED" = true ]; then
    gunzip -c "$BACKUP_FILE" | docker exec -i $DOCKER_DB_CONTAINER psql -U $DB_USER -d $DB_NAME > /dev/null 2>&1
else
    cat "$BACKUP_FILE" | docker exec -i $DOCKER_DB_CONTAINER psql -U $DB_USER -d $DB_NAME > /dev/null 2>&1
fi
echo -e "${GREEN}   ✅ Database restored${NC}"

# Step 5: Verify restoration
echo "5. Verifying restoration..."
RESTORED_USER_COUNT=$(docker exec $DOCKER_DB_CONTAINER psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM \"User\";" | tr -d ' ')
echo -e "${GREEN}   ✅ Restored user count: $RESTORED_USER_COUNT${NC}"

# Step 6: Restart application
echo "6. Restarting application..."
docker-compose -f docker-compose.prod.yml start app cron 2>/dev/null || docker-compose -f docker-compose.prod.yml up -d app cron
sleep 3
echo -e "${GREEN}   ✅ Application restarted${NC}"

# Step 7: Health check
echo "7. Running health check..."
sleep 2
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}   ✅ Application is healthy${NC}"
else
    echo -e "${YELLOW}   ⚠️  Health check failed (app may still be starting)${NC}"
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                                                                  ║"
echo "║                ✅ RESTORE COMPLETE! ✅                           ║"
echo "║                                                                  ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""
echo "Database restored from:"
echo "  $BACKUP_FILE"
echo ""
echo "Restored data:"
echo "  • Users: $RESTORED_USER_COUNT"
echo ""
echo -e "${GREEN}Your database has been restored successfully!${NC}"
echo ""
echo "Next steps:"
echo "  1. Verify application is working: http://localhost:3000"
echo "  2. Check database data is correct"
echo "  3. Test critical functionality"
echo ""

