/**
 * Standard API Response Types
 * Ensures consistent response format across all API endpoints
 */

/**
 * Standard success response
 */
export interface ApiSuccessResponse<T = unknown> {
    success: true;
    data: T;
    message?: string;
}

/**
 * Standard error response
 */
export interface ApiErrorResponse {
    success: false;
    error: string;
    code?: string;
    details?: string | Record<string, unknown>;
}

/**
 * Union type for all API responses
 */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Rate limit response metadata
 */
export interface RateLimitInfo {
    limit: number;
    remaining: number;
    reset: number;
}

/**
 * Response with rate limit information
 */
export interface ApiResponseWithRateLimit<T = unknown> extends ApiSuccessResponse<T> {
    rateLimit?: RateLimitInfo;
}

/**
 * Common error codes for consistent error handling
 */
export const API_ERROR_CODES = {
    // Authentication errors
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    INVALID_TOKEN: 'INVALID_TOKEN',

    // Validation errors
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    INVALID_INPUT: 'INVALID_INPUT',
    MISSING_FIELDS: 'MISSING_FIELDS',

    // Resource errors
    NOT_FOUND: 'NOT_FOUND',
    ALREADY_EXISTS: 'ALREADY_EXISTS',
    CONFLICT: 'CONFLICT',

    // Rate limiting
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',

    // Score validation
    INVALID_SCORE: 'INVALID_SCORE',
    IMPOSSIBLE_SCORE: 'IMPOSSIBLE_SCORE',
    DUPLICATE_SUBMISSION: 'DUPLICATE_SUBMISSION',

    // Payment errors
    PAYMENT_FAILED: 'PAYMENT_FAILED',
    PAYMENT_MISMATCH: 'PAYMENT_MISMATCH',
    INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',

    // Tournament errors
    TOURNAMENT_NOT_ACTIVE: 'TOURNAMENT_NOT_ACTIVE',
    TOURNAMENT_ENDED: 'TOURNAMENT_ENDED',
    GRACE_PERIOD_ACTIVE: 'GRACE_PERIOD_ACTIVE',

    // Server errors
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    DATABASE_ERROR: 'DATABASE_ERROR',
    REDIS_ERROR: 'REDIS_ERROR',
    EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
} as const;

export type ApiErrorCode = typeof API_ERROR_CODES[keyof typeof API_ERROR_CODES];

/**
 * Helper function to create success response
 */
export function createSuccessResponse<T>(
    data: T,
    message?: string
): ApiSuccessResponse<T> {
    return {
        success: true,
        data,
        ...(message && { message }),
    };
}

/**
 * Helper function to create error response
 */
export function createErrorResponse(
    error: string,
    code?: ApiErrorCode,
    details?: string | Record<string, unknown>
): ApiErrorResponse {
    return {
        success: false,
        error,
        ...(code && { code }),
        ...(details && { details }),
    };
}

/**
 * Helper function to create rate limit error response
 */
export function createRateLimitErrorResponse(
    rateLimit: RateLimitInfo
): ApiErrorResponse & { rateLimit: RateLimitInfo } {
    return {
        success: false,
        error: 'Too many requests. Please wait before trying again.',
        code: API_ERROR_CODES.RATE_LIMIT_EXCEEDED,
        rateLimit,
    };
}
