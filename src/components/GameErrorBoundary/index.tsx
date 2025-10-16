/**
 * Game Error Boundary
 * Catches errors in game components and displays fallback UI
 * Prevents entire app from crashing when a single component fails
 */

'use client';

import React, { Component, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    componentName?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class GameErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
        };
    }

    static getDerivedStateFromError(error: Error): State {
        return {
            hasError: true,
            error,
        };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('GameErrorBoundary caught error:', {
            component: this.props.componentName,
            error,
            errorInfo,
        });
    }

    handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
        });
        // Force reload if needed
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            // Use custom fallback if provided
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default fallback UI
            return (
                <div className="flex flex-col items-center justify-center min-h-screen bg-[#0B0C10] text-white p-4">
                    <div className="max-w-md w-full bg-gray-800 rounded-lg p-6 shadow-xl">
                        <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-red-500 rounded-full">
                            <svg
                                className="w-8 h-8 text-white"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                />
                            </svg>
                        </div>

                        <h2 className="text-2xl font-bold text-center mb-2">
                            Oops! Something went wrong
                        </h2>

                        <p className="text-gray-400 text-center mb-4">
                            {this.props.componentName
                                ? `The ${this.props.componentName} encountered an error.`
                                : 'We encountered an unexpected error.'}
                        </p>

                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <div className="mb-4 p-3 bg-gray-900 rounded text-xs text-red-400 overflow-auto max-h-32">
                                <p className="font-mono">{this.state.error.message}</p>
                            </div>
                        )}

                        <button
                            onClick={this.handleReset}
                            className="w-full bg-[#00F5FF] hover:bg-[#00D5E0] text-[#0B0C10] font-bold py-3 px-6 rounded-lg transition-colors"
                        >
                            Reload Page
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

/**
 * Lightweight error boundary for smaller components
 * Shows inline error message instead of full screen
 */
export class InlineErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
        };
    }

    static getDerivedStateFromError(error: Error): State {
        return {
            hasError: true,
            error,
        };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('InlineErrorBoundary caught error:', {
            component: this.props.componentName,
            error,
            errorInfo,
        });
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="p-4 bg-red-900 bg-opacity-20 border border-red-500 rounded-lg">
                    <p className="text-red-400 text-sm">
                        {this.props.componentName
                            ? `Error loading ${this.props.componentName}`
                            : 'Error loading component'}
                    </p>
                    {process.env.NODE_ENV === 'development' && this.state.error && (
                        <p className="text-xs text-red-300 mt-1 font-mono">
                            {this.state.error.message}
                        </p>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}
