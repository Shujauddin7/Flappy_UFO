"use client";

import React from 'react';

interface TournamentEntryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onEntrySelect: (entryType: 'verified' | 'standard') => void;
}

export const TournamentEntryModal: React.FC<TournamentEntryModalProps> = ({
    isOpen,
    onClose,
    onEntrySelect
}) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                
                <div className="epic-title-section">
                    <h1 className="epic-title">
                        <span className="choose-word">Choose Your</span>
                        <span className="destiny-word">Entry</span>
                    </h1>
                    <p className="epic-subtitle">Select your tournament path</p>
                </div>

                <div className="game-modes">
                    
                    {/* Verified Entry Card */}
                    <div className="mode-card verified-entry-mode">
                        <div className="cosmic-aura verified-aura"></div>
                        <div className="mode-content">
                            <div className="mode-icon">✨</div>
                            <h2 className="mode-name">GET VERIFIED</h2>
                            <p className="mode-desc">Premium path</p>
                            <div className="mode-features">
                                <span className="feature">🌟 Orb verified</span>
                                <span className="feature">💰 Only 0.9 WLD</span>
                            </div>
                            <div className="entry-price">0.9 WLD</div>
                            <button
                                className="mode-button verified-button"
                                onClick={() => onEntrySelect('verified')}
                            >
                                GET VERIFIED & PLAY
                            </button>
                        </div>
                    </div>

                    {/* Standard Entry Card */}
                    <div className="mode-card standard-entry-mode">
                        <div className="cosmic-aura standard-aura"></div>
                        <div className="mode-content">
                            <div className="mode-icon">💎</div>
                            <h2 className="mode-name">STANDARD ENTRY</h2>
                            <p className="mode-desc">Ready to battle</p>
                            <div className="mode-features">
                                <span className="feature">⚡ Instant play</span>
                                <span className="feature">🎮 Full tournament access</span>
                            </div>
                            <div className="entry-price">1.0 WLD</div>
                            <button
                                className="mode-button standard-button"
                                onClick={() => onEntrySelect('standard')}
                            >
                                STANDARD ENTRY
                            </button>
                        </div>
                    </div>

                </div>

                {/* Close button */}
                <button className="modal-close" onClick={onClose}>
                    ✕
                </button>

            </div>
        </div>
    );
};
