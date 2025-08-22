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
        <div className="fixed top-4 right-4 z-[9999]">
            <button
                onClick={handleSignOut}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg text-sm font-bold shadow-2xl transition-all duration-200 border-2 border-red-400 animate-pulse"
                title="Development only - Sign out to test authentication flow"
                style={{
                    position: 'fixed',
                    top: '20px',
                    right: '20px',
                    zIndex: 99999,
                    fontSize: '14px',
                    fontWeight: 'bold'
                }}
            >
                🚪 DEV: Sign Out
            </button>
        </div>
    );
}

export default DevSignOut;