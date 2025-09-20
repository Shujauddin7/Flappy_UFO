'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useMiniKit } from '@worldcoin/minikit-js/minikit-provider';
import { walletAuth } from '@/auth/wallet';

export const useGameAuth = () => {
    const { data: session, status, update } = useSession();
    const { isInstalled } = useMiniKit();
    const [isAuthenticating, setIsAuthenticating] = useState(false);

    const isAuthenticated = status === 'authenticated' && !!session;
    const isLoading = status === 'loading' || isAuthenticating;

    const authenticate = useCallback(async (): Promise<boolean> => {
        if (!isInstalled) {
            console.error('MiniKit not installed');
            return false;
        }

        if (isAuthenticated) {
            return true;
        }

        setIsAuthenticating(true);
        try {
            const result = await walletAuth();

            // Check if sign in was successful
            if (result && !result.error) {
                // Trigger session update to get the new session
                await update();
                setIsAuthenticating(false);
                return true;
            } else {
                // Authentication failed
                console.error('Sign in failed:', result?.error);
                setIsAuthenticating(false);
                return false;
            }
        } catch (error) {
            console.error('Authentication failed:', error);
            setIsAuthenticating(false);
            return false;
        }
    }, [isInstalled, isAuthenticated, update]);

    // Auto-update session status after authentication
    useEffect(() => {
        if (status === 'unauthenticated' && !isAuthenticating) {
            update();
        }
    }, [status, isAuthenticating, update]);

    // Save user to database AND track tournament sign-in when session becomes available
    useEffect(() => {
        if (session?.user?.id && status === 'authenticated') {
            const saveUserAndTrackSignIn = async () => {
                try {
                    const user = session.user as { id: string; username?: string; world_id?: string };
                    console.log('🚀 Starting user save and tournament sign-in process for:', user.id);

                    // First, save user to database (existing functionality)
                    console.log('📝 Step 1: Saving user to database...');
                    const userResponse = await fetch('/api/users', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            wallet: user.id,
                            username: user.username || null,
                            world_id: user.world_id || null,
                        }),
                    });

                    if (userResponse.ok) {
                        console.log('✅ Step 1 SUCCESS: User saved to database via API');
                    } else {
                        const errorText = await userResponse.text();
                        console.warn('❌ Step 1 FAILED: Database save failed:', errorText);
                        console.warn('❌ Response status:', userResponse.status);
                    }

                    // Second, track tournament sign-in (NEW: permanent sign-in tracking)
                    console.log('🏆 Step 2: Getting current tournament...');
                    try {
                        // Get current tournament ID from current tournament
                        const tournamentResponse = await fetch('/api/tournament/current');
                        if (tournamentResponse.ok) {
                            const tournamentData = await tournamentResponse.json();
                            console.log('✅ Step 2a SUCCESS: Tournament data received:', {
                                hasTournament: !!tournamentData.tournament,
                                tournamentId: tournamentData.tournament?.id,
                                tournamentDay: tournamentData.tournament?.tournament_day
                            });

                            if (tournamentData.tournament?.id) {
                                console.log('🎯 Step 3: Tracking tournament sign-in...');
                                const signInPayload = {
                                    wallet: user.id,
                                    username: user.username || 'Unknown',
                                    worldId: user.world_id || null,
                                    tournamentId: tournamentData.tournament.id
                                };
                                console.log('📤 Sign-in payload:', signInPayload);

                                const signInResponse = await fetch('/api/tournament/sign-in', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify(signInPayload),
                                });

                                if (signInResponse.ok) {
                                    const signInData = await signInResponse.json();
                                    console.log('✅ Step 3 SUCCESS: Tournament sign-in tracked:', signInData);
                                } else {
                                    const errorText = await signInResponse.text();
                                    console.warn('❌ Step 3 FAILED: Tournament sign-in tracking failed:', errorText);
                                    console.warn('❌ Response status:', signInResponse.status);
                                }
                            } else {
                                console.warn('❌ Step 2b FAILED: No tournament ID found, received:', tournamentData);
                            }
                        } else {
                            console.warn('❌ Step 2 FAILED: Failed to get current tournament, status:', tournamentResponse.status);
                            const errorText = await tournamentResponse.text();
                            console.warn('❌ Tournament response error:', errorText);
                        }
                    } catch (signInError) {
                        console.warn('❌ Tournament sign-in tracking failed (non-blocking):', signInError);
                    }

                } catch (dbError) {
                    console.warn('❌ User save failed (non-blocking):', dbError);
                }
            };

            // ALWAYS track tournament sign-in for debugging - remove sessionStorage blocking
            console.log('🔄 FORCE RUN: Always tracking sign-in for debugging...');
            saveUserAndTrackSignIn();
        }
    }, [session, status]);

    return {
        isAuthenticated,
        isLoading,
        isAuthenticating,
        authenticate,
        session,
        user: session?.user,
    };
};
