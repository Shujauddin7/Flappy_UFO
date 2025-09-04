import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function DELETE() {
    console.log('🗑️ Deleting test tournament');

    try {
        // Environment-specific database configuration
        const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod';

        const supabaseUrl = isProduction
            ? process.env.SUPABASE_PROD_URL
            : process.env.SUPABASE_DEV_URL;

        const supabaseServiceKey = isProduction
            ? process.env.SUPABASE_PROD_SERVICE_KEY
            : process.env.SUPABASE_DEV_SERVICE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error('❌ Missing environment variables');
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        // Initialize Supabase client with service role key
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Delete the specific test tournament from 2025-08-31
        const { data, error } = await supabase
            .from('tournaments')
            .delete()
            .eq('tournament_day', '2025-08-31')
            .eq('start_time', '2025-08-31 15:30:00+00')
            .select();

        if (error) {
            console.error('❌ Delete error:', error);
            return NextResponse.json({
                error: 'Failed to delete test tournament',
                details: error.message
            }, { status: 500 });
        }

        console.log('✅ Test tournament deleted:', data);

        return NextResponse.json({
            success: true,
            message: 'Test tournament deleted successfully',
            deleted: data
        });

    } catch (error) {
        console.error('❌ Delete tournament error:', error);
        return NextResponse.json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
