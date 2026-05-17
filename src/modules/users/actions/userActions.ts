"use server";

import {
    fetchArenaUserLink,
    fetchArenaUsersForArena,
    getArenaUsersStationColumnErrorMessage,
    isArenaUsersStationColumnMissingError
} from "@/lib/arena-users";
import { assertArenaBackofficeAccess, assertStationAccess } from "@/lib/server-auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import type { Database } from "@/types/supabase.types";

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

type OwnerArenaAddressData = {
    cep?: string;
    state?: string;
    city?: string;
    id_municipio?: number;
    neighborhood?: string;
    street?: string;
    number?: string;
    complement?: string;
}

type ArenaInsert = Database['public']['Tables']['arenas']['Insert'];

function normalizeOwnerArenaAddressData(value: unknown): OwnerArenaAddressData | undefined {
    if (!value || typeof value !== 'object') return undefined;
    const input = value as Record<string, unknown>;

    return {
        cep: typeof input.cep === 'string' ? input.cep : undefined,
        state: typeof input.state === 'string' ? input.state : undefined,
        city: typeof input.city === 'string' ? input.city : undefined,
        id_municipio: typeof input.id_municipio === 'number' ? input.id_municipio : undefined,
        neighborhood: typeof input.neighborhood === 'string' ? input.neighborhood : undefined,
        street: typeof input.street === 'string' ? input.street : undefined,
        number: typeof input.number === 'string' ? input.number : undefined,
        complement: typeof input.complement === 'string' ? input.complement : undefined,
    };
}

// Cria arena + vínculo arena_user (role Gestor) para um owner já existente em public.users.
// Idempotente: se já houver arena com o mesmo nome para o owner, não faz nada.
export async function provisionOwnerArena(
    ownerId: string,
    arenaName: string,
    phone?: string,
    addressData?: unknown,
) {
    const supabase = getSupabaseAdmin();
    const arenaAddress = normalizeOwnerArenaAddressData(addressData);

    const { data: existingArena } = await supabase
        .from('arenas').select('id').eq('owner_id', ownerId).eq('name', arenaName).maybeSingle();

    if (existingArena) return;

    const arenaInsertData: ArenaInsert = { name: arenaName, owner_id: ownerId, status: 'ativo', ...(phone && { phone }) };

    if (arenaAddress) {
        arenaInsertData.zip_code = arenaAddress.cep || undefined;
        arenaInsertData.id_municipio = arenaAddress.id_municipio || undefined;
        arenaInsertData.number = arenaAddress.number || undefined;
        arenaInsertData.complement = arenaAddress.complement || undefined;
        arenaInsertData.neighborhood = arenaAddress.neighborhood || undefined;
        arenaInsertData.address = arenaAddress.street || undefined;

        if (arenaAddress.street && arenaAddress.city && arenaAddress.state) {
            const locationPoint = await getCoordinatesFromAddress({
                street: arenaAddress.street, number: arenaAddress.number || '',
                neighborhood: arenaAddress.neighborhood || '', city: arenaAddress.city, state: arenaAddress.state
            });
            if (locationPoint) arenaInsertData.location = locationPoint;
        }
    }

    const { data: newArena, error: arenaError } = await supabase
        .from('arenas').insert(arenaInsertData).select().single();

    if (arenaError && arenaError.code !== '23505') throw new Error(`Erro ao criar arena: ${arenaError.message}`);

    if (newArena) {
        const { error: arenaUserError } = await supabase.from('arena_users').insert({
            arena_id: newArena.id, user_id: ownerId, role: 'Gestor', status: 'Ativo'
        });
        if (arenaUserError && arenaUserError.code !== '23505') throw new Error(`Erro ao vincular usuário: ${arenaUserError.message}`);
    }
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
    clerkUserId: string | null;
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
        clerk_user_id: string | null;
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

export async function createArenaUserAction(arenaId: string, data: ArenaUserFormData): Promise<ActionResult<{ clerk_user_id: string | null; email: string; id: string; name: string | null; role: string | null }>> {
    let createdAuthUserId: string | null = null;

    try {
        await assertArenaBackofficeAccess(arenaId);

        if (data.role === 'Caixa' && !data.stationId) {
            throw new Error('Selecione a estação vinculada ao caixa.');
        }
        if (data.role === 'Caixa' && data.stationId) {
            await assertStationAccess(data.stationId, arenaId);
        }

        const password = data.senha || data.password;
        if (!password) {
            throw new Error('Senha é obrigatória.');
        }

        const supabase = getSupabaseAdmin();

        // 1. Criar usuário no Supabase Auth (auto-confirmado, criado por admin)
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: data.email,
            password,
            email_confirm: true,
            user_metadata: { firstName: data.name },
        });

        if (authError || !authData.user) {
            throw new Error(`Erro ao criar usuário no Auth: ${authError?.message ?? 'desconhecido'}`);
        }
        createdAuthUserId = authData.user.id;

        // 2. Trigger on_auth_user_created cria public.users automaticamente.
        //    Upsert defensivo para garantir nome correto e role.
        // Cast: tipos gerados ainda dizem clerk_user_id NOT NULL; migration tornou nullable.
        const { data: newUser, error: userError } = await supabase
            .from('users')
            .upsert({
                id: createdAuthUserId,
                email: data.email,
                name: data.name,
                role: 'gestor',
            } as never, { onConflict: 'id' })
            .select()
            .single();

        if (userError) {
            console.error("Supabase user error:", userError);
            throw new Error(`Erro ao criar usuário local: ${userError.message}`);
        }

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
        if (createdAuthUserId) {
            const supabase = getSupabaseAdmin();
            await supabase.from('users').delete().eq('id', createdAuthUserId);
            await supabase.auth.admin.deleteUser(createdAuthUserId).catch(() => null);
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

        const supabase = getSupabaseAdmin();
        const arenaUser = await getArenaUserLinkOrThrow(arenaId, arenaUserId);
        if (arenaUser.user_id !== userId) {
            throw new Error('Vínculo do usuário não corresponde à arena informada');
        }

        // Atualizar senha no Supabase Auth.
        if (data.senha) {
            const { error: pwError } = await supabase.auth.admin.updateUserById(userId, {
                password: data.senha,
            });
            if (pwError) {
                throw new Error(`Erro ao atualizar senha: ${pwError.message}`);
            }
        }

        // Atualizar nome em public.users
        if (data.name) {
            await supabase
                .from('users')
                .update({ name: data.name })
                .eq('id', userId);
        }

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

        const supabase = getSupabaseAdmin();
        const arenaUser = await getArenaUserLinkOrThrow(arenaId, arenaUserId);
        if (arenaUser.user_id !== userId) {
            throw new Error('Vínculo do usuário não corresponde à arena informada');
        }

        // 1. Identificar se o usuario local tem entrada no Supabase Auth.
        const { data: localUser } = await supabase
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

        // 3. Se for o último vínculo do usuário, deletar de users e auth.users
        const { count: remainingLinks, error: remainingLinksError } = await supabase
            .from('arena_users')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId);

        if (remainingLinksError) {
            throw new Error(`Erro ao verificar vínculos restantes do usuário: ${remainingLinksError.message}`);
        }

        if ((remainingLinks ?? 0) === 0) {
            await supabase.from('users').delete().eq('id', userId);

            // Usuarios Supabase Auth tem clerk_user_id nulo.
            if (!localUser?.clerk_user_id) {
                await supabase.auth.admin.deleteUser(userId).catch(e => console.error("Error deleting auth user", e));
            }
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
