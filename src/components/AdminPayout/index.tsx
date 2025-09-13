'use client';
import { Button, LiveFeedback } from '@worldcoin/mini-apps-ui-kit-react';
import { MiniKit, Tokens, tokenToDecimals } from '@worldcoin/minikit-js';
import { useState } from 'react';

interface AdminPayoutProps {
    winnerAddress: string;
    amount: number;
    rank: number;
    username: string;
    selectedAdminWallet: string;
    tournamentId: string;
    finalScore: number;
    onPaymentSuccess: (winnerAddress: string, transactionId: string) => void;
    onPaymentError: (winnerAddress: string, error: string) => void;
    disabled?: boolean;
}

export const AdminPayout = ({
    winnerAddress,
    amount,
    rank,
    username,
    selectedAdminWallet,
    tournamentId,
    finalScore,
    onPaymentSuccess,
    onPaymentError,
    disabled = false
}: AdminPayoutProps) => {
    const [buttonState, setButtonState] = useState<
        'pending' | 'success' | 'failed' | undefined
    >(undefined);

    const handlePayout = async () => {
        setButtonState('pending');

        try {
            // Step 1: Try to create pending prize record (optional - don't fail if this fails)
            try {
                const pendingResponse = await fetch('/api/admin/pending-prizes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        winnerWallet: winnerAddress,
                        tournamentId: tournamentId,
                        rank: rank,
                        finalScore: finalScore,
                        prizeAmount: amount,
                        username: username,
                        tournamentDay: new Date().toISOString().split('T')[0]
                    })
                });

                if (pendingResponse.ok) {
                    console.log('✅ Pending prize record created');
                } else {
                    console.warn('⚠️ Failed to create pending prize record, continuing with payment...');
                }
            } catch (pendingError) {
                console.warn('⚠️ Pending prize creation failed, continuing with payment...', pendingError);
            }

            // Step 2: Get payment reference from backend
            const res = await fetch('/api/initiate-payment', {
                method: 'POST',
            });
            const { id } = await res.json();

            console.log('🚀 Starting payout to:', username, winnerAddress);
            console.log('💰 Amount:', amount, 'WLD');
            console.log('🔐 Using admin wallet:', selectedAdminWallet);

            // Step 3: Use MiniKit payment flow - this opens World App payment interface
            const result = await MiniKit.commandsAsync.pay({
                reference: id,
                to: winnerAddress,
                tokens: [
                    {
                        symbol: Tokens.WLD,
                        token_amount: tokenToDecimals(amount, Tokens.WLD).toString(),
                    },
                ],
                description: `Flappy UFO Tournament Prize - Rank ${rank} (${amount} WLD)`,
            });

            console.log('🔄 Payment result:', result);

            // Step 4: Handle payment result
            if (result.finalPayload.status === 'success') {
                console.log('✅ Payment successful!', result.finalPayload);
                setButtonState('success');

                // Step 5a: Save successful payment to prizes table
                try {
                    const saveResponse = await fetch('/api/admin/update-payment-status', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            winnerWallet: winnerAddress,
                            transactionId: result.finalPayload.reference || id,
                            tournamentId: tournamentId,
                            rank: rank,
                            finalScore: finalScore,
                            prizeAmount: amount,
                            username: username
                        })
                    });

                    const saveData = await saveResponse.json();
                    if (!saveData.success) {
                        console.warn('⚠️ Payment successful but recording failed:', saveData.error);
                    } else {
                        console.log('✅ Payment recorded in prizes table');

                        // Step 5b: Remove from pending_prizes table (success)
                        try {
                            await fetch(`/api/admin/pending-prizes?tournament_id=${tournamentId}&rank=${rank}&wallet=${winnerAddress}`, {
                                method: 'DELETE'
                            });
                            console.log('✅ Removed from pending prizes');
                        } catch (deleteError) {
                            console.warn('⚠️ Failed to remove from pending prizes:', deleteError);
                        }
                    }

                    // Wait for database operations to complete before calling success callback
                    console.log('⏳ Waiting for database operations to complete...');
                    await new Promise(resolve => setTimeout(resolve, 500));

                    // Call success callback - this updates the UI
                    onPaymentSuccess(winnerAddress, result.finalPayload.reference || id);

                } catch (saveError) {
                    console.warn('⚠️ Payment successful but recording failed:', saveError);
                    // Still call success callback even if recording failed, since payment went through
                    onPaymentSuccess(winnerAddress, result.finalPayload.reference || id);
                }

                // Auto-reset after 3 seconds
                setTimeout(() => {
                    setButtonState(undefined);
                }, 3000);

            } else {
                throw new Error('Payment failed or was cancelled');
            }

        } catch (error) {
            console.error('❌ Payout error:', error);
            setButtonState('failed');

            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            onPaymentError(winnerAddress, errorMessage);

            // Auto-reset after 3 seconds
            setTimeout(() => {
                setButtonState(undefined);
            }, 3000);
        }
    };

    return (
        <div>
            <LiveFeedback
                label={{
                    failed: 'Payment failed - Try again',
                    pending: 'Processing payment...',
                    success: 'Payment sent!',
                }}
                state={buttonState}
                className="w-full"
            >
                <Button
                    onClick={handlePayout}
                    disabled={buttonState === 'pending' || disabled}
                    size="sm"
                    variant="primary"
                    className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white px-4 py-1 rounded text-sm transition-colors"
                >
                    Pay {amount.toFixed(4)} WLD
                </Button>
            </LiveFeedback>
            <p className="text-xs text-gray-400 mt-1">
                From: {selectedAdminWallet.slice(0, 6)}...{selectedAdminWallet.slice(-4)}
            </p>
        </div>
    );
};