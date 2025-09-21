'use client';

import React, { useState } from 'react';
import Link from 'next/link';

type ActiveSection = 'faq' | 'terms' | 'support';

const InfoPage = () => {
  const [activeSection, setActiveSection] = useState<ActiveSection>('faq');
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setOpenFAQ(openFAQ === index ? null : index);
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
      question: "How are prizes distributed?",
      answer: "70% of total entry fees go to winners, 30% covers development costs. Top 10 players share the prize pool with 1st place getting the largest share."
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
    <div className="min-h-screen bg-[#0B0C10] text-white overflow-y-auto">
      {/* Header */}
      <div className="bg-[#1D4ED8] bg-opacity-20 backdrop-blur-sm border-b border-[#00F5FF] border-opacity-20 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl" style={{filter: 'drop-shadow(0 0 8px #00F5FF)'}}>🛸</span>
              <h1 className="text-2xl font-bold text-[#00F5FF]">
                Flappy UFO Info
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

      <div className="max-w-4xl mx-auto px-4 py-6">
        
        {/* Navigation Tabs */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => setActiveSection('faq')}
            className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-200 ${
              activeSection === 'faq'
                ? 'bg-[#00F5FF] bg-opacity-20 text-[#00F5FF] border-2 border-[#00F5FF] border-opacity-50'
                : 'bg-[#374151] text-[#E5E7EB] border-2 border-transparent hover:border-[#00F5FF] hover:border-opacity-30'
            }`}
          >
            ❓ FAQ
          </button>
          <button
            onClick={() => setActiveSection('terms')}
            className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-200 ${
              activeSection === 'terms'
                ? 'bg-[#00F5FF] bg-opacity-20 text-[#00F5FF] border-2 border-[#00F5FF] border-opacity-50'
                : 'bg-[#374151] text-[#E5E7EB] border-2 border-transparent hover:border-[#00F5FF] hover:border-opacity-30'
            }`}
          >
            📋 Terms
          </button>
          <button
            onClick={() => setActiveSection('support')}
            className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-200 ${
              activeSection === 'support'
                ? 'bg-[#00F5FF] bg-opacity-20 text-[#00F5FF] border-2 border-[#00F5FF] border-opacity-50'
                : 'bg-[#374151] text-[#E5E7EB] border-2 border-transparent hover:border-[#00F5FF] hover:border-opacity-30'
            }`}
          >
            🛠️ Support
          </button>
        </div>

        {/* Content Container - Fixed height with scroll */}
        <div className="bg-[#1D4ED8] bg-opacity-10 rounded-2xl border border-[#00F5FF] border-opacity-20 overflow-hidden" style={{height: 'calc(100vh - 200px)'}}>
          <div className="h-full overflow-y-auto p-6">
            
            {/* FAQ Section */}
            {activeSection === 'faq' && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-[#00F5FF] mb-6 flex items-center gap-3">
                  <span className="text-3xl">❓</span>
                  Frequently Asked Questions
                </h2>
                {faqData.map((faq, index) => (
                  <div key={index} className="border border-[#374151] rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleFAQ(index)}
                      className="w-full px-6 py-4 text-left bg-[#1F2937] hover:bg-[#374151] transition-colors duration-200 flex justify-between items-center"
                    >
                      <span className="font-medium text-[#E5E7EB]">{faq.question}</span>
                      <span className="text-[#00F5FF] text-xl font-bold transform transition-transform duration-200" 
                            style={{transform: openFAQ === index ? 'rotate(45deg)' : 'rotate(0deg)'}}>
                        +
                      </span>
                    </button>
                    {openFAQ === index && (
                      <div className="px-6 py-4 bg-[#111827] border-t border-[#374151] animate-slide-down">
                        <p className="text-[#9CA3AF] leading-relaxed">{faq.answer}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Terms Section */}
            {activeSection === 'terms' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-[#00F5FF] mb-6 flex items-center gap-3">
                  <span className="text-3xl">📋</span>
                  Terms of Service
                </h2>
                
                <div className="space-y-6 text-[#E5E7EB]">
                  <div>
                    <h3 className="text-lg font-semibold text-[#00F5FF] mb-3">Game Rules</h3>
                    <ul className="space-y-2 text-[#9CA3AF] ml-4">
                      <li>• Navigate your UFO by tapping to fly up and releasing to fall</li>
                      <li>• Avoid planets, asteroids, and other space obstacles</li>
                      <li>• Collect stars in Practice Mode to earn continue coins</li>
                      <li>• Each obstacle passed increases your score</li>
                      <li>• Game ends when your UFO hits an obstacle</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-[#00F5FF] mb-3">Fair Play Policy</h3>
                    <ul className="space-y-2 text-[#9CA3AF] ml-4">
                      <li>• No cheating, hacking, or exploiting game mechanics</li>
                      <li>• Use of automated tools or bots is prohibited</li>
                      <li>• Suspicious scores may be investigated and removed</li>
                      <li>• Multiple accounts to gain unfair advantages are not allowed</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-[#00F5FF] mb-3">Tournament Rules</h3>
                    <ul className="space-y-2 text-[#9CA3AF] ml-4">
                      <li>• Tournaments run weekly from Sunday 15:30 UTC to next Sunday</li>
                      <li>• Entry fee: 1.0 WLD (0.9 WLD with World ID verification)</li>
                      <li>• Prize distribution: 70% to winners, 30% development costs</li>
                      <li>• Top 10 players share the prize pool</li>
                      <li>• Prizes distributed automatically after tournament ends</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-[#00F5FF] mb-3">Payment & Prizes</h3>
                    <ul className="space-y-2 text-[#9CA3AF] ml-4">
                      <li>• All payments processed through Worldcoin (WLD)</li>
                      <li>• Prizes automatically distributed to connected wallets</li>
                      <li>• No refunds for tournament entry fees</li>
                      <li>• Prize calculations are final and cannot be disputed</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Support Section */}
            {activeSection === 'support' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-[#00F5FF] mb-6 flex items-center gap-3">
                  <span className="text-3xl">🛠️</span>
                  Support Center
                </h2>
                
                <div className="space-y-6">
                  
                  <div className="bg-[#1F2937] rounded-lg p-5 border border-[#374151]">
                    <h3 className="text-lg font-semibold text-[#00F5FF] mb-3 flex items-center gap-2">
                      <span>🚀</span> Getting Started
                    </h3>
                    <ul className="space-y-2 text-[#9CA3AF]">
                      <li>• <strong className="text-[#E5E7EB]">Practice Mode:</strong> Start here to learn the game mechanics</li>
                      <li>• <strong className="text-[#E5E7EB]">Collect Stars:</strong> Earn 2 coins per star to continue playing</li>
                      <li>• <strong className="text-[#E5E7EB]">Tournament Mode:</strong> Connect wallet and compete for prizes</li>
                      <li>• <strong className="text-[#E5E7EB]">World ID:</strong> Verify for tournament discounts</li>
                    </ul>
                  </div>

                  <div className="bg-[#1F2937] rounded-lg p-5 border border-[#374151]">
                    <h3 className="text-lg font-semibold text-[#00F5FF] mb-3 flex items-center gap-2">
                      <span>⚠️</span> Common Issues
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <p className="font-medium text-[#E5E7EB]">Game not loading?</p>
                        <p className="text-[#9CA3AF] text-sm">Refresh the page or try a different browser</p>
                      </div>
                      <div>
                        <p className="font-medium text-[#E5E7EB]">Wallet not connecting?</p>
                        <p className="text-[#9CA3AF] text-sm">Make sure you have a Worldcoin-compatible wallet installed</p>
                      </div>
                      <div>
                        <p className="font-medium text-[#E5E7EB]">Score not saving?</p>
                        <p className="text-[#9CA3AF] text-sm">Check your internet connection and try again</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#1F2937] rounded-lg p-5 border border-[#374151]">
                    <h3 className="text-lg font-semibold text-[#00F5FF] mb-3 flex items-center gap-2">
                      <span>💡</span> Tips & Tricks
                    </h3>
                    <ul className="space-y-2 text-[#9CA3AF]">
                      <li>• <strong className="text-[#E5E7EB]">Timing:</strong> Practice your tap timing for smooth flight control</li>
                      <li>• <strong className="text-[#E5E7EB]">Star Collection:</strong> Focus on stars in Practice Mode to build coin reserves</li>
                      <li>• <strong className="text-[#E5E7EB]">Tournament Strategy:</strong> Play Practice Mode first to warm up</li>
                      <li>• <strong className="text-[#E5E7EB]">Mobile Play:</strong> Game works best on mobile devices for touch controls</li>
                    </ul>
                  </div>

                  <div className="bg-[#1F2937] rounded-lg p-5 border border-[#374151]">
                    <h3 className="text-lg font-semibold text-[#00F5FF] mb-3 flex items-center gap-2">
                      <span>📧</span> Contact Us
                    </h3>
                    <div className="space-y-3 text-[#9CA3AF]">
                      <p>Need more help? Reach out to our support team:</p>
                      <div className="space-y-2">
                        <p><strong className="text-[#E5E7EB]">Email:</strong> support@flappyufo.com</p>
                        <p><strong className="text-[#E5E7EB]">Response Time:</strong> 24-48 hours</p>
                        <p><strong className="text-[#E5E7EB]">Support Hours:</strong> Monday-Friday, 9 AM - 6 PM UTC</p>
                      </div>
                      <div className="mt-4 p-3 bg-[#0B0C10] rounded border border-[#00F5FF] border-opacity-30">
                        <p className="text-sm text-[#00F5FF]">
                          <strong>Pro Tip:</strong> Include your wallet address and tournament details when reporting issues for faster resolution.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
          </div>
        </div>

      </div>
    </div>
  );
};

export default InfoPage;