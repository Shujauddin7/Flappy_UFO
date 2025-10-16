/**
 * Payment Amount Constants
 * Centralized source of truth for all payment amounts
 * Used for server-side validation
 */

import { PAYMENT } from './game-constants';

export const PAYMENT_AMOUNTS = {
    VERIFIED_ENTRY: PAYMENT.VERIFIED_ENTRY,
    STANDARD_ENTRY: PAYMENT.STANDARD_ENTRY,
    VERIFIED_CONTINUE: PAYMENT.VERIFIED_CONTINUE,
    STANDARD_CONTINUE: PAYMENT.STANDARD_CONTINUE,
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
