"use client";

import React, { useState } from 'react';
import { Page } from '@/components/PageLayout';

interface TournamentEntryModalProps {
    onBack: () => void;
    onEntrySelect: (entryType: 'verify' | 'standard' | 'verified') => void;
    isAuthenticating: boolean;
    isVerifiedToday: boolean;
    verificationLoading: boolean;
    isProcessingEntry: boolean;
    canUseOrbVerification: boolean;
    orbCapabilityLoading: boolean;
}

export const TournamentEntryModal: React.FC<TournamentEntryModalProps> = ({
    onBack,
    onEntrySelect,
    isAuthenticating,
    isVerifiedToday,
    verificationLoading,
    isProcessingEntry,
    canUseOrbVerification,
    orbCapabilityLoading
}) => {
    const [selectedEntry, setSelectedEntry] = useState<'verify' | 'standard' | 'verified' | null>(null);

    const handleEntrySelect = (entryType: 'verify' | 'standard' | 'verified') => {
        setSelectedEntry(entryType);
        onEntrySelect(entryType);
    };

    return (
        <Page.Main className="tournament-entry-screen">
            {/* Processing Overlay */}
            {isProcessingEntry && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50"
                    style={{ backdropFilter: 'blur(4px)' }}
                >
                    <div className="text-center space-y-4 px-6">
                        <div className="animate-spin rounded-full h-16 w-16 border-4 border-cyan-400 border-t-transparent mx-auto"></div>
                        <h3 className="text-xl font-bold text-white">Processing Payment</h3>
                        <p className="text-cyan-300">Please wait while we process your tournament entry...</p>
                        <p className="text-sm text-gray-400">Do not close this window</p>
                    </div>
                </div>
            )}

            <div className="epic-title-section">
                <h1 className="epic-title">
                    <span className="choose-word">Choose Your</span>
                    <span className="destiny-word">Entry</span>
                </h1>
                <p className="epic-subtitle">Verify your identity • Save on entry fees</p>
            </div>

            <div className="game-modes">
                {/* Show different options based on verification status */}
                {isVerifiedToday ? (
                    // User is already verified today - show verified entry option
                    <>
                        {/* Verified Entry Card */}
                        <div className="mode-card verify-mode">
                            <div className="cosmic-aura verify-aura"></div>
                            <div className="mode-content">
                                <div className="mode-icon">✅</div>
                                <h2 className="mode-name">VERIFIED</h2>
                                <p className="mode-desc">Already verified today</p>
                                <div className="mode-features">
                                    <span className="feature">💰 0.9 WLD entry fee</span>
                                    <span className="feature">🎯 Verified discount active</span>
                                </div>
                                <button
                                    className="mode-button verify-button"
                                    onClick={() => handleEntrySelect('verified')}
                                    disabled={isAuthenticating || isProcessingEntry}
                                >
                                    {(isAuthenticating || isProcessingEntry) && selectedEntry === 'verified'
                                        ? 'PROCESSING...'
                                        : 'PLAY TOURNAMENT (0.9 WLD)'
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
                                <p className="mode-desc">Standard tournament entry</p>
                                <div className="mode-features">
                                    <span className="feature">💎 1.0 WLD entry fee</span>
                                    <span className="feature">🚀 Instant access</span>
                                </div>
                                <button
                                    className="mode-button standard-button"
                                    onClick={() => handleEntrySelect('standard')}
                                    disabled={isAuthenticating || isProcessingEntry}
                                >
                                    {(isAuthenticating || isProcessingEntry) && selectedEntry === 'standard'
                                        ? 'PROCESSING...'
                                        : 'STANDARD ENTRY (1.0 WLD)'
                                    }
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    // User is not verified today - show verify option
                    <>
                        {/* Verify Entry Card */}
                        <div className="mode-card verify-mode">
                            <div className="cosmic-aura verify-aura"></div>
                            <div className="mode-content">
                                <div className="mode-icon">✅</div>
                                <h2 className="mode-name">VERIFY</h2>
                                <p className="mode-desc">
                                    {canUseOrbVerification ? 'Orb verification discount' : 'Requires Orb verification'}
                                </p>
                                <div className="mode-features">
                                    <span className="feature">💰 0.9 WLD entry fee</span>
                                    <span className="feature">🔒 World ID verification</span>
                                    {!canUseOrbVerification && (
                                        <span className="feature warning">⚠️ Orb verification needed</span>
                                    )}
                                </div>
                                <button
                                    className={`mode-button verify-button ${!canUseOrbVerification ? 'dimmed' : ''}`}
                                    onClick={() => handleEntrySelect('verify')}
                                    disabled={
                                        isAuthenticating ||
                                        verificationLoading ||
                                        isProcessingEntry ||
                                        orbCapabilityLoading ||
                                        !canUseOrbVerification
                                    }
                                >
                                    {orbCapabilityLoading
                                        ? 'CHECKING ORB STATUS...'
                                        : !canUseOrbVerification
                                            ? 'ORB VERIFICATION REQUIRED'
                                            : verificationLoading
                                                ? 'CHECKING...'
                                                : (isAuthenticating || isProcessingEntry) && selectedEntry === 'verify'
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
                                    disabled={isAuthenticating || verificationLoading || isProcessingEntry}
                                >
                                    {verificationLoading
                                        ? 'CHECKING...'
                                        : (isAuthenticating || isProcessingEntry) && selectedEntry === 'standard'
                                            ? 'PROCESSING...'
                                            : 'STANDARD ENTRY (1.0 WLD)'
                                    }
                                </button>
                            </div>
                        </div>
                    </>
                )}

            </div>

            <div className="bottom-nav-container">
                <div className="space-nav-icons">
                    <button
                        className={`space-nav-btn back-nav ${isProcessingEntry ? 'disabled' : ''}`}
                        onClick={onBack}
                        disabled={isProcessingEntry}
                        aria-label="Go Back"
                        style={{
                            opacity: isProcessingEntry ? 0.5 : 1,
                            cursor: isProcessingEntry ? 'not-allowed' : 'pointer',
                            pointerEvents: isProcessingEntry ? 'none' : 'auto'
                        }}
                    >
                        <div className="space-icon">⬅️</div>
                    </button>
                    <button
                        className={`space-nav-btn prizes-nav ${isProcessingEntry ? 'disabled' : ''}`}
                        onClick={() => window.location.href = '/leaderboard'}
                        disabled={isProcessingEntry}
                        aria-label="Leaderboard"
                        style={{
                            opacity: isProcessingEntry ? 0.5 : 1,
                            cursor: isProcessingEntry ? 'not-allowed' : 'pointer',
                            pointerEvents: isProcessingEntry ? 'none' : 'auto'
                        }}
                    >
                        <div className="space-icon">🏆</div>
                    </button>
                </div>
            </div>
        </Page.Main>
    );
};
