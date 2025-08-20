'use client'

import { useState, useEffect } from 'react'
import { MiniKit } from '@worldcoin/minikit-js'
import { supabase, type User } from '@/lib/supabase'

export interface AuthState {
    isSignedIn: boolean
    user: User | null
    isLoading: boolean
    wallet: string | null
    isVerifiedToday: boolean
}

export const useAuth = () => {
    const [authState, setAuthState] = useState<AuthState>({
        isSignedIn: false,
        user: null,
        isLoading: true,
        wallet: null,
        isVerifiedToday: false
    })

    // Check if MiniKit is installed and get wallet info
    useEffect(() => {
        const checkMiniKitAuth = async () => {
            try {
                if (!MiniKit.isInstalled()) {
                    console.log('MiniKit not installed')
                    setAuthState(prev => ({ ...prev, isLoading: false }))
                    return
                }

                // For now, just check if MiniKit is available
                // We'll implement wallet checking after successful auth
                setAuthState(prev => ({ ...prev, isLoading: false }))
            } catch (error) {
                console.error('Auth check failed:', error)
                setAuthState(prev => ({ ...prev, isLoading: false }))
            }
        }

        checkMiniKitAuth()
    }, [])

    // Sign in with World ID wallet auth
    const signIn = async (): Promise<{ success: boolean; error?: string }> => {
        try {
            if (!MiniKit.isInstalled()) {
                return { success: false, error: 'World App not installed' }
            }

            setAuthState(prev => ({ ...prev, isLoading: true }))

            // Generate nonce for wallet auth
            const nonce = crypto.randomUUID()

            // Use MiniKit wallet auth
            const result = await MiniKit.commandsAsync.walletAuth({
                nonce,
                expirationTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                notBefore: new Date(Date.now() - 24 * 60 * 60 * 1000),
                statement: `Sign in to Flappy UFO (${nonce.replace(/-/g, '').slice(0, 8)}).`,
            })

            if (!result || result.finalPayload.status !== 'success') {
                setAuthState(prev => ({ ...prev, isLoading: false }))
                return { success: false, error: 'Authentication cancelled or failed' }
            }

            // Get wallet address from the auth result
            const walletAddress = result.finalPayload.wallet_address

            if (!walletAddress) {
                setAuthState(prev => ({ ...prev, isLoading: false }))
                return { success: false, error: 'No wallet address found' }
            }

            // Create or update user in Supabase
            const { data: userData, error } = await supabase
                .from('users')
                .upsert({
                    wallet: walletAddress,
                    username: null // Will be updated later if user sets it
                }, {
                    onConflict: 'wallet',
                    ignoreDuplicates: false
                })
                .select()
                .single()

            if (error) {
                console.error('Supabase error:', error)
                setAuthState(prev => ({ ...prev, isLoading: false }))
                return { success: false, error: 'Database error' }
            }

            // Update auth state
            setAuthState({
                isSignedIn: true,
                user: userData,
                isLoading: false,
                wallet: walletAddress,
                isVerifiedToday: false // Will be checked separately
            })

            return { success: true }
        } catch (error) {
            console.error('Sign in error:', error)
            setAuthState(prev => ({ ...prev, isLoading: false }))
            return { success: false, error: 'Sign in failed' }
        }
    }

    // Sign out
    const signOut = () => {
        setAuthState({
            isSignedIn: false,
            user: null,
            isLoading: false,
            wallet: null,
            isVerifiedToday: false
        })
    }

    // Check verification status for current tournament (placeholder for now)
    const checkVerificationStatus = async (_userId: string): Promise<boolean> => {
        // TODO: Implement tournament verification check
        // For now, return false
        return false
    }

    // Refresh authentication state
    const refreshAuth = async () => {
        setAuthState(prev => ({ ...prev, isLoading: true }))

        try {
            if (!MiniKit.isInstalled()) {
                setAuthState(prev => ({ ...prev, isLoading: false }))
                return
            }

            // Check if we have stored auth state or need to re-authenticate
            setAuthState(prev => ({ ...prev, isLoading: false }))
        } catch (error) {
            console.error('Refresh auth failed:', error)
            setAuthState(prev => ({ ...prev, isLoading: false }))
        }
    }

    return {
        ...authState,
        signIn,
        signOut,
        refreshAuth
    }
}
