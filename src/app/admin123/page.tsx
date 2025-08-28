"use client";

import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function AdminSignOutPage() {
    const { data: session } = useSession();
    const router = useRouter();

    const handleSignOut = async () => {
        console.log('Admin SignOut: Starting sign out process');

        try {
            // Clear verification status from database if we have a session
            if (session?.user?.walletAddress) {
                try {
                    await fetch('/api/users/clear-verification', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ wallet: session.user.walletAddress })
                    });
                    console.log('Admin SignOut: Cleared verification status from database');
                } catch (verificationError) {
                    console.warn('Admin SignOut: Failed to clear verification status:', verificationError);
                }
            }

            // Clear local storage
            if (typeof window !== 'undefined') {
                localStorage.clear();
                sessionStorage.clear();
                localStorage.setItem('justSignedOut', 'true');
                console.log('Admin SignOut: Cleared local/session storage');
            }

            // Sign out and redirect to home
            await signOut({
                redirect: false
            });

            console.log('✅ Admin SignOut: Successfully signed out');

            // Redirect to home and reload
            router.push('/');
            setTimeout(() => {
                if (typeof window !== 'undefined') {
                    window.location.reload();
                }
            }, 100);

        } catch (error) {
            console.error('Admin SignOut: Error:', error);
            // Force reload even on error
            if (typeof window !== 'undefined') {
                setTimeout(() => {
                    window.location.reload();
                }, 500);
            }
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-gray-800 rounded-lg p-6 text-center">
                <h1 className="text-2xl font-bold mb-4">🔧 Admin Panel</h1>

                {session ? (
                    <div className="space-y-4">
                        <p className="text-gray-300">
                            Currently signed in as:<br />
                            <span className="text-blue-400 font-mono text-sm">
                                {session.user?.walletAddress}
                            </span>
                        </p>

                        <button
                            onClick={handleSignOut}
                            className="w-full bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-bold transition-all duration-200"
                        >
                            🚪 Sign Out & Clear Session
                        </button>

                        <p className="text-xs text-gray-400">
                            This will clear your session and reload the app
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <p className="text-gray-300">No active session found</p>

                        <button
                            onClick={() => {
                                router.push('/');
                            }}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold transition-all duration-200"
                        >
                            🏠 Go to Home
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
