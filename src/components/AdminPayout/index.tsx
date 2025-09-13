'use client';
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
    // rank, // Used for display and logging
    // username, // Used for logging  
    selectedAdminWallet,
    // tournamentId, // Used for API calls
    // finalScore, // Used for API calls
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
            // Simple test - just simulate success after 2 seconds
            setTimeout(() => {
                setButtonState('success');
                onPaymentSuccess(winnerAddress, 'test-tx-' + Date.now());

                // Reset after 3 seconds
                setTimeout(() => {
                    setButtonState(undefined);
                }, 3000);
            }, 2000);
        } catch (error) {
            console.error('❌ Payout error:', error);
            setButtonState('failed');

            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            onPaymentError(winnerAddress, errorMessage);

            // Reset after 3 seconds
            setTimeout(() => {
                setButtonState(undefined);
            }, 3000);
        }
    };

    return (
        <div>
            <button
                onClick={handlePayout}
                disabled={buttonState === 'pending' || disabled}
                className={`px-4 py-1 rounded text-sm transition-colors ${buttonState === 'pending'
                        ? 'bg-yellow-600 text-white cursor-not-allowed'
                        : buttonState === 'success'
                            ? 'bg-green-600 text-white'
                            : buttonState === 'failed'
                                ? 'bg-red-600 text-white'
                                : 'bg-purple-600 hover:bg-purple-700 text-white'
                    }`}
            >
                {buttonState === 'pending' ? 'Processing...' :
                    buttonState === 'success' ? 'Payment sent!' :
                        buttonState === 'failed' ? 'Failed - Try again' :
                            `Pay ${amount.toFixed(4)} WLD`}
            </button>
            <p className="text-xs text-gray-400 mt-1">
                From: {selectedAdminWallet.slice(0, 6)}...{selectedAdminWallet.slice(-4)}
            </p>
        </div>
    );
};
