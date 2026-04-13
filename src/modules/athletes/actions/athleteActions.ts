"use server"

import { createClerkClient } from '@clerk/nextjs/server'
import { SupabaseAthleteRepository } from '@/modules/athletes/repositories/SupabaseAthleteRepository'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { auth } from '@clerk/nextjs/server'
import { linkAthleteSchema } from '@/modules/athletes/schemas/athlete.schema'

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })

export async function linkAthlete(formData: {
    name: string;
    cpf: string;
    phone: string;
    email: string;
    sportId: string;
    arenaId: string;
}) {
    const parsed = linkAthleteSchema.safeParse(formData)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
    }

    try {
        const { userId: managerClerkId } = await auth();

        if (!managerClerkId) {
            return { success: false, error: "Não autorizado" };
        }

        const supabase = getSupabaseAdmin()

        // 1. Get Manager's DB User
        const { data: managerDbUser } = await supabase
            .from('users').select('*').eq('clerk_user_id', managerClerkId).single()
        if (!managerDbUser) {
            return { success: false, error: "Usuário gestor não encontrado no banco." };
        }

        // 1.1 Check if email already exists
        const { data: existingUser } = await supabase
            .from('users').select('id').eq('email', formData.email).maybeSingle()
        if (existingUser) {
            return { success: false, error: "Este e-mail já está cadastrado no sistema." };
        }

        // 2. Create User in Clerk
        const client = await clerk;
        const clerkUser = await client.users.createUser({
            emailAddress: [formData.email],
            firstName: formData.name.split(' ')[0],
            lastName: formData.name.split(' ').slice(1).join(' ') || undefined,
            skipPasswordRequirement: true,
            unsafeMetadata: {
                role: 'atleta',
                origem_cadastro: 'arena'
            }
        });

        // 3. Sync to Supabase users table
        const { data: athleteDbUser, error: upsertError } = await supabase
            .from('users')
            .upsert(
                { clerk_user_id: clerkUser.id, email: formData.email, name: formData.name, role: 'atleta' },
                { onConflict: 'clerk_user_id' }
            )
            .select()
            .single()
        if (upsertError) throw upsertError

        // 4. Create Atleta profile
        const repo = new SupabaseAthleteRepository(supabase)
        const atleta = await repo.create({
            id_users: athleteDbUser.id,
            nome_perfil: formData.name,
            cpf: formData.cpf,
            telefone: formData.phone,
            origem_cadastro: 'arena',
            id_arena_cadastro: formData.arenaId,
            compartilha_info: true
        });

        // 5. Link to Arena
        await repo.linkToArena({
            id_arena: formData.arenaId,
            id_atleta: atleta.id,
            origem: 'arena'
        });

        // 6. Link to Sport
        await repo.addSport({
            id_atleta: atleta.id,
            id_esporte: formData.sportId,
            id_nivel_habilidade_esporte: undefined
        });

        return { success: true };
    } catch (error: any) {
        console.error("DEBUG - Full Error in linkAthlete:", JSON.stringify(error, null, 2));

        if (error.errors && error.errors[0]) {
            const clerkError = error.errors[0];
            if (clerkError.code === 'form_identifier_exists') {
                return { success: false, error: "Este e-mail já está cadastrado no sistema." };
            }
            return {
                success: false,
                error: clerkError.longMessage || clerkError.message || "Erro de validação no Clerk."
            };
        }

        return {
            success: false,
            error: error.message || "Ocorreu um erro inesperado ao vincular o atleta."
        };
    }
}
