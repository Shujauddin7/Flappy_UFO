import { NextRequest, NextResponse } from 'next/server';
import { Tokens, tokenToDecimals } from '@worldcoin/minikit-js';
import {
    ISuccessResult,
    IVerifyResponse,
    verifyCloudProof,
} from '@worldcoin/minikit-js';

interface TournamentEntryRequest {
    entryType: 'verify' | 'standard' | 'verified';
    verificationPayload?: ISuccessResult;
}

/**
 * Tournament Entry API
 * Handles payment processing for tournament entries
 * - Verifies World ID proofs if provided
 * - Initiates payment with correct amount based on verification status
 * - Returns payment reference ID
 */
export async function POST(req: NextRequest) {
    try {
        const { entryType, verificationPayload } = (await req.json()) as TournamentEntryRequest;

        // Validate entry type
        if (!['verify', 'standard', 'verified'].includes(entryType)) {
            return NextResponse.json({
                success: false,
                error: 'Invalid entry type'
            }, { status: 400 });
        }

        // Generate unique reference ID for this payment
        const paymentReference = crypto.randomUUID().replace(/-/g, '');

        // Determine payment amount based on entry type
        let paymentAmount: string;
        let isVerified = false;

        if (entryType === 'verify') {
            // User wants to verify and pay discounted price
            if (!verificationPayload) {
                return NextResponse.json({
                    success: false,
                    error: 'Verification payload required for verify entry type'
                }, { status: 400 });
            }

            // Verify the World ID proof server-side
            const app_id = process.env.NEXT_PUBLIC_APP_ID as `app_${string}`;
            const verifyRes = (await verifyCloudProof(
                verificationPayload,
                app_id,
                'flappy-ufo', // Action name from plan.md
            )) as IVerifyResponse;

            if (!verifyRes.success) {
                return NextResponse.json({
                    success: false,
                    error: 'World ID verification failed',
                    details: verifyRes.detail
                }, { status: 400 });
            }

            paymentAmount = tokenToDecimals(0.9, Tokens.WLD).toString(); // 0.9 WLD for verified
            isVerified = true;

        } else if (entryType === 'verified') {
            // User is already verified today
            paymentAmount = tokenToDecimals(0.9, Tokens.WLD).toString(); // 0.9 WLD for verified
            isVerified = true;

        } else {
            // Standard entry
            paymentAmount = tokenToDecimals(1.0, Tokens.WLD).toString(); // 1.0 WLD for standard
            isVerified = false;
        }

        // TODO: Store payment reference and entry details in database
        // This should include:
        // - paymentReference
        // - entryType
        // - paymentAmount
        // - isVerified
        // - timestamp
        // - user info (from session/auth)

        console.log('🎮 Tournament Entry Initiated:', {
            paymentReference,
            entryType,
            paymentAmount: isVerified ? '0.9 WLD' : '1.0 WLD',
            isVerified,
            timestamp: new Date().toISOString()
        });

        return NextResponse.json({
            success: true,
            paymentReference,
            paymentAmount,
            isVerified,
            entryType
        });

    } catch (error) {
        console.error('❌ Tournament entry error:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to process tournament entry'
        }, { status: 500 });
    }
}
