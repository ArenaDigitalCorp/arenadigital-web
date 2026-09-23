import { eachDayOfInterval, endOfMonth, startOfDay, startOfMonth } from "date-fns"

/** `dia_semana`: 0 = domingo, igual a `Date.getDay()` (mesma convenção de `court_price_tables`). */
const DIAS_SEMANA_PLURAL = [
    "Domingos",
    "Segundas",
    "Terças",
    "Quartas",
    "Quintas",
    "Sextas",
    "Sábados",
]

export function diaSemanaPlural(diaSemana: number): string {
    return DIAS_SEMANA_PLURAL[diaSemana] ?? "—"
}

/** "20:00:00" → "20:00". Aceita já vir sem segundos. */
export function hhmm(time: string): string {
    return time.slice(0, 5)
}

/** Duração em horas de uma faixa `HH:mm[:ss]`. `fim <= inicio` cruza a meia-noite. */
export function duracaoHoras(inicio: string, fim: string): number {
    const [hi, mi] = inicio.split(":").map(Number)
    const [hf, mf] = fim.split(":").map(Number)
    const minutosInicio = hi * 60 + mi
    let minutosFim = hf * 60 + mf
    if (minutosFim <= minutosInicio) minutosFim += 24 * 60
    return (minutosFim - minutosInicio) / 60
}

/**
 * Quantas ocorrências de `diaSemana` caem no mês de `competenciaDate`, a partir
 * de `dataInicioPlano` (inclusive) e até `dataFimPlano` (inclusive, quando
 * houver) — cobre o mês de estreia/encerramento proporcional.
 */
export function ocorrenciasNoMes(
    diaSemana: number,
    competenciaDate: Date,
    dataInicioPlano: Date,
    dataFimPlano: Date | null
): number {
    const inicioMes = startOfMonth(competenciaDate)
    const fimMes = endOfMonth(competenciaDate)
    const inicioEfetivo = dataInicioPlano > inicioMes ? startOfDay(dataInicioPlano) : inicioMes
    const fimEfetivo = dataFimPlano && dataFimPlano < fimMes ? startOfDay(dataFimPlano) : fimMes
    if (inicioEfetivo > fimEfetivo) return 0

    return eachDayOfInterval({ start: inicioEfetivo, end: fimEfetivo }).filter(
        (d) => d.getDay() === diaSemana
    ).length
}
