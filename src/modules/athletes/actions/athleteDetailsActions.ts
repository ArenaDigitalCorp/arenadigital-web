"use server"

import { getSupabaseAdmin } from "@/lib/supabase-server"
import { assertArenaBackofficeAccess } from "@/lib/server-auth"

export interface AthleteDetailData {
    // Perfil
    id: string
    nome_perfil: string
    telefone: string | null
    cpf: string | null
    email: string | null
    foto_url: string | null
    instagram: string | null
    membro_desde: string | null
    data_nascimento: string | null

    // Fidelidade
    saldo: number
    historico_fidelidade: {
        id: string
        tipo: string
        valor: number
        descricao: string | null
        data_registro: string
        data_vencimento: string | null
    }[]

    // Reservas
    total_reservas: number
    reservas_este_mes: number
    reservas: {
        id: string
        start_time: string
        end_time: string
        status: string | null
        price: number | null
        court_name: string | null
        sport_name: string | null
    }[]

    // Esportes
    esportes: { nome: string; nivel: string | null }[]

    // Rotativos
    total_rotativos: number
    valor_total_rotativos: number
    rotativos: {
        id: string
        data: string
        hora_inicio: string
        hora_fim: string
        valor_pago: number | null
        status_pagamento: string | null
        sport_name: string | null
    }[]

    // Comandas (station_orders)
    total_comandas: number
    comandas_abertas: number
    comandas_fechadas: number
    total_gasto_comandas: number
    comandas: {
        id: string
        order_number: number
        status: string
        total_value: number
        created_at: string
        closed_at: string | null
    }[]

    // Pagamentos financeiros (transactions)
    total_pago_arena: number
    pagamentos: {
        id: string
        description: string | null
        category: string | null
        total_value: number
        registration_date: string
        modo_pagamento: string | null
    }[]
}

export async function getAthleteDetailsAction(
    arenaId: string,
    athleteId: string
): Promise<{ success: true; data: AthleteDetailData } | { success: false; error: string }> {
    try {
        await assertArenaBackofficeAccess(arenaId)
        const supabase = getSupabaseAdmin()

        // Executar todas as queries em paralelo
        const [
            atletaResult,
            balanceResult,
            bookingsResult,
            esportesResult,
            historicoResult,
            rotativosResult,
            comandasResult,
            pagamentosResult,
        ] = await Promise.all([
            // 1. Perfil + email + membro desde
            supabase
                .from("atleta")
                .select(`
                    id, nome_perfil, telefone, cpf, foto_url, instagram, data_nascimento,
                    users:id_users(email),
                    arenas_atleta!inner(data_criacao, id_arena)
                `)
                .eq("id", athleteId)
                .eq("arenas_atleta.id_arena", arenaId)
                .single(),

            // 2. Saldo fidelidade
            supabase
                .from("athlete_loyalty_balance")
                .select("balance")
                .eq("id_arena", arenaId)
                .eq("id_atleta", athleteId)
                .maybeSingle(),

            // 3. Reservas com quadra e esporte
            supabase
                .from("bookings")
                .select(`
                    id, start_time, end_time, status, price,
                    court:court_id(name),
                    sport:sport_id(name)
                `)
                .eq("arena_id", arenaId)
                .eq("athlete_id", athleteId)
                .order("start_time", { ascending: false })
                .limit(20),

            // 4. Esportes praticados + nível
            supabase
                .from("atleta_esportes")
                .select(`
                    sport:id_esporte(name),
                    nivel:id_nivel_habilidade_esporte(nivel)
                `)
                .eq("id_atleta", athleteId),

            // 5. Histórico fidelidade (últimas 10)
            supabase
                .from("programa_fidelidade_extrato")
                .select("id, tipo, valor, descricao, data_registro, data_vencimento")
                .eq("id_arena", arenaId)
                .eq("id_atleta", athleteId)
                .order("data_registro", { ascending: false })
                .limit(10),

            // 6. Rotativos
            supabase
                .from("rotativo_inscricoes")
                .select(`
                    id, valor_pago, status_pagamento, data_inscricao,
                    rotativo:id_rotativo(id, data, hora_inicio, hora_fim, id_esporte,
                        sport:id_esporte(name)
                    )
                `)
                .eq("id_atleta", athleteId)
                .order("data_inscricao", { ascending: false })
                .limit(20),

            // 7. Comandas
            supabase
                .from("station_orders")
                .select("id, order_number, status, total_value, created_at, closed_at")
                .eq("arena_id", arenaId)
                .eq("atleta_id", athleteId)
                .order("created_at", { ascending: false })
                .limit(20),

            // 8. Pagamentos financeiros (transactions entrada vinculadas ao atleta)
            supabase
                .from("transactions")
                .select(`
                    id, description, category, total_value, registration_date,
                    modo_pagamento:modo_pagamento_id(nome)
                `)
                .eq("arena_id", arenaId)
                .eq("atleta_id", athleteId)
                .eq("type", "entrada")
                .order("registration_date", { ascending: false })
                .limit(20),
        ])

        if (atletaResult.error) throw new Error(`Perfil: ${atletaResult.error.message}`)

        const atletaAny = atletaResult.data as any
        const membro_desde = atletaAny?.arenas_atleta?.[0]?.data_criacao ?? null
        const now = new Date()
        const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

        const bookings = (bookingsResult.data ?? []) as any[]
        const rotativos = (rotativosResult.data ?? []) as any[]
        const comandas = (comandasResult.data ?? []) as any[]
        const pagamentos = (pagamentosResult.data ?? []) as any[]

        const total_reservas = bookings.length
        const reservas_este_mes = bookings.filter((b) => b.start_time >= inicioMes).length

        const total_rotativos = rotativos.length
        const valor_total_rotativos = rotativos.reduce((acc, r) => acc + Number(r.valor_pago ?? 0), 0)

        const total_gasto_comandas = comandas.reduce((acc, c) => acc + Number(c.total_value ?? 0), 0)
        const comandas_abertas = comandas.filter((c) => c.status === "open").length
        const comandas_fechadas = comandas.filter((c) => c.status !== "open").length

        const total_pago_arena = pagamentos.reduce((acc, p) => acc + Number(p.total_value ?? 0), 0)

        return {
            success: true,
            data: {
                id: atletaResult.data.id,
                nome_perfil: atletaResult.data.nome_perfil,
                telefone: atletaResult.data.telefone ?? null,
                cpf: atletaResult.data.cpf ?? null,
                email: (atletaAny?.users as any)?.email ?? null,
                foto_url: atletaResult.data.foto_url ?? null,
                instagram: atletaResult.data.instagram ?? null,
                membro_desde,
                data_nascimento: (atletaResult.data as any).data_nascimento ?? null,

                saldo: Number(balanceResult.data?.balance ?? 0),
                historico_fidelidade: (historicoResult.data ?? []).map((h: any) => ({
                    id: h.id,
                    tipo: h.tipo,
                    valor: Number(h.valor),
                    descricao: h.descricao ?? null,
                    data_registro: h.data_registro,
                    data_vencimento: h.data_vencimento ?? null,
                })),

                total_reservas,
                reservas_este_mes,
                reservas: bookings.map((b) => ({
                    id: b.id,
                    start_time: b.start_time,
                    end_time: b.end_time,
                    status: b.status ?? null,
                    price: b.price ? Number(b.price) : null,
                    court_name: b.court?.name ?? null,
                    sport_name: b.sport?.name ?? null,
                })),

                esportes: (esportesResult.data ?? []).map((e: any) => ({
                    nome: e.sport?.name ?? "Desconhecido",
                    nivel: e.nivel?.nivel ?? null,
                })),

                total_rotativos,
                valor_total_rotativos,
                rotativos: rotativos.map((r) => ({
                    id: r.id,
                    data: r.rotativo?.data ?? null,
                    hora_inicio: r.rotativo?.hora_inicio ?? null,
                    hora_fim: r.rotativo?.hora_fim ?? null,
                    valor_pago: r.valor_pago ? Number(r.valor_pago) : null,
                    status_pagamento: r.status_pagamento ?? null,
                    sport_name: r.rotativo?.sport?.name ?? null,
                })),

                total_comandas: comandas.length,
                comandas_abertas,
                comandas_fechadas,
                total_gasto_comandas,
                comandas: comandas.map((c) => ({
                    id: c.id,
                    order_number: c.order_number,
                    status: c.status,
                    total_value: Number(c.total_value ?? 0),
                    created_at: c.created_at,
                    closed_at: c.closed_at ?? null,
                })),

                total_pago_arena,
                pagamentos: pagamentos.map((p) => ({
                    id: p.id,
                    description: p.description ?? null,
                    category: p.category ?? null,
                    total_value: Number(p.total_value ?? 0),
                    registration_date: p.registration_date,
                    modo_pagamento: (p.modo_pagamento as any)?.nome ?? null,
                })),
            },
        }
    } catch (error: any) {
        console.error("Error in getAthleteDetailsAction:", error)
        return { success: false, error: error.message || "Erro ao buscar detalhes do atleta" }
    }
}
