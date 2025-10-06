import React from 'react';

interface GracePeriodModalProps {
    isOpen: boolean;
    onClose: () => void;
    tournamentEndTime?: string;
}

export default function GracePeriodModal({ isOpen, onClose, tournamentEndTime }: GracePeriodModalProps) {
    if (!isOpen) return null;

    const formatTimeRemaining = () => {
        if (!tournamentEndTime) return '';
        
        const now = new Date();
        const endTime = new Date(tournamentEndTime);
        const diffMinutes = Math.ceil((endTime.getTime() - now.getTime()) / (1000 * 60));
        
        if (diffMinutes <= 0) return 'Tournament has ended';
        if (diffMinutes === 1) return '1 minute';
        return `${diffMinutes} minutes`;
    };

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm"
            onClick={onClose}
        >
            <div 
                className="relative w-[90%] max-w-md bg-gradient-to-br from-[#0A0A0F] via-[#1A1A2E] to-[#0A0A0F] border-2 border-[#00F5FF] rounded-2xl shadow-2xl shadow-[#00F5FF]/50 p-6 animate-fadeIn"
                onClick={(e) => e.stopPropagation()}
                style={{
                    animation: 'slideUp 0.3s ease-out',
                }}
            >
                {/* Glow effect */}
                <div className="absolute inset-0 bg-[#00F5FF] opacity-5 rounded-2xl blur-xl"></div>

                {/* Header */}
                <div className="relative z-10 text-center mb-6">
                    <div className="text-6xl mb-3">⏰</div>
                    <h2 className="text-2xl font-bold text-[#00F5FF] mb-2">
                        Tournament Wrapping Up!
                    </h2>
                    <div className="text-sm text-gray-400">
                        {tournamentEndTime && (
                            <span>Ends in {formatTimeRemaining()}</span>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="relative z-10 space-y-4 text-center">
                    <p className="text-white text-base leading-relaxed">
                        We&apos;re currently in the final moments of this week&apos;s tournament! 
                        New entries and continues are closed to ensure fair competition.
                    </p>

                    <div className="bg-[#00F5FF]/10 border border-[#00F5FF]/30 rounded-lg p-4 space-y-2">
                        <p className="text-[#00F5FF] font-semibold text-sm">
                            🎯 Already playing? You can still:
                        </p>
                        <ul className="text-gray-300 text-sm space-y-1 text-left pl-6">
                            <li>✅ Finish your current game</li>
                            <li>✅ Submit your final score</li>
                            <li>✅ Compete for the leaderboard</li>
                        </ul>
                    </div>

                    <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-400/30 rounded-lg p-4">
                        <p className="text-white font-bold text-base mb-2">
                            🚀 New Tournament Starts Soon!
                        </p>
                        <p className="text-gray-300 text-sm">
                            The next tournament begins <span className="text-[#00F5FF] font-semibold">Sunday at 15:30 UTC</span>.
                            <br />
                            Be ready to compete for bigger prizes!
                        </p>
                    </div>

                    <p className="text-yellow-400 text-xs italic">
                        💡 Tip: Practice mode is always available to sharpen your skills!
                    </p>
                </div>

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="relative z-10 w-full mt-6 bg-gradient-to-r from-[#00F5FF] to-[#00D4FF] text-black font-bold py-3 px-6 rounded-lg hover:scale-105 transform transition-all duration-200 shadow-lg shadow-[#00F5FF]/50"
                >
                    Got It! 🎮
                </button>
            </div>
        </div>
    );
}
