#!/usr/bin/env node
/**
 * Redis Connection Test Script
 * 
 * Tests the Redis connection and basic operations
 * Usage: node scripts/test-redis.js
 */

// Load environment variables from .env file
require('dotenv').config();

const Redis = require('ioredis');

async function testRedis() {
  console.log('🔍 Testing Redis Connection...\n');

  const redisUrl = process.env.REDIS_URL;
  const redisPassword = process.env.REDIS_PASSWORD;

  if (!redisUrl) {
    console.error('❌ REDIS_URL not found in environment variables');
    process.exit(1);
  }

  console.log(`📍 Redis URL: ${redisUrl.replace(/:[^:@]+@/, ':****@')}`);
  console.log(`🔐 Redis Password: ${redisPassword ? '✓ Set' : '✗ Not set'}\n`);

  const redis = new Redis(redisUrl, {
    password: redisPassword,
    maxRetriesPerRequest: 3,
    enableOfflineQueue: false,
    connectTimeout: 5000,
  });

  try {
    // Test 1: Connection
    console.log('Test 1: Connection');
    await redis.ping();
    console.log('✅ Connected successfully\n');

    // Test 2: Set/Get
    console.log('Test 2: Set/Get operations');
    await redis.set('test:key', 'Hello Redis!');
    const value = await redis.get('test:key');
    console.log(`✅ Set: "test:key" = "Hello Redis!"`);
    console.log(`✅ Get: "test:key" = "${value}"\n`);

    // Test 3: Expiration
    console.log('Test 3: Expiration (TTL)');
    await redis.setex('test:expiring', 10, 'Expires in 10s');
    const ttl = await redis.ttl('test:expiring');
    console.log(`✅ Set with TTL: ${ttl} seconds remaining\n`);

    // Test 4: Increment (for rate limiting)
    console.log('Test 4: Increment (rate limiting simulation)');
    const key = 'test:rate:192.168.1.1';
    await redis.del(key); // Clean up first
    await redis.incr(key);
    await redis.incr(key);
    await redis.incr(key);
    const count = await redis.get(key);
    console.log(`✅ Incremented 3 times: count = ${count}\n`);

    // Test 5: Rate Limiting Logic
    console.log('Test 5: Rate limiting logic');
    const rateLimitKey = 'test:ratelimit:test@example.com';
    await redis.del(rateLimitKey);
    
    // Simulate 5 requests
    for (let i = 1; i <= 5; i++) {
      const current = await redis.incr(rateLimitKey);
      if (current === 1) {
        await redis.expire(rateLimitKey, 60); // 60 second window
      }
      console.log(`  Request ${i}: count = ${current}`);
    }
    
    const remaining = await redis.ttl(rateLimitKey);
    console.log(`✅ Rate limit window: ${remaining}s remaining\n`);

    // Test 6: Info
    console.log('Test 6: Redis info');
    const info = await redis.info('server');
    const lines = info.split('\r\n');
    const version = lines.find(l => l.startsWith('redis_version:'));
    const uptime = lines.find(l => l.startsWith('uptime_in_seconds:'));
    console.log(`✅ ${version}`);
    console.log(`✅ ${uptime}\n`);

    // Cleanup
    await redis.del('test:key', 'test:expiring', key, rateLimitKey);
    console.log('🧹 Cleaned up test keys\n');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ All Redis tests passed!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await redis.quit();
    process.exit(0);
  } catch (error) {
    console.error('❌ Redis test failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Check REDIS_URL is correct');
    console.error('2. Check REDIS_PASSWORD matches');
    console.error('3. Ensure Redis container is running: docker ps');
    console.error('4. Check Redis logs: docker logs nametag-redis\n');
    
    await redis.quit();
    process.exit(1);
  }
}

testRedis();

