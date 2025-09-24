'use client';

interface TermsProps {
    onSupportClick: () => void;
}

export default function Terms({ onSupportClick }: TermsProps) {
    const termsData = [
        {
            heading: "Game Rules",
            content: [
                "⭐ Navigate your UFO through obstacles by tapping to fly up and releasing to fall",
                "⭐ Collect stars in Practice Mode to earn coins (2 coins per star)",
                "⭐ Score points by successfully passing obstacles (+1 point per obstacle)",
                "⭐ Use coins to continue in Practice Mode (10 coins per continue)",
                "⭐ Tournament entries require payment and allow one paid continue per game"
            ]
        },
        {
            heading: "Game Terms & Conditions",
            content: [
                "⭐ By playing Flappy UFO, you agree to these terms. This is a skill-based game integrated with World App and Worldcoin ecosystem.",

                "⭐ Eligibility: Must have World App installed and World ID for tournament participation.",

                "⭐ Skill-Based Gaming: This is NOT gambling. Outcomes are determined entirely by player skill, timing, and game knowledge. No random mechanics, luck elements, or chance-based rewards exist. Success depends on practiced flying abilities and consistent performance.",

                "⭐ Fair Play: All rewards earned through gameplay ability only. Better skilled players achieve higher scores consistently through superior timing and control."
            ]
        },
        {
            heading: "Tournament Rules",
            content: [
                "⭐ Weekly Schedule: Tournaments run Sunday 15:30 UTC to Sunday 15:30 UTC (7 days).",

                "⭐ Entry Fees: 1.0 WLD standard entry or 0.9 WLD for World ID Orb verified users (verification resets weekly).",

                "⭐ Continue Policy: One continue per game by paying entry fee again. After second crash, new entry required.",

                "⭐ Score Recording: Only your highest score across all entries counts. Multiple entries allowed.",

                "⭐ Grace Period: 30 minutes before tournament end (15:00-15:30 UTC) - no new entries accepted, but ongoing games can be completed."
            ]
        },
        {
            heading: "Payment & Prize Terms",
            content: [
                "⭐ Prize Distribution: Top 10 players share 70% of collected WLD with additional platform bonuses to enhance prize pools.",

                "⭐ Platform Support: Remaining funds support app development, server maintenance, and player experience improvements.",

                "⭐ Competitive Rewards: Prize amounts vary based on tournament participation and performance rankings.",

                "⭐ Payment Processing: All payments verified before entry creation for secure tournament participation.",

                "⭐ Verification Discount: World ID Orb verification grants 0.1 WLD discount per entry. Resets weekly."
            ]
        },
        {
            heading: "World App Integration",
            content: [
                "⭐ Authentication: World ID enables tournament entry with both standard (1.0 WLD) and verified (0.9 WLD) options. Anonymous practice mode available.",

                "⭐ Wallet: All transactions through World App wallet. Ensure sufficient WLD balance before entry.",

                "⭐ Privacy: Game respects World App privacy standards. No personal data collected beyond World ID.",

                "⭐ Updates: Game updates delivered through World App. Check regularly for latest features."
            ]
        },
        {
            heading: "Anti-Cheat & Fair Play",
            content: [
                "⭐ Detection Systems: Advanced anti-cheat monitors gameplay patterns and impossible scores.",

                "⭐ Penalties: Cheating results in immediate disqualification and potential account restrictions.",

                "⭐ Appeals: Wrongful disqualification appeals reviewed within 24 hours with full transparency.",

                "⭐ Community Standards: Report suspicious activity. We maintain fair competition for all players."
            ]
        },
        {
            heading: "Liability & Disclaimers",
            content: [
                "⭐ Game Availability: Service provided as-is. Temporary outages possible for maintenance.",

                "⭐ Technical Issues: Not liable for losses due to device problems, network issues, or World App connectivity.",

                "⭐ Prize Liability: Prizes distributed based on final leaderboard. Technical disputes resolved fairly.",

                "⭐ Changes: Terms may update with advance notice. Continued play constitutes acceptance."
            ]
        }
    ];

    return (
        <div className="h-full overflow-y-auto px-4 py-6">
            <div className="space-y-4">
                {termsData.map((section, index) => (
                    <div
                        key={index}
                        className="bg-gradient-to-r from-[rgba(0,245,255,0.1)] to-[rgba(147,51,234,0.1)] border border-[#00F5FF] border-opacity-30 rounded-lg p-6 backdrop-blur-[10px]"
                    >
                        <h3 className="text-[#00F5FF] text-lg font-bold mb-4 font-['Orbitron'] text-shadow-[0_0_10px_rgba(0,245,255,0.5)]">
                            {section.heading}
                        </h3>
                        <div className="space-y-3">
                            {section.content.map((item, itemIndex) => (
                                <p key={itemIndex} className="text-white text-sm leading-relaxed">
                                    {item}
                                </p>
                            ))}
                        </div>
                    </div>
                ))}

                {/* Support Navigation */}
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
        </div>
    );
}