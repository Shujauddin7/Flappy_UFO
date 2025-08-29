import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
    try {
        // Get session
        const session = await auth();
        if (!session?.user?.walletAddress) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const { continue_amount } = await req.json();

        if (!continue_amount) {
            return NextResponse.json({ error: 'Missing continue_amount' }, { status: 400 });
        }

        // Environment-specific database credentials
        const isProduction = process.env.NODE_ENV === 'production';
        const supabaseUrl = isProduction ? process.env.SUPABASE_PROD_URL : process.env.SUPABASE_DEV_URL;
        const supabaseServiceKey = isProduction ? process.env.SUPABASE_PROD_SERVICE_KEY : process.env.SUPABASE_DEV_SERVICE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const wallet = session.user.walletAddress;
        const today = new Date().toISOString().split('T')[0];

        // Get current values first
        const { data: currentRecord } = await supabase
            .from('user_tournament_records')
            .select('total_continues_used, total_continue_payments')
            .eq('wallet', wallet)
            .eq('tournament_day', today)
            .single();

        if (!currentRecord) {
            return NextResponse.json({ error: 'Tournament record not found' }, { status: 400 });
        }

        // Simple update: increment continue counters
        const { error } = await supabase
            .from('user_tournament_records')
            .update({
                total_continues_used: currentRecord.total_continues_used + 1,
                total_continue_payments: currentRecord.total_continue_payments + continue_amount
            })
            .eq('wallet', wallet)
            .eq('tournament_day', today);

        if (error) {
            console.error('❌ Continue update error:', error);
            return NextResponse.json({ error: 'Failed to record continue' }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('❌ Continue API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}