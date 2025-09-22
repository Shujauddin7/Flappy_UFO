'use client';

import { useState } from 'react';

interface FAQItem {
    question: string;
    answer: string;
}

const faqData: FAQItem[] = [
    {
        question: "How does Flappy UFO work?",
        answer: "Navigate your UFO through planets and asteroids by tapping to fly up. Collect stars in Practice Mode (2 coins each) and compete in weekly WLD tournaments. Your highest score across all entries is recorded."
    },
    {
        question: "What's the difference between Practice and Tournament Mode?",
        answer: "Practice Mode is free - earn coins by collecting stars and use 10 coins to continue when you crash. Tournament Mode requires payment (1.0 WLD or 0.9 WLD if verified) and allows only one continue per game for fairness."
    },
    {
        question: "How do I get verified for the discount?",
        answer: "Use World ID Orb verification within the tournament entry flow. Verified players pay 0.9 WLD instead of 1.0 WLD. Verification resets weekly at tournament start (15:30 UTC Sunday)."
    },
    {
        question: "When do tournaments run?",
        answer: "Weekly tournaments run from 15:30 UTC Sunday to 15:30 UTC the following Sunday. There's a 30-minute grace period (15:00-15:30 UTC) where no new entries are accepted for prize calculation."
    },
    {
        question: "How are prizes distributed?",
        answer: "Top 10 players share 70% of collected WLD. If fewer than 5 players join, everyone gets a full refund. Admin adds guarantee funds when needed to ensure all top 10 players profit."
    },
    {
        question: "Can I play multiple times in a tournament?",
        answer: "Yes! You can create multiple entries by paying each time, but only your highest score across all entries counts. Each game allows exactly one continue by paying the same amount again."
    },
    {
        question: "What happens if I crash in Tournament Mode?",
        answer: "First crash: Pay the same amount to continue (score carries forward). Second crash: Game over completely. You must create a new entry with new payment to play again."
    },
    {
        question: "How is the leaderboard updated?",
        answer: "Real-time updates using professional gaming cache systems. Your position updates instantly when you submit a score. The leaderboard shows Top 10 plus your current rank."
    },
    {
        question: "What are the admin fees?",
        answer: "30% of collected WLD goes to admin fees for platform maintenance and development. This is transparently displayed and helps fund the guarantee system for player profits."
    },
    {
        question: "Is this gambling?",
        answer: "No! Flappy UFO is a skill-based game. All rewards are earned through gameplay ability, not chance. There are no random rewards or gambling mechanics - just pure UFO flying skill."
    }
];

export default function FAQ() {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    const toggleFAQ = (index: number) => {
        setOpenIndex(openIndex === index ? null : index);
    };

    return (
        <div className="h-full overflow-y-auto px-4 py-6 space-y-4">
            {faqData.map((item, index) => (
                <div
                    key={index}
                    className="bg-[#1D4ED8] bg-opacity-20 border border-[#00F5FF] border-opacity-30 rounded-lg overflow-hidden"
                >
                    <button
                        onClick={() => toggleFAQ(index)}
                        className="w-full flex items-center justify-between p-4 text-left hover:bg-[#00F5FF] hover:bg-opacity-10 transition-colors duration-200"
                    >
                        <span className="text-[#E5E7EB] font-medium text-sm sm:text-base pr-4">
                            {item.question}
                        </span>
                        <div
                            className={`flex-shrink-0 w-6 h-6 flex items-center justify-center text-[#00F5FF] text-xl font-bold transition-transform duration-200 ${openIndex === index ? 'rotate-45' : 'rotate-0'
                                }`}
                        >
                            +
                        </div>
                    </button>

                    <div
                        className={`overflow-hidden transition-all duration-300 ease-in-out ${openIndex === index ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                            }`}
                    >
                        <div className="p-4 pt-0 border-t border-[#00F5FF] border-opacity-20">
                            <p className="text-[#E5E7EB] text-opacity-90 text-sm sm:text-base leading-relaxed">
                                {item.answer}
                            </p>
                        </div>
                    </div>
                </div>
            ))}

            <div className="text-center pt-6 pb-8">
                <p className="text-[#00F5FF] text-sm opacity-80">
                    Need more help? Check out our Support section! 🛸
                </p>
            </div>
        </div>
    );
}