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
    const [debugInfo, setDebugInfo] = useState<string>('');

    const handlePayout = async () => {
        setButtonState('pending');
        setDebugInfo('Starting payment...');

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
                    } else {
                    }
            } catch {
                }

            // Step 2: Get payment reference from backend
            const res = await fetch('/api/initiate-payment', {
                method: 'POST',
            });
            const { id } = await res.json();

            // Check if trying to pay to self vs other wallet
            const isSelfPayment = winnerAddress.toLowerCase() === selectedAdminWallet.toLowerCase();
            setDebugInfo(isSelfPayment ? 'Paying to your own wallet...' : `Paying to ${username} (${winnerAddress.slice(0, 6)}...${winnerAddress.slice(-4)})`);

            // Step 3: Use MiniKit payment flow - this opens World App payment interface
            // NOTE: MiniKit uses the authenticated user's wallet, not selectedAdminWallet
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

            // Step 4: Handle payment result - Fixed validation (reference is optional)
            if (result.finalPayload && result.finalPayload.status === 'success') {
                setButtonState('success');
                setDebugInfo('✅ Payment successful! Saving to database...');

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
                        throw new Error(`Database recording failed: ${saveData.error}`);
                    } else {
                        // Step 5b: Remove from pending_prizes table (success)
                        try {
                            await fetch(`/api/admin/pending-prizes?tournament_id=${tournamentId}&rank=${rank}&wallet=${winnerAddress}`, {
                                method: 'DELETE'
                            });
                            } catch {
                            }
                    }

                    // Wait for database operations to complete before calling success callback
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    // Call success callback - this updates the UI
                    onPaymentSuccess(winnerAddress, result.finalPayload.reference || id);

                } catch (saveError) {
                    console.error('⚠️ Payment successful but database operations failed:', saveError);
                    setButtonState('failed');
                    const errorMessage = saveError instanceof Error ? saveError.message : 'Unknown database error';
                    onPaymentError(winnerAddress, `Payment succeeded but database update failed: ${errorMessage}`);
                    return;
                }

                // Auto-reset after 3 seconds
                setTimeout(() => {
                    setButtonState(undefined);
                    setDebugInfo('');
                }, 3000);
            } else {
                // Payment failed, cancelled, or invalid result
                console.error('❌ Payment failed or cancelled:', result);
                console.error('❌ Payload details:', JSON.stringify(result.finalPayload, null, 2));

                const failureReason = result.finalPayload?.status || 'cancelled';
                const isSelfPayment = winnerAddress.toLowerCase() === selectedAdminWallet.toLowerCase();

                let errorDetails = `Payment ${failureReason}`;
                if (!isSelfPayment) {
                    errorDetails += ` (to other wallet)`;
                    setDebugInfo(`❌ Failed: Cannot pay to ${username}. Reason: ${failureReason}`);
                } else {
                    setDebugInfo(`❌ Failed: Self-payment failed. Reason: ${failureReason}`);
                }

                throw new Error(`${errorDetails}: User cancelled or payment failed`);
            }

        } catch (error) {
            console.error('❌ Payout error:', error);
            console.error('❌ Error details:', JSON.stringify(error, null, 2));

//             const isSelfPayment = winnerAddress.toLowerCase() === selectedAdminWallet.toLowerCase();
            setButtonState('failed');

            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            onPaymentError(winnerAddress, errorMessage);

            // Auto-reset after 3 seconds
            setTimeout(() => {
                setButtonState(undefined);
                setDebugInfo('');
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
            {debugInfo && (
                <p className="text-xs text-yellow-300 mt-1 font-mono bg-black/20 px-2 py-1 rounded">
                    {debugInfo}
                </p>
            )}
            <p className="text-xs text-gray-400 mt-1">
                From: {selectedAdminWallet.slice(0, 6)}...{selectedAdminWallet.slice(-4)}
            </p>
        </div>
    );
};