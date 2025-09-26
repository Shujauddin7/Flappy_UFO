'use client';

export default function Support() {
    // Helper function to render text with clickable email links
    const renderContentWithLinks = (text: string) => {
        // Regular expression to find email addresses
        const emailRegex = /([\w\.-]+@[\w\.-]+\.\w+)/g;

        // Split text by email addresses
        const parts = text.split(emailRegex);

        return parts.map((part, index) => {
            // Check if this part is an email
            if (emailRegex.test(part)) {
                return (
                    <a
                        key={index}
                        href={`mailto:${part}`}
                        className="text-[#00F5FF] hover:text-[#66FFFF] underline underline-offset-2 font-semibold transition-colors duration-200 hover:glow"
                        style={{
                            textShadow: '0 0 8px rgba(0, 245, 255, 0.6)',
                            textDecoration: 'underline',
                            textUnderlineOffset: '3px'
                        }}
                        onClick={(e) => {
                            // Ensure the mailto link works on mobile devices
                            e.preventDefault();
                            window.location.href = `mailto:${part}`;
                        }}
                    >
                        {part}
                    </a>
                );
            }
            return part;
        });
    };

    const supportData = [
        {
            heading: "Need Help? We've Got You Covered! 🛸",
            content: [
                "Our support team is here to help you navigate the galaxy and resolve any issues you encounter while playing Flappy UFO.",
                "Email: flappyufo.help@gmail.com"
            ]
        },
        {
            heading: "Quick Help",
            content: [
                "🎮 Game Issues: Game not loading? UFO not responding? Try refreshing the app or restarting World App. Most issues resolve with a fresh start.",
                "💰 Payment Problems: Payment failed or entry not recorded? Check your World App wallet balance first. All payments are verified before creating entries.",
                "🆔 Verification Issues: Can't get verified pricing? Ensure you're completing World ID Orb verification within the tournament entry flow. Verification resets weekly.",
                "🏆 Tournament Questions: Confused about tournament timing or rules? Check the FAQ section for detailed explanations of all tournament mechanics."
            ]
        },
        {
            heading: "Report Issues",
            content: [
                "Bug Reports: Found a bug? Describe what happened, when it occurred, and what you expected to happen.",
                "Payment Disputes: Include your World ID, transaction time, and payment proof ID for faster resolution.",
                "Score Disputes: Provide your game session details and the score in question."
            ]
        },
        {
            heading: "Have Ideas? We'd Love to Hear! 💡",
            content: [
                "💡 Feature Suggestions: Got ideas to make Flappy UFO even more fun? We're always looking for ways to improve the game experience!",
                "🎮 Gameplay Ideas: Think of new game modes, power-ups, or challenges? Share your creative vision with us!",
                "🌟 Community Feedback: Your input shapes the future of Flappy UFO. Every suggestion is valued and considered!",
                "📝 Contact: Drop us your ideas at flappyufo.help@gmail.com - let's make this galaxy adventure even more amazing together!"
            ]
        },

        {
            heading: "Player Resources",
            content: [
                "� FAQ Section: Complete guide to gameplay, tournaments, and payment systems",
                "📋 Terms: All the legal details and game rules in one place",
                "🎯 Tips: Practice mode is perfect for honing your UFO flying skills before tournaments!"
            ]
        }
    ];

    return (
        <div className="h-full overflow-y-auto px-4 py-6"
            style={{
                WebkitOverflowScrolling: 'touch',
                touchAction: 'pan-y'
            }}>
            <div className="space-y-4">
                {supportData.map((section, index) => (
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
                                    {renderContentWithLinks(item)}
                                </p>
                            ))}
                        </div>
                    </div>
                ))}

                {/* Footer */}
                <div className="text-center pt-6 border-t border-[#00F5FF] border-opacity-20">
                    <p className="text-[#00F5FF] text-sm opacity-80">
                        Still need help? Don&apos;t hesitate to reach out!
                    </p>
                </div>
            </div>
        </div>
    );
}