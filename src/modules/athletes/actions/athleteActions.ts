"use server"

import { SupabaseAthleteRepository } from '@/modules/athletes/repositories/SupabaseAthleteRepository'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { assertArenaBackofficeAccess, requireAuthenticatedDbUser } from '@/lib/server-auth'
import { linkAthleteSchema } from '@/modules/athletes/schemas/athlete.schema'

type MunicipioSearchRow = {
    codigo_ibge: number;
    nome: string;
    estados: { uf: string } | { uf: string }[] | null;
}

export async function linkAthlete(formData: {
    name: string;
    cpf: string;
    phone: string;
    email: string;
    sportId: string;
    arenaId: string;
    nivelHabilidadeId?: string;
    birthDate?: string;
    cep?: string;
    endereco?: string;
    enderecoNumero?: string;
    bairro?: string;
    idMunicipio?: number;
}) {
    const parsed = linkAthleteSchema.safeParse(formData)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
    }

    try {
        await requireAuthenticatedDbUser()
        await assertArenaBackofficeAccess(formData.arenaId)

        const supabase = getSupabaseAdmin()

        // 1. Check if email already exists
        const { data: existingUser } = await supabase
            .from('users').select('id').eq('email', formData.email).maybeSingle()
        if (existingUser) {
            return { success: false, error: "Este e-mail já está cadastrado no sistema." };
        }

        // 2. Create User in Supabase Auth (no password — athlete entra via app mobile)
        const firstName = formData.name.split(' ')[0]
        const lastName = formData.name.split(' ').slice(1).join(' ') || undefined
        const { data: created, error: createErr } = await supabase.auth.admin.createUser({
            email: formData.email,
            email_confirm: true,
            user_metadata: {
                firstName,
                lastName,
                name: formData.name,
                role: 'atleta',
                origem_cadastro: 'arena',
            },
        })
        if (createErr || !created.user) {
            return { success: false, error: createErr?.message || 'Erro ao criar usuário do atleta.' }
        }

        // 3. Ensure public.users row exists (trigger inserts with role='gestor' por padrão; corrigimos para atleta)
        const { data: athleteDbUser, error: upsertError } = await supabase
            .from('users')
            .upsert(
                { id: created.user.id, email: formData.email, name: formData.name, role: 'atleta' } as never,
                { onConflict: 'id' }
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
            data_nascimento: formData.birthDate || null,
            cep: formData.cep || null,
            endereco: formData.endereco || null,
            endereco_numero: formData.enderecoNumero || null,
            bairro: formData.bairro || null,
            id_municipio: formData.idMunicipio || null,
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
            id_nivel_habilidade_esporte: formData.nivelHabilidadeId || undefined
        });

        return { success: true };
    } catch (error: unknown) {
        console.error("DEBUG - Full Error in linkAthlete:", error);
        const message = error instanceof Error ? error.message : "Ocorreu um erro inesperado ao vincular o atleta."
        return { success: false, error: message };
    }
}

export async function getAthletesByArenaAction(arenaId: string, searchTerm?: string) {
    try {
        await assertArenaBackofficeAccess(arenaId)
        const repo = new SupabaseAthleteRepository(getSupabaseAdmin())
        const data = await repo.findByArena(arenaId, searchTerm)
        return { success: true, data }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar atletas'
        return { success: false, error: message, data: [] }
    }
}

export async function getSportsAction() {
    try {
        const repo = new SupabaseAthleteRepository(getSupabaseAdmin())
        const data = await repo.getSports()
        return { success: true, data }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar esportes'
        return { success: false, error: message, data: [] }
    }
}

export async function getNiveisHabilidadeAction(sportId: string): Promise<{
    success: boolean;
    data: { id: string; nivel: string }[];
    error?: string;
}> {
    try {
        const supabase = getSupabaseAdmin()
        const { data, error } = await supabase
            .from('nivel_habilidade_esporte')
            .select('id, nivel')
            .eq('id_esporte', sportId)
            .order('nivel')
        if (error) throw error
        return { success: true, data: data ?? [] }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar níveis'
        return { success: false, data: [], error: message }
    }
}

export async function searchMunicipiosAction(query: string): Promise<{
    success: boolean;
    data: { codigo_ibge: number; nome: string; uf: string }[];
    error?: string;
}> {
    if (query.length < 2) return { success: true, data: [] }
    try {
        const supabase = getSupabaseAdmin()
        const { data, error } = await supabase
            .from('municipios')
            .select('codigo_ibge, nome, estados:codigo_uf(uf)')
            .ilike('nome', `${query}%`)
            .limit(10)
            .order('nome')

        if (error) throw error

        const result = ((data ?? []) as MunicipioSearchRow[]).map((m) => {
            const estado = Array.isArray(m.estados) ? m.estados[0] : m.estados
            return {
            codigo_ibge: m.codigo_ibge,
            nome: m.nome,
                uf: estado?.uf ?? '',
            }
        })

        return { success: true, data: result }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar municípios'
        return { success: false, data: [], error: message }
    }
}
