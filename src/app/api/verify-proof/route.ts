import {
  ISuccessResult,
  IVerifyResponse,
  verifyCloudProof,
} from '@worldcoin/minikit-js';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getVerificationLimiter } from '@/utils/rate-limit';
import { auth } from '@/auth';

interface IRequestPayload {
  payload: ISuccessResult;
  action: string;
  signal: string | undefined;
}

/**
 * This route is used to verify the proof of the user
 * It is critical proofs are verified from the server side
 * Read More: https://docs.world.org/mini-apps/commands/verify#verifying-the-proof
 */
export async function POST(req: NextRequest) {
  // Get session for rate limiting
  const session = await auth();
  const identifier = session?.user?.walletAddress || req.headers.get('x-forwarded-for') || 'anonymous';

  // Rate limiting: 3 verifications per minute
  const rateLimitResult = await checkRateLimit(identifier, getVerificationLimiter());

  if (!rateLimitResult.success) {
    return NextResponse.json({
      success: false,
      error: 'Too many verification attempts. Please wait before trying again.',
      limit: rateLimitResult.limit,
      remaining: rateLimitResult.remaining,
      reset: rateLimitResult.reset
    }, {
      status: 429,
      headers: {
        'X-RateLimit-Limit': rateLimitResult.limit.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': rateLimitResult.reset.toString(),
      }
    });
  }

  const { payload, action, signal } = (await req.json()) as IRequestPayload;
  const app_id = process.env.NEXT_PUBLIC_APP_ID as `app_${string}`;

  const verifyRes = (await verifyCloudProof(
    payload,
    app_id,
    action,
    signal,
  )) as IVerifyResponse; // Wrapper on this

  if (verifyRes.success) {
    // Verification successful - World ID proof is valid
    // The actual nullifier_hash will be handled client-side in world-id-verification.ts

    return NextResponse.json({
      success: true,
      verifyRes,
      nullifier_hash: payload.nullifier_hash,
      verification_level: payload.verification_level,
      status: 200
    });
  } else {
    // This is where you should handle errors from the World ID /verify endpoint.
    // Usually these errors are due to a user having already verified for this action.
    console.error('❌ World ID verification failed:', verifyRes);
    return NextResponse.json({
      success: false,
      verifyRes,
      error: verifyRes.detail || 'Verification failed',
      status: 400
    });
  }
}
