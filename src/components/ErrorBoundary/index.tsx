"use client";

import React, { Component, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
    errorInfo?: React.ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        // Log the error details
        console.error('❌ CRITICAL CRASH CAUGHT:', error);
        console.error('Stack trace:', error.stack);
        console.error('Component stack:', errorInfo.componentStack);

        // Store error details for debugging
        this.setState({
            hasError: true,
            error,
            errorInfo
        });

        // Store crash details in sessionStorage for debugging
        try {
            const crashData = {
                timestamp: new Date().toISOString(),
                error: {
                    message: error.message,
                    stack: error.stack,
                    name: error.name
                },
                componentStack: errorInfo.componentStack,
                url: window.location.href,
                userAgent: navigator.userAgent
            };
            sessionStorage.setItem('last_crash_data', JSON.stringify(crashData));
            console.log('💾 Crash data saved to sessionStorage for debugging');
        } catch (storageError) {
            console.warn('Failed to save crash data:', storageError);
        }
    }

    render() {
        if (this.state.hasError) {
            // Fallback UI
            return this.props.fallback || (
                <div style={{
                    padding: '20px',
                    textAlign: 'center',
                    backgroundColor: '#1a1a1a',
                    color: '#fff',
                    minHeight: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center'
                }}>
                    <h1 style={{ color: '#ff4444', marginBottom: '20px' }}>🚨 App Crashed</h1>
                    <p style={{ maxWidth: '600px', lineHeight: '1.5', marginBottom: '20px' }}>
                        Something went wrong. The error has been logged for debugging.
                    </p>
                    <details style={{ marginBottom: '20px', textAlign: 'left' }}>
                        <summary style={{ cursor: 'pointer', marginBottom: '10px' }}>
                            Click to show error details
                        </summary>
                        <pre style={{
                            backgroundColor: '#333',
                            padding: '15px',
                            borderRadius: '8px',
                            overflow: 'auto',
                            fontSize: '12px',
                            maxWidth: '80vw'
                        }}>
                            <strong>Error:</strong> {this.state.error?.message}
                            {'\n\n'}
                            <strong>Stack:</strong>
                            {'\n'}{this.state.error?.stack}
                            {'\n\n'}
                            <strong>Component Stack:</strong>
                            {'\n'}{this.state.errorInfo?.componentStack}
                        </pre>
                    </details>
                    <button
                        onClick={() => {
                            // Clear error state and try to reload
                            this.setState({ hasError: false, error: undefined, errorInfo: undefined });
                            window.location.reload();
                        }}
                        style={{
                            padding: '12px 24px',
                            backgroundColor: '#00F5FF',
                            color: '#000',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '16px',
                            fontWeight: 'bold'
                        }}
                    >
                        🔄 Reload App
                    </button>
                    <button
                        onClick={() => window.location.href = '/'}
                        style={{
                            padding: '12px 24px',
                            backgroundColor: '#444',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '16px',
                            marginLeft: '10px'
                        }}
                    >
                        🏠 Go Home
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;