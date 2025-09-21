'use client';

import React from 'react';
import Link from 'next/link';

const TermsPage = () => {
    return (
        <div className="min-h-screen bg-[#0B0C10] text-white">
            {/* Navigation Header */}
            <div className="bg-[#1D4ED8] bg-opacity-20 backdrop-blur-sm border-b border-[#00F5FF] border-opacity-20">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl" style={{ filter: 'drop-shadow(0 0 8px #00F5FF)' }}>🛸</span>
                            <h1 className="text-2xl font-bold text-[#00F5FF]">
                                Terms of Service
                            </h1>
                        </div>
                        <Link
                            href="/"
                            className="text-[#00F5FF] text-2xl hover:bg-[#00F5FF] hover:bg-opacity-20 p-2 rounded-full transition-all duration-300"
                            aria-label="Back to Home"
                        >
                            ✕
                        </Link>
                    </div>
                </div>
            </div>

            {/* Terms Content */}
            <div className="max-w-4xl mx-auto px-4 py-8">
                <div className="space-y-8">

                    {/* Game Rules Section */}
                    <section className="bg-gradient-to-r from-[#1D4ED8] from-opacity-10 to-[#9333EA] to-opacity-10 rounded-lg border border-[#00F5FF] border-opacity-20 p-6">
                        <h2 className="text-xl font-bold text-[#00F5FF] mb-4">🎮 Game Rules</h2>
                        <div className="text-[#E5E7EB] space-y-3">
                            <p>• Navigate your UFO through obstacles by tapping to fly up and releasing to fall</p>
                            <p>• Collect stars in Practice Mode to earn coins (2 coins per star)</p>
                            <p>• Score points by successfully passing obstacles (+1 point per obstacle)</p>
                            <p>• Use coins to continue in Practice Mode (10 coins per continue)</p>
                            <p>• Tournament entries require payment and allow one paid continue per game</p>
                        </div>
                    </section>

                    {/* Tournament Rules Section */}
                    <section className="bg-gradient-to-r from-[#1D4ED8] from-opacity-10 to-[#9333EA] to-opacity-10 rounded-lg border border-[#00F5FF] border-opacity-20 p-6">
                        <h2 className="text-xl font-bold text-[#00F5FF] mb-4">🏆 Tournament Rules</h2>
                        <div className="text-[#E5E7EB] space-y-3">
                            <p>• Weekly tournaments run from Sunday 15:30 UTC to the following Sunday</p>
                            <p>• Entry fee: 1.0 WLD (standard) or 0.9 WLD (World ID verified this week)</p>
                            <p>• Multiple entries allowed, but only your highest score counts</p>
                            <p>• One continue per game allowed by paying the same entry fee</p>
                            <p>• Minimum 5 players required for prize distribution</p>
                            <p>• If fewer than 5 players join, all entry fees are refunded</p>
                        </div>
                    </section>

                    {/* Prize Distribution Section */}
                    <section className="bg-gradient-to-r from-[#1D4ED8] from-opacity-10 to-[#9333EA] to-opacity-10 rounded-lg border border-[#00F5FF] border-opacity-20 p-6">
                        <h2 className="text-xl font-bold text-[#00F5FF] mb-4">💰 Prize Distribution</h2>
                        <div className="text-[#E5E7EB] space-y-3">
                            <p>• <span className="text-[#FFD700]">70%</span> of collected entry fees go to the prize pool for top 10 players</p>
                            <p>• <span className="text-[#FFD700]">30%</span> is retained for platform operations and development</p>
                            <p>• Top 10 winners receive prizes based on their final ranking</p>
                            <p>• Rank 1 receives 40% of prize pool, Rank 2 gets 22%, Rank 3 gets 14%</p>
                            <p>• Remaining ranks (4-10) receive 6%, 5%, 4%, 3%, 2%, 2%, 2% respectively</p>
                        </div>
                    </section>

                    {/* Fair Play Section */}
                    <section className="bg-gradient-to-r from-[#1D4ED8] from-opacity-10 to-[#9333EA] to-opacity-10 rounded-lg border border-[#00F5FF] border-opacity-20 p-6">
                        <h2 className="text-xl font-bold text-[#00F5FF] mb-4">⚖️ Fair Play Policy</h2>
                        <div className="text-[#E5E7EB] space-y-3">
                            <p>• All gameplay must be legitimate - no cheating, hacking, or exploiting</p>
                            <p>• Scores are validated on our servers to prevent tampering</p>
                            <p>• World ID verification ensures one account per real person</p>
                            <p>• Suspicious activity may result in disqualification</p>
                            <p>• All scores must be achieved through actual gameplay</p>
                        </div>
                    </section>

                    {/* Account & Data Section */}
                    <section className="bg-gradient-to-r from-[#1D4ED8] from-opacity-10 to-[#9333EA] to-opacity-10 rounded-lg border border-[#00F5FF] border-opacity-20 p-6">
                        <h2 className="text-xl font-bold text-[#00F5FF] mb-4">👤 Account & Data</h2>
                        <div className="text-[#E5E7EB] space-y-3">
                            <p>• World ID authentication required for tournament participation</p>
                            <p>• Your username and scores are displayed on public leaderboards</p>
                            <p>• Practice Mode data is stored locally on your device</p>
                            <p>• Tournament data is stored securely on our servers</p>
                            <p>• You are responsible for maintaining access to your World ID account</p>
                        </div>
                    </section>

                    {/* Payment & Refunds Section */}
                    <section className="bg-gradient-to-r from-[#1D4ED8] from-opacity-10 to-[#9333EA] to-opacity-10 rounded-lg border border-[#00F5FF] border-opacity-20 p-6">
                        <h2 className="text-xl font-bold text-[#00F5FF] mb-4">💳 Payments & Refunds</h2>
                        <div className="text-[#E5E7EB] space-y-3">
                            <p>• All tournament entries are paid in WLD cryptocurrency</p>
                            <p>• Prize payments are processed manually and may take up to 7 days</p>
                            <p>• Winners must maintain access to their World App wallet for prize delivery</p>
                            <p>• Failed payments due to technical issues will be retried</p>
                        </div>
                    </section>

                    {/* Disclaimers Section */}
                    <section className="bg-gradient-to-r from-[#1D4ED8] from-opacity-10 to-[#9333EA] to-opacity-10 rounded-lg border border-[#00F5FF] border-opacity-20 p-6">
                        <h2 className="text-xl font-bold text-[#00F5FF] mb-4">⚠️ Disclaimers</h2>
                        <div className="text-[#E5E7EB] space-y-3">
                            <p>• The game is provided &quot;as is&quot; without warranties of any kind</p>
                            <p>• We are not responsible for technical issues, device problems, or network outages</p>
                            <p>• Tournament schedules and rules may be updated with reasonable notice</p>
                            <p>• Cryptocurrency values fluctuate - entry and prize amounts are final at time of transaction</p>
                            <p>• This is a game of skill, not gambling - prizes are earned through gameplay performance</p>
                        </div>
                    </section>

                    {/* Updates Section */}
                    <section className="bg-gradient-to-r from-[#1D4ED8] from-opacity-10 to-[#9333EA] to-opacity-10 rounded-lg border border-[#00F5FF] border-opacity-20 p-6">
                        <h2 className="text-xl font-bold text-[#00F5FF] mb-4">🔄 Terms Updates</h2>
                        <div className="text-[#E5E7EB] space-y-3">
                            <p>• These terms may be updated periodically to reflect changes in the game</p>
                            <p>• Continued use of the game constitutes acceptance of updated terms</p>
                            <p>• Major changes will be communicated through the game interface</p>
                        </div>
                    </section>
                </div>

                {/* Back to Game */}
                <div className="mt-12 text-center">
                    <Link
                        href="/"
                        className="inline-flex items-center px-8 py-3 bg-gradient-to-r from-[#00F5FF] to-[#1D4ED8] text-[#0B0C10] font-bold rounded-lg hover:from-[#1D4ED8] hover:to-[#9333EA] transition-all duration-300 shadow-lg hover:shadow-[#00F5FF]/20"
                    >
                        🚀 Back to Game
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default TermsPage;