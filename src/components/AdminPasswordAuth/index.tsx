// Admin password authentication component - simple inline form
'use client';

import { useState } from 'react';
import { Button } from '@worldcoin/mini-apps-ui-kit-react';

export const AdminPasswordAuth = ({ onSuccess }: { onSuccess: () => void }) => {
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const response = await fetch('/api/admin/password-auth', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ password }),
            });

            const result = await response.json();

            if (result.success) {
                onSuccess();
            } else {
                setError(result.message || 'Invalid password');
                setPassword(''); // Clear password on failure
            }
        } catch (error) {
            console.error('Password auth error:', error);
            setError('Authentication failed. Please try again.');
            setPassword('');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div>
            <p className="text-gray-400 text-sm mb-4">Or use admin password:</p>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <div className="relative">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-12"
                            placeholder="Enter admin password"
                            required
                            disabled={isLoading}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white"
                            disabled={isLoading}
                        >
                            {showPassword ? '🙈' : '👁️'}
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-900/50 border border-red-600 rounded-lg p-3">
                        <p className="text-red-200 text-sm">{error}</p>
                    </div>
                )}

                <Button
                    type="submit"
                    disabled={isLoading || !password.trim()}
                    variant="primary"
                    size="lg"
                    className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600"
                >
                    {isLoading ? 'Signing in...' : 'Sign in with Password'}
                </Button>
            </form>

            <div className="mt-4 p-3 bg-gray-900/50 rounded-lg border border-gray-700">
                <p className="text-xs text-gray-400 text-center">
                    🔒 Password required for each visit
                </p>
            </div>
        </div>
    );
};