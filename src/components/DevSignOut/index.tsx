"use client";

import { signOut } from 'next-auth/react';

function DevSignOut() {
    console.log('DevSignOut component loaded, NODE_ENV:', process.env.NODE_ENV);

    const handleSignOut = async (event: React.MouseEvent<HTMLButtonElement>) => {
        console.log('DevSignOut: Sign out clicked');

        // Show loading state
        const button = event.target as HTMLButtonElement;
        if (button) {
            button.disabled = true;
            button.textContent = '🔄 Signing Out...';
        }

        try {
            // Clear any additional local storage or session data first
            if (typeof window !== 'undefined') {
                localStorage.clear();
                sessionStorage.clear();
                console.log('DevSignOut: Cleared local/session storage');
            }

            // Sign out without redirect to stay in the app
            await signOut({
                redirect: false
            });

            console.log('DevSignOut: NextAuth sign out completed');

            // Force reload the page to clear any remaining state
            if (typeof window !== 'undefined') {
                setTimeout(() => {
                    window.location.reload();
                }, 500);
            }
        } catch (error) {
            console.error('Error signing out:', error);
            // Even if sign out fails, try to reload to clear state
            if (typeof window !== 'undefined') {
                setTimeout(() => {
                    window.location.reload();
                }, 500);
            }
        }
    };

    // Only show in development - NEVER in production
    const showDevSignOut = process.env.NODE_ENV === 'development' &&
        process.env.NEXT_PUBLIC_SHOW_DEV_SIGNOUT === 'true';

    // Double safety check - never show if hostname contains production URLs
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname === 'flappyufo.vercel.app' ||
            hostname.includes('flappyufo.vercel.app') ||
            hostname.includes('vercel.app')) {
            console.log('DevSignOut: Hidden in production environment');
            return null;
        }
    }

    if (!showDevSignOut) {
        console.log('DevSignOut: Hidden (dev sign out not enabled)');
        return null;
    }

    console.log('DevSignOut: Rendering button in development mode');

    return (
        <div className="mt-4">
            <button
                onClick={handleSignOut}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-lg transition-all duration-200 border border-red-400"
                title="Development only - Sign out and reload to test authentication flow"
            >
                🚪 DEV: Sign Out & Reload
            </button>
        </div>
    );
}

export default DevSignOut;