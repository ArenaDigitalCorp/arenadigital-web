"use server";

import { revalidatePath } from "next/cache";
import { assertArenaAdminAccess } from "@/lib/server-auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { findUserByAuthUserId, findUserByEmail, normalizeEmail } from "@/lib/account-identity";
import { isStrongPassword } from "@/lib/password-policy";
import { accessRpc, loadAccessManagement } from "@/modules/access/server";
import type { AccessMember } from "@/modules/access/types";

type ArenaUserFormData = {
    email: string;
    name: string;
    password?: string;
    profileId: string;
    stationId?: string | null;
    senha?: string;
    status: string;
};

type ActionResult<T = undefined> =
    | { success: true; data?: T; user?: T }
    | { success: false; error: string };

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Não foi possível alterar o vínculo.';
}

async function authorize(arenaId: string) {
    return assertArenaAdminAccess(arenaId, 'settings.users');
}

function getMember(members: AccessMember[], arenaUserId: string, userId: string) {
    const member = members.find(m => m.id === arenaUserId && m.user_id === userId);
    if (!member) throw new Error('Vínculo do usuário não corresponde à arena informada.');
    return member;
}

async function prepareAssignment(arenaId: string, data: ArenaUserFormData) {
    await authorize(arenaId);
    const management = await loadAccessManagement(arenaId);
    const profile = management.profiles.find(p => p.id === data.profileId);
    if (!profile) throw new Error('Este perfil não está disponível para atribuição.');
    if (!['Ativo', 'Inativo'].includes(data.status)) throw new Error('Status inválido.');
    const stationId = profile.base_role === 'Caixa' ? data.stationId ?? null : null;
    return { management, profile, stationId };
}

export async function createArenaUserAction(arenaId: string, data: ArenaUserFormData): Promise<ActionResult<{usesExistingCredentials: boolean}>> {
    try {
        const { management, profile, stationId } = await prepareAssignment(arenaId, data);
        if (profile.base_role === 'Caixa' && !stationId) throw new Error('Selecione a estação do caixa.');
        const name = data.name.trim();
        const email = normalizeEmail(data.email);
        if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Informe um nome e e-mail válidos.');
        if (management.members.some(m => normalizeEmail(m.email) === email)) throw new Error('Esta pessoa já possui um vínculo. Edite o acesso existente.');

        const supabase = getSupabaseAdmin();
        // Validate the station before provisioning an identity. The ACL RPC checks it again when saving.
        if (stationId) {
            const station = await supabase.from('stations').select('id').eq('arena_id', arenaId).eq('id', stationId).maybeSingle();
            if (station.error || !station.data) throw new Error('Estação inválida para esta arena.');
        }
        let newUser = await findUserByEmail(supabase, email);
        const usesExistingCredentials = Boolean(newUser?.auth_user_id);
        if (!newUser?.auth_user_id) {
            if (newUser) throw new Error('Esta pessoa já possui um cadastro. Peça que ative o próprio acesso antes de vinculá-la.');
            const password = data.senha || data.password;
            if (!password || !isStrongPassword(password)) throw new Error('Informe uma senha que atenda aos requisitos de segurança.');
            const { data: authData, error } = await supabase.auth.admin.createUser({
                email, password, email_confirm: true, user_metadata: { firstName: name, name },
            });
            if (error || !authData.user) throw new Error('Não foi possível provisionar a identidade da pessoa.');
            const createdAuthUserId = authData.user.id;
            newUser = await findUserByAuthUserId(supabase, createdAuthUserId);
            if (!newUser) throw new Error('Identidade criada. Tente vincular o usuário novamente.');
        }
        await accessRpc('set_arena_member_access', { p_arena_id: arenaId, p_user_id: newUser.id, p_profile_id: profile.id, p_status: data.status, p_station_id: stationId, p_expected_member_id: null });
        revalidatePath('/dashboard', 'layout');
        return { success: true, user: { usesExistingCredentials } };
    } catch (error) {
        return { success: false, error: getErrorMessage(error) };
    }
}

export async function updateArenaUserAction(arenaId: string, arenaUserId: string, userId: string, data: ArenaUserFormData): Promise<ActionResult> {
    try {
        const { management, profile, stationId } = await prepareAssignment(arenaId, data);
        getMember(management.members, arenaUserId, userId);
        if (data.senha) throw new Error('A senha deve ser alterada pelo próprio usuário no fluxo de recuperação de acesso.');
        await accessRpc('set_arena_member_access', { p_arena_id: arenaId, p_user_id: userId, p_profile_id: profile.id, p_status: data.status, p_station_id: stationId, p_expected_member_id: arenaUserId });
        revalidatePath('/dashboard', 'layout');
        return { success: true };
    } catch (error) {
        return { success: false, error: getErrorMessage(error) };
    }
}

export async function deleteArenaUserAction(arenaId: string, arenaUserId: string, userId: string): Promise<ActionResult> {
    try {
        await authorize(arenaId);
        const management = await loadAccessManagement(arenaId);
        getMember(management.members, arenaUserId, userId);
        await accessRpc('remove_arena_member_access', { p_arena_id: arenaId, p_user_id: userId, p_expected_member_id: arenaUserId });
        revalidatePath('/dashboard', 'layout');
        return { success: true };
    } catch (error) {
        return { success: false, error: getErrorMessage(error) };
    }
}
