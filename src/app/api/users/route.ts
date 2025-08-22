import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { wallet, username, world_id } = await request.json();

    console.log('📊 Creating/updating user:', { wallet, username, world_id });

    if (!wallet) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }

    // Dynamic import to avoid build-time issues
    const { supabase } = await import('@/lib/supabase');

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