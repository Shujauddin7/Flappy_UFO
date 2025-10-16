import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Health check endpoint for monitoring system status
 * 
 * Checks:
 * - Redis connection and operations
 * - Database connection and queries
 * - Overall system health
 * 
 * Returns:
 * - 200 OK: All systems healthy
 * - 503 Service Unavailable: One or more systems degraded
 */

// Test Redis connection and operations
async function testRedisConnection(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
    try {
        const startTime = Date.now();
        
        // Dynamic import to match redis.ts pattern
        const { Redis } = await import('@upstash/redis');
        
        const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod';
        const redisUrl = isProduction 
            ? process.env.UPSTASH_REDIS_PROD_URL 
            : process.env.UPSTASH_REDIS_DEV_URL;
        const redisToken = isProduction 
            ? process.env.UPSTASH_REDIS_PROD_TOKEN 
            : process.env.UPSTASH_REDIS_DEV_TOKEN;

        if (!redisUrl || !redisToken) {
            return {
                healthy: false,
                error: 'Redis credentials not configured'
            };
        }

        const redis = new Redis({
            url: redisUrl,
            token: redisToken,
        });

        // Test basic operations
        const testKey = `health:test:${Date.now()}`;
        await redis.set(testKey, 'test', { ex: 10 }); // 10 second TTL
        const value = await redis.get(testKey);
        await redis.del(testKey);

        const latency = Date.now() - startTime;

        if (value === 'test') {
            return {
                healthy: true,
                latency
            };
        } else {
            return {
                healthy: false,
                error: 'Redis operation verification failed'
            };
        }
    } catch (error) {
        return {
            healthy: false,
            error: error instanceof Error ? error.message : 'Unknown Redis error'
        };
    }
}

// Test database connection and queries
async function testDatabaseConnection(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
    try {
        const startTime = Date.now();

        const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod';
        const supabaseUrl = isProduction 
            ? process.env.SUPABASE_PROD_URL 
            : process.env.SUPABASE_DEV_URL;
        const supabaseKey = isProduction 
            ? process.env.SUPABASE_PROD_SERVICE_KEY 
            : process.env.SUPABASE_DEV_SERVICE_KEY;

        if (!supabaseUrl || !supabaseKey) {
            return {
                healthy: false,
                error: 'Database credentials not configured'
            };
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Test simple query (count active tournaments)
        const { error } = await supabase
            .from('tournaments')
            .select('id', { count: 'exact', head: true })
            .limit(1);

        const latency = Date.now() - startTime;

        if (error) {
            return {
                healthy: false,
                error: error.message
            };
        }

        return {
            healthy: true,
            latency
        };
    } catch (error) {
        return {
            healthy: false,
            error: error instanceof Error ? error.message : 'Unknown database error'
        };
    }
}

export async function GET() {
    try {
        const startTime = Date.now();

        // Test both Redis and Database in parallel
        const [redisHealth, dbHealth] = await Promise.all([
            testRedisConnection(),
            testDatabaseConnection()
        ]);

        const totalLatency = Date.now() - startTime;
        const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod';

        // Determine overall status
        const allHealthy = redisHealth.healthy && dbHealth.healthy;
        const status = allHealthy ? 'healthy' : 'degraded';
        const httpStatus = allHealthy ? 200 : 503;

        return NextResponse.json({
            status,
            environment: isProduction ? 'production' : 'development',
            timestamp: new Date().toISOString(),
            latency: {
                total: totalLatency,
                redis: redisHealth.latency || null,
                database: dbHealth.latency || null
            },
            services: {
                redis: {
                    healthy: redisHealth.healthy,
                    error: redisHealth.error || null
                },
                database: {
                    healthy: dbHealth.healthy,
                    error: dbHealth.error || null
                }
            }
        }, { status: httpStatus });

    } catch (error) {
        return NextResponse.json({
            status: 'error',
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
