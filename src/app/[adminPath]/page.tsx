"use client";

import { signOut, useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { resetCoins } from '@/utils/coins';
import { AdminPasswordAuth } from '@/components/AdminPasswordAuth';

// Import AdminPayout as dynamic component to prevent SSR issues with MiniKit
const AdminPayout = dynamic(() => import('@/components/AdminPayout').then(mod => ({ default: mod.AdminPayout })), {
    ssr: false,
    loading: () => <div className="text-xs text-gray-400">Loading payout...</div>
});

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
    const params = useParams();
    const [activeTab, setActiveTab] = useState<'overview' | 'payouts' | 'history'>('overview');
    const [tournamentView, setTournamentView] = useState<'current' | 'previous'>('current');
    const [currentTournament, setCurrentTournament] = useState<TournamentData | null>(null);
    const [previousTournament, setPreviousTournament] = useState<TournamentData | null>(null);
    const [winners, setWinners] = useState<Winner[]>([]);
    const [previousWinners, setPreviousWinners] = useState<Winner[]>([]); // Used for previous tournament view
    const displayedWinners = tournamentView === 'current' ? winners : previousWinners;
    const [prizePool, setPrizePool] = useState<PrizePoolData | null>(null);
    const [previousPrizePool, setPreviousPrizePool] = useState<PrizePoolData | null>(null);
    const [loading, setLoading] = useState(false);
    const [isValidAdminPath, setIsValidAdminPath] = useState(false);
    const [selectedAdminWallet, setSelectedAdminWallet] = useState<string>('');

    // Password authentication state (no session storage)
    const [isPasswordAuthenticated, setIsPasswordAuthenticated] = useState(false);

    // Multi-admin wallet system
    const primaryAdminWallet = process.env.NEXT_PUBLIC_ADMIN_WALLET;
    const backupAdminWallet = process.env.NEXT_PUBLIC_BACKUP_ADMIN_WALLET;

    // Get all valid admin wallets (filter out undefined)
    const validAdminWallets = [primaryAdminWallet, backupAdminWallet].filter(Boolean) as string[];

    // Check if user is any valid admin (wallet auth)
    const currentUserWallet = session?.user?.walletAddress;
    const isWalletAdmin = currentUserWallet && validAdminWallets.includes(currentUserWallet);



    // Combined admin check - either wallet or password
    const isAdmin = isWalletAdmin || isPasswordAuthenticated;

    // Set default selected admin wallet
    useEffect(() => {
        if (isWalletAdmin && currentUserWallet && !selectedAdminWallet) {
            setSelectedAdminWallet(currentUserWallet);
        } else if (isPasswordAuthenticated && primaryAdminWallet && !selectedAdminWallet) {
            setSelectedAdminWallet(primaryAdminWallet);
        }
    }, [isWalletAdmin, currentUserWallet, selectedAdminWallet, isPasswordAuthenticated, primaryAdminWallet]);

    // Password authentication handler
    const handlePasswordAuthSuccess = () => {
        setIsPasswordAuthenticated(true);
        // Use primary admin wallet for password auth
        if (primaryAdminWallet) {
            setSelectedAdminWallet(primaryAdminWallet);
        }
    };

    // Check if this is a valid admin path immediately
    useEffect(() => {
        const validAdminPath = process.env.NEXT_PUBLIC_ADMIN_PATH;
        const providedAdminPath = params.adminPath as string;

        // Check if the provided admin path matches the configured admin path
        if (validAdminPath && providedAdminPath === validAdminPath) {
            setIsValidAdminPath(true);
        } else {
            // Silently redirect without showing any admin content
            router.replace('/');
        }
    }, [router, params.adminPath]);

    useEffect(() => {
        // Early returns to prevent unnecessary execution
        // Allow execution for either session (World ID) OR password authentication
        if (!session && !isPasswordAuthenticated) return;
        if (!isValidAdminPath) return; // Don't execute admin logic for invalid paths

        // Security: Check admin wallet configuration (path obscurity through dynamic routing)
        if (validAdminWallets.length === 0) {
            console.error('No admin wallets configured');
            router.push('/');
            return;
        }

        if (!isAdmin) {
            // If no authentication method is active, show options
            if (!session && !isPasswordAuthenticated) {
                // Show authentication options (this will be handled in render)
                return;
            }

            // If user is signed in but not an admin wallet, redirect
            if (session && !isWalletAdmin && !isPasswordAuthenticated) {
                router.push('/');
                return;
            }
        }

        const calculateBasePrize = (rank: number): number => {
            // Plan.md percentages: 40%, 22%, 14%, 6%, 5%, 4%, 3%, 2%, 2%, 2%
            const prizeDistribution = [0.40, 0.22, 0.14, 0.06, 0.05, 0.04, 0.03, 0.02, 0.02, 0.02];
            return prizeDistribution[rank - 1] || 0;
        };

        const updateWinnersWithPrizePool = (baseAmount: number, guaranteeAmount: number) => {
            setWinners(prevWinners =>
                prevWinners.map(winner => {
                    const basePrize = winner.base_amount * baseAmount;
                    // Guarantee bonus: 1 WLD per top 10 winner (equally distributed)
                    const guaranteeBonus = guaranteeAmount > 0 ? 1.0 : 0.0;
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
                    const data = await response.json();
                    const leaderboard = data.players || data; // Handle both response formats

                    // Get already paid winners from prizes table
                    const paidResponse = await fetch(`/api/admin/paid-winners?tournament_id=${tournamentId}`);
                    const paidWinners = paidResponse.ok ? await paidResponse.json() : { winners: [] };

                    // Create a map for better lookup performance with transaction hashes
                    const paidWalletsMap = new Map<string, string>(
                        paidWinners.winners?.map((w: { wallet: string; transaction_hash: string }) =>
                            [w.wallet, w.transaction_hash || '']
                        ) || []
                    );

                    // Calculate payouts for top 10
                    const winnersData = leaderboard.slice(0, 10).map((player: { wallet?: string; wallet_address?: string; username?: string; highest_score?: number; score?: number }, index: number) => {
                        const walletAddress = player.wallet || player.wallet_address || '';
                        const transactionHash = paidWalletsMap.get(walletAddress);
                        const isPaid = Boolean(transactionHash);

                        return {
                            rank: index + 1,
                            wallet_address: walletAddress,
                            username: player.username || `Player ${index + 1}`,
                            score: player.highest_score || player.score,
                            base_amount: calculateBasePrize(index + 1),
                            guarantee_bonus: 0, // Will be calculated based on revenue
                            final_amount: 0, // Will be calculated
                            payment_status: isPaid ? ('sent' as const) : ('pending' as const),
                            transaction_id: transactionHash || undefined
                        };
                    });

                    setWinners(winnersData);
                } else {
                    console.warn('Failed to load winners:', response.status);
                }
            } catch (error) {
                console.error('Error loading winners:', error);
            }
        };

        const loadPrizePool = async (tournamentId: string, tournamentDay: string) => {
            try {
                const response = await fetch(`/api/admin/tournament-analytics?tournament_day=${tournamentDay}`);
                if (response.ok) {
                    const result = await response.json();
                    const analytics = result.data; // API returns { success: true, data: {...} }

                    const totalCollected = analytics.total_collected || 0;
                    const adminFee = analytics.admin_fee || 0;
                    const guaranteeAmount = analytics.guarantee_amount || 0;
                    const baseAmount = analytics.total_prize_pool || 0;

                    setPrizePool({
                        base_amount: baseAmount,
                        guarantee_amount: guaranteeAmount,
                        admin_fee: adminFee,
                        total_collected: totalCollected,
                        guarantee_needed: guaranteeAmount > 0
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
                        await loadPrizePool(tournament.id, tournament.tournament_day);
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
    }, [session, isAdmin, router, params?.adminPath, isValidAdminPath, validAdminWallets.length, isPasswordAuthenticated, isWalletAdmin]);

    // Early return if not a valid admin path - prevents any admin content from rendering
    if (!isValidAdminPath) {
        return null; // No admin content rendered for invalid paths
    }

    // Simple callback handlers for the AdminPayout component
    const handlePaymentSuccess = async (winnerAddress: string, transactionId: string) => {
        console.log('✅ Payment successful for:', winnerAddress);

        // Update winner status to sent immediately for UI feedback
        setWinners(prevWinners =>
            prevWinners.map(winner =>
                winner.wallet_address === winnerAddress
                    ? { ...winner, payment_status: 'sent' as const, transaction_id: transactionId }
                    : winner
            )
        );

        // Wait a moment for the database transaction to complete
        // The AdminPayout component saves to database before calling this callback,
        // but we need to ensure the transaction is committed before we reload
        console.log('⏳ Waiting for database transaction to complete...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Reload paid winners from database to ensure persistence
        if (currentTournament?.tournament_id) {
            console.log('🔄 Reloading payment status from database...');
            try {
                const paidResponse = await fetch(`/api/admin/paid-winners?tournament_id=${currentTournament.tournament_id}`);
                if (paidResponse.ok) {
                    const paidWinners = await paidResponse.json();
                    console.log('📊 Database reload result:', paidWinners);
                    const paidWalletsMap = new Map<string, string>(
                        paidWinners.winners?.map((w: { wallet: string; transaction_hash: string }) =>
                            [w.wallet, w.transaction_hash || '']
                        ) || []
                    );

                    // Update winners with persistent payment status from database
                    setWinners(prevWinners =>
                        prevWinners.map((winner): Winner => {
                            const transactionHash = paidWalletsMap.get(winner.wallet_address);
                            if (transactionHash) {
                                console.log(`✅ Confirmed payment for ${winner.username}: ${transactionHash}`);
                                return { ...winner, payment_status: 'sent' as const, transaction_id: transactionHash };
                            }
                            return winner;
                        })
                    );
                } else {
                    console.warn('Failed to reload payment status:', paidResponse.status);
                }
            } catch (error) {
                console.error('Failed to reload payment status from database:', error);
            }
        }
    };

    const handlePaymentError = (winnerAddress: string, error: string) => {
        console.log('❌ Payment failed for:', winnerAddress, error);

        // Update winner status to failed
        setWinners(prevWinners =>
            prevWinners.map(winner =>
                winner.wallet_address === winnerAddress
                    ? { ...winner, payment_status: 'failed' as const }
                    : winner
            )
        );
    };

    // Load previous tournament data
    const handleLoadPreviousTournament = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/tournament/previous');
            if (response.ok) {
                const data = await response.json();
                const tournament = data.tournament;

                const mappedTournament = {
                    tournament_id: tournament.id,
                    tournament_day: tournament.tournament_day,
                    total_collected: tournament.total_collected,
                    participant_count: tournament.total_players,
                    status: 'ended',
                    created_at: tournament.created_at
                };

                setPreviousTournament(mappedTournament);

                // Calculate base prize percentages
                const calculateBasePrize = (rank: number): number => {
                    const prizeDistribution = [0.40, 0.22, 0.14, 0.06, 0.05, 0.04, 0.03, 0.02, 0.02, 0.02];
                    return prizeDistribution[rank - 1] || 0;
                };

                if (tournament?.id) {
                    const leaderboardResponse = await fetch(`/api/tournament/leaderboard-data?tournament_id=${tournament.id}`);
                    if (leaderboardResponse.ok) {
                        const leaderboardData = await leaderboardResponse.json();
                        const leaderboard = leaderboardData.players || leaderboardData;

                        const paidResponse = await fetch(`/api/admin/paid-winners?tournament_id=${tournament.id}`);
                        const paidWinners = paidResponse.ok ? await paidResponse.json() : { winners: [] };

                        const paidWalletsMap = new Map<string, string>(
                            paidWinners.winners?.map((w: { wallet: string; transaction_hash: string }) =>
                                [w.wallet, w.transaction_hash || '']
                            ) || []
                        );

                        const winnersData = leaderboard.slice(0, 10).map((player: { wallet?: string; wallet_address?: string; username?: string; highest_score?: number; score?: number }, index: number) => {
                            const walletAddress = player.wallet || player.wallet_address || '';
                            const transactionHash = paidWalletsMap.get(walletAddress);
                            const isPaid = Boolean(transactionHash);

                            return {
                                rank: index + 1,
                                wallet_address: walletAddress,
                                username: player.username || `Player ${index + 1}`,
                                score: player.highest_score || player.score,
                                base_amount: calculateBasePrize(index + 1),
                                guarantee_bonus: 0,
                                final_amount: 0,
                                payment_status: isPaid ? ('sent' as const) : ('pending' as const),
                                transaction_id: transactionHash || undefined
                            };
                        });

                        setPreviousWinners(winnersData);

                        const analyticsResponse = await fetch(`/api/admin/tournament-analytics?tournament_day=${tournament.tournament_day}`);
                        if (analyticsResponse.ok) {
                            const result = await analyticsResponse.json();
                            const analytics = result.data;

                            const totalCollected = analytics.total_collected || 0;
                            const adminFee = analytics.admin_fee || 0;
                            const guaranteeAmount = analytics.guarantee_amount || 0;
                            const baseAmount = analytics.total_prize_pool || 0;

                            setPreviousPrizePool({
                                base_amount: baseAmount,
                                guarantee_amount: guaranteeAmount,
                                admin_fee: adminFee,
                                total_collected: totalCollected,
                                guarantee_needed: guaranteeAmount > 0
                            });

                            setPreviousWinners(prev =>
                                prev.map(winner => {
                                    const basePrize = winner.base_amount * baseAmount;
                                    const guaranteeBonus = guaranteeAmount > 0 ? 1.0 : 0.0;
                                    const finalAmount = basePrize + guaranteeBonus;

                                    return {
                                        ...winner,
                                        guarantee_bonus: guaranteeBonus,
                                        final_amount: finalAmount
                                    };
                                })
                            );
                        }
                    }
                }
            } else {
                console.warn('No previous tournament found');
                setPreviousTournament(null);
                setPreviousWinners([]);
            }
        } catch (error) {
            console.error('Error loading previous tournament:', error);
        } finally {
            setLoading(false);
        }
    };

    // Force refresh payment status from database (for troubleshooting)
    const forceRefreshPaymentStatus = async () => {
        if (!currentTournament?.tournament_id) return;

        console.log('🔄 Force refreshing payment status from database...');
        setLoading(true);

        try {
            const paidResponse = await fetch(`/api/admin/paid-winners?tournament_id=${currentTournament.tournament_id}`);
            if (paidResponse.ok) {
                const paidWinners = await paidResponse.json();
                console.log('📊 Database payment status:', paidWinners);

                const paidWalletsMap = new Map<string, string>(
                    paidWinners.winners?.map((w: { wallet: string; transaction_hash: string }) =>
                        [w.wallet, w.transaction_hash || '']
                    ) || []
                );

                // Update winners with persistent payment status from database
                setWinners(prevWinners =>
                    prevWinners.map((winner): Winner => {
                        const transactionHash = paidWalletsMap.get(winner.wallet_address);
                        if (transactionHash) {
                            console.log(`✅ ${winner.username} (${winner.wallet_address}) - PAID in database`);
                            return { ...winner, payment_status: 'sent' as const, transaction_id: transactionHash };
                        } else {
                            console.log(`⏳ ${winner.username} (${winner.wallet_address}) - PENDING in database`);
                            return { ...winner, payment_status: 'pending' as const, transaction_id: undefined };
                        }
                    })
                );
            }
        } catch (error) {
            console.error('Failed to refresh payment status:', error);
        } finally {
            setLoading(false);
        }
    };

    // Don't render anything until we've verified this is a valid admin path
    if (!isValidAdminPath) {
        return null; // Return nothing instead of showing admin content
    }

    // Show authentication options if no valid session exists
    if (!session && !isPasswordAuthenticated) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                    <div className="bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-700">
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-purple-600 rounded-full mx-auto mb-4 flex items-center justify-center">
                                <span className="text-2xl">🛸</span>
                            </div>
                            <h1 className="text-2xl font-bold text-white mb-2">
                                Flappy UFO Admin
                            </h1>
                            <p className="text-gray-400">
                                Sign in to access admin dashboard
                            </p>
                        </div>

                        {/* Default: Sign in with World ID */}
                        <div className="mb-6">
                            <button
                                onClick={() => window.location.href = '/api/auth/signin'}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-medium transition-colors mb-4"
                            >
                                Sign in with World ID
                            </button>
                        </div>

                        {/* Password Authentication */}
                        <div className="border-t border-gray-600 pt-6">
                            <AdminPasswordAuth
                                onSuccess={handlePasswordAuthSuccess}
                            />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // This condition is now handled above - password auth users don't need session
    // Removed: if (!session) check because password authentication is valid without session

    if (validAdminWallets.length === 0) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
                <div className="text-white text-xl">Admin configuration error. Please contact support at flappyufo.help@gmail.com.</div>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center p-4">
                <div className="text-center">
                    <div className="bg-red-900/50 border border-red-600 rounded-lg p-6 mb-4">
                        <h2 className="text-red-200 text-xl font-bold mb-2">Access Denied</h2>
                        <p className="text-red-300">Admin privileges required.</p>
                        {session && !isWalletAdmin && (
                            <p className="text-red-300 mt-2 text-sm">
                                Your wallet ({currentUserWallet?.slice(0, 6)}...{currentUserWallet?.slice(-4)}) is not authorized.
                            </p>
                        )}
                    </div>

                    <div className="space-y-3">
                        <button
                            onClick={() => window.location.href = '/'}
                            className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                        >
                            Go Home
                        </button>

                        {session && (
                            <button
                                onClick={() => signOut()}
                                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium transition-colors ml-3"
                            >
                                Sign Out
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Logout function
    const handleLogout = () => {
        if (isPasswordAuthenticated) {
            // Just refresh page for password auth
            window.location.reload();
        } else {
            resetCoins(); // Reset practice mode coins on signout
            signOut();
        }
    };

    return (
        <div className="h-screen bg-gradient-to-b from-indigo-900 via-purple-900 to-pink-900 p-6 overflow-y-auto">
            <div className="max-w-7xl mx-auto pb-20">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-4xl font-bold text-white">Admin Dashboard</h1>
                        <div className="text-sm text-gray-300 mt-1 flex items-center gap-2">
                            {isWalletAdmin && (
                                <>
                                    <span className="bg-blue-600 px-2 py-1 rounded text-xs">📱 Wallet Auth</span>
                                    <span>Connected: {currentUserWallet?.slice(0, 6)}...{currentUserWallet?.slice(-4)}</span>
                                </>
                            )}
                            {isPasswordAuthenticated && (
                                <>
                                    <span className="bg-purple-600 px-2 py-1 rounded text-xs">💻 Password Auth</span>
                                    <span>Admin access active</span>
                                </>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg transition-colors"
                    >
                        Sign Out
                    </button>
                </div>

                {/* Admin Wallet Selection */}
                {validAdminWallets.length > 1 && (
                    <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-4 mb-6">
                        <h3 className="text-lg font-semibold text-white mb-3">🔐 Choose Admin Wallet</h3>
                        <div className="flex flex-wrap gap-3">
                            {validAdminWallets.map((wallet, index) => (
                                <button
                                    key={wallet}
                                    onClick={() => setSelectedAdminWallet(wallet)}
                                    className={`px-4 py-2 rounded-lg transition-colors font-mono text-sm ${selectedAdminWallet === wallet
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white/20 text-gray-300 hover:bg-white/30'
                                        }`}
                                >
                                    {index === 0 ? '👑 Primary' : '🔄 Backup'}: {wallet.slice(0, 6)}...{wallet.slice(-4)}
                                    {currentUserWallet === wallet && ' (You)'}
                                </button>
                            ))}
                        </div>
                        <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-3 mt-3">
                            <h4 className="text-sm font-semibold text-yellow-300 mb-2">⚠️ Important: World App Payment Restrictions</h4>
                            <ul className="text-xs text-yellow-200 space-y-1">
                                <li>• World App can only send payments from YOUR logged-in wallet</li>
                                <li>• You cannot send from a different &quot;admin wallet&quot; - MiniKit uses your authenticated wallet</li>
                                <li>• If you need to pay from a different wallet, log out and log back in with that wallet</li>
                                <li>• The &quot;admin wallet&quot; selection above is just for display - payments still come from you</li>
                            </ul>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">
                            💡 Switch wallets if your World App has pending transactions
                        </p>
                    </div>
                )}

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

                {/* Tournament View Toggle */}
                {(activeTab === 'overview' || activeTab === 'payouts') && (
                    <div className="bg-cyan-500/20 border border-cyan-500/50 rounded-lg p-4 mb-6">
                        <div className="flex items-center justify-between flex-wrap gap-4">
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-1">📅 Tournament Period</h3>
                                <p className="text-sm text-gray-300">
                                    {tournamentView === 'current' ? 'Viewing current active tournament' : 'Viewing previous tournament for payments'}
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setTournamentView('current')}
                                    className={`px-6 py-2 rounded-lg font-semibold transition-all ${tournamentView === 'current'
                                        ? 'bg-green-600 text-white shadow-lg scale-105'
                                        : 'bg-white/20 text-gray-300 hover:bg-white/30'
                                        }`}
                                >
                                    🟢 Current
                                </button>
                                <button
                                    onClick={() => {
                                        setTournamentView('previous');
                                        if (!previousTournament) {
                                            handleLoadPreviousTournament();
                                        }
                                    }}
                                    className={`px-6 py-2 rounded-lg font-semibold transition-all ${tournamentView === 'previous'
                                        ? 'bg-orange-600 text-white shadow-lg scale-105'
                                        : 'bg-white/20 text-gray-300 hover:bg-white/30'
                                        }`}
                                >
                                    🔴 Previous
                                </button>
                            </div>
                        </div>
                        {tournamentView === 'previous' && (
                            <div className="mt-3 bg-yellow-500/20 border border-yellow-500/50 rounded p-3">
                                <p className="text-sm text-yellow-200">
                                    ⚠️ <strong>Remember to pay winners!</strong> Previous tournament ended. Check if all winners have been paid below.
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {loading && (
                    <div className="text-center text-white text-xl mb-8">
                        Loading tournament data...
                    </div>
                )}

                {/* Overview Tab */}
                {activeTab === 'overview' && (
                    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 mb-8">
                        <h2 className="text-2xl font-bold text-white mb-6">Tournament Overview</h2>

                        {tournamentView === 'current' && currentTournament && (
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
                        )}

                        {tournamentView === 'previous' && previousTournament && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-white/20 rounded-lg p-4">
                                    <h3 className="text-lg font-semibold text-white mb-2">Tournament Status</h3>
                                    <p className="text-2xl font-bold text-gray-400">{previousTournament.status}</p>
                                    <p className="text-sm text-gray-300">Day: {previousTournament.tournament_day}</p>
                                </div>

                                <div className="bg-white/20 rounded-lg p-4">
                                    <h3 className="text-lg font-semibold text-white mb-2">Participants</h3>
                                    <p className="text-2xl font-bold text-blue-400">{previousTournament.participant_count}</p>
                                    <p className="text-sm text-gray-300">Total players</p>
                                </div>

                                <div className="bg-white/20 rounded-lg p-4">
                                    <h3 className="text-lg font-semibold text-white mb-2">Revenue</h3>
                                    <p className="text-2xl font-bold text-yellow-400">{previousTournament.total_collected.toFixed(2)} WLD</p>
                                    <p className="text-sm text-gray-300">Total collected</p>
                                </div>
                            </div>
                        )}

                        {(tournamentView === 'current' ? prizePool : previousPrizePool) && (
                            <div className="mt-6 bg-white/20 rounded-lg p-4">
                                <h3 className="text-lg font-semibold text-white mb-4">Prize Pool Breakdown</h3>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                                    <div>
                                        <p className="text-gray-300">Base Prize Pool</p>
                                        <p className="text-xl font-bold text-green-400">
                                            {(tournamentView === 'current' ? prizePool : previousPrizePool)?.base_amount.toFixed(2)} WLD
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-gray-300">Admin Fee (30%)</p>
                                        <p className="text-xl font-bold text-orange-400">
                                            {(tournamentView === 'current' ? prizePool : previousPrizePool)?.admin_fee.toFixed(2)} WLD
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-gray-300">Guarantee Bonus</p>
                                        <p className="text-xl font-bold text-purple-400">
                                            {(tournamentView === 'current' ? prizePool : previousPrizePool)?.guarantee_amount.toFixed(2)} WLD
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-gray-300">Total Payout</p>
                                        <p className="text-xl font-bold text-yellow-400">
                                            {((tournamentView === 'current' ? prizePool : previousPrizePool)!.base_amount +
                                                (tournamentView === 'current' ? prizePool : previousPrizePool)!.guarantee_amount).toFixed(2)} WLD
                                        </p>
                                    </div>
                                </div>
                                {(tournamentView === 'current' ? prizePool : previousPrizePool)?.guarantee_needed && (
                                    <div className="mt-4 p-3 bg-yellow-500/20 border border-yellow-500/50 rounded-lg">
                                        <p className="text-yellow-300 font-semibold">⚠️ Guarantee Bonus Active</p>
                                        <p className="text-sm text-yellow-200">Revenue below 72 WLD threshold. Adding 1 WLD guarantee per top 10 winner.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Tournament Schedule & Payout Timing */}
                        <div className="mt-6 bg-white/20 rounded-lg p-4">
                            <h3 className="text-lg font-semibold text-white mb-4">🕒 Tournament Schedule & Payouts</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <h4 className="text-md font-semibold text-blue-300">Tournament Timeline:</h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-gray-300">Start:</span>
                                            <span className="text-green-400">Monday 15:30 UTC</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-300">End:</span>
                                            <span className="text-red-400">Sunday 15:30 UTC</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-300">Duration:</span>
                                            <span className="text-white">7 days</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <h4 className="text-md font-semibold text-purple-300">Payout Process:</h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex items-center space-x-2">
                                            <span className="text-yellow-400">⏰</span>
                                            <span className="text-gray-300">Payouts available after tournament ends</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <span className="text-green-400">✅</span>
                                            <span className="text-gray-300">Process payouts via &ldquo;Payouts&rdquo; tab</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <span className="text-blue-400">💳</span>
                                            <span className="text-gray-300">Real WLD payments via World App</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-4 p-3 bg-blue-500/20 border border-blue-500/50 rounded-lg">
                                <p className="text-blue-300 font-semibold">💡 Admin Workflow</p>
                                <p className="text-sm text-blue-200">Wait for tournament to end → Go to &ldquo;Payouts&rdquo; tab → Review winners → Process payments</p>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="mt-6 bg-white/20 rounded-lg p-4">
                            <h3 className="text-lg font-semibold text-white mb-4">⚡ Quick Actions</h3>
                            <div className="flex flex-wrap gap-3">
                                <button
                                    onClick={() => setActiveTab('payouts')}
                                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
                                >
                                    <span>💰</span>
                                    <span>Process Payouts</span>
                                </button>
                                <button
                                    onClick={() => window.open('https://flappyufo-git-dev-shujauddin.vercel.app/leaderboard', '_blank')}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
                                >
                                    <span>🏆</span>
                                    <span>View Leaderboard</span>
                                </button>
                                <button
                                    onClick={() => window.open('https://flappyufo-git-dev-shujauddin.vercel.app/', '_blank')}
                                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
                                >
                                    <span>🎮</span>
                                    <span>View Game</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Payouts Tab */}
                {activeTab === 'payouts' && (
                    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-2xl font-bold text-white">Tournament Payouts</h2>
                            <div className="flex items-center space-x-4">
                                <button
                                    onClick={forceRefreshPaymentStatus}
                                    disabled={loading}
                                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 text-sm"
                                >
                                    <span>🔄</span>
                                    <span>{loading ? 'Refreshing...' : 'Refresh Status'}</span>
                                </button>
                                <div className="text-center">
                                    <p className="text-sm text-gray-400 mb-1">Use individual Pay buttons below</p>
                                    <p className="text-xs text-gray-500">Each payment opens World App payment interface</p>
                                </div>
                            </div>
                        </div>

                        {/* World App Payment Limitations Warning */}
                        <div className="bg-orange-500/20 border border-orange-500/50 rounded-lg p-4 mb-6">
                            <h4 className="text-sm font-semibold text-orange-300 mb-2">⚠️ World App Payment Limitations</h4>
                            <ul className="text-xs text-orange-200 space-y-1">
                                <li>• <strong>Self-payments work:</strong> You can pay to your own wallet successfully</li>
                                <li>• <strong>Payments to others may fail:</strong> World App sometimes restricts payments to other wallets</li>
                                <li>• <strong>Possible causes:</strong> Insufficient balance, daily limits, unverified wallets, or World App restrictions</li>
                                <li>• <strong>Workaround:</strong> Ask winners to share a different wallet address if payments fail</li>
                            </ul>
                        </div>

                        {displayedWinners.length > 0 ? (
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
                                        {displayedWinners.map((winner) => {
                                            // Safety checks for each winner data
                                            if (!winner || typeof winner.rank !== 'number') {
                                                return null;
                                            }

                                            return (
                                                <tr key={winner.rank} className="border-b border-white/10">
                                                    <td className="py-3 px-4 font-bold">#{winner.rank}</td>
                                                    <td className="py-3 px-4">
                                                        <div>
                                                            <p className="font-semibold">{winner.username || `Player ${winner.rank}`}</p>
                                                            <p className="text-xs text-gray-400 font-mono">
                                                                {winner.wallet_address ?
                                                                    `${winner.wallet_address.slice(0, 6)}...${winner.wallet_address.slice(-4)}` :
                                                                    'No address'
                                                                }
                                                            </p>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4">{(winner.score || 0).toLocaleString()}</td>
                                                    <td className="py-3 px-4">{((winner.final_amount || 0) - (winner.guarantee_bonus || 0)).toFixed(4)} WLD</td>
                                                    <td className="py-3 px-4">{(winner.guarantee_bonus || 0).toFixed(4)} WLD</td>
                                                    <td className="py-3 px-4 font-bold text-yellow-400">{(winner.final_amount || 0).toFixed(4)} WLD</td>
                                                    <td className="py-3 px-4">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${winner.payment_status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' :
                                                            winner.payment_status === 'sent' ? 'bg-blue-500/20 text-blue-300' :
                                                                winner.payment_status === 'confirmed' ? 'bg-green-500/20 text-green-300' :
                                                                    'bg-red-500/20 text-red-300'
                                                            }`}>
                                                            {winner.payment_status || 'unknown'}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        {winner.payment_status === 'pending' && winner.wallet_address && (
                                                            <AdminPayout
                                                                key={`payout-${winner.wallet_address}-${winner.rank}`}
                                                                winnerAddress={winner.wallet_address}
                                                                amount={winner.final_amount || 0}
                                                                rank={winner.rank}
                                                                username={winner.username || `Player ${winner.rank}`}
                                                                selectedAdminWallet={selectedAdminWallet || ''}
                                                                tournamentId={(tournamentView === 'current' ? currentTournament?.tournament_id : previousTournament?.tournament_id) || ''}
                                                                finalScore={winner.score || 0}
                                                                onPaymentSuccess={handlePaymentSuccess}
                                                                onPaymentError={handlePaymentError}
                                                                disabled={false}
                                                            />
                                                        )}
                                                        {winner.transaction_id && (
                                                            <p className="text-xs text-gray-400 mt-1 font-mono">
                                                                TX: {winner.transaction_id.slice(0, 8)}...
                                                            </p>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
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