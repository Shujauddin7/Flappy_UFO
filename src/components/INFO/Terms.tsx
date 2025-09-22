'use client';

export default function Terms() {
    return (
        <div className="h-full overflow-y-auto px-4 py-6">
            <div className="bg-[#1D4ED8] bg-opacity-20 border border-[#00F5FF] border-opacity-30 rounded-lg p-6 space-y-6">

                <section className="space-y-4">
                    <h3 className="text-[#00F5FF] text-lg font-bold">Game Terms & Conditions</h3>
                    <div className="text-[#E5E7EB] text-sm sm:text-base leading-relaxed space-y-3">
                        <p>
                            By playing Flappy UFO, you agree to these terms. This is a skill-based game integrated with World App and Worldcoin ecosystem.
                        </p>
                        <p>
                            <strong className="text-[#00F5FF]">Eligibility:</strong> Must have World App installed and World ID for tournament participation. No geographic restrictions apply.
                        </p>
                        <p>
                            <strong className="text-[#00F5FF]">Fair Play:</strong> This is a skill-based game - no gambling mechanics. All rewards earned through gameplay ability only.
                        </p>
                    </div>
                </section>

                <section className="space-y-4">
                    <h3 className="text-[#00F5FF] text-lg font-bold">Tournament Rules</h3>
                    <div className="text-[#E5E7EB] text-sm sm:text-base leading-relaxed space-y-3">
                        <p>
                            <strong className="text-[#9333EA]">Weekly Schedule:</strong> Tournaments run Sunday 15:30 UTC to Sunday 15:30 UTC (7 days).
                        </p>
                        <p>
                            <strong className="text-[#9333EA]">Entry Fees:</strong> 1.0 WLD standard entry or 0.9 WLD for World ID Orb verified users (verification resets weekly).
                        </p>
                        <p>
                            <strong className="text-[#9333EA]">Continue Policy:</strong> One continue per game by paying entry fee again. After second crash, new entry required.
                        </p>
                        <p>
                            <strong className="text-[#9333EA]">Score Recording:</strong> Only your highest score across all entries counts. Multiple entries allowed.
                        </p>
                        <p>
                            <strong className="text-[#9333EA]">Grace Period:</strong> 30 minutes before tournament end (15:00-15:30 UTC) - no new entries accepted.
                        </p>
                    </div>
                </section>

                <section className="space-y-4">
                    <h3 className="text-[#00F5FF] text-lg font-bold">Payment & Prize Terms</h3>
                    <div className="text-[#E5E7EB] text-sm sm:text-base leading-relaxed space-y-3">
                        <p>
                            <strong className="text-[#FFD700]">Prize Distribution:</strong> Top 10 players share 70% of collected WLD. Admin fee is 30%.
                        </p>
                        <p>
                            <strong className="text-[#FFD700]">Minimum Players:</strong> If fewer than 5 players join, full refunds issued to all participants.
                        </p>
                        <p>
                            <strong className="text-[#FFD700]">Payment Processing:</strong> All transactions processed through World App Pay API with verification.
                        </p>
                        <p>
                            <strong className="text-[#FFD700]">Refund Policy:</strong> Refunds only issued for technical failures or tournaments with under 5 players.
                        </p>
                        <p>
                            <strong className="text-[#FFD700]">Payout Timing:</strong> Winners notified and paid within 24 hours of tournament end.
                        </p>
                    </div>
                </section>

                <section className="space-y-4">
                    <h3 className="text-[#00F5FF] text-lg font-bold">World App Compliance</h3>
                    <div className="text-[#E5E7EB] text-sm sm:text-base leading-relaxed space-y-3">
                        <p>
                            <strong className="text-[#EC4899]">Privacy:</strong> No wallet addresses displayed publicly. Usernames shown when available.
                        </p>
                        <p>
                            <strong className="text-[#EC4899]">Anti-Cheat:</strong> Backend validation for all scores and payments. Cheating results in disqualification.
                        </p>
                        <p>
                            <strong className="text-[#EC4899]">Data Security:</strong> All data encrypted and stored securely via Supabase with Row Level Security.
                        </p>
                        <p>
                            <strong className="text-[#EC4899]">No Gambling:</strong> Strictly skill-based gameplay. No random elements in prize distribution.
                        </p>
                    </div>
                </section>

                <section className="space-y-4">
                    <h3 className="text-[#00F5FF] text-lg font-bold">Account & Verification</h3>
                    <div className="text-[#E5E7EB] text-sm sm:text-base leading-relaxed space-y-3">
                        <p>
                            <strong className="text-[#9333EA]">World ID Required:</strong> Sign-in persists across sessions. Verification resets weekly for pricing.
                        </p>
                        <p>
                            <strong className="text-[#9333EA]">Account Security:</strong> You&apos;re responsible for keeping your World App secure. No account sharing allowed.
                        </p>
                        <p>
                            <strong className="text-[#9333EA]">Data Retention:</strong> Tournament data archived for 7 days post-tournament, then deleted.
                        </p>
                    </div>
                </section>

                <section className="space-y-4">
                    <h3 className="text-[#00F5FF] text-lg font-bold">Liability & Disputes</h3>
                    <div className="text-[#E5E7EB] text-sm sm:text-base leading-relaxed space-y-3">
                        <p>
                            Game provided &ldquo;as-is&rdquo; without warranties. Players participate at their own risk. Admin decisions on disputes are final.
                        </p>
                        <p>
                            Technical issues during gameplay may result in score restoration or entry refund at admin discretion.
                        </p>
                    </div>
                </section>

                <section className="space-y-4">
                    <h3 className="text-[#00F5FF] text-lg font-bold">Changes to Terms</h3>
                    <div className="text-[#E5E7EB] text-sm sm:text-base leading-relaxed">
                        <p>
                            Terms may be updated for World App compliance or game improvements. Major changes will be announced in-game.
                        </p>
                    </div>
                </section>

                <div className="text-center pt-6 border-t border-[#00F5FF] border-opacity-20">
                    <p className="text-[#00F5FF] text-sm opacity-80">
                        Last updated: September 2024 | Questions? Check our Support section! 🛸
                    </p>
                </div>
            </div>
        </div>
    );
}