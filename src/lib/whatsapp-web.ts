/** Mesmo mecanismo usado em Relatórios → Atletas e clientes (`ClientesOverviewPageClient`). */
export function buildWhatsAppWebUrl(phone: string, message: string): string {
    const clean = phone.replace(/\D/g, "")
    const withCountryCode = clean.length <= 11 ? `55${clean}` : clean
    return `https://wa.me/${withCountryCode}?text=${encodeURIComponent(message)}`
}

export function openWhatsAppWeb(phone: string | null, message: string): void {
    if (!phone) return
    window.open(buildWhatsAppWebUrl(phone, message), "_blank")
}
