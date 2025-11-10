"use client";

import React from 'react';

interface Player {
    id: string;
    user_id: string;
    username: string | null;
    wallet: string;
    highest_score: number;
    tournament_day: string;
    created_at: string;
    rank?: number;
}

interface PlayerRankCardProps {
    player: Player;
    prizeAmount: string | null;
    isCurrentUser: boolean;
    isTopThree: boolean;
    isLoading?: boolean; // Add loading prop for blur effects
    showScore?: boolean; // Show/hide score column (default true for current, false for history)
}

export const PlayerRankCard: React.FC<PlayerRankCardProps> = ({
    player,
    prizeAmount,
    isCurrentUser,
    isTopThree,
    isLoading = false, // Default to false
    showScore = true // Default to true (show scores in current leaderboard)
}) => {
    const getRankEmoji = (rank?: number) => {
        if (!rank) return '🏆';
        switch (rank) {
            case 1: return '🥇';
            case 2: return '🥈';
            case 3: return '🥉';
            default: return '🏆';
        }
    };

    const formatWallet = (wallet: string) => {
        if (wallet.length <= 8) return wallet;
        return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
    };

    const getDisplayName = () => {
        if (player.username) {
            // Truncate long usernames to prevent layout issues
            if (player.username.length > 15) {
                return `${player.username.slice(0, 13)}...`;
            }
            return player.username;
        }

        // CRITICAL FIX: Show short wallet address for users without usernames
        // This provides unique identification instead of generic "Human"
        return formatWallet(player.wallet);
    };

    const getRankDisplay = () => {
        if (!player.rank) return '';
        if (player.rank <= 3) return getRankEmoji(player.rank);
        return `${player.rank}`;
    };

    return (
        <div className={`player-rank-card ${isCurrentUser ? 'current-user' : ''} ${isTopThree ? 'top-three' : ''}`}>
            <div className="rank-section">
                <div className="rank-display">
                    {getRankDisplay()}
                </div>
            </div>

            <div className="player-info">
                <div className="player-name">
                    <span className="player-name-text">
                        {getDisplayName()}
                    </span>
                </div>
            </div>

            {showScore && (
                <div className="score-section">
                    <div className="player-score">
                        {(player.highest_score || 0).toLocaleString()}
                    </div>
                </div>
            )}

            <div className="prize-section">
                {isLoading ? (
                    <div className="prize-amount loading-blur highlighted-prize">
                        $0.00 WLD
                    </div>
                ) : prizeAmount ? (
                    <div className="prize-amount highlighted-prize">
                        {prizeAmount} WLD
                    </div>
                ) : (
                    <div className="no-prize">
                        -
                    </div>
                )}
            </div>
        </div>
    );
};
