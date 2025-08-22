"use client";

import { useState, useEffect } from 'react';

interface DebugLog {
    timestamp: string;
    type: 'info' | 'error' | 'success' | 'warning';
    message: string;
}

export default function MobileDebugConsole() {
    const [logs, setLogs] = useState<DebugLog[]>([]);
    const [isVisible, setIsVisible] = useState(false);

    // Only show debug console in development, never in production
    const isProduction = typeof window !== 'undefined' &&
        (window.location.hostname === 'flappyufo.vercel.app' ||
            window.location.hostname.includes('vercel.app') ||
            process.env.NODE_ENV === 'production');

    const showDebugConsole = !isProduction &&
        (process.env.NEXT_PUBLIC_SHOW_DEV_TOOLS === 'true' ||
            (typeof window !== 'undefined' &&
                (window.location.hostname.includes('flappyufo-git-dev-shujauddin') ||
                    window.location.hostname.includes('msshuj') ||
                    window.location.href.includes('git-dev-shujauddin'))));

    useEffect(() => {
        if (!showDebugConsole) return;

        // Override console methods to capture logs
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;

        console.log = (...args: unknown[]) => {
            originalLog.apply(console, args);
            const message = args.map(arg =>
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ');

            if (message.includes('🔍') || message.includes('✅') || message.includes('❌') || message.includes('📋')) {
                setLogs(prev => [...prev.slice(-9), {
                    timestamp: new Date().toLocaleTimeString(),
                    type: 'info',
                    message
                }]);
            }
        };

        console.error = (...args: unknown[]) => {
            originalError.apply(console, args);
            const message = args.map(arg =>
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ');

            setLogs(prev => [...prev.slice(-9), {
                timestamp: new Date().toLocaleTimeString(),
                type: 'error',
                message
            }]);
        };

        console.warn = (...args: unknown[]) => {
            originalWarn.apply(console, args);
            const message = args.map(arg =>
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ');

            setLogs(prev => [...prev.slice(-9), {
                timestamp: new Date().toLocaleTimeString(),
                type: 'warning',
                message
            }]);
        };

        return () => {
            console.log = originalLog;
            console.error = originalError;
            console.warn = originalWarn;
        };
    }, [showDebugConsole]);

    if (!showDebugConsole) {
        return null;
    }

    return (
        <>
            {/* Toggle Button */}
            <button
                onClick={() => setIsVisible(!isVisible)}
                style={{
                    position: 'fixed',
                    bottom: '10px',
                    left: '10px',
                    background: 'rgba(0, 0, 0, 0.8)',
                    color: 'white',
                    border: '2px solid #44ff44',
                    borderRadius: '50%',
                    width: '50px',
                    height: '50px',
                    fontSize: '16px',
                    zIndex: 10000,
                    cursor: 'pointer'
                }}
            >
                🐛
            </button>

            {/* Debug Panel */}
            {isVisible && (
                <div style={{
                    position: 'fixed',
                    bottom: '70px',
                    left: '10px',
                    right: '10px',
                    maxHeight: '300px',
                    background: 'rgba(0, 0, 0, 0.9)',
                    color: 'white',
                    padding: '10px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    zIndex: 9999,
                    border: '2px solid #44ff44',
                    overflow: 'auto'
                }}>
                    <div style={{ marginBottom: '10px', fontWeight: 'bold' }}>
                        📱 Mobile Debug Console
                        <button
                            onClick={() => setLogs([])}
                            style={{
                                float: 'right',
                                background: '#ff4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '3px',
                                padding: '2px 6px',
                                fontSize: '10px',
                                cursor: 'pointer'
                            }}
                        >
                            Clear
                        </button>
                    </div>

                    {logs.length === 0 ? (
                        <div style={{ color: '#aaa', fontStyle: 'italic' }}>
                            No debug logs yet. Sign in to see authentication logs.
                        </div>
                    ) : (
                        logs.map((log, index) => (
                            <div
                                key={index}
                                style={{
                                    marginBottom: '8px',
                                    padding: '4px',
                                    borderRadius: '3px',
                                    background: log.type === 'error' ? 'rgba(255, 68, 68, 0.2)' :
                                        log.type === 'warning' ? 'rgba(255, 165, 0, 0.2)' :
                                            log.type === 'success' ? 'rgba(68, 255, 68, 0.2)' :
                                                'rgba(255, 255, 255, 0.1)',
                                    border: `1px solid ${log.type === 'error' ? '#ff4444' :
                                        log.type === 'warning' ? '#ffa500' :
                                            log.type === 'success' ? '#44ff44' :
                                                '#666'}`
                                }}
                            >
                                <div style={{ fontSize: '10px', color: '#aaa' }}>
                                    {log.timestamp}
                                </div>
                                <div style={{ fontSize: '11px', whiteSpace: 'pre-wrap' }}>
                                    {log.message}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </>
    );
}
