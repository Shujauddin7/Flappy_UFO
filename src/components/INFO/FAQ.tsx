'use client';

import { useState } from 'react';

interface FAQItem {
    question: string;
    answer: string;
}

interface FAQProps {
    onSupportClick: () => void;
}

const faqData: FAQItem[] = [
    {
        question: "How does Flappy UFO work?",
        answer: "Navigate your UFO through planets and asteroids by tapping to fly up. Collect stars in Practice Mode (2 coins each) and compete in weekly WLD tournaments. Your highest score across all entries is recorded."
    },
    {
        question: "Is this gambling?",
        answer: `No! Flappy UFO is 100% skill-based competitive gaming:
• Your flying skill alone determines your score.
• Better players consistently achieve higher results.
• No random mechanics, luck, or chance involved.
• Similar to chess or esports tournaments, where talent and practice decide winners.
• Pure skill, focus, and practice lead to success.`,
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
        answer: "Weekly tournaments run from 15:30 UTC Sunday to 15:30 UTC the following Sunday. There's a 30-minute grace period (15:00-15:30 UTC) where no new entries are accepted, but players already in games can continue playing."
    },
    {
        question: "What are the Pool Prize breakdown?",
        answer:  `Rank 1 → 40% of prize pool  
Rank 2 → 22%, 
Rank 3 → 14%, 
Rank 4 → 6%,
Rank 5 → 5%, 
Rank 6 → 4%,  
Rank 7 → 3%,  
Rank 8 → 2%,  
Rank 9 → 2%, 
Rank 10 → 2%.`
    },
    {
      question: "What are the different game modes?",
      answer: "Practice Mode: Play for free, collect coins from stars, use coins to continue. Tournament Mode: Pay entry fee to compete for WLD prizes with other players."
    },
    {
        question: "Can I play multiple times in a tournament?",
        answer: "Yes! You can create multiple entries by paying each time, but only your highest score across all entries counts. Each game allows exactly one continue by paying the same amount again to keep the game fair."
    },
    {
        question: "What happens if I crash in Tournament Mode?",
        answer: "First crash: Pay the same amount to continue (score carries forward). Second crash: Game over completely. You must create a new entry with new payment to play again."
    },
    {
      question: "How do continues work?",
      answer: "Practice Mode: Use 10 coins per continue (unlimited). Tournament Mode: Pay the same entry fee once per game to continue, then game over on second crash."
    },
    {
      question: "How is the leaderboard ranked?",
      answer: "Players are ranked by their highest score. In case of ties, the player who achieved the score first wins. Only your best score across all entries counts."
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

export default function FAQ({ onSupportClick }: FAQProps) {
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
                <p className="text-white text-sm mb-4">Need more help?</p>
                <button
                    onClick={onSupportClick}
                    className="bg-transparent border-2 border-[#00F5FF] text-[#00F5FF] px-6 py-2 rounded-full text-sm font-medium hover:bg-[#00F5FF] hover:text-black transition-all duration-300 font-['Orbitron'] cursor-pointer"
                >
                    Support
                </button>
            </div>
        </div>
    );
}