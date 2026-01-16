#!/bin/bash
set -e

echo "🔧 Initializing dev container environment..."

ENV_FILE=".env"

if [ ! -f "$ENV_FILE" ]; then
    echo "📝 Creating .env file..."
    touch "$ENV_FILE"
fi

generate_secret() {
    local length=$1
    openssl rand -base64 $length | tr -d '\n' | tr '/+=' 'aaa'
}

ensure_env_var() {
    local var_name=$1
    local var_value=$2
    
    if ! grep -q "^${var_name}=" "$ENV_FILE" 2>/dev/null; then
        echo "${var_name}=${var_value}" >> "$ENV_FILE"
        echo "✅ Generated ${var_name}"
    else
        echo "ℹ️  ${var_name} already exists, skipping"
    fi
}

DB_PASSWORD=$(generate_secret 32)
REDIS_PASSWORD=$(generate_secret 32)
NEXTAUTH_SECRET=$(generate_secret 32)
CRON_SECRET=$(generate_secret 16)

ensure_env_var "DB_PASSWORD" "$DB_PASSWORD"
ensure_env_var "REDIS_PASSWORD" "$REDIS_PASSWORD"
ensure_env_var "NEXTAUTH_SECRET" "$NEXTAUTH_SECRET"
ensure_env_var "CRON_SECRET" "$CRON_SECRET"

ensure_env_var "DB_USER" "nametag"
ensure_env_var "DB_NAME" "nametag_db"
ensure_env_var "DB_PORT" "5432"
ensure_env_var "REDIS_PORT" "6379"

ensure_env_var "DATABASE_URL" "postgresql://nametag:${DB_PASSWORD}@db:5432/nametag_db"
ensure_env_var "REDIS_URL" "redis://:${REDIS_PASSWORD}@redis:6379"

ensure_env_var "NEXTAUTH_URL" "http://localhost:3000"
ensure_env_var "NEXT_PUBLIC_APP_URL" "http://localhost:3000"

ensure_env_var "NODE_ENV" "development"
ensure_env_var "LOG_LEVEL" "info"

echo ""
echo "✅ Environment initialization complete!"
echo ""
