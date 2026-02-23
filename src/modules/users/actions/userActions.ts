"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { supabase } from "@/shared/database/supabaseClient";

export async function createArenaUserAction(arenaId: string, data: any) {
    try {
        const client = await clerkClient();

        // 1. Create user in Clerk
        const clerkUserOptions: any = {
            emailAddress: [data.email],
            password: data.senha || data.password,
            firstName: data.name,
        };

        if (data.login) {
            clerkUserOptions.username = data.login;
        }

        const clerkUser = await client.users.createUser(clerkUserOptions);

        // 2. Insert into users table
        const { data: newUser, error: userError } = await supabase
            .from('users')
            .upsert({
                clerk_user_id: clerkUser.id,
                email: data.email,
                name: data.name,
                role: 'gestor'
            }, { onConflict: 'clerk_user_id' })
            .select()
            .single();

        if (userError) {
            console.error("Supabase user error:", userError);
            throw new Error(`Erro ao criar usuário local: ${userError.message}`);
        }

        // 3. Insert into arena_users table
        const { error: arenaUserError } = await supabase
            .from('arena_users')
            .insert({
                arena_id: arenaId,
                user_id: newUser.id,
                role: data.role,
                status: data.status,
            });

        if (arenaUserError) {
            console.error("Supabase arena user error:", arenaUserError);
            throw new Error(`Erro ao vincular usuário à arena: ${arenaUserError.message}`);
        }

        return { success: true, user: newUser };
    } catch (error: any) {
        console.error("Error creating arena user:", error);
        return { success: false, error: error.errors?.[0]?.longMessage || error.message || "Erro desconhecido" };
    }
}

export async function updateArenaUserAction(arenaId: string, arenaUserId: string, userId: string, data: any) {
    try {
        const client = await clerkClient();

        // Find clerk id first to update Clerk fields
        const { data: localUser, error: localUserError } = await supabase
            .from('users')
            .select('clerk_user_id')
            .eq('id', userId)
            .single();

        if (!localUserError && localUser) {
            const clerkUpdateOptions: any = {};
            if (data.name) clerkUpdateOptions.firstName = data.name;
            if (data.senha) clerkUpdateOptions.password = data.senha;

            if (Object.keys(clerkUpdateOptions).length > 0) {
                await client.users.updateUser(localUser.clerk_user_id, clerkUpdateOptions);
            }
        }

        // Update local users table (name, etc)
        await supabase
            .from('users')
            .update({ name: data.name })
            .eq('id', userId);

        // Update arena_users table
        const { error: arenaUserError } = await supabase
            .from('arena_users')
            .update({
                role: data.role,
                status: data.status,
            })
            .eq('id', arenaUserId);

        if (arenaUserError) {
            throw new Error(`Erro ao atualizar vínculo: ${arenaUserError.message}`);
        }

        return { success: true };
    } catch (error: any) {
        console.error("Error updating arena user:", error);
        return { success: false, error: error.errors?.[0]?.longMessage || error.message || "Erro desconhecido" };
    }
}

export async function deleteArenaUserAction(arenaId: string, arenaUserId: string, userId: string) {
    try {
        const client = await clerkClient();

        // 1. Get clerk ID
        const { data: localUser, error: localUserError } = await supabase
            .from('users')
            .select('clerk_user_id')
            .eq('id', userId)
            .single();

        // 2. Delete from arena_users
        const { error: arenaUserError } = await supabase
            .from('arena_users')
            .delete()
            .eq('id', arenaUserId);

        if (arenaUserError) {
            throw new Error(`Erro ao desvincular usuário: ${arenaUserError.message}`);
        }

        // 3. Delete from users table
        await supabase.from('users').delete().eq('id', userId);

        // 4. Delete from clerk if possible
        if (!localUserError && localUser) {
            await client.users.deleteUser(localUser.clerk_user_id).catch(e => console.error("Error deleting clerk user", e));
        }

        return { success: true };
    } catch (error: any) {
        console.error("Error deleting arena user:", error);
        return { success: false, error: error.errors?.[0]?.longMessage || error.message || "Erro desconhecido" };
    }
}

export async function getArenaUsersAction(arenaId: string) {
    try {
        const { data, error } = await supabase
            .from('arena_users')
            .select(`
                id,
                role,
                status,
                created_at,
                user_id,
                users (
                    id,
                    name,
                    email,
                    clerk_user_id
                )
            `)
            .eq('arena_id', arenaId)
            .order('created_at', { ascending: false });

        if (error) {
            throw new Error(error.message);
        }

        // Transform data to flat format for easy table rendering
        const formattedData = data.map((item: any) => ({
            arenaUserId: item.id,
            id: item.users.id, // mapped to user.id so existing code might work
            name: item.users.name,
            email: item.users.email,
            role: item.role,
            status: item.status,
            clerkUserId: item.users.clerk_user_id,
        }));

        return { success: true, data: formattedData };
    } catch (error: any) {
        console.error("Error fetching arena users:", error);
        return { success: false, error: error.message || "Erro ao buscar usuários" };
    }
}
