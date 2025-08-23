import { NextRequest, NextResponse } from 'next/server';

interface PaymentResult {
    status: string;
    reference: string;
    [key: string]: unknown;
}

interface PaymentValidationRequest {
    paymentReference: string;
    paymentResult: PaymentResult;
    entryType: 'verify' | 'standard' | 'verified';
}

/**
 * Payment Validation API
 * Called after MiniKit payment is completed to validate and record the transaction
 * This is where we would:
 * 1. Verify the payment was successful
 * 2. Validate the payment amount matches what was expected
 * 3. Create database entry for tournament participation
 * 4. Return entry_id for game session
 */
export async function POST(req: NextRequest) {
    try {
        const { paymentReference, paymentResult, entryType } = (await req.json()) as PaymentValidationRequest;

        // Validate required fields
        if (!paymentReference || !paymentResult || !entryType) {
            return NextResponse.json({
                success: false,
                error: 'Missing required fields'
            }, { status: 400 });
        }

        // Check if payment was successful
        if (paymentResult.status !== 'success') {
            return NextResponse.json({
                success: false,
                error: 'Payment was not successful',
                paymentStatus: paymentResult.status
            }, { status: 400 });
        }

        // Validate payment reference matches
        if (paymentResult.reference !== paymentReference) {
            return NextResponse.json({
                success: false,
                error: 'Payment reference mismatch'
            }, { status: 400 });
        }

        // TODO: Validate payment amount matches expected amount for entry type
        // TODO: Store validated entry in database with:
        // - user_id (from session)
        // - tournament_id (current active tournament)
        // - entry_type
        // - payment_amount
        // - payment_reference
        // - transaction details from paymentResult
        // - is_verified status

        // Generate entry ID for the game session
        const entryId = crypto.randomUUID();

        console.log('✅ Tournament Entry Validated:', {
            entryId,
            paymentReference,
            entryType,
            paymentStatus: paymentResult.status,
            timestamp: new Date().toISOString()
        });

        // TODO: Return real entry_id from database once implemented
        return NextResponse.json({
            success: true,
            entryId,
            message: 'Tournament entry validated successfully'
        });

    } catch (error) {
        console.error('❌ Payment validation error:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to validate payment'
        }, { status: 500 });
    }
}
