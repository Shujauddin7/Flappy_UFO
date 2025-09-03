"use client";

import { signOut } from 'next-auth/react';
import { useSession } from 'next-auth/react';

function DevSignOut() {
    console.log('DevSignOut component loaded, NODE_ENV:', process.env.NODE_ENV);

    const { data: session } = useSession();

    const handleSignOut = async (event: React.MouseEvent<HTMLButtonElement>) => {
        console.log('DevSignOut: Sign out clicked');

        // Show loading state
        const button = event.target as HTMLButtonElement;
        if (button) {
            button.disabled = true;
            button.textContent = '🔄 Signing Out...';
        }

        try {
            // Clear verification status from database if we have a session
            if (session?.user?.walletAddress) {
                try {
                    await fetch('/api/users/clear-verification', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ wallet: session.user.walletAddress })
                    });
                    console.log('DevSignOut: Cleared verification status from database');
                } catch (verificationError) {
                    console.warn('DevSignOut: Failed to clear verification status:', verificationError);
                    // Continue with sign out even if verification clear fails
                }

                // Note: Tournament data reset removed to prevent accidental data loss
                // If you need to reset tournament data, use the admin panel instead
            }

            // Clear any additional local storage or session data first
            if (typeof window !== 'undefined') {
                localStorage.clear();
                sessionStorage.clear();
                // Add a flag to indicate we just signed out - this will force verification check
                localStorage.setItem('justSignedOut', 'true');
                console.log('DevSignOut: Cleared local/session storage and set sign-out flag');
            }

            // Sign out without redirect to stay in the app
            await signOut({
                redirect: false
            });

            console.log('✅ DevSignOut: Successfully signed out');

            // Force reload to ensure complete state reset including verification status
            if (typeof window !== 'undefined') {
                setTimeout(() => {
                    window.location.reload();
                }, 100);
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

    // Show dev sign out in development OR on dev deployment URLs
    const isLocalDev = process.env.NODE_ENV === 'development';
    const isDevDeployment = typeof window !== 'undefined' &&
        window.location.hostname.includes('flappyufo-git-dev-shujauddin');
    const isProductionDeployment = typeof window !== 'undefined' &&
        window.location.hostname === 'flappyufo.vercel.app';

    // Show if: (local dev OR dev deployment) AND not production deployment
    const showDevSignOut = (isLocalDev || isDevDeployment) &&
        !isProductionDeployment &&
        process.env.NEXT_PUBLIC_SHOW_DEV_SIGNOUT !== 'false';

    if (!showDevSignOut) {
        console.log('DevSignOut: Hidden (not in dev environment or explicitly disabled)');
        return null;
    }

    console.log('DevSignOut: Rendering button in development mode');

    return (
        <div className="mt-4">
            <button
                onClick={handleSignOut}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-lg transition-all duration-200 border border-red-400"
                title="Development only - Sign out, reset verification & tournament data, and reload to test fresh authentication flow"
            >
                🚪 DEV: Sign Out & Reset
            </button>
        </div>
    );
}

export default DevSignOut;