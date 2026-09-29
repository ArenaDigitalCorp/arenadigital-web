import type { Booking } from '@/modules/bookings/types/booking.types'

type ParticipantEmbed = {
    atleta_id: string
    funcao?: string | null
    atleta?: { nome_perfil: string } | { nome_perfil: string }[] | null
}

function participantName(p: ParticipantEmbed): string | null {
    const atleta = Array.isArray(p.atleta) ? p.atleta[0] : p.atleta
    return atleta?.nome_perfil ?? null
}

/**
 * Nomes para exibição no calendário/detalhes. O responsável pela reserva vem
 * sempre primeiro, seguido dos participantes adicionais — o banco devolve o
 * embed de `booking_participants` sem ordem garantida. Pessoas sem cadastro do
 * rateio (`booking_cobrancas` sem atleta) entram por último.
 */
export function getBookingParticipantNames(booking: Booking | null | undefined): string[] {
    if (!booking) return []

    const ownerName = booking.athlete_name || booking.atleta?.nome_perfil || null
    const raw = (booking as Booking & { booking_participants?: ParticipantEmbed[] }).booking_participants ?? []

    const responsible =
        raw.find((p) => p.funcao === 'responsavel') ??
        (booking.athlete_id ? raw.find((p) => p.atleta_id === booking.athlete_id) : undefined)
    const others = raw.filter((p) => p !== responsible)

    const semCadastro = (booking.booking_cobrancas ?? [])
        .filter((c) => !c.atleta_id && !c.responsavel)
        .map((c) => c.nome)

    const names = [
        (responsible && participantName(responsible)) ?? ownerName,
        ...others.map(participantName),
        ...semCadastro,
    ].filter((n): n is string => Boolean(n))

    return Array.from(new Set(names))
}

export function formatBookingParticipantLabel(booking: Booking | null | undefined): string {
    const names = getBookingParticipantNames(booking)
    if (names.length === 0) return '—'
    if (names.length <= 2) return names.join(', ')
    return `${names.slice(0, 2).join(', ')} +${names.length - 2}`
}
