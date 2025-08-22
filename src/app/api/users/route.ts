import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
    try {
        const { wallet, username, world_id } = await request.json();

        console.log('📊 Creating/updating user:', { wallet, username, world_id });

        if (!wallet) {
            return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
        }

        // Create Supabase client directly in the API route
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseAnonKey) {
            console.error('❌ Missing Supabase environment variables');
            return NextResponse.json({ error: 'Database configuration error' }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        // Try to insert new user or update existing one
        const { data, error } = await supabase
            .from('users')
            .upsert({
                wallet: wallet,
                username: username || null,
                world_id: world_id || null,
            }, {
                onConflict: 'wallet'
            })
            .select();

        if (error) {
            console.error('❌ Database error:', error);
            return NextResponse.json({ error: 'Database operation failed' }, { status: 500 });
        }

        console.log('✅ User saved successfully:', data);
        return NextResponse.json({ success: true, user: data[0] });

    } catch (error) {
        console.error('❌ API route error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}