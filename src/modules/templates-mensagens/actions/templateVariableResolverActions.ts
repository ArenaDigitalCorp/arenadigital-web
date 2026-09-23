"use server"

import { format, parseISO, startOfMonth } from "date-fns"
import { ptBR } from "date-fns/locale"
import { getSupabaseAdmin } from "@/lib/supabase-server"
import { assertArenaAdminAccess } from "@/lib/server-auth"
import { getMensalistaDetailAction } from "@/modules/mensalistas/actions/mensalistaActions"
import { getArenaCancellationPolicySettingsAction } from "@/modules/arenas/actions/cancellationPolicyActions"
import {
    diaSemanaPlural,
    duracaoHoras,
    hhmm,
    ocorrenciasNoMes,
} from "@/modules/templates-mensagens/lib/mensalista-variables"
import type { PlanoMensalistaBloco } from "@/modules/bookings/types/booking.types"

export interface ResolvedTemplatePreview {
    athleteName: string
    athletePhone: string | null
    resolvedMessage: string
    /** Avisos para o gestor revisar antes de enviar (variável não preenchida, ambiguidade, etc.). */
    warnings: string[]
}

const TOKEN_PATTERN = /##[A-Z_]+##/g

const MENSALISTA_TOKENS = [
    "##VALOR_DEVIDO_MES_CORRENTE##",
    "##VALOR_CREDITO_ATUAL##",
    "##MENSALISTA_RECORRENCIA##",
    "##MENSALISTA_TOTAL_HORAS_MES##",
    "##MENSALISTA_VALOR_HORA##",
    "##MENSALISTA_VALOR_MENSALIDADE##",
    "##MENSALISTA_DATA_VENCIMENTO##",
]

function formatCurrency(value: number): string {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

function formatHoras(horas: number): string {
    return `${Number.isInteger(horas) ? horas : horas.toFixed(1)}h`
}

/**
 * Resolve as variáveis `##VAR##` presentes em `rawMessage` para um atleta e
 * competência (mês filtrado), a partir das mesmas fontes já usadas pelas
 * telas de Mensalistas, Configurações da Arena (política de cancelamento) e
 * Perfil da Arena. Só consulta o que o texto realmente usa.
 */
export async function resolveMessageTemplateAction(
    arenaId: string,
    atletaId: string,
    competencia: string,
    rawMessage: string
): Promise<{ success: boolean; data?: ResolvedTemplatePreview; error?: string }> {
    try {
        await assertArenaAdminAccess(arenaId)
        const tokensUsados = new Set(rawMessage.match(TOKEN_PATTERN) ?? [])
        const warnings: string[] = []
        const supabase = getSupabaseAdmin()

        const { data: atleta, error: atletaError } = await supabase
            .from("atleta")
            .select("id, nome_perfil, telefone")
            .eq("id", atletaId)
            .maybeSingle()
        if (atletaError) throw new Error(atletaError.message)
        if (!atleta) throw new Error("Atleta não encontrado")

        const nomeCompleto = atleta.nome_perfil ?? ""
        const primeiroNome = nomeCompleto.split(" ")[0] || nomeCompleto

        const values: Record<string, string> = {
            "##ATLETA_NOME_COMPLETO##": nomeCompleto,
            "##ATLETA_PRIMEIRO_NOME##": primeiroNome,
            "##MES_REFERENCIA##": format(parseISO(`${competencia}-01`), "MMMM", { locale: ptBR }),
        }

        if (MENSALISTA_TOKENS.some((t) => tokensUsados.has(t))) {
            const detail = await getMensalistaDetailAction(arenaId, atletaId, competencia)

            if (detail.success && detail.data) {
                const { resumo, recorrencias } = detail.data
                values["##VALOR_DEVIDO_MES_CORRENTE##"] = formatCurrency(resumo.restanteMes)
                values["##VALOR_CREDITO_ATUAL##"] = formatCurrency(resumo.creditoSaldo)
                values["##MENSALISTA_VALOR_MENSALIDADE##"] = formatCurrency(resumo.valorMes)

                const ativas = recorrencias.filter((r) => r.plano.status !== "cancelado")
                const competenciaDate = parseISO(`${competencia}-01`)

                const trechosRecorrencia: string[] = []
                const ratesPorPlano: string[] = []
                const vencimentos = new Set<string>()
                let horasTotais = 0

                for (const r of ativas) {
                    const plano = r.plano
                    const blocos: PlanoMensalistaBloco[] =
                        plano.blocos && plano.blocos.length > 0
                            ? plano.blocos
                            : [
                                  {
                                      id: plano.id,
                                      court_id: plano.court_id,
                                      dia_semana: plano.dia_semana,
                                      horario_inicio: plano.horario_inicio,
                                      horario_fim: plano.horario_fim,
                                      court: plano.court,
                                  },
                              ]

                    const dataInicio = parseISO(plano.data_inicio)
                    const dataFim = plano.data_encerramento_efetiva
                        ? parseISO(plano.data_encerramento_efetiva)
                        : null

                    let horasDoPlano = 0
                    let horasCheiasDoPlano = 0
                    for (const bloco of blocos) {
                        const ocorrencias = ocorrenciasNoMes(bloco.dia_semana, competenciaDate, dataInicio, dataFim)
                        horasDoPlano += ocorrencias * duracaoHoras(bloco.horario_inicio, bloco.horario_fim)
                        // Ocorrências do mês CHEIO (sem recorte por data_inicio/encerramento):
                        // referência estável para o valor da hora — a mensalidade do mês pode vir
                        // proporcional (estreia/encerramento) por motivos que não são "menos horas".
                        const ocorrenciasCheias = ocorrenciasNoMes(
                            bloco.dia_semana,
                            competenciaDate,
                            startOfMonth(competenciaDate),
                            null
                        )
                        horasCheiasDoPlano += ocorrenciasCheias * duracaoHoras(bloco.horario_inicio, bloco.horario_fim)
                        trechosRecorrencia.push(
                            `${diaSemanaPlural(bloco.dia_semana)} às ${hhmm(bloco.horario_inicio)}–${hhmm(bloco.horario_fim)}`
                        )
                    }
                    horasTotais += horasDoPlano

                    if (r.mensalidade?.vencimento) vencimentos.add(r.mensalidade.vencimento)

                    // Valor mensal cheio do plano ÷ horas de um mês cheio — não o valor_total
                    // da mensalidade (pode vir prorrateado, e não necessariamente na mesma
                    // proporção das ocorrências deste mês).
                    if (horasCheiasDoPlano > 0) {
                        const rate = Number(plano.valor_mensal) / horasCheiasDoPlano
                        ratesPorPlano.push(
                            ativas.length > 1
                                ? `${plano.court?.name ?? "Quadra"} (${plano.sports?.name ?? "—"}): ${formatCurrency(rate)}/h`
                                : formatCurrency(rate)
                        )
                    }
                }

                values["##MENSALISTA_RECORRENCIA##"] =
                    trechosRecorrencia.length > 0 ? trechosRecorrencia.join("; ") : "[sem recorrência ativa]"
                values["##MENSALISTA_TOTAL_HORAS_MES##"] =
                    horasTotais > 0 ? formatHoras(horasTotais) : "[sem recorrência ativa]"
                values["##MENSALISTA_VALOR_HORA##"] =
                    ratesPorPlano.length > 0 ? ratesPorPlano.join("; ") : "[sem recorrência ativa]"

                if (vencimentos.size === 0) {
                    values["##MENSALISTA_DATA_VENCIMENTO##"] = "[vencimento não definido]"
                } else {
                    values["##MENSALISTA_DATA_VENCIMENTO##"] = [...vencimentos]
                        .map((v) => format(parseISO(v), "dd/MM/yyyy"))
                        .join(" / ")
                    if (vencimentos.size > 1) {
                        warnings.push(
                            "O atleta tem planos com datas de vencimento diferentes neste mês — revise antes de enviar."
                        )
                    }
                }
            } else {
                for (const token of MENSALISTA_TOKENS) values[token] = "[sem plano mensalista ativo]"
                warnings.push(
                    "Este atleta não tem plano mensalista ativo neste mês — as variáveis de mensalista não puderam ser preenchidas."
                )
            }
        }

        if (tokensUsados.has("##ARENA_CNPJ##")) {
            const { data: arenaRow } = await supabase
                .from("arenas")
                .select("cpf_cnpj")
                .eq("id", arenaId)
                .maybeSingle()
            values["##ARENA_CNPJ##"] = arenaRow?.cpf_cnpj || "[CNPJ/CPF não configurado]"
        }

        if (tokensUsados.has("##ARENA_ANTECEDENCIA_CANCELAMENTO##")) {
            const policy = await getArenaCancellationPolicySettingsAction(arenaId)
            const tierIntegral = policy.data?.currentPolicy?.tiers.find((t) => t.refundPercentage === 100)
            values["##ARENA_ANTECEDENCIA_CANCELAMENTO##"] = tierIntegral
                ? `${tierIntegral.minimumHoursBeforeStart} horas`
                : "[antecedência de cancelamento não configurada]"
            if (!tierIntegral) {
                warnings.push(
                    "A Arena não tem uma faixa de reembolso de 100% configurada na política de cancelamento."
                )
            }
        }

        if (tokensUsados.has("##ARENA_CHAVE_PIX##") || tokensUsados.has("##ARENA_TITULAR_PIX##")) {
            // A leitura de chave Pix/titular passa pela mesma checagem de acesso
            // financeiro das Configurações e hoje é redigida para quem não é
            // super_admin — preencher aqui exigiria uma leitura dedicada.
            // Placeholder editável até essa decisão ser tomada.
            values["##ARENA_CHAVE_PIX##"] = "[Pix não configurado — preencha manualmente]"
            values["##ARENA_TITULAR_PIX##"] = "[Pix não configurado — preencha manualmente]"
            warnings.push("A chave Pix da Arena ainda não é lida automaticamente — preencha manualmente antes de enviar.")
        }

        let resolvedMessage = rawMessage
        for (const token of tokensUsados) {
            const value = values[token] ?? "[variável desconhecida]"
            resolvedMessage = resolvedMessage.split(token).join(value)
            if (value.startsWith("[")) warnings.push(`A variável ${token} não pôde ser preenchida automaticamente.`)
        }

        return {
            success: true,
            data: {
                athleteName: nomeCompleto,
                athletePhone: atleta.telefone,
                resolvedMessage,
                warnings: [...new Set(warnings)],
            },
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao resolver variáveis do template"
        return { success: false, error: message }
    }
}
