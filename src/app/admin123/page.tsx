"use client";

import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { MiniKit, Tokens, tokenToDecimals } from '@worldcoin/minikit-js';

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
    const isAdmin = session?.user?.walletAddress === process.env.NEXT_PUBLIC_ADMIN_WALLET;

    useEffect(() => {
        if (isAdmin) {
            loadCurrentTournament();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAdmin]);

    const loadCurrentTournament = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/tournament/current');
            const data = await response.json();

            if (data.tournament) {
                setCurrentTournament(data.tournament);
                await loadPrizeData(data.tournament.tournament_day);
                await loadWinners(data.tournament.tournament_day);
            }
        } catch (error) {
            console.error('Error loading tournament:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadPrizeData = async (tournamentDay: string) => {
        try {
            const response = await fetch(`/api/tournament/dynamic-prizes?tournament_day=${tournamentDay}`);
            const data = await response.json();
            setPrizePool(data.prize_pool);
        } catch (error) {
            console.error('Error loading prize data:', error);
        }
    };

    const loadWinners = async (tournamentDay: string) => {
        try {
            const response = await fetch(`/api/tournament/leaderboard-data?tournament_day=${tournamentDay}`);
            const data = await response.json();

            if (data.success && data.leaderboard) {
                // Get top 10 and calculate prize amounts
                const top10 = data.leaderboard.slice(0, 10);
                const prizeResponse = await fetch(`/api/tournament/dynamic-prizes?tournament_day=${tournamentDay}`);
                const prizeData = await prizeResponse.json();

                const percentages = [40, 22, 14, 6, 5, 4, 3, 2, 2, 2]; // Top 10 percentages

                const winnersWithPrizes = top10.map((player: { wallet_address: string; username?: string; best_score: number }, index: number) => ({
                    rank: index + 1,
                    wallet_address: player.wallet_address,
                    username: player.username || 'Anonymous',
                    score: player.best_score,
                    base_amount: (prizeData.prize_pool.base_amount * percentages[index]) / 100,
                    guarantee_bonus: prizeData.prize_pool.guarantee_needed ? 1 : 0,
                    final_amount: ((prizeData.prize_pool.base_amount * percentages[index]) / 100) + (prizeData.prize_pool.guarantee_needed ? 1 : 0),
                    payment_status: 'pending' as const
                }));

                setWinners(winnersWithPrizes);
            }
        } catch (error) {
            console.error('Error loading winners:', error);
        }
    };

    const handleCreateTournament = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/tournament/trigger-now', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const result = await response.json();

            if (response.ok) {
                alert('✅ Tournament created successfully!');
                await loadCurrentTournament();
            } else {
                alert('❌ Failed to create tournament: ' + (result.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Tournament creation error:', error);
            alert('❌ Error creating tournament: ' + (error instanceof Error ? error.message : 'Unknown error'));
        } finally {
            setLoading(false);
        }
    };

    const handleSendPayout = async (winner: Winner) => {
        try {
            setPayoutInProgress(true);

            // Update status to sending
            setWinners(prev => prev.map(w =>
                w.wallet_address === winner.wallet_address
                    ? { ...w, payment_status: 'sent' }
                    : w
            ));

            // Generate payment reference
            const reference = `flappy-ufo-prize-rank-${winner.rank}-${Date.now()}`;

            // Use MiniKit to send payment
            const result = await MiniKit.commandsAsync.pay({
                reference: reference,
                to: winner.wallet_address,
                tokens: [
                    {
                        symbol: Tokens.WLD,
                        token_amount: tokenToDecimals(winner.final_amount, Tokens.WLD).toString(),
                    },
                ],
                description: `Flappy UFO Tournament Prize - Rank ${winner.rank}`,
            });

            if (result.finalPayload.status === 'success') {
                // Update status to confirmed
                setWinners(prev => prev.map(w =>
                    w.wallet_address === winner.wallet_address
                        ? { ...w, payment_status: 'confirmed', transaction_id: reference }
                        : w
                ));
                alert(`✅ Payment sent successfully to ${winner.username}!`);
            } else {
                throw new Error('Transaction failed');
            }
        } catch (error) {
            console.error('Payment error:', error);
            // Update status to failed
            setWinners(prev => prev.map(w =>
                w.wallet_address === winner.wallet_address
                    ? { ...w, payment_status: 'failed' }
                    : w
            ));
            alert(`❌ Payment failed for ${winner.username}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setPayoutInProgress(false);
        }
    };

    const handleProcessAllPayouts = async () => {
        const pendingWinners = winners.filter(w => w.payment_status === 'pending' || w.payment_status === 'failed');

        if (pendingWinners.length === 0) {
            alert('No pending payments to process.');
            return;
        }

        const confirm = window.confirm(
            `Process ${pendingWinners.length} payments?\n\nThis will require manual confirmation for each payment in World App.`
        );

        if (!confirm) return;

        for (const winner of pendingWinners) {
            await handleSendPayout(winner);
            // Add small delay between payments
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    };

    if (!isAdmin) {
        return (
            <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-gray-800 rounded-lg p-6 text-center">
                    <h1 className="text-2xl font-bold mb-4">🔒 Access Denied</h1>
                    <p className="text-gray-300 mb-4">This page is restricted to admin users only.</p>
                    <button
                        onClick={() => router.push('/')}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold transition-all duration-200"
                    >
                        🏠 Go to Home
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white p-4">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="bg-gray-800 rounded-lg p-6 mb-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-3xl font-bold text-blue-400">🛸 Flappy UFO Admin</h1>
                            <p className="text-gray-300">Tournament Management & Payout System</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-gray-400">Admin Wallet:</p>
                            <p className="text-xs font-mono text-blue-400">{session?.user?.walletAddress}</p>
                            <button
                                onClick={() => signOut({ redirect: false }).then(() => router.push('/'))}
                                className="mt-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm"
                            >
                                Sign Out
                            </button>
                        </div>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="bg-gray-800 rounded-lg mb-6">
                    <div className="flex border-b border-gray-700">
                        {[
                            { id: 'overview', label: '📊 Overview', icon: '📊' },
                            { id: 'payouts', label: '💰 Payouts', icon: '💰' },
                            { id: 'history', label: '📋 History', icon: '📋' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as 'overview' | 'payouts' | 'history')}
                                className={`px-6 py-4 font-medium transition-all duration-200 ${activeTab === tab.id
                                        ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-900/20'
                                        : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Overview Tab */}
                {activeTab === 'overview' && (
                    <div className="space-y-6">
                        {/* Current Tournament Status */}
                        <div className="bg-gray-800 rounded-lg p-6">
                            <h2 className="text-xl font-bold mb-4 text-blue-400">🏆 Current Tournament</h2>
                            {loading ? (
                                <p className="text-gray-400">Loading tournament data...</p>
                            ) : currentTournament ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div className="bg-blue-900/30 p-4 rounded-lg border border-blue-500/30">
                                        <p className="text-blue-300 text-sm">Tournament Day</p>
                                        <p className="text-white font-bold">{currentTournament.tournament_day}</p>
                                    </div>
                                    <div className="bg-green-900/30 p-4 rounded-lg border border-green-500/30">
                                        <p className="text-green-300 text-sm">Participants</p>
                                        <p className="text-white font-bold">{currentTournament.participant_count}</p>
                                    </div>
                                    <div className="bg-yellow-900/30 p-4 rounded-lg border border-yellow-500/30">
                                        <p className="text-yellow-300 text-sm">Total Collected</p>
                                        <p className="text-white font-bold">{currentTournament.total_collected} WLD</p>
                                    </div>
                                    <div className="bg-purple-900/30 p-4 rounded-lg border border-purple-500/30">
                                        <p className="text-purple-300 text-sm">Status</p>
                                        <p className="text-white font-bold capitalize">{currentTournament.status}</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <p className="text-gray-400 mb-4">No active tournament found</p>
                                    <button
                                        onClick={handleCreateTournament}
                                        disabled={loading}
                                        className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-bold transition-all duration-200"
                                    >
                                        {loading ? 'Creating...' : '🚀 Create Tournament'}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Prize Pool Breakdown */}
                        {prizePool && (
                            <div className="bg-gray-800 rounded-lg p-6">
                                <h2 className="text-xl font-bold mb-4 text-blue-400">💰 Prize Pool Breakdown</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div className="bg-blue-900/30 p-4 rounded-lg border border-blue-500/30">
                                        <p className="text-blue-300 text-sm">Base Prize Pool (70%)</p>
                                        <p className="text-white font-bold">{prizePool.base_amount.toFixed(2)} WLD</p>
                                    </div>
                                    <div className="bg-green-900/30 p-4 rounded-lg border border-green-500/30">
                                        <p className="text-green-300 text-sm">Guarantee Bonus</p>
                                        <p className="text-white font-bold">{prizePool.guarantee_amount.toFixed(2)} WLD</p>
                                    </div>
                                    <div className="bg-yellow-900/30 p-4 rounded-lg border border-yellow-500/30">
                                        <p className="text-yellow-300 text-sm">Admin Fee (30%)</p>
                                        <p className="text-white font-bold">{prizePool.admin_fee.toFixed(2)} WLD</p>
                                    </div>
                                    <div className="bg-purple-900/30 p-4 rounded-lg border border-purple-500/30">
                                        <p className="text-purple-300 text-sm">Total to Pay Out</p>
                                        <p className="text-white font-bold">{(prizePool.base_amount + prizePool.guarantee_amount).toFixed(2)} WLD</p>
                                    </div>
                                </div>
                                {prizePool.guarantee_needed && (
                                    <div className="mt-4 bg-orange-900/30 p-4 rounded-lg border border-orange-500/30">
                                        <p className="text-orange-300 text-sm">⚠️ Guarantee Active</p>
                                        <p className="text-white">Each top 10 winner gets +1 WLD bonus (total collected &lt; 72 WLD)</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Quick Actions */}
                        <div className="bg-gray-800 rounded-lg p-6">
                            <h2 className="text-xl font-bold mb-4 text-blue-400">⚡ Quick Actions</h2>
                            <div className="flex flex-wrap gap-4">
                                <button
                                    onClick={handleCreateTournament}
                                    disabled={loading}
                                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-bold transition-all duration-200"
                                >
                                    {loading ? 'Creating...' : '🚀 Create Tournament'}
                                </button>
                                <button
                                    onClick={() => setActiveTab('payouts')}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold transition-all duration-200"
                                >
                                    💰 Manage Payouts
                                </button>
                                <button
                                    onClick={loadCurrentTournament}
                                    disabled={loading}
                                    className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-bold transition-all duration-200"
                                >
                                    {loading ? 'Refreshing...' : '🔄 Refresh Data'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Payouts Tab */}
                {activeTab === 'payouts' && (
                    <div className="space-y-6">
                        <div className="bg-gray-800 rounded-lg p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-blue-400">💰 Tournament Payouts</h2>
                                <button
                                    onClick={handleProcessAllPayouts}
                                    disabled={payoutInProgress || winners.length === 0}
                                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-bold transition-all duration-200"
                                >
                                    {payoutInProgress ? 'Processing...' : '💸 Process All Payouts'}
                                </button>
                            </div>

                            {winners.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="border-b border-gray-700">
                                                <th className="p-3 text-blue-300">Rank</th>
                                                <th className="p-3 text-blue-300">Player</th>
                                                <th className="p-3 text-blue-300">Score</th>
                                                <th className="p-3 text-blue-300">Base Prize</th>
                                                <th className="p-3 text-blue-300">Guarantee</th>
                                                <th className="p-3 text-blue-300">Total</th>
                                                <th className="p-3 text-blue-300">Status</th>
                                                <th className="p-3 text-blue-300">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {winners.map((winner) => (
                                                <tr key={winner.wallet_address} className="border-b border-gray-700 hover:bg-gray-700/50">
                                                    <td className="p-3 font-bold text-yellow-400">#{winner.rank}</td>
                                                    <td className="p-3">
                                                        <div>
                                                            <p className="font-medium">{winner.username}</p>
                                                            <p className="text-xs text-gray-400 font-mono">{winner.wallet_address.slice(0, 8)}...{winner.wallet_address.slice(-6)}</p>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 font-bold">{winner.score}</td>
                                                    <td className="p-3">{winner.base_amount.toFixed(2)} WLD</td>
                                                    <td className="p-3">
                                                        {winner.guarantee_bonus > 0 ? (
                                                            <span className="text-green-400">+{winner.guarantee_bonus} WLD</span>
                                                        ) : (
                                                            <span className="text-gray-500">-</span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 font-bold text-green-400">{winner.final_amount.toFixed(2)} WLD</td>
                                                    <td className="p-3">
                                                        <span className={`px-2 py-1 rounded text-xs font-medium ${winner.payment_status === 'confirmed' ? 'bg-green-900/50 text-green-300' :
                                                                winner.payment_status === 'sent' ? 'bg-blue-900/50 text-blue-300' :
                                                                    winner.payment_status === 'failed' ? 'bg-red-900/50 text-red-300' :
                                                                        'bg-yellow-900/50 text-yellow-300'
                                                            }`}>
                                                            {winner.payment_status}
                                                        </span>
                                                    </td>
                                                    <td className="p-3">
                                                        <button
                                                            onClick={() => handleSendPayout(winner)}
                                                            disabled={payoutInProgress || winner.payment_status === 'confirmed'}
                                                            className={`px-4 py-2 rounded text-sm font-medium transition-all duration-200 ${winner.payment_status === 'confirmed'
                                                                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                                                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                                                                }`}
                                                        >
                                                            {winner.payment_status === 'confirmed' ? '✅ Paid' : '💸 Send Payment'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <p className="text-gray-400">No winners found for current tournament</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* History Tab */}
                {activeTab === 'history' && (
                    <div className="space-y-6">
                        <div className="bg-gray-800 rounded-lg p-6">
                            <h2 className="text-xl font-bold mb-4 text-blue-400">📋 Tournament History</h2>
                            <p className="text-gray-400">Tournament history feature coming soon...</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
