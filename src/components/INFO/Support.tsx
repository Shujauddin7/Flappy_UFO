'use client';

export default function Support() {
    return (
        <div className="h-full overflow-y-auto px-4 py-6">
            <div className="bg-[#1D4ED8] bg-opacity-20 border border-[#00F5FF] border-opacity-30 rounded-lg p-6 space-y-6">

                <section className="space-y-4">
                    <h3 className="text-[#00F5FF] text-lg font-bold">Need Help? We&apos;ve Got You Covered! 🛸</h3>
                    <div className="text-[#E5E7EB] text-sm sm:text-base leading-relaxed">
                        <p>
                            Our support team is here to help you navigate the galaxy and resolve any issues you encounter while playing Flappy UFO.
                        </p>
                    </div>
                </section>

                <section className="space-y-4">
                    <h3 className="text-[#00F5FF] text-lg font-bold">Quick Help</h3>
                    <div className="space-y-4">
                        <div className="bg-[#0B0C10] bg-opacity-60 rounded-lg p-4 border-l-4 border-[#9333EA]">
                            <h4 className="text-[#9333EA] font-semibold mb-2">🎮 Game Issues</h4>
                            <p className="text-[#E5E7EB] text-sm">
                                Game not loading? UFO not responding? Try refreshing the app or restarting World App. Most issues resolve with a fresh start.
                            </p>
                        </div>

                        <div className="bg-[#0B0C10] bg-opacity-60 rounded-lg p-4 border-l-4 border-[#FFD700]">
                            <h4 className="text-[#FFD700] font-semibold mb-2">💰 Payment Problems</h4>
                            <p className="text-[#E5E7EB] text-sm">
                                Payment failed or entry not recorded? Check your World App wallet balance first. All payments are verified before creating entries.
                            </p>
                        </div>

                        <div className="bg-[#0B0C10] bg-opacity-60 rounded-lg p-4 border-l-4 border-[#EC4899]">
                            <h4 className="text-[#EC4899] font-semibold mb-2">🆔 Verification Issues</h4>
                            <p className="text-[#E5E7EB] text-sm">
                                Can&apos;t get verified pricing? Ensure you&apos;re completing World ID Orb verification within the tournament entry flow. Verification resets weekly.
                            </p>
                        </div>

                        <div className="bg-[#0B0C10] bg-opacity-60 rounded-lg p-4 border-l-4 border-[#00F5FF]">
                            <h4 className="text-[#00F5FF] font-semibold mb-2">🏆 Tournament Questions</h4>
                            <p className="text-[#E5E7EB] text-sm">
                                Confused about tournament timing or rules? Check the FAQ section for detailed explanations of all tournament mechanics.
                            </p>
                        </div>
                    </div>
                </section>

                <section className="space-y-4">
                    <h3 className="text-[#00F5FF] text-lg font-bold">Contact Information</h3>
                    <div className="bg-[#0B0C10] bg-opacity-40 rounded-lg p-4 space-y-3">
                        <div className="flex items-center space-x-3">
                            <span className="text-[#00F5FF] text-lg">📧</span>
                            <div>
                                <p className="text-[#E5E7EB] font-medium">Email Support</p>
                                <p className="text-[#00F5FF] text-sm">support@flappyufo.com</p>
                            </div>
                        </div>

                        <div className="flex items-center space-x-3">
                            <span className="text-[#9333EA] text-lg">💬</span>
                            <div>
                                <p className="text-[#E5E7EB] font-medium">Discord Community</p>
                                <p className="text-[#9333EA] text-sm">Join our Discord server for real-time help</p>
                            </div>
                        </div>

                        <div className="flex items-center space-x-3">
                            <span className="text-[#FFD700] text-lg">🐦</span>
                            <div>
                                <p className="text-[#E5E7EB] font-medium">Twitter Updates</p>
                                <p className="text-[#FFD700] text-sm">@FlappyUFO for game updates and announcements</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="space-y-4">
                    <h3 className="text-[#00F5FF] text-lg font-bold">Report Issues</h3>
                    <div className="text-[#E5E7EB] text-sm sm:text-base leading-relaxed space-y-3">
                        <p>
                            <strong className="text-[#EC4899]">Bug Reports:</strong> Found a bug? Describe what happened, when it occurred, and what you expected to happen.
                        </p>
                        <p>
                            <strong className="text-[#EC4899]">Payment Disputes:</strong> Include your World ID, transaction time, and payment proof ID for faster resolution.
                        </p>
                        <p>
                            <strong className="text-[#EC4899]">Score Disputes:</strong> Provide your game session details and the score in question.
                        </p>
                    </div>
                </section>

                <section className="space-y-4">
                    <h3 className="text-[#00F5FF] text-lg font-bold">Response Times</h3>
                    <div className="text-[#E5E7EB] text-sm sm:text-base leading-relaxed space-y-2">
                        <p>🚀 <strong className="text-[#00F5FF]">Critical Issues:</strong> Within 2 hours</p>
                        <p>⚡ <strong className="text-[#9333EA]">Payment Problems:</strong> Within 4 hours</p>
                        <p>📞 <strong className="text-[#FFD700]">General Support:</strong> Within 24 hours</p>
                        <p>💬 <strong className="text-[#EC4899]">Feature Requests:</strong> Within 48 hours</p>
                    </div>
                </section>

                <section className="space-y-4">
                    <h3 className="text-[#00F5FF] text-lg font-bold">Useful Resources</h3>
                    <div className="space-y-3">
                        <div className="bg-[#0B0C10] bg-opacity-40 rounded-lg p-3">
                            <p className="text-[#E5E7EB] text-sm">
                                📖 <strong className="text-[#00F5FF]">World App Documentation:</strong> Learn more about World ID and World App features
                            </p>
                        </div>
                        <div className="bg-[#0B0C10] bg-opacity-40 rounded-lg p-3">
                            <p className="text-[#E5E7EB] text-sm">
                                🎯 <strong className="text-[#9333EA]">Game Tips:</strong> Check our FAQ section for strategies and gameplay tips
                            </p>
                        </div>
                        <div className="bg-[#0B0C10] bg-opacity-40 rounded-lg p-3">
                            <p className="text-[#E5E7EB] text-sm">
                                🛡️ <strong className="text-[#FFD700]">Security:</strong> Learn about our anti-cheat measures and fair play policies
                            </p>
                        </div>
                    </div>
                </section>

                <div className="text-center pt-6 border-t border-[#00F5FF] border-opacity-20">
                    <p className="text-[#00F5FF] text-sm opacity-80 mb-2">
                        Still need help? Don&apos;t hesitate to reach out!
                    </p>
                    <p className="text-[#E5E7EB] text-xs opacity-70">
                        Support Team Available 24/7 | Average Response: &lt;4 hours 🚀
                    </p>
                </div>
            </div>
        </div>
    );
}