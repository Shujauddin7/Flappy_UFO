"use client";

import { signOut } from 'next-auth/react';

function DevSignOut() {
    console.log('DevSignOut component loaded, NODE_ENV:', process.env.NODE_ENV);

    const handleSignOut = async () => {
        console.log('DevSignOut: Sign out clicked');
        try {
            await signOut({
                callbackUrl: '/',
                redirect: true
            });
            // Clear any additional local storage or session data
            if (typeof window !== 'undefined') {
                localStorage.clear();
                sessionStorage.clear();
            }
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    // Show in development OR when SHOW_DEV_SIGNOUT is enabled
    const showDevSignOut = process.env.NODE_ENV === 'development' || 
                          process.env.NEXT_PUBLIC_SHOW_DEV_SIGNOUT === 'true';
    
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
                title="Development only - Sign out to test authentication flow"
            >
                🚪 DEV: Sign Out
            </button>
        </div>
    );
}

export default DevSignOut;