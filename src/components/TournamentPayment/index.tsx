'use client';

import React, { useState } from 'react';
import { MiniKit, Tokens, VerificationLevel } from '@worldcoin/minikit-js';
import { Button, LiveFeedback } from '@worldcoin/mini-apps-ui-kit-react';

interface TournamentPaymentProps {
    entryType: 'verify' | 'standard' | 'verified';
    onPaymentSuccess: (entryId: string) => void;
    onPaymentFailed: (error: string) => void;
    onCancel: () => void;
}

/**
 * Tournament Payment Component
 * Handles the complete payment flow for tournament entries:
 * 1. Initiates payment with correct amount based on entry type
 * 2. Processes verification if needed
 * 3. Completes payment via MiniKit
 * 4. Validates payment on server
 * 5. Returns entry ID for game session
 */
export const TournamentPayment: React.FC<TournamentPaymentProps> = ({
    entryType,
    onPaymentSuccess,
    onPaymentFailed,
    onCancel
}) => {
    const [paymentState, setPaymentState] = useState<'idle' | 'verifying' | 'initiating' | 'paying' | 'validating'>('idle');
    const [error, setError] = useState<string | null>(null);

    const processPayment = async () => {
        try {
            setPaymentState('initiating');
            setError(null);

            let verificationPayload = null;

            // Step 1: Handle verification if needed
            if (entryType === 'verify') {
                setPaymentState('verifying');

                const verificationResult = await MiniKit.commandsAsync.verify({
                    action: 'flappy-ufo', // Action name from plan.md
                    verification_level: VerificationLevel.Orb,
                });

                if (verificationResult.finalPayload.status !== 'success') {
                    throw new Error('World ID verification failed');
                }

                verificationPayload = verificationResult.finalPayload;
            }

            // Step 2: Initiate tournament entry (get payment reference and amount)
            const entryResponse = await fetch('/api/tournament/entry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    entryType,
                    verificationPayload
                })
            });

            const entryData = await entryResponse.json();
            if (!entryData.success) {
                throw new Error(entryData.error || 'Failed to initiate tournament entry');
            }

            const { paymentReference, paymentAmount, isVerified } = entryData;

            // Step 3: Process payment via MiniKit
            setPaymentState('paying');

            // Get admin wallet address for payment recipient
            const adminWallet = process.env.NEXT_PUBLIC_ADMIN_WALLET;
            if (!adminWallet) {
                throw new Error('Admin wallet not configured. Please contact support.');
            }

            const paymentResult = await MiniKit.commandsAsync.pay({
                reference: paymentReference,
                to: adminWallet,
                tokens: [
                    {
                        symbol: Tokens.WLD,
                        token_amount: paymentAmount,
                    },
                ],
                description: `Flappy UFO Tournament Entry ${isVerified ? '(Verified - 0.9 WLD)' : '(Standard - 1.0 WLD)'}`,
            });

            if (paymentResult.finalPayload.status !== 'success') {
                throw new Error('Payment failed or was cancelled');
            }

            // Step 4: Validate payment on server
            setPaymentState('validating');

            const validationResponse = await fetch('/api/tournament/validate-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    paymentReference,
                    paymentResult: paymentResult.finalPayload,
                    entryType
                })
            });

            const validationData = await validationResponse.json();
            if (!validationData.success) {
                throw new Error(validationData.error || 'Payment validation failed');
            }

            // Step 5: Success - return entry ID for game session
            onPaymentSuccess(validationData.entryId);

        } catch (error) {
            console.error('❌ Tournament payment error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Payment failed';
            setError(errorMessage);
            onPaymentFailed(errorMessage);
        } finally {
            setPaymentState('idle');
        }
    };

    const getButtonText = (): string => {
        switch (paymentState) {
            case 'verifying':
                return 'VERIFYING IDENTITY...';
            case 'initiating':
                return 'PREPARING PAYMENT...';
            case 'paying':
                return 'PROCESSING PAYMENT...';
            case 'validating':
                return 'VALIDATING ENTRY...';
            default:
                if (entryType === 'verify') {
                    return 'VERIFY & PAY 0.9 WLD';
                } else if (entryType === 'verified') {
                    return 'PAY 0.9 WLD';
                } else {
                    return 'PAY 1.0 WLD';
                }
        }
    };

    const getButtonVariant = () => {
        return entryType === 'standard' ? 'secondary' : 'primary';
    };

    return (
        <div className="tournament-payment-container space-y-4">
            <div className="payment-info bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-bold mb-2">
                    {entryType === 'verify' && '🔒 Verify & Play'}
                    {entryType === 'verified' && '✅ Verified Entry'}
                    {entryType === 'standard' && '⚡ Standard Entry'}
                </h3>
                <p className="text-sm text-gray-300 mb-3">
                    {entryType === 'verify' && 'Complete World ID verification and get discounted tournament entry.'}
                    {entryType === 'verified' && 'You are verified today! Enjoy discounted tournament entry.'}
                    {entryType === 'standard' && 'Quick tournament entry without verification required.'}
                </p>
                <div className="payment-amount text-center">
                    <span className="text-2xl font-bold text-yellow-400">
                        {entryType === 'standard' ? '1.0 WLD' : '0.9 WLD'}
                    </span>
                </div>
            </div>

            {error && (
                <div className="error-message bg-red-800 border border-red-600 rounded-lg p-3">
                    <p className="text-red-200 text-sm">{error}</p>
                </div>
            )}

            <div className="payment-actions space-y-3">
                <LiveFeedback
                    label={{
                        failed: 'Payment failed',
                        pending: 'Processing...',
                        success: 'Payment successful',
                    }}
                    state={paymentState === 'idle' ? undefined : 'pending'}
                    className="w-full"
                >
                    <Button
                        onClick={processPayment}
                        disabled={paymentState !== 'idle'}
                        size="lg"
                        variant={getButtonVariant()}
                        className="w-full"
                    >
                        {getButtonText()}
                    </Button>
                </LiveFeedback>

                <Button
                    onClick={onCancel}
                    disabled={paymentState !== 'idle'}
                    size="lg"
                    variant="tertiary"
                    className="w-full"
                >
                    Cancel
                </Button>
            </div>
        </div>
    );
};
