/**
 * Payment Amount Constants
 * Centralized source of truth for all payment amounts
 * Used for server-side validation
 */

export const PAYMENT_AMOUNTS = {
    VERIFIED_ENTRY: 0.9,
    STANDARD_ENTRY: 1.0,
    VERIFIED_CONTINUE: 0.9,
    STANDARD_CONTINUE: 1.0,
} as const;

export const PAYMENT_TOLERANCE = 0.01; // Allow 0.01 variance for floating point

/**
 * Validate payment amount against expected value
 */
export function validatePaymentAmount(
    paidAmount: number,
    isVerifiedEntry: boolean,
    isContinuePayment: boolean = false
): { valid: boolean; expected: number } {
    const expectedAmount = isContinuePayment
        ? (isVerifiedEntry ? PAYMENT_AMOUNTS.VERIFIED_CONTINUE : PAYMENT_AMOUNTS.STANDARD_CONTINUE)
        : (isVerifiedEntry ? PAYMENT_AMOUNTS.VERIFIED_ENTRY : PAYMENT_AMOUNTS.STANDARD_ENTRY);

    const valid = Math.abs(paidAmount - expectedAmount) <= PAYMENT_TOLERANCE;

    return { valid, expected: expectedAmount };
}
