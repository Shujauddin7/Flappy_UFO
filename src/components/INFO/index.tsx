'use client';

import { useState, useCallback } from 'react';
import FAQ from './FAQ';

import Terms from './Terms';
import Support from './Support';

interface InfoModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type InfoSection = 'faq' | 'terms' | 'support';

export default function InfoModal({ isOpen, onClose }: InfoModalProps) {
    const [activeSection, setActiveSection] = useState<InfoSection>('faq');

    // Stable close handler
    const handleClose = useCallback(() => {
        onClose();
    }, [onClose]);

    if (!isOpen) {
        return null;
    }

    const handleSectionChange = (section: InfoSection) => {
        setActiveSection(section);
    };

    const renderContent = () => {
        switch (activeSection) {
            case 'faq':
                return <FAQ onSupportClick={() => setActiveSection('support')} />;
            case 'terms':
                return <Terms onSupportClick={() => setActiveSection('support')} />;
            case 'support':
                return <Support />;
            default:
                return <FAQ onSupportClick={() => setActiveSection('support')} />;
        }
    };

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            style={{ zIndex: 9999 }}
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-[#0B0C10] bg-opacity-95 backdrop-blur-sm"
                onClick={handleClose}
            />

            {/* Modal Content */}
            <div 
                className="relative w-full h-full max-w-4xl mx-auto bg-[#0B0C10] border border-[#00F5FF] border-opacity-30 flex flex-col"
                style={{
                    maxHeight: '100dvh'
                }}
            >

                {/* Fixed Navigation Header - Countdown Timer Style */}
                <div className="flex-shrink-0">
                    {/* Top Bar with Title and Close */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-[#00F5FF] border-opacity-20">
                        <div className="flex items-center space-x-2">
                            <span className="text-xl">🛸</span>
                            <h2 className="text-[#00F5FF] font-bold text-lg">Flappy UFO</h2>
                        </div>
                        <button
                            onClick={handleClose}
                            className="w-8 h-8 flex items-center justify-center text-[#E5E7EB] hover:text-[#00F5FF] transition-colors duration-200 text-xl font-bold"
                            aria-label="Close Info"
                        >
                            ×
                        </button>
                    </div>

                    {/* Navigation Tabs - Countdown Timer Style */}
                    <div className="flex justify-center gap-3 p-4">
                        <button
                            onClick={() => handleSectionChange('faq')}
                            className={`px-4 py-2 text-sm font-medium font-['Orbitron'] rounded-full border-2 transition-all duration-200 ${activeSection === 'faq'
                                ? 'text-[#00F5FF] bg-gradient-to-r from-[rgba(0,245,255,0.2)] to-[rgba(147,51,234,0.2)] border-[#00F5FF] text-shadow-[0_0_15px_rgba(0,245,255,0.8)] backdrop-blur-[10px] shadow-[0_0_20px_rgba(0,245,255,0.3)]'
                                : 'text-[#E5E7EB] bg-gradient-to-r from-[rgba(0,245,255,0.05)] to-[rgba(147,51,234,0.05)] border-[#00F5FF] border-opacity-20 hover:border-opacity-40 hover:text-[#00F5FF]'
                                }`}
                        >
                            FAQ
                        </button>
                        <button
                            onClick={() => handleSectionChange('terms')}
                            className={`px-4 py-2 text-sm font-medium font-['Orbitron'] rounded-full border-2 transition-all duration-200 ${activeSection === 'terms'
                                ? 'text-[#00F5FF] bg-gradient-to-r from-[rgba(0,245,255,0.2)] to-[rgba(147,51,234,0.2)] border-[#00F5FF] text-shadow-[0_0_15px_rgba(0,245,255,0.8)] backdrop-blur-[10px] shadow-[0_0_20px_rgba(0,245,255,0.3)]'
                                : 'text-[#E5E7EB] bg-gradient-to-r from-[rgba(0,245,255,0.05)] to-[rgba(147,51,234,0.05)] border-[#00F5FF] border-opacity-20 hover:border-opacity-40 hover:text-[#00F5FF]'
                                }`}
                        >
                            Terms
                        </button>
                        <button
                            onClick={() => handleSectionChange('support')}
                            className={`px-4 py-2 text-sm font-medium font-['Orbitron'] rounded-full border-2 transition-all duration-200 ${activeSection === 'support'
                                ? 'text-[#00F5FF] bg-gradient-to-r from-[rgba(0,245,255,0.2)] to-[rgba(147,51,234,0.2)] border-[#00F5FF] text-shadow-[0_0_15px_rgba(0,245,255,0.8)] backdrop-blur-[10px] shadow-[0_0_20px_rgba(0,245,255,0.3)]'
                                : 'text-[#E5E7EB] bg-gradient-to-r from-[rgba(0,245,255,0.05)] to-[rgba(147,51,234,0.05)] border-[#00F5FF] border-opacity-20 hover:border-opacity-40 hover:text-[#00F5FF]'
                                }`}
                        >
                            Support
                        </button>
                    </div>
                </div>

                {/* Content Area - AGGRESSIVE MOBILE SCROLLING FIX */}
                <div
                    className="flex-1"
                    style={{
                        overflow: 'auto',
                        overflowY: 'scroll',
                        WebkitOverflowScrolling: 'touch',
                        touchAction: 'pan-y',
                        height: '100%',
                        maxHeight: '100%',
                        position: 'relative'
                    }}
                >
                    <div style={{ minHeight: '100%', padding: '0' }}>
                        {renderContent()}
                    </div>
                </div>
            </div>
        </div>
    );
}