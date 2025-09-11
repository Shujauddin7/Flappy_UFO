"use client";

import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

// Dynamic import to prevent SSR issues
const loadMiniKit = async () => {
    if (typeof window !== 'undefined') {
        try {
            const { MiniKit, Tokens, tokenToDecimals } = await import('@worldcoin/minikit-js');
            return { MiniKit, Tokens, tokenToDecimals };
        } catch (error) {
            console.warn('MiniKit not available:', error);
            return null;
        }
    }
    return null;
};

interface TournamentData {
    tournament_id: string;
    tournament_day: string;
    total_collected: number;
    participant_count: number;
    status: string;
    created_at: string;
}

interface Winner {
    rank: number;
    wallet_address: string;
    username: string;
    score: number;
    base_amount: number;
    guarantee_bonus: number;
    final_amount: number;
    payment_status: 'pending' | 'sent' | 'confirmed' | 'failed';
    transaction_id?: string;
}

interface PrizePoolData {
    base_amount: number;
    guarantee_amount: number;
    admin_fee: number;
    total_collected: number;
    guarantee_needed: boolean;
}

export default function AdminDashboard() {
    const { data: session } = useSession();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'overview' | 'payouts' | 'history'>('overview');
    const [currentTournament, setCurrentTournament] = useState<TournamentData | null>(null);
    const [winners, setWinners] = useState<Winner[]>([]);
    const [prizePool, setPrizePool] = useState<PrizePoolData | null>(null);
    const [loading, setLoading] = useState(false);
    const [payoutInProgress, setPayoutInProgress] = useState(false);

    // Check if user is admin
    const adminWallet = process.env.NEXT_PUBLIC_ADMIN_WALLET;
    const isAdmin = adminWallet && session?.user?.walletAddress === adminWallet;

    useEffect(() => {
        // Early returns to prevent unnecessary execution
        if (!session) return;

        // Security: Check admin wallet only (path obscurity through dynamic routing)
        if (!adminWallet) {
            console.error('Admin wallet not configured');
            router.push('/');
            return;
        }

        if (!isAdmin) {
            router.push('/');
            return;
        }

        const calculateBasePrize = (rank: number): number => {
            const prizeDistribution = [0.35, 0.25, 0.15, 0.10, 0.05, 0.03, 0.025, 0.02, 0.015, 0.01];
            return prizeDistribution[rank - 1] || 0;
        };

        const updateWinnersWithPrizePool = (baseAmount: number, guaranteeAmount: number) => {
            setWinners(prevWinners =>
                prevWinners.map(winner => {
                    const basePrize = winner.base_amount * baseAmount;
                    const guaranteeBonus = guaranteeAmount / 10; // Split guarantee equally among top 10
                    const finalAmount = basePrize + guaranteeBonus;

                    return {
                        ...winner,
                        guarantee_bonus: guaranteeBonus,
                        final_amount: finalAmount
                    };
                })
            );
        };

        const loadWinners = async (tournamentId: string) => {
            try {
                const response = await fetch(`/api/tournament/leaderboard-data?tournament_id=${tournamentId}`);
                if (response.ok) {
                    const leaderboard = await response.json();

                    // Calculate payouts for top 10
                    const winnersData = leaderboard.slice(0, 10).map((player: { wallet_address: string; username?: string; score: number }, index: number) => ({
                        rank: index + 1,
                        wallet_address: player.wallet_address,
                        username: player.username || `Player ${index + 1}`,
                        score: player.score,
                        base_amount: calculateBasePrize(index + 1),
                        guarantee_bonus: 0, // Will be calculated based on revenue
                        final_amount: 0, // Will be calculated
                        payment_status: 'pending' as const,
                        transaction_id: undefined
                    }));

                    setWinners(winnersData);
                } else {
                    console.warn('Failed to load winners:', response.status);
                }
            } catch (error) {
                console.error('Error loading winners:', error);
            }
        };

        const loadPrizePool = async (tournamentId: string) => {
            try {
                const response = await fetch(`/api/admin/tournament-analytics?tournament_id=${tournamentId}`);
                if (response.ok) {
                    const analytics = await response.json();

                    const totalCollected = analytics.total_collected || 0;
                    const adminFee = totalCollected * 0.1; // 10% admin fee
                    const baseAmount = totalCollected - adminFee;

                    // Check if guarantee is needed (revenue < 72 WLD = 7.2 WLD after admin fee)
                    const guaranteeNeeded = baseAmount < 7.2;
                    const guaranteeAmount = guaranteeNeeded ? (10 - baseAmount) : 0; // 1 WLD per top 10 winner

                    setPrizePool({
                        base_amount: baseAmount,
                        guarantee_amount: guaranteeAmount,
                        admin_fee: adminFee,
                        total_collected: totalCollected,
                        guarantee_needed: guaranteeNeeded
                    });

                    // Update winners with final amounts
                    updateWinnersWithPrizePool(baseAmount, guaranteeAmount);
                } else {
                    console.warn('Failed to load prize pool:', response.status);
                }
            } catch (error) {
                console.error('Error loading prize pool:', error);
            }
        };

        const loadCurrentTournament = async () => {
            setLoading(true);
            try {
                const response = await fetch('/api/tournament/current');
                if (response.ok) {
                    const data = await response.json();
                    const tournament = data.tournament; // API returns { tournament: {...} }

                    // Map the API response to our expected format
                    const mappedTournament = {
                        tournament_id: tournament.id,
                        tournament_day: tournament.tournament_day,
                        total_collected: tournament.total_collected,
                        participant_count: tournament.total_players,
                        status: tournament.is_active ? 'active' : 'ended',
                        created_at: tournament.created_at
                    };

                    setCurrentTournament(mappedTournament);

                    if (tournament?.id) {
                        await loadWinners(tournament.id);
                        await loadPrizePool(tournament.id);
                    }
                } else {
                    console.warn('Failed to load tournament:', response.status);
                }
            } catch (error) {
                console.error('Error loading tournament:', error);
            } finally {
                setLoading(false);
            }
        };

        loadCurrentTournament();
    }, [session, isAdmin, router, adminWallet]);

    const handlePayout = async (winnerAddress: string, amount: number, rank: number) => {
        setPayoutInProgress(true);

        try {
            // Load MiniKit dynamically
            const miniKitModules = await loadMiniKit();
            if (!miniKitModules) {
                throw new Error('MiniKit not available');
            }

            const { MiniKit, Tokens, tokenToDecimals } = miniKitModules;

            // Convert WLD to wei (18 decimals)
            const amountInWei = tokenToDecimals(amount, Tokens.WLD);

            const payload = {
                reference: `tournament_prize_rank_${rank}_${Date.now()}`,
                to: winnerAddress,
                tokens: [{
                    symbol: Tokens.WLD,
                    token_amount: amountInWei.toString()
                }],
                description: `Tournament Prize - Rank ${rank}`
            };

            console.log('Sending payment payload:', payload);

            const result = await MiniKit.commandsAsync.pay(payload);
            console.log('Payment result:', result);

            if (result.finalPayload) {
                // Update winner status
                setWinners(prevWinners =>
                    prevWinners.map(winner =>
                        winner.wallet_address === winnerAddress
                            ? { ...winner, payment_status: 'sent' as const, transaction_id: payload.reference }
                            : winner
                    )
                );

                alert(`Payment sent successfully to rank ${rank}!`);
            } else {
                throw new Error('Payment failed - no response payload');
            }
        } catch (error) {
            console.error('Payout error:', error);
            alert(`Payment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);

            // Update winner status to failed
            setWinners(prevWinners =>
                prevWinners.map(winner =>
                    winner.wallet_address === winnerAddress
                        ? { ...winner, payment_status: 'failed' as const }
                        : winner
                )
            );
        } finally {
            setPayoutInProgress(false);
        }
    };

    const handlePayoutAll = async () => {
        setPayoutInProgress(true);

        for (const winner of winners) {
            if (winner.payment_status === 'pending' && winner.final_amount > 0) {
                await handlePayout(winner.wallet_address, winner.final_amount, winner.rank);
                // Add delay between payments to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        setPayoutInProgress(false);
    };

    if (!session) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
                <div className="text-white text-xl">Please sign in to access admin panel</div>
            </div>
        );
    }

    if (!adminWallet) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
                <div className="text-white text-xl">Admin configuration error. Please contact support.</div>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
                <div className="text-white text-xl">Access denied. Admin privileges required.</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-indigo-900 via-purple-900 to-pink-900 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-4xl font-bold text-white">Admin Dashboard</h1>
                    <button
                        onClick={() => signOut()}
                        className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg transition-colors"
                    >
                        Sign Out
                    </button>
                </div>

                {/* Navigation Tabs */}
                <div className="flex space-x-4 mb-8">
                    {(['overview', 'payouts', 'history'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${activeTab === tab
                                ? 'bg-white text-purple-900'
                                : 'bg-purple-800 text-white hover:bg-purple-700'
                                }`}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>

                {loading && (
                    <div className="text-center text-white text-xl mb-8">
                        Loading tournament data...
                    </div>
                )}

                {/* Overview Tab */}
                {activeTab === 'overview' && currentTournament && (
                    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 mb-8">
                        <h2 className="text-2xl font-bold text-white mb-6">Tournament Overview</h2>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white/20 rounded-lg p-4">
                                <h3 className="text-lg font-semibold text-white mb-2">Tournament Status</h3>
                                <p className="text-2xl font-bold text-green-400">{currentTournament.status}</p>
                                <p className="text-sm text-gray-300">Day: {currentTournament.tournament_day}</p>
                            </div>

                            <div className="bg-white/20 rounded-lg p-4">
                                <h3 className="text-lg font-semibold text-white mb-2">Participants</h3>
                                <p className="text-2xl font-bold text-blue-400">{currentTournament.participant_count}</p>
                                <p className="text-sm text-gray-300">Total players</p>
                            </div>

                            <div className="bg-white/20 rounded-lg p-4">
                                <h3 className="text-lg font-semibold text-white mb-2">Revenue</h3>
                                <p className="text-2xl font-bold text-yellow-400">{currentTournament.total_collected.toFixed(2)} WLD</p>
                                <p className="text-sm text-gray-300">Total collected</p>
                            </div>
                        </div>

                        {prizePool && (
                            <div className="mt-6 bg-white/20 rounded-lg p-4">
                                <h3 className="text-lg font-semibold text-white mb-4">Prize Pool Breakdown</h3>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                                    <div>
                                        <p className="text-gray-300">Base Prize Pool</p>
                                        <p className="text-xl font-bold text-green-400">{prizePool.base_amount.toFixed(2)} WLD</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-300">Admin Fee (10%)</p>
                                        <p className="text-xl font-bold text-orange-400">{prizePool.admin_fee.toFixed(2)} WLD</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-300">Guarantee Bonus</p>
                                        <p className="text-xl font-bold text-purple-400">{prizePool.guarantee_amount.toFixed(2)} WLD</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-300">Total Payout</p>
                                        <p className="text-xl font-bold text-yellow-400">{(prizePool.base_amount + prizePool.guarantee_amount).toFixed(2)} WLD</p>
                                    </div>
                                </div>
                                {prizePool.guarantee_needed && (
                                    <div className="mt-4 p-3 bg-yellow-500/20 border border-yellow-500/50 rounded-lg">
                                        <p className="text-yellow-300 font-semibold">⚠️ Guarantee Bonus Active</p>
                                        <p className="text-sm text-yellow-200">Revenue below 72 WLD threshold. Adding 1 WLD guarantee per top 10 winner.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Payouts Tab */}
                {activeTab === 'payouts' && (
                    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-white">Tournament Payouts</h2>
                            <button
                                onClick={handlePayoutAll}
                                disabled={payoutInProgress || winners.every(w => w.payment_status !== 'pending')}
                                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-6 py-2 rounded-lg transition-colors"
                            >
                                {payoutInProgress ? 'Processing...' : 'Payout All Pending'}
                            </button>
                        </div>

                        {winners.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-white">
                                    <thead>
                                        <tr className="border-b border-white/20">
                                            <th className="text-left py-3 px-4">Rank</th>
                                            <th className="text-left py-3 px-4">Player</th>
                                            <th className="text-left py-3 px-4">Score</th>
                                            <th className="text-left py-3 px-4">Base Prize</th>
                                            <th className="text-left py-3 px-4">Guarantee Bonus</th>
                                            <th className="text-left py-3 px-4">Final Amount</th>
                                            <th className="text-left py-3 px-4">Status</th>
                                            <th className="text-left py-3 px-4">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {winners.map((winner) => (
                                            <tr key={winner.rank} className="border-b border-white/10">
                                                <td className="py-3 px-4 font-bold">#{winner.rank}</td>
                                                <td className="py-3 px-4">
                                                    <div>
                                                        <p className="font-semibold">{winner.username}</p>
                                                        <p className="text-xs text-gray-400 font-mono">
                                                            {winner.wallet_address.slice(0, 6)}...{winner.wallet_address.slice(-4)}
                                                        </p>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">{winner.score.toLocaleString()}</td>
                                                <td className="py-3 px-4">{(winner.final_amount - winner.guarantee_bonus).toFixed(4)} WLD</td>
                                                <td className="py-3 px-4">{winner.guarantee_bonus.toFixed(4)} WLD</td>
                                                <td className="py-3 px-4 font-bold text-yellow-400">{winner.final_amount.toFixed(4)} WLD</td>
                                                <td className="py-3 px-4">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${winner.payment_status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' :
                                                        winner.payment_status === 'sent' ? 'bg-blue-500/20 text-blue-300' :
                                                            winner.payment_status === 'confirmed' ? 'bg-green-500/20 text-green-300' :
                                                                'bg-red-500/20 text-red-300'
                                                        }`}>
                                                        {winner.payment_status}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    {winner.payment_status === 'pending' && (
                                                        <button
                                                            onClick={() => handlePayout(winner.wallet_address, winner.final_amount, winner.rank)}
                                                            disabled={payoutInProgress}
                                                            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white px-4 py-1 rounded text-sm transition-colors"
                                                        >
                                                            Pay
                                                        </button>
                                                    )}
                                                    {winner.transaction_id && (
                                                        <p className="text-xs text-gray-400 mt-1 font-mono">
                                                            TX: {winner.transaction_id.slice(0, 8)}...
                                                        </p>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center text-gray-400 py-8">
                                No tournament data available for payouts
                            </div>
                        )}
                    </div>
                )}

                {/* History Tab */}
                {activeTab === 'history' && (
                    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
                        <h2 className="text-2xl font-bold text-white mb-6">Tournament History</h2>
                        <div className="text-center text-gray-400 py-8">
                            Tournament history feature coming soon...
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
