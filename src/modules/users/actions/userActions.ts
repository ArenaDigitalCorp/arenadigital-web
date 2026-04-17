"use server";

import { clerkClient } from "@clerk/nextjs/server";
import {
    fetchArenaUserLink,
    fetchArenaUsersForArena,
    getArenaUsersStationColumnErrorMessage,
    isArenaUsersStationColumnMissingError
} from "@/lib/arena-users";
import { assertArenaBackofficeAccess, assertStationAccess } from "@/lib/server-auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";

async function getCoordinatesFromAddress(addressData: { street: string; number: string; neighborhood: string; city: string; state: string }) {
    const query = `${addressData.street}, ${addressData.number}, ${addressData.city}, ${addressData.state}, Brasil`;
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`, {
            headers: { 'Accept-Language': 'pt-BR', 'User-Agent': 'ArenaDigital-Web-Sync' }
        });
        const geoData = await res.json();
        if (geoData?.[0]) return `POINT(${geoData[0].lon} ${geoData[0].lat})`;
    } catch { /* geocoding is best-effort */ }
    return null;
}

export async function syncUserAction(
    clerkUserId: string,
    email: string,
    name?: string,
    arenaName?: string,
    cpf?: string,
    phone?: string,
    addressData?: any,
    role?: string,
) {
    const supabase = getSupabaseAdmin();

    const { data: user, error: userError } = await supabase
        .from('users')
        .upsert({ clerk_user_id: clerkUserId, email, name, ...(cpf && { cpf }), ...(role && { role }) }, { onConflict: 'clerk_user_id' })
        .select()
        .single();

    if (userError) throw new Error(`Erro ao sincronizar usuário: ${userError.message}`);

    if (arenaName && user) {
        const { data: existingArena } = await supabase
            .from('arenas').select('id').eq('owner_id', user.id).eq('name', arenaName).maybeSingle();

        if (!existingArena) {
            const arenaInsertData: any = { name: arenaName, owner_id: user.id, status: 'ativo', ...(phone && { phone }) };

            if (addressData) {
                arenaInsertData.zip_code = addressData.cep || undefined;
                arenaInsertData.id_municipio = addressData.id_municipio || undefined;
                arenaInsertData.number = addressData.number || undefined;
                arenaInsertData.complement = addressData.complement || undefined;
                arenaInsertData.neighborhood = addressData.neighborhood || undefined;
                arenaInsertData.address = addressData.street || undefined;

                if (addressData.street && addressData.city && addressData.state) {
                    const locationPoint = await getCoordinatesFromAddress({
                        street: addressData.street, number: addressData.number || '',
                        neighborhood: addressData.neighborhood || '', city: addressData.city, state: addressData.state
                    });
                    if (locationPoint) arenaInsertData.location = locationPoint;
                }
            }

            const { data: newArena, error: arenaError } = await supabase
                .from('arenas').insert(arenaInsertData).select().single();

            if (arenaError && arenaError.code !== '23505') throw new Error(`Erro ao criar arena: ${arenaError.message}`);

            if (newArena) {
                const { error: arenaUserError } = await supabase.from('arena_users').insert({
                    arena_id: newArena.id, user_id: user.id, role: 'Gestor', status: 'Ativo'
                });
                if (arenaUserError && arenaUserError.code !== '23505') throw new Error(`Erro ao vincular usuário: ${arenaUserError.message}`);
            }
        }
    }

    return user;
}

type ArenaUserFormData = {
    email: string;
    login?: string;
    name: string;
    password?: string;
    role: string;
    stationId?: string | null;
    senha?: string;
    status: string;
};

type ArenaUserListItem = {
    arenaUserId: string;
    clerkUserId: string;
    email: string;
    id: string;
    name: string;
    role: string;
    stationId: string | null;
    status: string;
};

type ActionResult<T = undefined> =
    | { success: true; data?: T; user?: T }
    | { success: false; error: string };

type ArenaUserQueryRow = {
    id: string;
    role: string;
    station_id: string | null;
    status: string;
    created_at: string;
    user_id: string;
    users: {
        id: string;
        name: string | null;
        email: string;
        clerk_user_id: string;
    } | null;
};

type ArenaUserLinkRow = {
    id: string;
    arena_id: string;
    station_id: string | null;
    user_id: string;
};

function getErrorMessage(error: unknown) {
    if (error instanceof Error) {
        return error.message;
    }

    return "Erro desconhecido";
}

async function getArenaUserLinkOrThrow(arenaId: string, arenaUserId: string): Promise<ArenaUserLinkRow> {
    const { data, error } = await fetchArenaUserLink(getSupabaseAdmin(), arenaId, arenaUserId);

    if (error) {
        throw new Error(`Erro ao carregar vínculo do usuário: ${error.message}`);
    }

    return data as ArenaUserLinkRow;
}

export async function createArenaUserAction(arenaId: string, data: ArenaUserFormData): Promise<ActionResult<{ clerk_user_id: string; email: string; id: string; name: string | null; role: string | null }>> {
    let createdClerkUserId: string | null = null;
    let createdLocalUserId: string | null = null;

    try {
        await assertArenaBackofficeAccess(arenaId);

        if (data.role === 'Caixa' && !data.stationId) {
            throw new Error('Selecione a estação vinculada ao caixa.');
        }
        if (data.role === 'Caixa' && data.stationId) {
            await assertStationAccess(data.stationId, arenaId);
        }

        const client = await clerkClient();
        const supabase = getSupabaseAdmin();

        // 1. Create user in Clerk
        const clerkUserOptions = {
            emailAddress: [data.email],
            password: data.senha || data.password,
            firstName: data.name,
            skipPasswordChecks: true,
            ...(data.login ? { username: data.login } : {}),
        };

        const clerkUser = await client.users.createUser(clerkUserOptions);
        createdClerkUserId = clerkUser.id;

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
        createdLocalUserId = newUser.id;

        // 3. Insert into arena_users table
        const arenaUserPayload = {
            arena_id: arenaId,
            user_id: newUser.id,
            role: data.role,
            station_id: data.role === 'Caixa' ? data.stationId ?? null : null,
            status: data.status,
        };

        let { error: arenaUserError } = await supabase
            .from('arena_users')
            .insert(arenaUserPayload);

        if (isArenaUsersStationColumnMissingError(arenaUserError)) {
            if (data.role === 'Caixa') {
                throw new Error(getArenaUsersStationColumnErrorMessage());
            }

            ({ error: arenaUserError } = await supabase
                .from('arena_users')
                .insert({
                    arena_id: arenaId,
                    user_id: newUser.id,
                    role: data.role,
                    status: data.status,
                }));
        }

        if (arenaUserError) {
            console.error("Supabase arena user error:", arenaUserError);
            throw new Error(`Erro ao vincular usuário à arena: ${arenaUserError.message}`);
        }

        return { success: true, user: newUser };
    } catch (error: unknown) {
        const supabase = getSupabaseAdmin();
        const client = await clerkClient();
        if (createdLocalUserId) {
            await supabase.from('users').delete().eq('id', createdLocalUserId);
        }
        if (createdClerkUserId) {
            await client.users.deleteUser(createdClerkUserId).catch(() => null);
        }
        console.error("Error creating arena user:", error);
        return { success: false, error: getErrorMessage(error) };
    }
}

export async function updateArenaUserAction(arenaId: string, arenaUserId: string, userId: string, data: ArenaUserFormData): Promise<ActionResult> {
    try {
        await assertArenaBackofficeAccess(arenaId);

        if (data.role === 'Caixa' && !data.stationId) {
            throw new Error('Selecione a estação vinculada ao caixa.');
        }
        if (data.role === 'Caixa' && data.stationId) {
            await assertStationAccess(data.stationId, arenaId);
        }

        const client = await clerkClient();
        const supabase = getSupabaseAdmin();
        const arenaUser = await getArenaUserLinkOrThrow(arenaId, arenaUserId);
        if (arenaUser.user_id !== userId) {
            throw new Error('Vínculo do usuário não corresponde à arena informada');
        }

        // Find clerk id first to update Clerk fields
        const { data: localUser, error: localUserError } = await supabase
            .from('users')
            .select('clerk_user_id')
            .eq('id', userId)
            .single();

        if (!localUserError && localUser) {
            const clerkUpdateOptions = {
                ...(data.name ? { firstName: data.name } : {}),
                ...(data.senha ? { password: data.senha } : {}),
            };

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
        let { error: arenaUserError } = await supabase
            .from('arena_users')
            .update({
                role: data.role,
                station_id: data.role === 'Caixa' ? data.stationId ?? null : null,
                status: data.status,
            })
            .eq('id', arenaUserId)
            .eq('arena_id', arenaId)
            .eq('user_id', userId);

        if (isArenaUsersStationColumnMissingError(arenaUserError)) {
            if (data.role === 'Caixa') {
                throw new Error(getArenaUsersStationColumnErrorMessage());
            }

            ({ error: arenaUserError } = await supabase
                .from('arena_users')
                .update({
                    role: data.role,
                    status: data.status,
                })
                .eq('id', arenaUserId)
                .eq('arena_id', arenaId)
                .eq('user_id', userId));
        }

        if (arenaUserError) {
            throw new Error(`Erro ao atualizar vínculo: ${arenaUserError.message}`);
        }

        return { success: true };
    } catch (error: unknown) {
        console.error("Error updating arena user:", error);
        return { success: false, error: getErrorMessage(error) };
    }
}

export async function deleteArenaUserAction(arenaId: string, arenaUserId: string, userId: string): Promise<ActionResult> {
    try {
        await assertArenaBackofficeAccess(arenaId);

        const client = await clerkClient();
        const supabase = getSupabaseAdmin();
        const arenaUser = await getArenaUserLinkOrThrow(arenaId, arenaUserId);
        if (arenaUser.user_id !== userId) {
            throw new Error('Vínculo do usuário não corresponde à arena informada');
        }

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
            .eq('id', arenaUserId)
            .eq('arena_id', arenaId)
            .eq('user_id', userId);

        if (arenaUserError) {
            throw new Error(`Erro ao desvincular usuário: ${arenaUserError.message}`);
        }

        // 3. Delete from users table only if no other arena link remains
        const { count: remainingLinks, error: remainingLinksError } = await supabase
            .from('arena_users')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId);

        if (remainingLinksError) {
            throw new Error(`Erro ao verificar vínculos restantes do usuário: ${remainingLinksError.message}`);
        }

        if ((remainingLinks ?? 0) === 0) {
            await supabase.from('users').delete().eq('id', userId);
        }

        // 4. Delete from clerk if possible and no other arena link remains
        if ((remainingLinks ?? 0) === 0 && !localUserError && localUser) {
            await client.users.deleteUser(localUser.clerk_user_id).catch(e => console.error("Error deleting clerk user", e));
        }

        return { success: true };
    } catch (error: unknown) {
        console.error("Error deleting arena user:", error);
        return { success: false, error: getErrorMessage(error) };
    }
}

export async function getArenaUsersAction(arenaId: string): Promise<ActionResult<ArenaUserListItem[]>> {
    try {
        await assertArenaBackofficeAccess(arenaId);

        const supabase = getSupabaseAdmin();
        const { data, error } = await fetchArenaUsersForArena(supabase, arenaId);

        if (error) {
            throw new Error(error.message);
        }

        // Transform data to flat format for easy table rendering
        const formattedData = ((data ?? []) as unknown as ArenaUserQueryRow[])
            .filter((item) => item.users !== null)
            .map((item) => {
                const linkedUser = item.users!;
                return {
                    arenaUserId: item.id,
                    id: linkedUser.id,
                    name: linkedUser.name ?? '',
                    email: linkedUser.email,
                    role: item.role,
                    stationId: item.station_id,
                    status: item.status,
                    clerkUserId: linkedUser.clerk_user_id,
                };
            });

        return { success: true, data: formattedData };
    } catch (error: unknown) {
        console.error("Error fetching arena users:", error);
        return { success: false, error: getErrorMessage(error) };
    }
}
