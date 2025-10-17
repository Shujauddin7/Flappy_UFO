/**
 * Game Constants - Centralized configuration values
 * 
 * All magic numbers extracted to one place for easy maintenance
 */

// ============================================================================
// TIME CONSTANTS
// ============================================================================
export const TIME = {
    /** Duplicate score check window: 5 minutes */
    DUPLICATE_CHECK_MS: 300000,

    /** Grace period check interval: 30 seconds */
    GRACE_PERIOD_CHECK_MS: 30000,

    /** Tournament grace period duration: 30 minutes */
    GRACE_PERIOD_DURATION_MINUTES: 30,

    /** Cache TTL for tournament data: 15 seconds */
    CACHE_TTL_SECONDS: 15,

    /** Cache TTL in milliseconds */
    CACHE_TTL_MS: 15000,

    /** Score validation minimum duration: 1 second */
    MIN_GAME_DURATION_MS: 1000,
} as const;

// ============================================================================
// PAYMENT CONSTANTS
// ============================================================================
export const PAYMENT = {
    /** Verified user entry fee (after Orb verification this week) */
    VERIFIED_ENTRY: 0.9,

    /** Standard user entry fee (not verified this week) */
    STANDARD_ENTRY: 1.0,

    /** Verified user continue fee (same as entry) */
    VERIFIED_CONTINUE: 0.9,

    /** Standard user continue fee (same as entry) */
    STANDARD_CONTINUE: 1.0,

    /** Prize pool percentage from total collected */
    PRIZE_POOL_PERCENTAGE: 0.70,

    /** Admin fee percentage from total collected */
    ADMIN_FEE_PERCENTAGE: 0.30,

    /** Minimum WLD collected before guarantee kicks in */
    GUARANTEE_THRESHOLD_WLD: 72,

    /** Guarantee amount per top 10 winner */
    GUARANTEE_PER_WINNER_WLD: 1.0,

    /** Minimum players required for tournament payout */
    MIN_PLAYERS_FOR_PAYOUT: 5,
} as const;

// ============================================================================
// SCORE VALIDATION CONSTANTS
// ============================================================================
export const SCORE_VALIDATION = {
    /** Maximum score allowed */
    MAX_SCORE: 100000,

    /** Minimum score (negative scores not allowed) */
    MIN_SCORE: 0,

    /** Maximum points achievable per second of gameplay */
    MAX_SCORE_PER_SECOND: 10,

    /** Minimum game duration for non-zero scores (1 second) */
    MIN_DURATION_MS: 1000,
} as const;

// ============================================================================
// RATE LIMIT CONSTANTS
// ============================================================================
export const RATE_LIMITS = {
    /** Score submissions per minute */
    SCORE_SUBMIT_PER_MINUTE: 10,

    /** Tournament entries per minute */
    TOURNAMENT_ENTRY_PER_MINUTE: 5,

    /** World ID verifications per minute */
    VERIFICATION_PER_MINUTE: 3,

    /** General API calls per minute */
    GENERAL_API_PER_MINUTE: 30,

    /** Rate limit window in seconds */
    WINDOW_SECONDS: 60,
} as const;

// ============================================================================
// TOURNAMENT TIMING CONSTANTS  
// ============================================================================
export const TOURNAMENT = {
    /** Tournament start day (0 = Sunday) */
    START_DAY_UTC: 0,

    /** Tournament start hour (UTC) */
    START_HOUR_UTC: 15,

    /** Tournament start minute (UTC) */
    START_MINUTE_UTC: 30,

    /** Grace period start hour (UTC) */
    GRACE_START_HOUR_UTC: 15,

    /** Grace period start minute (UTC) */
    GRACE_START_MINUTE_UTC: 0,

    /** Grace period end minute (UTC) */
    GRACE_END_MINUTE_UTC: 30,

    /** Tournament duration in days */
    DURATION_DAYS: 7,
} as const;

// ============================================================================
// REDIS CONSTANTS
// ============================================================================
export const REDIS = {
    /** Default cache TTL: 15 seconds */
    DEFAULT_TTL_SECONDS: 15,

    /** Idempotency lock TTL: 5 minutes */
    IDEMPOTENCY_TTL_SECONDS: 300,

    /** Health check timeout: 10 seconds */
    HEALTH_CHECK_TIMEOUT_MS: 10000,
} as const;

// ============================================================================
// API CONSTANTS
// ============================================================================
export const API = {
    /** Default fetch timeout: 10 seconds */
    FETCH_TIMEOUT_MS: 10000,

    /** Max retry attempts for failed operations */
    MAX_RETRY_ATTEMPTS: 3,

    /** Retry delay base (exponential backoff) */
    RETRY_DELAY_MS: 1000,
} as const;

// ============================================================================
// PRACTICE MODE CONSTANTS
// ============================================================================
export const PRACTICE_MODE = {
    /** Coins earned per star collected */
    COINS_PER_STAR: 1,

    /** Coins required to continue */
    COINS_PER_CONTINUE: 10,

    /** LocalStorage key for coins */
    COINS_STORAGE_KEY: 'flappy_ufo_coins',

    /** LocalStorage key for coins hash */
    COINS_HASH_STORAGE_KEY: 'flappy_ufo_coins_hash',

    /** Salt for coin hash validation */
    COINS_HASH_SALT: 'ufo_secret_2024',
} as const;

// ============================================================================
// LEADERBOARD CONSTANTS
// ============================================================================
export const LEADERBOARD = {
    /** Number of items per page */
    PAGE_SIZE: 20,

    /** Top winners count */
    TOP_WINNERS_COUNT: 10,

    /** Update interval for real-time leaderboard (ms) */
    UPDATE_INTERVAL_MS: 5000,
} as const;

// ============================================================================
// CONTINUE SYSTEM CONSTANTS
// ============================================================================
export const CONTINUE_SYSTEM = {
    /** Maximum continues allowed per game */
    MAX_CONTINUES_PER_GAME: 1,

    /** Continue offer time limit: 5 minutes */
    CONTINUE_TIME_LIMIT_MS: 300000,
} as const;

// ============================================================================
// TYPE EXPORTS (for TypeScript type safety)
// ============================================================================
export type PaymentType = keyof typeof PAYMENT;
export type RateLimitType = keyof typeof RATE_LIMITS;
export type TimeConstant = keyof typeof TIME;
