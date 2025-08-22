"use client";

import React, { useState } from 'react';
import { Page } from '@/components/PageLayout';

interface TournamentEntryModalProps {
    onBack: () => void;
    onEntrySelect: (entryType: 'verify' | 'standard') => void;
    isAuthenticating: boolean;
}

export const TournamentEntryModal: React.FC<TournamentEntryModalProps> = ({
    onBack,
    onEntrySelect,
    isAuthenticating
}) => {
    const [selectedEntry, setSelectedEntry] = useState<'verify' | 'standard' | null>(null);

    const handleEntrySelect = (entryType: 'verify' | 'standard') => {
        setSelectedEntry(entryType);
        onEntrySelect(entryType);
    };

    return (
        <Page.Main className="tournament-entry-screen">
            <div className="epic-title-section">
                <h1 className="epic-title">
                    <span className="choose-word">Choose Your</span>
                    <span className="destiny-word">Entry</span>
                </h1>
                <p className="epic-subtitle">Verify your identity • Save on entry fees</p>
            </div>

            <div className="game-modes">
                {/* Verify Entry Card */}
                <div className="mode-card verify-mode">
                    <div className="cosmic-aura verify-aura"></div>
                    <div className="mode-content">
                        <div className="mode-icon">✅</div>
                        <h2 className="mode-name">VERIFY</h2>
                        <p className="mode-desc">Orb verification discount</p>
                        <div className="mode-features">
                            <span className="feature">💰 0.9 WLD entry fee</span>
                            <span className="feature">🔒 World ID verification</span>
                        </div>
                        <button
                            className="mode-button verify-button"
                            onClick={() => handleEntrySelect('verify')}
                            disabled={isAuthenticating}
                        >
                            {isAuthenticating && selectedEntry === 'verify'
                                ? 'VERIFYING...'
                                : 'GET VERIFIED & PLAY'
                            }
                        </button>
                    </div>
                </div>

                {/* Standard Entry Card */}
                <div className="mode-card standard-mode">
                    <div className="cosmic-aura standard-aura"></div>
                    <div className="mode-content">
                        <div className="mode-icon">⚡</div>
                        <h2 className="mode-name">STANDARD</h2>
                        <p className="mode-desc">Quick tournament entry</p>
                        <div className="mode-features">
                            <span className="feature">💎 1.0 WLD entry fee</span>
                            <span className="feature">🚀 Instant access</span>
                        </div>
                        <button
                            className="mode-button standard-button"
                            onClick={() => handleEntrySelect('standard')}
                            disabled={isAuthenticating}
                        >
                            {isAuthenticating && selectedEntry === 'standard'
                                ? 'PROCESSING...'
                                : 'STANDARD ENTRY'
                            }
                        </button>
                    </div>
                </div>

            </div>

            <div className="bottom-nav-container">
                <div className="space-nav-icons">
                    <button
                        className="space-nav-btn back-nav"
                        onClick={onBack}
                        aria-label="Go Back"
                    >
                        <div className="space-icon">⬅️</div>
                    </button>
                    <button
                        className="space-nav-btn prizes-nav"
                        onClick={() => alert('Galactic Leaderboard & Cosmic Prizes')}
                        aria-label="Cosmic Prizes"
                    >
                        <div className="space-icon">🏆</div>
                    </button>
                </div>
            </div>
        </Page.Main>
    );
};
