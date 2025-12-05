#!/bin/bash

# Script to manually trigger the send-reminders endpoint for debugging

# Load environment variables from .env file if it exists
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Check if CRON_SECRET is set
if [ -z "$CRON_SECRET" ]; then
  echo "Error: CRON_SECRET is not set"
  echo "Either set it in your environment or add it to .env file"
  exit 1
fi

# Default to localhost:3000, but allow override
BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "Triggering reminders endpoint at $BASE_URL/api/cron/send-reminders"
echo "---"

curl -s -X GET "$BASE_URL/api/cron/send-reminders" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" | jq .

echo "---"
echo "Done"
