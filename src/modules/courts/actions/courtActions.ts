"use server"

import { getSupabaseAdmin } from '@/lib/supabase-server'
import { assertArenaAdminAccess, assertCourtAccess } from '@/lib/server-auth'
import { assertCanCreateSpaceForArena } from '@/modules/payments/usecases/assert-space-entitlement.usecase'
import type { Database } from '@/types/supabase.types'
import {
    normalizeCourtSports,
    type CourtWithSportRelations,
} from '@/modules/courts/utils/normalize-court-sports'
import { clonePriceTablesToCourt } from '@/modules/courts/lib/clone-price-tables'
import { revalidatePath } from 'next/cache'

type CourtInsert = Database['public']['Tables']['courts']['Insert']
type CourtUpdate = Database['public']['Tables']['courts']['Update']
type CourtCreateInput = Omit<CourtInsert, 'arena_id'>

type CourtRowWithSports = CourtWithSportRelations & Record<string, unknown>

export async function getSportsForCourtAction(): Promise<{ success: boolean; data: { id: string; name: string }[]; error?: string }> {
    try {
        const supabase = getSupabaseAdmin()
        const { data, error } = await supabase
            .from('sports')
            .select('id, name')
            .order('name')

        if (error) throw new Error(error.message)
        return { success: true, data: data ?? [] }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar esportes'
        console.error('[getSportsForCourtAction]', message)
        return { success: false, error: message, data: [] }
    }
}

export async function getCourtsByArenaAction(arenaId: string) {
    try {
        await assertArenaAdminAccess(arenaId)
        const supabase = getSupabaseAdmin()
        const { data, error } = await supabase
            .from('courts')
            .select(`*, sports:court_sports(sport:sports(*))`)
            .eq('arena_id', arenaId)
            .order('created_at', { ascending: false })

        if (error) throw new Error(error.message)

        return {
            success: true,
            data: (data as CourtRowWithSports[]).map((court) => normalizeCourtSports(court))
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar espaços'
        return { success: false, error: message, data: [] }
    }
}

/**
 * O que existe pendurado num espaço. É o que a tela mostra antes de o gestor
 * decidir entre desativar e excluir.
 *
 * Excluir um espaço faz `bookings` cair por CASCADE — e com elas participantes,
 * consumos e a ligação com o caixa (`transactions` não tem FK para booking, então
 * os lançamentos ficam sem a reserva que os originou). Por isso a exclusão só é
 * liberada para espaço sem histórico; com histórico, o caminho é desativar.
 */
export interface CourtDeletionImpact {
    reservas: number
    reservasFuturas: number
    reservasConfirmadas: number
    planosMensalistas: number
    solicitacoesApp: number
    tabelasPreco: number
    /** Só é possível excluir um espaço que nunca foi usado. */
    podeExcluir: boolean
    /** Motivos que impedem a exclusão, na linguagem do gestor. */
    bloqueios: string[]
}

async function countCourtRows(
    supabase: ReturnType<typeof getSupabaseAdmin>,
    table: string,
    build: (q: ReturnType<ReturnType<typeof getSupabaseAdmin>['from']>) => unknown
): Promise<number> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- contagem genérica sobre tabelas variadas
        const query = (supabase as any).from(table).select('id', { count: 'exact', head: true })
        const { count, error } = await (build(query) as Promise<{ count: number | null; error: unknown }>)
        // Tabela ainda não existe neste ambiente (migração pendente): conta zero
        // em vez de derrubar o levantamento inteiro.
        if (error) return 0
        return count ?? 0
    } catch {
        return 0
    }
}

export async function getCourtDeletionImpactAction(
    arenaId: string,
    courtId: string
): Promise<{ success: boolean; data?: CourtDeletionImpact; error?: string }> {
    try {
        await assertArenaAdminAccess(arenaId)
        await assertCourtAccess(courtId, arenaId)
        const supabase = getSupabaseAdmin()
        const agora = new Date().toISOString()

        const [reservas, reservasFuturas, reservasConfirmadas, planos, planosBlocos, solicitacoes, tabelas] =
            await Promise.all([
                // eslint-disable-next-line @typescript-eslint/no-explicit-any -- builders encadeados
                countCourtRows(supabase, 'bookings', (q: any) =>
                    q.eq('court_id', courtId).neq('status', 'cancelled')),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                countCourtRows(supabase, 'bookings', (q: any) =>
                    q.eq('court_id', courtId).neq('status', 'cancelled').gte('start_time', agora)),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                countCourtRows(supabase, 'bookings', (q: any) =>
                    q.eq('court_id', courtId).eq('status', 'confirmed')),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                countCourtRows(supabase, 'planos_mensalista', (q: any) =>
                    q.eq('court_id', courtId).neq('status', 'cancelado')),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                countCourtRows(supabase, 'planos_mensalista_blocos', (q: any) =>
                    q.eq('court_id', courtId)),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                countCourtRows(supabase, 'app_booking_requests', (q: any) =>
                    q.eq('court_id', courtId)),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                countCourtRows(supabase, 'court_price_tables', (q: any) =>
                    q.eq('court_id', courtId)),
            ])

        const planosMensalistas = Math.max(planos, planosBlocos > 0 ? 1 : 0)

        const bloqueios: string[] = []
        if (reservas > 0) {
            bloqueios.push(
                `${reservas} ${reservas === 1 ? 'reserva' : 'reservas'} no histórico` +
                    (reservasConfirmadas > 0
                        ? ` (${reservasConfirmadas} ${reservasConfirmadas === 1 ? 'paga' : 'pagas'})`
                        : '')
            )
        }
        if (planosMensalistas > 0) {
            bloqueios.push(
                `${planosMensalistas} ${planosMensalistas === 1 ? 'recorrência de mensalista' : 'recorrências de mensalista'}`
            )
        }
        if (solicitacoes > 0) {
            bloqueios.push(
                `${solicitacoes} ${solicitacoes === 1 ? 'solicitação vinda do app' : 'solicitações vindas do app'}`
            )
        }

        return {
            success: true,
            data: {
                reservas,
                reservasFuturas,
                reservasConfirmadas,
                planosMensalistas,
                solicitacoesApp: solicitacoes,
                tabelasPreco: tabelas,
                podeExcluir: bloqueios.length === 0,
                bloqueios,
            },
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao verificar o espaço'
        return { success: false, error: message }
    }
}

/**
 * Tira o espaço de operação sem apagar nada. É o caminho reversível e o que o
 * gestor quer na maioria dos casos ("essa quadra saiu de uso").
 *
 * `status = 'inativo'` é o que as RPCs atômicas do banco checam para recusar
 * novas reservas, planos mensalistas e reservas pelo app.
 */
export async function setCourtActiveAction(arenaId: string, courtId: string, ativo: boolean) {
    try {
        await assertArenaAdminAccess(arenaId)
        await assertCourtAccess(courtId, arenaId)

        const { data, error } = await getSupabaseAdmin()
            .from('courts')
            .update({ status: ativo ? 'ativo' : 'inativo', is_active: ativo })
            .eq('id', courtId)
            .eq('arena_id', arenaId)
            .select(`*, sports:court_sports(sport:sports(*))`)
            .single()

        if (error) throw new Error(error.message)

        revalidatePath(`/dashboard/arenas/${arenaId}`)
        revalidatePath(`/dashboard/arenas/${arenaId}/courts`)
        return { success: true, data: normalizeCourtSports(data as CourtRowWithSports) }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao alterar o status do espaço'
        return { success: false, error: message, data: null }
    }
}

/**
 * Exclusão permanente. Só passa em espaço sem histórico: o `ON DELETE CASCADE`
 * de `bookings` levaria junto reservas, participantes, consumos e a rastreabilidade
 * dos lançamentos de caixa. Com histórico, a resposta é desativar.
 */
export async function deleteCourtAction(arenaId: string, courtId: string) {
    try {
        await assertArenaAdminAccess(arenaId)
        await assertCourtAccess(courtId, arenaId)

        // A tela já mostrou o levantamento, mas ela não é fronteira de segurança:
        // o servidor refaz a checagem antes de apagar.
        const impacto = await getCourtDeletionImpactAction(arenaId, courtId)
        if (!impacto.success || !impacto.data) {
            throw new Error(impacto.error ?? 'Não foi possível verificar o espaço')
        }
        if (!impacto.data.podeExcluir) {
            throw new Error(
                `Este espaço não pode ser excluído porque tem ${impacto.data.bloqueios.join(', ')}. ` +
                    'Desative o espaço para tirá-lo de operação sem perder o histórico.'
            )
        }

        const { error } = await getSupabaseAdmin()
            .from('courts')
            .delete()
            .eq('id', courtId)
            .eq('arena_id', arenaId)

        if (error) throw new Error(error.message)

        revalidatePath(`/dashboard/arenas/${arenaId}`)
        revalidatePath(`/dashboard/arenas/${arenaId}/courts`)
        return { success: true }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao excluir espaço'
        return { success: false, error: message }
    }
}

export async function getCourtByIdAction(arenaId: string, courtId: string) {
    try {
        await assertCourtAccess(courtId, arenaId)
        const { data, error } = await getSupabaseAdmin()
            .from('courts')
            .select(`*, sports:court_sports(sport:sports(*))`)
            .eq('id', courtId)
            .eq('arena_id', arenaId)
            .single()

        if (error) throw new Error(error.message)

        return { success: true, data: normalizeCourtSports(data as CourtRowWithSports) }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar espaço'
        return { success: false, error: message, data: null }
    }
}

export async function createCourtAction(arenaId: string, input: CourtCreateInput, sportIds?: string[]) {
    try {
        await assertArenaAdminAccess(arenaId)
        await assertCanCreateSpaceForArena(arenaId)
        const supabase = getSupabaseAdmin()

        const { data: court, error } = await supabase
            .from('courts')
            .insert([{ ...input, arena_id: arenaId }])
            .select()
            .single()

        if (error) throw new Error(error.message)

        if (sportIds && sportIds.length > 0) {
            await supabase.from('court_sports').insert(sportIds.map(id => ({ court_id: court.id, sport_id: id })))
        }

        revalidatePath(`/dashboard/arenas/${arenaId}`)
        return { success: true, data: court }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao criar espaço'
        return { success: false, error: message, data: null }
    }
}

export async function duplicateCourtAction(arenaId: string, courtId: string, newName: string) {
    try {
        await assertArenaAdminAccess(arenaId)
        await assertCourtAccess(courtId, arenaId)
        await assertCanCreateSpaceForArena(arenaId)
        const supabase = getSupabaseAdmin()

        const trimmedName = newName.trim()
        if (!trimmedName) throw new Error('Informe um nome para o novo espaço.')

        const { data: original, error: fetchError } = await supabase
            .from('courts')
            .select(`*, sports:court_sports(sport:sports(*))`)
            .eq('id', courtId)
            .eq('arena_id', arenaId)
            .single()

        if (fetchError) throw new Error(fetchError.message)

        const {
            id: _id,
            created_at: _createdAt,
            arena_id: _arenaId,
            name: _name,
            sports,
            ...rest
        } = original as CourtRowWithSports

        const sportIds = (sports ?? []).flatMap((relation) =>
            relation.sport ? [relation.sport.id] : []
        )

        const { data: court, error } = await supabase
            .from('courts')
            .insert([{ ...(rest as CourtCreateInput), name: trimmedName, arena_id: arenaId }])
            .select()
            .single()

        if (error) throw new Error(error.message)

        if (sportIds.length > 0) {
            await supabase
                .from('court_sports')
                .insert(sportIds.map((id) => ({ court_id: court.id, sport_id: id })))
        }

        // O trigger do banco semeia o novo espaço com Padrão (de `day_config`) e
        // Mensalista/Professor vazias. A cópia tem que trazer as tabelas da
        // origem inteiras. Falhar aqui não desfaz o espaço já criado — o gestor
        // é avisado para revisar as tabelas em vez de copiar de novo.
        let warning: string | undefined
        try {
            await clonePriceTablesToCourt(supabase, arenaId, courtId, court.id)
        } catch (cloneError) {
            const detail = cloneError instanceof Error ? cloneError.message : String(cloneError)
            console.error('[duplicateCourtAction] falha ao copiar tabelas de preço', detail)
            warning = 'Espaço copiado, mas as tabelas de preço não vieram junto. Revise-as no novo espaço.'
        }

        const { data: full } = await supabase
            .from('courts')
            .select(`*, sports:court_sports(sport:sports(*))`)
            .eq('id', court.id)
            .single()

        revalidatePath(`/dashboard/arenas/${arenaId}`)
        return {
            success: true,
            data: normalizeCourtSports((full ?? court) as CourtRowWithSports),
            warning,
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao copiar espaço'
        return { success: false, error: message, data: null, warning: undefined }
    }
}

export async function updateCourtAction(arenaId: string, courtId: string, input: CourtUpdate, sportIds?: string[]) {
    try {
        await assertArenaAdminAccess(arenaId)
        await assertCourtAccess(courtId, arenaId)
        const supabase = getSupabaseAdmin()

        const { data: court, error } = await supabase
            .from('courts')
            .update(input)
            .eq('id', courtId)
            .eq('arena_id', arenaId)
            .select()
            .single()

        if (error) throw new Error(error.message)

        if (sportIds) {
            await supabase.from('court_sports').delete().eq('court_id', courtId)
            if (sportIds.length > 0) {
                await supabase.from('court_sports').insert(sportIds.map(id => ({ court_id: courtId, sport_id: id })))
            }
        }

        revalidatePath(`/dashboard/arenas/${arenaId}`)
        return { success: true, data: court }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao atualizar espaço'
        return { success: false, error: message, data: null }
    }
}
