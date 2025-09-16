import { Redis } from '@upstash/redis';

// Singleton Redis clients for each environment
let devRedis: Redis | null = null;
let prodRedis: Redis | null = null;

export function getRedisClient(): Redis {
  // Determine environment based on NEXT_PUBLIC_ENV
  const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod';
  
  if (isProduction) {
    // PRODUCTION Redis
    if (!prodRedis) {
      if (!process.env.UPSTASH_REDIS_PROD_URL || !process.env.UPSTASH_REDIS_PROD_TOKEN) {
        throw new Error('UPSTASH_REDIS_PROD_URL and UPSTASH_REDIS_PROD_TOKEN environment variables are required for production');
      }
      
      prodRedis = new Redis({
        url: process.env.UPSTASH_REDIS_PROD_URL,
        token: process.env.UPSTASH_REDIS_PROD_TOKEN,
      });
      
      console.log('🚀 Connected to PRODUCTION Redis (Mumbai, India)');
    }
    return prodRedis;
  } else {
    // DEVELOPMENT Redis
    if (!devRedis) {
      if (!process.env.UPSTASH_REDIS_DEV_URL || !process.env.UPSTASH_REDIS_DEV_TOKEN) {
        throw new Error('UPSTASH_REDIS_DEV_URL and UPSTASH_REDIS_DEV_TOKEN environment variables are required for development');
      }
      
      devRedis = new Redis({
        url: process.env.UPSTASH_REDIS_DEV_URL,
        token: process.env.UPSTASH_REDIS_DEV_TOKEN,
      });
      
      console.log('🧪 Connected to DEVELOPMENT Redis (Mumbai, India)');
    }
    return devRedis;
  }
}

// Cache helper functions with environment-specific keys
export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const redis = getRedisClient();
    
    // Add environment prefix to avoid dev/prod conflicts (extra safety)
    const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod';
    const envKey = `${isProduction ? 'prod' : 'dev'}:${key}`;
    
    const cached = await redis.get(envKey);
    return cached as T | null;
  } catch (error) {
    console.error('Redis get error:', error);
    return null; // Graceful fallback - app still works if Redis is down
  }
}

export async function setCached<T>(
  key: string, 
  data: T, 
  expirationSeconds: number = 60
): Promise<void> {
  try {
    const redis = getRedisClient();
    
    // Add environment prefix to avoid dev/prod conflicts (extra safety)
    const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod';
    const envKey = `${isProduction ? 'prod' : 'dev'}:${key}`;
    
    await redis.setex(envKey, expirationSeconds, JSON.stringify(data));
  } catch (error) {
    console.error('Redis set error:', error);
    // Graceful fallback - don't crash the app if Redis fails
  }
}

// Helper to clear cache (useful for testing)
export async function clearCache(key: string): Promise<void> {
  try {
    const redis = getRedisClient();
    
    // Add environment prefix
    const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod';
    const envKey = `${isProduction ? 'prod' : 'dev'}:${key}`;
    
    await redis.del(envKey);
  } catch (error) {
    console.error('Redis clear error:', error);
  }
}

// Helper to check if Redis is working
export async function testRedisConnection(): Promise<boolean> {
  try {
    const redis = getRedisClient();
    await redis.ping();
    return true;
  } catch (error) {
    console.error('Redis connection test failed:', error);
    return false;
  }
}