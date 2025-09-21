'use client';

import React, { useState } from 'react';
import Link from 'next/link';

const FAQPage = () => {
    const [openQuestion, setOpenQuestion] = useState<number | null>(null);

    const toggleQuestion = (index: number) => {
        setOpenQuestion(openQuestion === index ? null : index);
    };

    const faqData = [
        {
            question: "How do I play Flappy UFO?",
            answer: "Tap to make your UFO fly up, release to let it fall. Navigate through planets and asteroids while collecting stars. Pass obstacles to score points!"
        },
        {
            question: "What are the different game modes?",
            answer: "Practice Mode: Play for free, collect coins from stars, use coins to continue. Tournament Mode: Pay entry fee to compete for WLD prizes with other players."
        },
        {
            question: "How do tournaments work?",
            answer: "Weekly tournaments run from Sunday 15:30 UTC to the next Sunday. Pay 1.0 WLD to enter (0.9 WLD if verified with World ID this week). Compete for top 10 rankings to win prizes!"
        },
        {
            question: "What verification discount is available?",
            answer: "Players verified with World ID during the current tournament week get a 0.1 WLD discount (pay 0.9 WLD instead of 1.0 WLD). Verification status resets each Sunday."
        },
        {
            question: "How do continues work?",
            answer: "Practice Mode: Use 10 coins per continue (unlimited). Tournament Mode: Pay the same entry fee once per game to continue, then game over on second crash."
        },
        {
            question: "How are prizes distributed?",
            answer: "70% of collected entry fees go to the prize pool, distributed among top 10 players. 30% covers platform operations. Minimum 5 players required for payouts."
        },
        {
            question: "What happens if less than 5 players join?",
            answer: "If fewer than 5 players enter a tournament, all entry fees are fully refunded to participants."
        },
        {
            question: "How is the leaderboard ranked?",
            answer: "Players are ranked by their highest score. In case of ties, the player who achieved the score first wins. Only your best score across all entries counts."
        },
        {
            question: "Can I enter multiple times?",
            answer: "Yes! You can enter as many times as you want, but only your highest score will be recorded on the leaderboard."
        },
        {
            question: "When do tournaments end?",
            answer: "Tournaments end every Sunday at 15:30 UTC. There's a 30-minute grace period for final score submissions, then prizes are calculated and distributed."
        },
        {
            question: "How do I collect stars in Practice Mode?",
            answer: "Fly through stars during gameplay to collect them. Each star gives you 2 coins. Stars don't affect your score - they're just for earning continue coins!"
        },
        {
            question: "Is my progress saved?",
            answer: "Tournament scores are saved on our servers. Practice Mode coins are saved locally on your device. Your session persists when you return to the game."
        }
    ];

    return (
        <div className="min-h-screen bg-[#0B0C10] text-white">
            {/* Navigation Header */}
            <div className="bg-[#1D4ED8] bg-opacity-20 backdrop-blur-sm border-b border-[#00F5FF] border-opacity-20">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl" style={{ filter: 'drop-shadow(0 0 8px #00F5FF)' }}>🛸</span>
                            <h1 className="text-2xl font-bold text-[#00F5FF]">
                                Flappy UFO FAQ
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

            {/* FAQ Content */}
            <div className="max-w-4xl mx-auto px-4 py-8">
                <div className="space-y-4">
                    {faqData.map((faq, index) => (
                        <div
                            key={index}
                            className="bg-gradient-to-r from-[#1D4ED8] from-opacity-10 to-[#9333EA] to-opacity-10 rounded-lg border border-[#00F5FF] border-opacity-20 overflow-hidden"
                        >
                            <button
                                className="w-full px-6 py-4 text-left focus:outline-none focus:ring-2 focus:ring-[#00F5FF] focus:ring-opacity-50"
                                onClick={() => toggleQuestion(index)}
                            >
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold text-[#00F5FF]">
                                        {faq.question}
                                    </h3>
                                    <div className="flex-shrink-0 ml-4">
                                        <div
                                            className={`w-6 h-6 rounded-full bg-[#00F5FF] bg-opacity-20 flex items-center justify-center transition-transform duration-200 ${openQuestion === index ? 'rotate-45' : 'rotate-0'
                                                }`}
                                        >
                                            <span className="text-[#00F5FF] text-lg font-bold">+</span>
                                        </div>
                                    </div>
                                </div>
                            </button>

                            {openQuestion === index && (
                                <div className="px-6 pb-4">
                                    <div className="pt-2 border-t border-[#00F5FF] border-opacity-20">
                                        <p className="text-[#E5E7EB] leading-relaxed">
                                            {faq.answer}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
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

export default FAQPage;