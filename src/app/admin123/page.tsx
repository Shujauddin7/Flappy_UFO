"use client";

import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function AdminSignOutPage() {
    const { data: session } = useSession();
    const router = useRouter();

    const handleTriggerTournament = async () => {
        try {
            console.log('🚀 Triggering tournament creation...');

            const response = await fetch('/api/tournament/trigger-now', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const result = await response.json();

            if (response.ok) {
                alert('✅ Tournament created successfully!\n\n' + result.message);
                console.log('✅ Tournament trigger success:', result);
            } else {
                alert('❌ Failed to create tournament:\n\n' + (result.error || 'Unknown error'));
                console.error('❌ Tournament trigger failed:', result);
            }
        } catch (error) {
            console.error('❌ Tournament trigger error:', error);
            alert('❌ Error triggering tournament:\n\n' + (error instanceof Error ? error.message : 'Unknown error'));
        }
    };

    const handleDeleteTestTournament = async () => {
        try {
            console.log('🗑️ Deleting test tournament...');

            const response = await fetch('/api/tournament/delete-test', {
                method: 'DELETE'
            });

            const result = await response.json();

            if (response.ok) {
                alert('✅ Test tournament deleted successfully!');
                console.log('✅ Delete success:', result);
            } else {
                alert('❌ Failed to delete test tournament:\n\n' + (result.error || 'Unknown error'));
                console.error('❌ Delete failed:', result);
            }
        } catch (error) {
            console.error('❌ Delete error:', error);
            alert('❌ Error deleting tournament:\n\n' + (error instanceof Error ? error.message : 'Unknown error'));
        }
    };

    const handleSignOut = async () => {
        console.log('Admin SignOut: Starting COMPLETE sign out process');

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

            // AGGRESSIVE CLEANUP - Clear all browser data
            if (typeof window !== 'undefined') {
                // Clear all storage
                localStorage.clear();
                sessionStorage.clear();

                // Clear all cookies
                document.cookie.split(";").forEach((c) => {
                    const eqPos = c.indexOf("=");
                    const name = eqPos > -1 ? c.substr(0, eqPos) : c;
                    document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
                    document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.vercel.app";
                });

                // Set flag for forced re-authentication
                localStorage.setItem('justSignedOut', 'true');
                localStorage.setItem('forceReauth', 'true');

                console.log('Admin SignOut: CLEARED ALL BROWSER DATA');
            }

            // Sign out from NextAuth
            await signOut({
                redirect: false
            });

            console.log('✅ Admin SignOut: Complete sign out finished');

            // Force hard reload to completely reset everything
            if (typeof window !== 'undefined') {
                window.location.href = '/';
            }

        } catch (error) {
            console.error('Admin SignOut: Error:', error);
            // Force hard reload even on error
            if (typeof window !== 'undefined') {
                window.location.href = '/';
            }
        }
    };

    // Add a force clear function for when no session is detected but user is still somehow logged in
    const handleForceClear = async () => {
        console.log('Admin: Force clearing all data');

        if (typeof window !== 'undefined') {
            // Nuclear option - clear everything
            localStorage.clear();
            sessionStorage.clear();

            // Clear all cookies
            document.cookie.split(";").forEach((c) => {
                const eqPos = c.indexOf("=");
                const name = eqPos > -1 ? c.substr(0, eqPos) : c;
                document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
                document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.vercel.app";
            });

            localStorage.setItem('forceReauth', 'true');
        }

        // Force sign out even without session
        try {
            await signOut({ redirect: false });
        } catch {
            console.log('No session to sign out from');
        }

        // Hard redirect
        window.location.href = '/';
    };

    // NEW: Reset user database data completely
    const handleResetUser = async () => {
        if (!session?.user?.walletAddress) {
            alert('No user session found to reset');
            return;
        }

        const confirm = window.confirm(
            'This will completely reset your tournament data and verification status. Are you sure?'
        );

        if (!confirm) return;

        try {
            const response = await fetch('/api/admin/reset-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet: session.user.walletAddress
                })
            });

            const result = await response.json();

            if (result.success) {
                alert('User data reset successfully! You can now verify fresh.');
                // Clear session and redirect
                handleSignOut();
            } else {
                alert('Reset failed: ' + result.error);
            }
        } catch (error) {
            console.error('Reset error:', error);
            alert('Reset failed: ' + error);
        }
    }; return (
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

                        {/* Tournament Management Section */}
                        <div className="bg-blue-900/30 p-4 rounded-lg border border-blue-500/30 mb-4">
                            <h3 className="text-blue-300 font-bold mb-4">🏆 Tournament Management</h3>

                            <button
                                onClick={handleTriggerTournament}
                                className="w-full bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold transition-all duration-200 mb-3"
                            >
                                🚀 Create Tournament Now
                            </button>

                            <button
                                onClick={handleDeleteTestTournament}
                                className="w-full bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-bold transition-all duration-200 mb-3"
                            >
                                🗑️ Delete Test Tournament
                            </button>

                            <p className="text-xs text-blue-300">
                                Creates real automated tournament for immediate testing
                            </p>
                        </div>

                        {/* User Management Section */}

                        <button
                            onClick={handleSignOut}
                            className="w-full bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-bold transition-all duration-200"
                        >
                            🚪 Complete Sign Out & Clear All Data
                        </button>

                        <button
                            onClick={handleResetUser}
                            className="w-full bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg font-bold transition-all duration-200"
                        >
                            🔄 Reset User & Tournament Data
                        </button>

                        <p className="text-xs text-gray-400">
                            Reset will clear verification status and today&apos;s tournament data
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <p className="text-gray-300 mb-4">No active session found</p>

                        <p className="text-yellow-400 text-sm mb-4">
                            Still seeing yourself as logged in on the home page?<br />
                            Use the force clear button below:
                        </p>

                        <button
                            onClick={handleForceClear}
                            className="w-full bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-bold transition-all duration-200 mb-4"
                        >
                            💥 FORCE CLEAR ALL DATA
                        </button>

                        <button
                            onClick={() => {
                                router.push('/');
                            }}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold transition-all duration-200"
                        >
                            🏠 Go to Home
                        </button>

                        <p className="text-xs text-gray-400 mt-2">
                            Force clear will remove all cached authentication data
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
