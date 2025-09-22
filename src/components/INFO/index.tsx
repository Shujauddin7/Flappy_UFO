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
                return <FAQ />;
            case 'terms':
                return <Terms />;
            case 'support':
                return <Support />;
            default:
                return <FAQ />;
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
            <div className="relative w-full h-full max-w-4xl mx-auto bg-[#0B0C10] border border-[#00F5FF] border-opacity-30 flex flex-col">

                {/* Fixed Navigation Header */}
                <div className="flex-shrink-0 bg-[#1D4ED8] bg-opacity-30 border-b border-[#00F5FF] border-opacity-30">
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

                    {/* Navigation Tabs */}
                    <div className="flex">
                        <button
                            onClick={() => handleSectionChange('faq')}
                            className={`flex-1 py-3 px-4 text-sm font-medium transition-all duration-200 ${activeSection === 'faq'
                                ? 'text-[#00F5FF] bg-[#00F5FF] bg-opacity-10 border-b-2 border-[#00F5FF]'
                                : 'text-[#E5E7EB] hover:text-[#00F5FF] hover:bg-[#00F5FF] hover:bg-opacity-5'
                                }`}
                        >
                            FAQ
                        </button>
                        <button
                            onClick={() => handleSectionChange('terms')}
                            className={`flex-1 py-3 px-4 text-sm font-medium transition-all duration-200 ${activeSection === 'terms'
                                ? 'text-[#00F5FF] bg-[#00F5FF] bg-opacity-10 border-b-2 border-[#00F5FF]'
                                : 'text-[#E5E7EB] hover:text-[#00F5FF] hover:bg-[#00F5FF] hover:bg-opacity-5'
                                }`}
                        >
                            Terms
                        </button>
                        <button
                            onClick={() => handleSectionChange('support')}
                            className={`flex-1 py-3 px-4 text-sm font-medium transition-all duration-200 ${activeSection === 'support'
                                ? 'text-[#00F5FF] bg-[#00F5FF] bg-opacity-10 border-b-2 border-[#00F5FF]'
                                : 'text-[#E5E7EB] hover:text-[#00F5FF] hover:bg-[#00F5FF] hover:bg-opacity-5'
                                }`}
                        >
                            Support
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-hidden">
                    <div className="h-full transition-all duration-300 ease-in-out">
                        {renderContent()}
                    </div>
                </div>
            </div>
        </div>
    );
}