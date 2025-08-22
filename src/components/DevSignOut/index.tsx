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

    // Only show in development mode
    if (process.env.NODE_ENV === 'production') {
        console.log('DevSignOut: Hidden in production mode');
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