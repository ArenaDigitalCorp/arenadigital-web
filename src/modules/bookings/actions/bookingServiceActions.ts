"use server"

import { getSupabaseAdmin } from "@/lib/supabase-server"
import { assertArenaBackofficeAccess, assertBookingAccess } from "@/lib/server-auth"
import { revalidatePath } from "next/cache"

export type BookingServiceLineDTO = {
    id: string
    booking_id: string
    product_id: string
    quantity: number
    unit_price: number
    products?: { id: string; name: string } | null
}

function revalidateArenaCalendar(arenaId: string) {
    revalidatePath(`/dashboard/arenas/${arenaId}`)
    revalidatePath(`/dashboard/arenas/${arenaId}/courts`)
    revalidatePath(`/dashboard/finance/${arenaId}`)
}

export async function getBookingServicesAction(
    arenaId: string,
    bookingId: string
): Promise<{ success: boolean; data?: BookingServiceLineDTO[]; error?: string }> {
    try {
        await assertArenaBackofficeAccess(arenaId)
        await assertBookingAccess(bookingId, arenaId)
        const supabase = getSupabaseAdmin()
        const { data, error } = await supabase
            .from("booking_services")
            .select("id, booking_id, product_id, quantity, unit_price, products(id, name)")
            .eq("booking_id", bookingId)
            .order("created_at", { ascending: true })

        if (error) throw new Error(error.message)
        return { success: true, data: (data ?? []) as unknown as BookingServiceLineDTO[] }
    } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao carregar serviços da reserva"
        return { success: false, error: message }
    }
}

export async function replaceBookingServicesAction(
    arenaId: string,
    bookingId: string,
    lines: { product_id: string; quantity: number }[]
): Promise<{ success: boolean; error?: string }> {
    try {
        await assertArenaBackofficeAccess(arenaId)
        await assertBookingAccess(bookingId, arenaId)
        const supabase = getSupabaseAdmin()
        const safeLines = lines.map(({ product_id, quantity }) => ({ product_id, quantity }))
        const { error } = await supabase.rpc("replace_booking_services_atomic", {
            p_arena_id: arenaId,
            p_booking_id: bookingId,
            p_lines: safeLines,
        })
        if (error) throw new Error(error.message)

        revalidateArenaCalendar(arenaId)
        return { success: true }
    } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao salvar serviços da reserva"
        return { success: false, error: message }
    }
}

/** Compatibilidade para consumidores do sync: preço e linhas são derivados atomicamente no banco. */
export async function syncBookingServicesAndTotalAction(
    arenaId: string,
    bookingId: string,
    lines: { product_id: string; quantity: number }[]
): Promise<{ success: boolean; error?: string }> {
    return replaceBookingServicesAction(arenaId, bookingId, lines)
}
