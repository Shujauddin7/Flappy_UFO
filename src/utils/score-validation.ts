/**
 * Score plausibility validation to prevent cheating
 * 
 * Validates that submitted scores are physically possible based on game mechanics
 * Prevents console-based score manipulation and bot attacks
 */

// Game rules configuration
export const GAME_RULES = {
    // Maximum possible score per second of gameplay
    // Adjusted based on Flappy UFO mechanics (1 point per obstacle passed)
    MAX_SCORE_PER_SECOND: 10, // Very generous - assumes passing 10 obstacles per second (impossible for humans)

    // Minimum game duration in milliseconds
    MIN_DURATION_MS: 1000, // 1 second minimum (to prevent 0ms games with high scores)

    // Maximum absolute score (hard cap)
    MAX_SCORE: 100000,

    // Minimum score (negative scores not allowed)
    MIN_SCORE: 0,
};

export interface ScoreValidationResult {
    valid: boolean;
    error?: string;
    details?: string;
}

/**
 * Validate score against game rules and plausibility checks
 */
export function validateScorePlausibility(
    score: number,
    gameDurationMs: number
): ScoreValidationResult {
    // Check minimum score
    if (score < GAME_RULES.MIN_SCORE) {
        return {
            valid: false,
            error: 'Invalid score: negative scores not allowed',
            details: `Score ${score} is below minimum ${GAME_RULES.MIN_SCORE}`
        };
    }

    // Check maximum score
    if (score > GAME_RULES.MAX_SCORE) {
        return {
            valid: false,
            error: 'Invalid score: exceeds maximum allowed',
            details: `Score ${score} exceeds maximum ${GAME_RULES.MAX_SCORE}`
        };
    }

    // Special case: Allow score 0 with any duration (player can crash immediately)
    if (score === 0) {
        return {
            valid: true
        };
    }

    // Check minimum game duration (only for non-zero scores)
    if (gameDurationMs < GAME_RULES.MIN_DURATION_MS) {
        return {
            valid: false,
            error: 'Invalid game: duration too short',
            details: `Game duration ${gameDurationMs}ms is below minimum ${GAME_RULES.MIN_DURATION_MS}ms`
        };
    }

    // Check score-to-duration ratio (prevent impossible scores)
    const durationSeconds = gameDurationMs / 1000;
    const maxPossibleScore = Math.floor(durationSeconds * GAME_RULES.MAX_SCORE_PER_SECOND);

    if (score > maxPossibleScore) {
        return {
            valid: false,
            error: 'Impossible score: exceeds maximum possible for game duration',
            details: `Score ${score} impossible in ${durationSeconds.toFixed(1)}s (max possible: ${maxPossibleScore})`
        };
    }

    // All checks passed
    return {
        valid: true
    };
}

/**
 * Calculate maximum possible score for a given duration
 */
export function calculateMaxPossibleScore(gameDurationMs: number): number {
    const durationSeconds = gameDurationMs / 1000;
    return Math.floor(durationSeconds * GAME_RULES.MAX_SCORE_PER_SECOND);
}

/**
 * Validate score format and basic constraints
 */
export function validateScoreFormat(score: unknown): score is number {
    return (
        typeof score === 'number' &&
        !isNaN(score) &&
        isFinite(score) &&
        Number.isInteger(score)
    );
}
