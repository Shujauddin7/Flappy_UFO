'use client';

import React from 'react';
import Link from 'next/link';

const SupportPage = () => {
    return (
        <div className="min-h-screen bg-[#0B0C10] text-white">
            {/* Navigation Header */}
            <div className="bg-[#1D4ED8] bg-opacity-20 backdrop-blur-sm border-b border-[#00F5FF] border-opacity-20">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl" style={{ filter: 'drop-shadow(0 0 8px #00F5FF)' }}>🛸</span>
                            <h1 className="text-2xl font-bold text-[#00F5FF]">
                                Support Center
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

            {/* Support Content */}
            <div className="max-w-4xl mx-auto px-4 py-8">
                <div className="space-y-8">

                    {/* Quick Help Section */}
                    <section className="bg-gradient-to-r from-[#1D4ED8] from-opacity-10 to-[#9333EA] to-opacity-10 rounded-lg border border-[#00F5FF] border-opacity-20 p-6">
                        <h2 className="text-xl font-bold text-[#00F5FF] mb-4">🚀 Quick Help</h2>
                        <div className="text-[#E5E7EB] space-y-3">
                            <p>• Having trouble playing? Check our <Link href="/info/faq" className="text-[#00F5FF] hover:underline">FAQ section</Link> for common questions</p>
                            <p>• Game not loading? Try refreshing the page or clearing your browser cache</p>
                            <p>• Payment issues? Make sure your World App wallet has sufficient WLD balance</p>
                            <p>• Score not updating? Wait a moment - scores sync automatically with our servers</p>
                        </div>
                    </section>

                    {/* Common Issues Section */}
                    <section className="bg-gradient-to-r from-[#1D4ED8] from-opacity-10 to-[#9333EA] to-opacity-10 rounded-lg border border-[#00F5FF] border-opacity-20 p-6">
                        <h2 className="text-xl font-bold text-[#00F5FF] mb-4">🔧 Common Issues</h2>
                        <div className="space-y-4">
                            <div className="border-l-2 border-[#00F5FF] border-opacity-50 pl-4">
                                <h3 className="font-semibold text-[#FFD700] mb-1">Game Controls Not Responding</h3>
                                <p className="text-[#E5E7EB] text-sm">Make sure your device screen is clean and try tapping different areas. The game responds to touch anywhere on the screen.</p>
                            </div>

                            <div className="border-l-2 border-[#00F5FF] border-opacity-50 pl-4">
                                <h3 className="font-semibold text-[#FFD700] mb-1">World ID Verification Failed</h3>
                                <p className="text-[#E5E7EB] text-sm">Ensure you have the latest World App installed and try the verification process again. You can still play without verification at the standard rate.</p>
                            </div>

                            <div className="border-l-2 border-[#00F5FF] border-opacity-50 pl-4">
                                <h3 className="font-semibold text-[#FFD700] mb-1">Payment Not Processing</h3>
                                <p className="text-[#E5E7EB] text-sm">Check your WLD balance in World App and ensure you have a stable internet connection. Try the payment again after a few moments.</p>
                            </div>

                            <div className="border-l-2 border-[#00F5FF] border-opacity-50 pl-4">
                                <h3 className="font-semibold text-[#FFD700] mb-1">Leaderboard Not Loading</h3>
                                <p className="text-[#E5E7EB] text-sm">Leaderboard updates automatically. If it appears stuck, try refreshing the page. During peak times, there might be slight delays.</p>
                            </div>
                        </div>
                    </section>

                    {/* Getting Started Section */}
                    <section className="bg-gradient-to-r from-[#1D4ED8] from-opacity-10 to-[#9333EA] to-opacity-10 rounded-lg border border-[#00F5FF] border-opacity-20 p-6">
                        <h2 className="text-xl font-bold text-[#00F5FF] mb-4">🎮 Getting Started</h2>
                        <div className="text-[#E5E7EB] space-y-3">
                            <p><span className="text-[#FFD700]">Step 1:</span> Start with Practice Mode to learn the controls and collect coins</p>
                            <p><span className="text-[#FFD700]">Step 2:</span> Sign in with World ID when ready to compete in tournaments</p>
                            <p><span className="text-[#FFD700]">Step 3:</span> Consider verifying with World ID for a discount on tournament entries</p>
                            <p><span className="text-[#FFD700]">Step 4:</span> Practice your skills and aim for the top 10 leaderboard!</p>
                        </div>
                    </section>

                    {/* Tournament Help Section */}
                    <section className="bg-gradient-to-r from-[#1D4ED8] from-opacity-10 to-[#9333EA] to-opacity-10 rounded-lg border border-[#00F5FF] border-opacity-20 p-6">
                        <h2 className="text-xl font-bold text-[#00F5FF] mb-4">🏆 Tournament Help</h2>
                        <div className="text-[#E5E7EB] space-y-3">
                            <p>• Tournaments run weekly from Sunday to Sunday (15:30 UTC)</p>
                            <p>• Your best score across all attempts counts for ranking</p>
                            <p>• You can enter multiple times to improve your score</p>
                            <p>• Prize distribution happens automatically after each tournament ends</p>
                            <p>• Winners will receive their prizes directly in their World App wallet</p>
                        </div>
                    </section>

                    {/* Contact Section */}
                    <section className="bg-gradient-to-r from-[#1D4ED8] from-opacity-10 to-[#9333EA] to-opacity-10 rounded-lg border border-[#00F5FF] border-opacity-20 p-6">
                        <h2 className="text-xl font-bold text-[#00F5FF] mb-4">📧 Need More Help?</h2>
                        <div className="text-[#E5E7EB] space-y-4">
                            <p>If you can&apos;t find the answer to your question, here are ways to get additional support:</p>

                            <div className="bg-[#0B0C10] bg-opacity-50 rounded-lg p-4 border border-[#374151]">
                                <p className="text-center">
                                    <span className="text-[#FFD700]">For game issues and support:</span><br />
                                    Check back soon for additional contact methods
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                                <div className="text-center p-4 border border-[#374151] rounded-lg">
                                    <div className="text-2xl mb-2">⏰</div>
                                    <h3 className="font-semibold text-[#00F5FF] mb-1">Response Time</h3>
                                    <p className="text-sm text-[#E5E7EB]">We aim to address issues within 24-48 hours</p>
                                </div>

                                <div className="text-center p-4 border border-[#374151] rounded-lg">
                                    <div className="text-2xl mb-2">🌍</div>
                                    <h3 className="font-semibold text-[#00F5FF] mb-1">World App Community</h3>
                                    <p className="text-sm text-[#E5E7EB]">Join the World App community for general help</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Tips Section */}
                    <section className="bg-gradient-to-r from-[#1D4ED8] from-opacity-10 to-[#9333EA] to-opacity-10 rounded-lg border border-[#00F5FF] border-opacity-20 p-6">
                        <h2 className="text-xl font-bold text-[#00F5FF] mb-4">💡 Pro Tips</h2>
                        <div className="text-[#E5E7EB] space-y-3">
                            <p>• Practice in Practice Mode first to learn the physics and timing</p>
                            <p>• Focus on smooth, controlled movements rather than rapid tapping</p>
                            <p>• Each obstacle pattern is different, so stay alert and adapt</p>
                            <p>• Stars in Practice Mode give coins but don&apos;t affect your score</p>
                            <p>• In tournaments, your first entry is often your best - don&apos;t overthink it!</p>
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

export default SupportPage;