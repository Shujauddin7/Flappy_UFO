"use client";

import React from 'react';

interface GameNotificationProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message: string;
    type?: 'success' | 'error' | 'warning' | 'info';
    icon?: string;
}

export const GameNotification: React.FC<GameNotificationProps> = ({
    isOpen,
    onClose,
    title,
    message,
    type = 'info',
    icon
}) => {
    if (!isOpen) return null;

    const getTypeStyles = () => {
        switch (type) {
            case 'success':
                return {
                    border: 'border-green-500',
                    glow: 'shadow-[0_0_30px_rgba(34,197,94,0.3)]',
                    icon: icon || '✅',
                    iconColor: 'text-green-400'
                };
            case 'error':
                return {
                    border: 'border-red-500',
                    glow: 'shadow-[0_0_30px_rgba(239,68,68,0.3)]',
                    icon: icon || '❌',
                    iconColor: 'text-red-400'
                };
            case 'warning':
                return {
                    border: 'border-yellow-500',
                    glow: 'shadow-[0_0_30px_rgba(234,179,8,0.3)]',
                    icon: icon || '⚠️',
                    iconColor: 'text-yellow-400'
                };
            default:
                return {
                    border: 'border-cyan-500',
                    glow: 'shadow-[0_0_30px_rgba(6,182,212,0.3)]',
                    icon: icon || 'ℹ️',
                    iconColor: 'text-cyan-400'
                };
        }
    };

    const styles = getTypeStyles();

    return (
        <div
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
            style={{ backdropFilter: 'blur(8px)' }}
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black bg-opacity-70"
                onClick={onClose}
            />

            {/* Modal */}
            <div
                className={`relative bg-gradient-to-b from-gray-900 to-black border-2 ${styles.border} ${styles.glow} rounded-2xl p-6 max-w-md w-full animate-[modalSlideIn_0.3s_ease-out]`}
                style={{
                    animation: 'modalSlideIn 0.3s ease-out'
                }}
            >
                {/* Icon */}
                <div className="flex justify-center mb-4">
                    <div className={`text-6xl ${styles.iconColor} animate-bounce`}>
                        {styles.icon}
                    </div>
                </div>

                {/* Title */}
                <h3
                    className={`text-2xl font-bold text-center mb-3 ${styles.iconColor}`}
                    style={{
                        textShadow: `0 0 20px currentColor`,
                        fontFamily: "'Orbitron', monospace"
                    }}
                >
                    {title}
                </h3>

                {/* Message */}
                <p className="text-gray-300 text-center mb-6 leading-relaxed">
                    {message}
                </p>

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className={`w-full py-3 px-6 rounded-lg font-bold text-white transition-all duration-200 ${
                        type === 'success' ? 'bg-green-600 hover:bg-green-700' :
                        type === 'error' ? 'bg-red-600 hover:bg-red-700' :
                        type === 'warning' ? 'bg-yellow-600 hover:bg-yellow-700' :
                        'bg-cyan-600 hover:bg-cyan-700'
                    }`}
                    style={{
                        boxShadow: `0 0 20px ${
                            type === 'success' ? 'rgba(34,197,94,0.4)' :
                            type === 'error' ? 'rgba(239,68,68,0.4)' :
                            type === 'warning' ? 'rgba(234,179,8,0.4)' :
                            'rgba(6,182,212,0.4)'
                        }`
                    }}
                >
                    GOT IT
                </button>
            </div>
        </div>
    );
};
