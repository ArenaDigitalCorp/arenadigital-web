import { normalizePhone } from '@/lib/brasil-document'

/** Mesmo mecanismo usado em Relatórios → Atletas e clientes (`ClientesOverviewPageClient`). */
export function buildWhatsAppWebUrl(phone: string, message: string): string {
    const normalized = normalizePhone(phone)
    if (!normalized) throw new Error("Telefone inválido para abrir o WhatsApp.")
    const withCountryCode = normalized.slice(1)
    return `https://wa.me/${withCountryCode}?text=${encodeURIComponent(message)}`
}

export function openWhatsAppWeb(phone: string | null, message: string): void {
    if (!phone || !normalizePhone(phone)) return
    window.open(buildWhatsAppWebUrl(phone, message), "_blank")
}
