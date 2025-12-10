# Redis Setup Guide

This guide explains how Redis is configured in the NameTag application.

## 🎯 What Redis Does

Redis provides **distributed rate limiting** to protect your API from abuse:
- Prevents brute force attacks on login
- Limits registration attempts
- Protects password reset endpoints
- Scales across multiple app instances

## 🐳 Docker Configuration

Redis is automatically included in both development and production Docker setups:

### Development (`docker-compose.yml`)
- Container: `nametag-redis`
- Port: `6379` (exposed on host)
- Data persistence: Docker volume `redis_data`
- Password protected: Yes

### Production (`docker-compose.prod.yml`)
- Container: `nametag-redis-prod`
- Port: `6379` (not exposed by default for security)
- Data persistence: Docker volume `redis_data`
- Password protected: Yes
- Health checks: Enabled

## 🔧 Environment Variables

Add these to your `.env` file:

```bash
# Redis Configuration
REDIS_PASSWORD=your_secure_redis_password_here
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
REDIS_PORT=6379  # Optional, defaults to 6379
```

**Generate a secure password:**
```bash
openssl rand -base64 32
```

## 🚀 Getting Started

### 1. Add Redis Password to `.env`

```bash
# Generate password
REDIS_PASSWORD=$(openssl rand -base64 32)

# Add to .env
echo "REDIS_PASSWORD=$REDIS_PASSWORD" >> .env
echo "REDIS_URL=redis://:$REDIS_PASSWORD@redis:6379" >> .env
```

### 2. Start Redis with Docker Compose

**Development:**
```bash
# Stop current containers
docker-compose down

# Start with Redis
docker-compose up -d

# Check Redis is running
docker ps | grep redis
```

**Production:**
```bash
# Stop current containers
docker-compose -f docker-compose.prod.yml down

# Start with Redis
docker-compose -f docker-compose.prod.yml up -d

# Check Redis is running
docker ps | grep redis
```

### 3. Test Redis Connection

```bash
# Run the test script
node scripts/test-redis.js
```

Expected output:
```bash
✅ All Redis tests passed!
```

## 🔍 Testing Redis

### Manual Testing with Redis CLI

```bash
# Connect to Redis container
docker exec -it nametag-redis redis-cli

# Authenticate (in Redis CLI)
AUTH your_redis_password

# Test commands
PING                    # Should return PONG
SET test "Hello"        # OK
GET test                # "Hello"
INCR counter            # 1
TTL counter             # -1 (no expiration)
QUIT
```

### Test Rate Limiting

```bash
# Make multiple API requests to trigger rate limiting
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}'
  echo ""
done
```

After 5 attempts, you should see:
```json
{
  "error": "Too many attempts. Please try again later."
}
```

## 📊 Monitoring Redis

### View Redis Logs

```bash
# Development
docker logs nametag-redis -f

# Production
docker logs nametag-redis-prod -f
```

### Check Redis Stats

```bash
# Connect to container
docker exec -it nametag-redis redis-cli -a your_password

# View info
INFO stats
INFO memory
INFO clients

# View all keys (use in development only!)
KEYS *

# View specific rate limit keys
KEYS ratelimit:*
```

### Monitor Real-time Commands

```bash
docker exec -it nametag-redis redis-cli -a your_password MONITOR
```

## 🛠️ Common Operations

### Clear All Rate Limits

```bash
# Connect to Redis
docker exec -it nametag-redis redis-cli -a your_password

# Delete all rate limit keys
EVAL "return redis.call('del', unpack(redis.call('keys', 'ratelimit:*')))" 0
```

### Check Specific User's Rate Limit

```bash
# Replace with actual email
docker exec -it nametag-redis redis-cli -a your_password GET "ratelimit:login:test@example.com"
```

### View Rate Limit TTL

```bash
# Check how long until rate limit expires
docker exec -it nametag-redis redis-cli -a your_password TTL "ratelimit:login:test@example.com"
```

## 🐛 Troubleshooting

### Redis Not Starting

**Check logs:**
```bash
docker logs nametag-redis
```

**Common issues:**
- Password not set in `.env`
- Port 6379 already in use
- Insufficient permissions for Docker volumes

**Solution:**
```bash
# Check if port is in use
lsof -i :6379

# Remove old containers and volumes
docker-compose down -v
docker-compose up -d
```

### App Can't Connect to Redis

**Check connection string:**
```bash
# In Docker, use service name 'redis', not 'localhost'
REDIS_URL=redis://:password@redis:6379  # ✅ Correct (in Docker)
REDIS_URL=redis://:password@localhost:6379  # ❌ Wrong (in Docker)
```

**Test from app container:**
```bash
docker exec -it nametag-app sh
apk add redis
redis-cli -h redis -a your_password PING
```

### Rate Limiting Not Working

**Verify Redis is being used:**
```bash
# Watch Redis monitor while making requests
docker exec -it nametag-redis redis-cli -a your_password MONITOR

# In another terminal, make API requests
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!@#"}'
```

You should see Redis `INCR` commands in the monitor.

**Check app logs:**
```bash
docker logs nametag-app | grep -i redis
```

Look for:
- "Redis client connected" (good)
- "Redis client error" (check password/URL)
- "REDIS_URL is not set" (add to .env)

## 🔒 Security Best Practices

### 1. Strong Password
```bash
# Use at least 32 characters
REDIS_PASSWORD=$(openssl rand -base64 32)
```

### 2. Network Isolation (Production)

In `docker-compose.prod.yml`, Redis is on an internal network and not exposed to the host:

```yaml
redis:
  # No ports section = not accessible from host
  networks:
    - nametag-network  # Internal network only
```

### 3. Data Persistence

Redis data is persisted in Docker volumes:
```bash
# Backup Redis data
docker run --rm -v nametag_redis_data:/data -v $(pwd):/backup alpine tar czf /backup/redis-backup.tar.gz /data
```

### 4. Regular Monitoring

Set up alerts for:
- Redis memory usage > 80%
- Connection errors
- High rate limit triggers (possible attack)

## 📈 Performance Tuning

### Memory Management

Redis stores all data in memory. Configure max memory:

```bash
# Add to redis command in docker-compose.yml
command: redis-server --requirepass ${REDIS_PASSWORD} --maxmemory 256mb --maxmemory-policy allkeys-lru
```

### Connection Pooling

The app uses `ioredis` with connection pooling (configured in `lib/redis.ts`):
- Automatic reconnection
- Offline queue disabled (fail fast)
- Maximum retries: 3

## 🔄 Migration from In-Memory

The app automatically uses Redis rate limiting when `REDIS_URL` is set. No code changes needed!

**Before (in-memory):**
- Rate limits reset on app restart
- Not shared between app instances
- Limited to single server

**After (Redis):**
- Rate limits persist across restarts
- Shared between all app instances
- Scales horizontally

## 📚 Rate Limiting Configuration

Configured in `lib/constants.ts`:

```typescript
export const RATE_LIMITS = {
  LOGIN: { max: 5, window: 15 * 60 * 1000 },      // 5 per 15 min
  REGISTER: { max: 3, window: 60 * 60 * 1000 },   // 3 per hour
  FORGOT_PASSWORD: { max: 3, window: 60 * 60 * 1000 },
  RESET_PASSWORD: { max: 5, window: 60 * 60 * 1000 },
  API: { max: 100, window: 15 * 60 * 1000 },      // 100 per 15 min
};
```

## ✅ Quick Health Check

```bash
# One-line health check
docker exec nametag-redis redis-cli -a your_password PING && echo "✅ Redis is healthy" || echo "❌ Redis is down"
```

## 🆘 Emergency: Disable Redis

If Redis is causing issues, temporarily disable it:

1. Remove `REDIS_URL` from `.env`
2. Restart app: `docker-compose restart app`
3. App will fall back to in-memory rate limiting

**Note:** This is NOT recommended for production!

## 📝 Next Steps

After Redis is set up:
1. ✅ Test rate limiting with `scripts/test-redis.js`
2. ✅ Monitor Redis logs during first few days
3. ✅ Set up alerting for Redis errors
4. ✅ Configure backups (handled by backup service)
5. ✅ Document Redis password in secure location

---

**Need help?** Check the main documentation:
- `START_HERE.md` - Getting started guide
- `WHATS_NEXT.md` - Next steps after setup
- `DEPLOYMENT_GUIDE.md` - Production deployment

**Redis is now configured! 🎉**

