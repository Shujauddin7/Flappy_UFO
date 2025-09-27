import { NextRequest, NextResponse } from 'next/server';

// Rate limiting storage (in production, use Redis or database)
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();

const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes

export async function POST(req: NextRequest) {
    try {
        const { password } = await req.json();

        if (!password || typeof password !== 'string') {
            return NextResponse.json(
                { success: false, message: 'Password is required' },
                { status: 400 }
            );
        }

        // Get client IP for rate limiting
        const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

        // Check rate limiting
        const now = Date.now();
        const attempts = loginAttempts.get(clientIP) || { count: 0, lastAttempt: 0 };

        // Reset attempts if window has passed
        if (now - attempts.lastAttempt > RATE_LIMIT_WINDOW) {
            attempts.count = 0;
        }

        // Check if rate limited
        if (attempts.count >= RATE_LIMIT_MAX_ATTEMPTS) {
            const timeLeft = Math.ceil((RATE_LIMIT_WINDOW - (now - attempts.lastAttempt)) / 1000 / 60);
            return NextResponse.json(
                {
                    success: false,
                    message: `Too many failed attempts. Try again in ${timeLeft} minutes.`
                },
                { status: 429 }
            );
        }

        // Get admin password from environment (plain text)
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminPassword) {
            return NextResponse.json(
                { success: false, message: 'Server configuration error' },
                { status: 500 }
            );
        }

        // Direct password comparison
        const isValidPassword = password === adminPassword;

        if (isValidPassword) {
            // Clear failed attempts on success
            loginAttempts.delete(clientIP);

            return NextResponse.json({
                success: true,
                message: 'Authentication successful',
                timestamp: Date.now()
            });
        } else {
            // Record failed attempt
            attempts.count += 1;
            attempts.lastAttempt = now;
            loginAttempts.set(clientIP, attempts);

            return NextResponse.json(
                {
                    success: false,
                    message: 'Invalid password',
                    attemptsRemaining: RATE_LIMIT_MAX_ATTEMPTS - attempts.count
                },
                { status: 401 }
            );
        }

    } catch (error) {
        console.error('Password authentication error:', error);
        return NextResponse.json(
            { success: false, message: 'Authentication failed' },
            { status: 500 }
        );
    }
}