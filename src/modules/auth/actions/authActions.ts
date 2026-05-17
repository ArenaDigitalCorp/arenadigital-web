"use server"

import { createSupabaseServerClient } from "@/lib/supabase/server"
import { getSupabaseAdmin } from "@/lib/supabase-server"
import { provisionOwnerArena } from "@/modules/users/actions/userActions"

type AddressData = {
    cep?: string
    state?: string
    city?: string
    id_municipio?: number
    neighborhood?: string
    street?: string
    number?: string
    complement?: string
}

type SignUpInput = {
    email: string
    password: string
    emailRedirectTo: string
    firstName: string
    lastName: string
    cpf: string
    phone: string
    arenaName: string
    addressData: AddressData
}

type ActionResult<T = undefined> =
    | { success: true; data?: T }
    | { success: false; error: string }

function getErrorMessage(error: unknown) {
    if (error instanceof Error) return error.message
    return "Erro desconhecido"
}

function normalizeEmailRedirectTo(value: string) {
    try {
        const url = new URL(value)
        if (!['http:', 'https:'].includes(url.protocol)) return undefined
        if (url.pathname !== '/auth/callback') return undefined
        return url.toString()
    } catch {
        return undefined
    }
}

// Inicia o cadastro de um novo gestor.
// Cria entrada em auth.users via supabase.auth.signUp (envia link de confirmação por email).
// O trigger on_auth_user_created já cria a linha em public.users com nome/cpf vindos do metadata.
// A criação da arena fica para depois do callback de confirmação (provisionAfterSignUpAction).
export async function startSignUpAction(input: SignUpInput): Promise<ActionResult> {
    try {
        const supabase = await createSupabaseServerClient()
        const emailRedirectTo = normalizeEmailRedirectTo(input.emailRedirectTo)

        const { error } = await supabase.auth.signUp({
            email: input.email,
            password: input.password,
            options: {
                ...(emailRedirectTo ? { emailRedirectTo } : {}),
                data: {
                    firstName: input.firstName,
                    lastName: input.lastName,
                    cpf: input.cpf,
                    phone: input.phone,
                    arenaName: input.arenaName,
                    addressData: input.addressData,
                },
            },
        })

        if (error) {
            return { success: false, error: error.message }
        }

        return { success: true }
    } catch (error) {
        console.error("startSignUpAction error:", error)
        return { success: false, error: getErrorMessage(error) }
    }
}

// Após o usuário confirmar o link de email, provisiona arena + arena_user.
// Lê o usuário autenticado da session (cookie) e os dados do metadata salvos em raw_user_meta_data.
export async function provisionAfterSignUpAction(): Promise<ActionResult<{ arenaCreated: boolean }>> {
    try {
        const supabase = await createSupabaseServerClient()
        const { data: authData, error: authError } = await supabase.auth.getUser()

        if (authError || !authData.user) {
            return { success: false, error: "Usuário não autenticado" }
        }

        const user = authData.user
        const meta = (user.user_metadata ?? {}) as Record<string, unknown>
        const arenaName = typeof meta.arenaName === "string" ? meta.arenaName : undefined
        const phone = typeof meta.phone === "string" ? meta.phone : undefined
        const addressData = meta.addressData

        // Garante linha em public.users com cpf/phone (trigger faz nome+role, mas pode faltar cpf em casos de OAuth)
        const admin = getSupabaseAdmin()
        const cpf = typeof meta.cpf === "string" ? meta.cpf : undefined
        if (cpf) {
            await admin.from("users").update({ cpf }).eq("id", user.id)
        }

        if (arenaName) {
            await provisionOwnerArena(user.id, arenaName, phone, addressData)
            return { success: true, data: { arenaCreated: true } }
        }

        return { success: true, data: { arenaCreated: false } }
    } catch (error) {
        console.error("provisionAfterSignUpAction error:", error)
        return { success: false, error: getErrorMessage(error) }
    }
}
