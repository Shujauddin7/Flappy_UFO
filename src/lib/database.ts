export interface User {
    id: string
    wallet: string
    world_id?: string
    username?: string
    last_verified_date?: string
    last_verified_tournament_id?: string
    created_at: string
}

/**
 * Create or update user in database after successful World ID authentication
 */
export async function createOrUpdateUser(userData: {
    wallet: string
    world_id?: string
    username?: string
}): Promise<User | null> {
    try {
        // Dynamic import to avoid build-time execution
        const { createServerSupabaseClient } = await import('@/lib/supabase');
        const supabaseAdmin = createServerSupabaseClient();

        const { data, error } = await supabaseAdmin
            .from('users')
            .upsert(
                {
                    wallet: userData.wallet,
                    world_id: userData.world_id,
                    username: userData.username,
                },
                {
                    onConflict: 'wallet',
                    ignoreDuplicates: false
                }
            )
            .select()
            .single()

        if (error) {
            console.error('Error creating/updating user:', error)
            return null
        }

        return data
    } catch (error) {
        console.error('Database error:', error)
        return null
    }
}
