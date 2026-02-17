import { supabase } from "@/shared/database/supabaseClient";

export class UserService {
    static async syncUser(clerkUserId: string, email: string, name?: string, arenaName?: string) {
        // 1. Sync user
        const { data: user, error: userError } = await supabase
            .from('users')
            .upsert(
                {
                    clerk_user_id: clerkUserId,
                    email: email,
                    name: name,
                },
                { onConflict: 'clerk_user_id' }
            )
            .select()
            .single();

        if (userError) {
            console.error('Error syncing user:', userError);
            throw userError;
        }

        // 2. If arenaName is provided, ensure organization and arena exist
        if (arenaName && user) {
            // 2.1 Get or Create Organization
            let orgId: string | null = null;
            const { data: existingOrg } = await supabase
                .from('organizations')
                .select('id')
                .eq('owner_id', user.id)
                .order('created_at', { ascending: true })
                .limit(1)
                .maybeSingle();

            if (existingOrg) {
                orgId = existingOrg.id;
            } else {
                const { data: newOrg, error: orgError } = await supabase
                    .from('organizations')
                    .insert({
                        name: arenaName,
                        owner_id: user.id
                    })
                    .select()
                    .single();

                if (orgError) {
                    // If duplicate (concurrent call), try to fetch it again
                    if (orgError.code === '23505') {
                        const { data: retryOrg } = await supabase
                            .from('organizations')
                            .select('id')
                            .eq('owner_id', user.id)
                            .maybeSingle();
                        orgId = retryOrg?.id || null;
                    } else {
                        console.error('Error creating organization:', orgError);
                    }
                } else {
                    orgId = newOrg.id;
                }
            }

            // 2.2 Create Arena if it doesn't exist for this organization
            if (orgId) {
                const { data: existingArena } = await supabase
                    .from('arenas')
                    .select('id')
                    .eq('organization_id', orgId)
                    .eq('name', arenaName)
                    .maybeSingle();

                if (!existingArena) {
                    const { error: arenaError } = await supabase
                        .from('arenas')
                        .insert({
                            name: arenaName,
                            owner_id: user.id,
                            organization_id: orgId
                        });

                    if (arenaError && arenaError.code !== '23505') {
                        console.error('Error creating arena:', arenaError);
                    }
                }
            }
        }

        return user;
    }

    static async getUserByClerkId(clerkUserId: string) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('clerk_user_id', clerkUserId)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Error fetching user:', error);
            throw error;
        }

        return data;
    }

    static async getUserByEmail(email: string) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .maybeSingle();

        if (error) {
            console.error('Error fetching user by email:', error);
            throw error;
        }

        return data;
    }
}
