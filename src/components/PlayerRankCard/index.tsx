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
}

export const PlayerRankCard: React.FC<PlayerRankCardProps> = ({
    player,
    prizeAmount,
    isCurrentUser,
    isTopThree
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
            return player.username;
        }
        return formatWallet(player.wallet);
    };

    const getRankDisplay = () => {
        if (!player.rank) return '';
        if (player.rank <= 3) return getRankEmoji(player.rank);
        return `#${player.rank}`;
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
                    {getDisplayName()}
                    {isCurrentUser && <span className="you-badge">YOU</span>}
                </div>
                <div className="player-score">
                    {player.highest_score.toLocaleString()} points
                </div>
            </div>

            <div className="prize-section">
                {prizeAmount ? (
                    <div className="prize-amount">
                        💎 {prizeAmount} WLD
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
