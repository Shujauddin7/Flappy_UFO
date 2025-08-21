import { hashNonce } from '@/auth/wallet/client-helpers';
import { supabase } from '@/lib/supabase';
import {
  MiniAppWalletAuthSuccessPayload,
  MiniKit,
  verifySiweMessage,
} from '@worldcoin/minikit-js';
import NextAuth, { type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

declare module 'next-auth' {
  interface User {
    walletAddress: string;
    username: string;
    profilePictureUrl: string;
  }

  interface Session {
    user: {
      walletAddress: string;
      username: string;
      profilePictureUrl: string;
    } & DefaultSession['user'];
  }
}

// Auth configuration for Wallet Auth based sessions
// For more information on each option (and a full list of options) go to
// https://authjs.dev/getting-started/authentication/credentials
export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET,
  basePath: '/api/auth',
  session: { 
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days (permanent as per Plan.md)
    updateAge: 24 * 60 * 60, // 24 hours - rolling refresh
  },
  cookies: {
    sessionToken: {
      name: 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        // Always secure for both dev and prod (Vercel uses HTTPS everywhere)
        secure: true,
        // Environment-specific domain configuration for Vercel
        domain: process.env.VERCEL_ENV === 'production' 
          ? '.vercel.app'  // Works for both custom domain and vercel.app
          : undefined,     // Let browser handle dev domains
        maxAge: 30 * 24 * 60 * 60, // 30 days
      }
    },
    // Add additional cookie for session backup/recovery
    callbackUrl: {
      name: 'next-auth.callback-url',
      options: {
        httpOnly: false, // Accessible to client for session recovery
        sameSite: 'lax',
        path: '/',
        secure: true,
        maxAge: 30 * 24 * 60 * 60,
      }
    }
  },
  providers: [
    Credentials({
      name: 'World App Wallet',
      credentials: {
        nonce: { label: 'Nonce', type: 'text' },
        signedNonce: { label: 'Signed Nonce', type: 'text' },
        finalPayloadJson: { label: 'Final Payload', type: 'text' },
      },
      // @ts-expect-error TODO
      authorize: async ({
        nonce,
        signedNonce,
        finalPayloadJson,
      }: {
        nonce: string;
        signedNonce: string;
        finalPayloadJson: string;
      }) => {
        const expectedSignedNonce = hashNonce({ nonce });

        if (signedNonce !== expectedSignedNonce) {
          console.log('Invalid signed nonce');
          return null;
        }

        const finalPayload: MiniAppWalletAuthSuccessPayload =
          JSON.parse(finalPayloadJson);

        console.log('🔍 Full MiniKit payload:', JSON.stringify(finalPayload, null, 2));

        const result = await verifySiweMessage(finalPayload, nonce);

        if (!result.isValid || !result.siweMessageData.address) {
          console.log('Invalid final payload');
          return null;
        }

        const walletAddress = result.siweMessageData.address;

        // NOTE: Wallet Auth only provides wallet address, NOT World ID
        // World ID (nullifier_hash) is only available through the verify command
        // For now, we use wallet address as primary identifier
        console.log('💳 Wallet Address (primary ID):', walletAddress);
        console.log('ℹ️ World ID will be captured during verification step (if needed)');

        // Get user info from MiniKit
        let userInfo: { username?: string; profilePictureUrl?: string } | null = null;
        try {
          console.log('🔍 Getting user info from MiniKit for address:', walletAddress);
          userInfo = await MiniKit.getUserInfo(walletAddress);
          console.log('📋 MiniKit user info received:', userInfo);
        } catch (userInfoError) {
          console.error('⚠️ Failed to get user info from MiniKit:', userInfoError);
          // Continue without user info - we still have wallet address
        }

        // Store/update user in Supabase (according to Plan.md)
        try {
          console.log('🔍 Attempting to save user to Supabase:', {
            walletAddress,
            username: userInfo?.username || null
          });

          // Test Supabase connection first
          console.log('🔍 Testing Supabase connection...');
          const { error: testError } = await supabase
            .from('users')
            .select('count')
            .limit(1);

          if (testError) {
            console.error('❌ Supabase connection test failed:', testError);
          } else {
            console.log('✅ Supabase connection successful');
          }

          const { data, error } = await supabase
            .from('users')
            .upsert({
              wallet: walletAddress,
              world_id: null, // World ID will be set later during verification step
              username: userInfo?.username || null
            }, {
              onConflict: 'wallet',
              ignoreDuplicates: false
            })
            .select()
            .single();

          if (error) {
            console.error('❌ Supabase user creation error:', error);
            console.error('Error details:', JSON.stringify(error, null, 2));
            // Continue with auth even if Supabase fails (graceful degradation)
          } else {
            console.log('✅ Successfully saved user to Supabase:', data);
          }
        } catch (supabaseError) {
          console.error('❌ Supabase connection error:', supabaseError);
          // Continue with auth even if Supabase fails
        }        // Return user object with verified wallet address
        const returnUser = {
          id: walletAddress, // Use wallet address as primary ID
          walletAddress: walletAddress, // Verified wallet address
          username: userInfo?.username || null,
          name: userInfo?.username || `User ${walletAddress.slice(0, 6)}`, // Fallback name
          profilePictureUrl: userInfo?.profilePictureUrl || null,
        };

        console.log('👤 Returning user object:', returnUser);
        return returnUser;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Persist user data in the token for permanent sessions
      if (user) {
        token.userId = user.id;
        token.walletAddress = user.walletAddress;
        token.username = user.username;
        token.profilePictureUrl = user.profilePictureUrl;
        // Add session creation timestamp for debugging
        token.sessionCreatedAt = Date.now();
        
        console.log('🔐 JWT token created/updated:', {
          userId: token.userId,
          walletAddress: token.walletAddress,
          username: token.username,
          environment: process.env.VERCEL_ENV || 'development',
          timestamp: new Date().toISOString()
        });
      } else {
        // Token refresh - add refresh timestamp
        token.lastRefreshedAt = Date.now();
        console.log('🔄 JWT token refreshed:', {
          userId: token.userId,
          walletAddress: token.walletAddress,
          environment: process.env.VERCEL_ENV || 'development',
          sessionAge: token.sessionCreatedAt ? Math.round((Date.now() - (token.sessionCreatedAt as number)) / (1000 * 60 * 60)) + 'h' : 'unknown',
          timestamp: new Date().toISOString()
        });
      }

      return token;
    },
    session: async ({ session, token }) => {
      // Ensure session always has user data from the persistent token
      if (token.userId) {
        session.user.id = token.userId as string;
        session.user.walletAddress = token.walletAddress as string;
        session.user.username = token.username as string;
        session.user.profilePictureUrl = token.profilePictureUrl as string;
        
        console.log('👤 Session retrieved from token:', {
          id: session.user.id,
          walletAddress: session.user.walletAddress,
          username: session.user.username,
          environment: process.env.VERCEL_ENV || 'development',
          sessionAge: token.sessionCreatedAt ? Math.round((Date.now() - (token.sessionCreatedAt as number)) / (1000 * 60 * 60)) + 'h' : 'unknown',
          lastRefresh: token.lastRefreshedAt ? new Date(token.lastRefreshedAt as number).toISOString() : 'never'
        });
      }

      return session;
    },
  },
});
