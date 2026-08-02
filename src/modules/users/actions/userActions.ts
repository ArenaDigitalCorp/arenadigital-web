"use server";

import {
    fetchArenaUserLink,
    fetchArenaUsersForArena,
    getArenaUsersStationColumnErrorMessage,
    isArenaUsersStationColumnMissingError
} from "@/lib/arena-users";
import { assertArenaAdminAccess, assertStationAccess } from "@/lib/server-auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { findUserByAuthUserId, findUserByEmail, normalizeEmail } from "@/lib/account-identity";
import { isStrongPassword } from "@/lib/password-policy";

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

function assertValidArenaUserFormData(data: ArenaUserFormData) {
    if (data.name.trim().length < 2) {
        throw new Error('Informe o nome do usuário.');
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(data.email))) {
        throw new Error('Informe um e-mail válido.');
    }

    if (!['Gestor', 'Atendente', 'Caixa'].includes(data.role)) {
        throw new Error('Papel de usuário inválido.');
    }

    if (!['Ativo', 'Inativo', 'ativo', 'inativo', 'active', 'inactive'].includes(data.status)) {
        throw new Error('Status de usuário inválido.');
    }
}

async function getArenaUserLinkOrThrow(arenaId: string, arenaUserId: string): Promise<ArenaUserLinkRow> {
    const { data, error } = await fetchArenaUserLink(getSupabaseAdmin(), arenaId, arenaUserId);

    if (error) {
        throw new Error(`Erro ao carregar vínculo do usuário: ${error.message}`);
    }

    return data as ArenaUserLinkRow;
}

export async function createArenaUserAction(arenaId: string, data: ArenaUserFormData): Promise<ActionResult<{ email: string; id: string; name: string | null; role: string | null; usesExistingCredentials: boolean }>> {
    let createdAuthUserId: string | null = null;
    let existingUserLinkedToCreatedAuth: string | null = null;

    try {
        await assertArenaAdminAccess(arenaId);
        assertValidArenaUserFormData(data);

        if (data.role === 'Caixa' && !data.stationId) {
            throw new Error('Selecione a estação vinculada ao caixa.');
        }
        if (data.role === 'Caixa' && data.stationId) {
            await assertStationAccess(data.stationId, arenaId);
        }

        const supabase = getSupabaseAdmin();
        const email = normalizeEmail(data.email);
        if (!email) {
            throw new Error('E-mail é obrigatório.');
        }

        let newUser = await findUserByEmail(supabase, email);
        const usesExistingCredentials = Boolean(newUser?.auth_user_id);

        if (!newUser?.auth_user_id) {
            const password = data.senha || data.password;
            if (!password) {
                throw new Error('Senha é obrigatória para criar um novo usuário.');
            }
            if (!isStrongPassword(password)) {
                throw new Error('A senha não atende aos requisitos de segurança.');
            }

            // 1. Criar usuário no Supabase Auth (auto-confirmado, criado por admin)
            const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: { firstName: data.name.trim(), name: data.name.trim() },
            });

            if (authError || !authData.user) {
                throw new Error(`Erro ao criar usuário no Auth: ${authError?.message ?? 'desconhecido'}`);
            }
            createdAuthUserId = authData.user.id;
            if (newUser) existingUserLinkedToCreatedAuth = newUser.id;

            // 2. O trigger cria ou reconcilia public.users pelo e-mail.
            newUser = await findUserByAuthUserId(supabase, createdAuthUserId);
            if (!newUser) throw new Error('A identidade foi criada, mas o usuário local não foi provisionado.');
        } else if (data.name && !newUser.name) {
            const { data: updatedUser, error: updateUserError } = await supabase
                .from('users')
                .update({ name: data.name })
                .eq('id', newUser.id)
                .select('id, email, name, cpf, role')
                .single();
            if (updateUserError) throw updateUserError;
            newUser = updatedUser;
        }

        if (!newUser) {
            throw new Error('Não foi possível resolver o usuário da arena.');
        }

        // 3. Insert/update arena_users table
        const arenaUserPayload = {
            arena_id: arenaId,
            user_id: newUser.id,
            role: data.role,
            station_id: data.role === 'Caixa' ? data.stationId ?? null : null,
            status: data.status,
        };

        let { error: arenaUserError } = await supabase
            .from('arena_users')
            .upsert(arenaUserPayload, { onConflict: 'arena_id,user_id' });

        if (isArenaUsersStationColumnMissingError(arenaUserError)) {
            if (data.role === 'Caixa') {
                throw new Error(getArenaUsersStationColumnErrorMessage());
            }

            ({ error: arenaUserError } = await supabase
                .from('arena_users')
                .upsert({
                    arena_id: arenaId,
                    user_id: newUser.id,
                    role: data.role,
                    status: data.status,
                }, { onConflict: 'arena_id,user_id' }));
        }

        if (arenaUserError) {
            console.error("Supabase arena user error:", arenaUserError);
            throw new Error(`Erro ao vincular usuário à arena: ${arenaUserError.message}`);
        }

        return {
            success: true,
            user: {
                ...newUser,
                usesExistingCredentials,
            },
        };
    } catch (error: unknown) {
        if (createdAuthUserId) {
            const supabase = getSupabaseAdmin();
            if (existingUserLinkedToCreatedAuth) {
                await supabase
                    .from('users')
                    .update({ auth_user_id: null })
                    .eq('id', existingUserLinkedToCreatedAuth)
                    .eq('auth_user_id', createdAuthUserId);
            } else {
                await supabase.from('users').delete().eq('id', createdAuthUserId);
            }
            await supabase.auth.admin.deleteUser(createdAuthUserId).catch(() => null);
        }
        console.error("Error creating arena user:", error);
        return { success: false, error: getErrorMessage(error) };
    }
}

export async function updateArenaUserAction(arenaId: string, arenaUserId: string, userId: string, data: ArenaUserFormData): Promise<ActionResult> {
    try {
        await assertArenaAdminAccess(arenaId);
        assertValidArenaUserFormData(data);

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

        // Senha é uma credencial global e não pode ser redefinida por um gestor
        // de arena, sobretudo quando a mesma identidade participa de outras arenas.
        if (data.senha) {
            throw new Error('A senha deve ser alterada pelo próprio usuário no fluxo de recuperação de acesso.');
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
        await assertArenaAdminAccess(arenaId);

        const supabase = getSupabaseAdmin();
        const arenaUser = await getArenaUserLinkOrThrow(arenaId, arenaUserId);
        if (arenaUser.user_id !== userId) {
            throw new Error('Vínculo do usuário não corresponde à arena informada');
        }

        const { error } = await supabase.rpc('remove_arena_user_membership_atomic', {
            p_arena_id: arenaId,
            p_arena_user_id: arenaUserId,
            p_user_id: userId,
        });
        if (error) throw new Error(`Erro ao desvincular usuário: ${error.message}`);

        return { success: true };
    } catch (error: unknown) {
        console.error("Error deleting arena user:", error);
        return { success: false, error: getErrorMessage(error) };
    }
}

export async function getArenaUsersAction(arenaId: string): Promise<ActionResult<ArenaUserListItem[]>> {
    try {
        await assertArenaAdminAccess(arenaId);

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
                };
            });

        return { success: true, data: formattedData };
    } catch (error: unknown) {
        console.error("Error fetching arena users:", error);
        return { success: false, error: getErrorMessage(error) };
    }
}
