
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use environment-based variables (DEV or PROD)
const isDev = process.env.NEXT_PUBLIC_ENV === 'dev';
const supabaseUrl = isDev ? process.env.SUPABASE_DEV_URL : process.env.SUPABASE_PROD_URL;
const supabaseServiceKey = isDev ? process.env.SUPABASE_DEV_SERVICE_KEY : process.env.SUPABASE_PROD_SERVICE_KEY;

export async function GET() {
    try {
        if (!supabaseUrl || !supabaseServiceKey) {
            console.error('Missing Supabase credentials');
            return NextResponse.json(
                { error: 'Server configuration error' },
                { status: 500 }
            );
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Determine environment - show all in DEV, filter by date in PROD
        const isDev = process.env.NODE_ENV === 'development';
        const startDate = isDev ? '2000-01-01' : '2024-10-24'; // DEV: all, PROD: from Oct 24, 2024

        // Fetch all past tournaments (is_active = false) ordered by most recent first
        const { data: tournaments, error } = await supabase
            .from('tournaments')
            .select('*')
            .eq('is_active', false)
            .gte('tournament_day', startDate) // Filter by start date
            .order('tournament_day', { ascending: false });

        if (error) {
            console.error('Error fetching tournament history:', error);
            return NextResponse.json(
                { error: 'Failed to fetch tournament history' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            tournaments: tournaments || [],
            total: tournaments?.length || 0
        }, {
            headers: {
                'Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=86400',
            }
        });
    } catch (error) {
        console.error('Tournament history API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
