"use server"

import { createSupabaseServerClient } from "@/lib/supabase/server"
import { getSupabaseAdmin } from "@/lib/supabase-server"
import { provisionOwnerArena } from "@/modules/users/services/provision-owner-arena"
import { findUserByCpf, findUserByEmail, normalizeEmail, resolveAuthenticatedDbUser } from "@/lib/account-identity"
import { isValidCpf, isValidCpfOrCnpj, onlyDigits } from "@/lib/brasil-document"
import { hasWebBackofficeAccess, WEB_BACKOFFICE_ACCESS_DENIED_MESSAGE } from "@/lib/server-auth"
import { observeServerAction } from "@/lib/observability/server"
import { isStrongPassword } from "@/lib/password-policy"
import { headers } from "next/headers"
import {
    ARENA_SIGNUP_INTENT_KEY,
    consumeArenaSignupIntentMetadata,
    createArenaSignupIntent,
    readArenaSignupIntent,
} from "@/modules/auth/lib/arena-signup-intent"

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
    firstName: string
    lastName: string
    cpf: string
    phone: string
    arenaName: string
    arenaDocument: string
    addressData: AddressData
}

type ActionResult<T = undefined> =
    | { success: true; data?: T }
    | { success: false; error: string }

type ActionObserver = Awaited<ReturnType<typeof observeServerAction>>

function finishObservedAction<T>(
    observer: ActionObserver,
    result: ActionResult<T>,
    outcome = result.success ? "completed" : "rejected",
): ActionResult<T> {
    observer.complete(outcome)
    return result
}

function getErrorMessage(error: unknown) {
    if (error instanceof Error) return error.message
    return "Erro desconhecido"
}

async function getArenaSignupRedirectTo() {
    const requestOrigin = (await headers()).get('origin')
    const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL
    const candidate = requestOrigin || configuredOrigin
    if (!candidate) return undefined

    try {
        const origin = new URL(candidate)
        const isLocal = ['localhost', '127.0.0.1'].includes(origin.hostname)
        if (origin.protocol !== 'https:' && !(isLocal && origin.protocol === 'http:')) return undefined
        return new URL('/auth/callback?next=/dashboard', origin.origin).toString()
    } catch {
        return undefined
    }
}

function validateArenaSignupData(input: SignUpInput) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(input.email))) return "Informe um e-mail válido."
    if (input.firstName.trim().length < 2) return "Informe o nome do responsável."
    if (input.lastName.trim().length < 2) return "Informe o sobrenome do responsável."
    if (!isValidCpf(input.cpf)) return "Informe um CPF válido para o responsável."
    if (!isStrongPassword(input.password)) return "A senha não atende aos requisitos de segurança."
    if (!input.arenaName.trim()) return "Informe o nome da arena."
    if (onlyDigits(input.phone).length < 10) return "Informe um telefone válido para a arena."
    if (!onlyDigits(input.arenaDocument)) return "Informe o CPF ou CNPJ da arena."
    if (!isValidCpfOrCnpj(input.arenaDocument)) return "Informe um CPF ou CNPJ válido."
    if (!input.addressData.id_municipio) return "Selecione a cidade da arena."
    return null
}

export async function checkArenaSignupEmailAction(emailInput: string): Promise<ActionResult<{
    status: "new-user"
}>> {
    const observation = await observeServerAction({ component: "auth", operation: "check_signup_email" })
    try {
        const email = normalizeEmail(emailInput)
        if (!email) return finishObservedAction(observation, { success: false, error: "Informe um e-mail válido." })

        // Não exponha se a identidade já existe nesta etapa pública. A verificação
        // autoritativa de e-mail/CPF acontece somente no envio completo.
        return finishObservedAction(observation, { success: true, data: { status: "new-user" } })
    } catch (error) {
        observation.log("error", "auth.check_signup_email.failed", { error })
        return finishObservedAction(observation, { success: false, error: getErrorMessage(error) }, "failed")
    }
}

// Inicia o cadastro de um novo gestor.
// Cria entrada em auth.users via supabase.auth.signUp (envia link de confirmação por email).
// O trigger on_auth_user_created já cria a linha em public.users com nome/documento vindos do metadata.
// A criação da arena fica para depois do callback de confirmação (provisionAfterSignUpAction).
export async function startSignUpAction(input: SignUpInput): Promise<ActionResult> {
    const observation = await observeServerAction({ component: "auth", operation: "start_signup" })
    try {
        const validationError = validateArenaSignupData(input)
        if (validationError) return finishObservedAction(observation, { success: false, error: validationError })

        const supabase = await createSupabaseServerClient()
        const admin = getSupabaseAdmin()
        const email = normalizeEmail(input.email)
        const cleanCpf = onlyDigits(input.cpf)
        const cleanArenaDocument = onlyDigits(input.arenaDocument)
        const emailRedirectTo = await getArenaSignupRedirectTo()

        const [existingUserByEmail, existingUserByCpf] = await Promise.all([
            findUserByEmail(admin, email),
            findUserByCpf(admin, cleanCpf),
        ])

        if (existingUserByEmail) {
            return finishObservedAction(observation, {
                success: false,
                error: "Não foi possível criar esta conta. Se você já possui cadastro, entre ou recupere sua senha.",
            })
        }

        if (existingUserByCpf && normalizeEmail(existingUserByCpf.email) !== email) {
            return finishObservedAction(observation, {
                success: false,
                error: "Este CPF já está vinculado a outro e-mail. Use o e-mail cadastrado ou recupere o acesso.",
            })
        }

        const { data: signUpData, error } = await supabase.auth.signUp({
            email,
            password: input.password,
            options: {
                ...(emailRedirectTo ? { emailRedirectTo } : {}),
                data: {
                    firstName: input.firstName.trim(),
                    lastName: input.lastName.trim(),
                    cpf: cleanCpf,
                    phone: input.phone.trim(),
                },
            },
        })

        if (error) {
            return finishObservedAction(observation, { success: false, error: error.message })
        }

        if (!signUpData.user) {
            return finishObservedAction(observation, { success: false, error: "Não foi possível iniciar o cadastro." })
        }

        const intent = createArenaSignupIntent({
            arenaName: input.arenaName.trim(),
            arenaDocument: cleanArenaDocument,
            phone: input.phone.trim(),
            cpf: cleanCpf,
            addressData: input.addressData,
        })
        const { error: intentError } = await admin.auth.admin.updateUserById(signUpData.user.id, {
            app_metadata: {
                ...(signUpData.user.app_metadata ?? {}),
                [ARENA_SIGNUP_INTENT_KEY]: intent,
            },
        })

        if (intentError) {
            await admin.auth.admin.deleteUser(signUpData.user.id).catch(() => null)
            return finishObservedAction(observation, { success: false, error: "Não foi possível preparar o cadastro da arena. Tente novamente." })
        }

        return finishObservedAction(observation, { success: true })
    } catch (error) {
        observation.log("error", "auth.start_signup.failed", { error })
        return finishObservedAction(observation, { success: false, error: getErrorMessage(error) }, "failed")
    }
}

// Provisiona arena + arena_user a partir de um intent emitido pelo servidor em
// app_metadata (não editável pelo usuário).
// Chamado após confirmação de email (/auth/callback) e no login, para cobrir quem
// confirma o e-mail mas entra depois pela tela de login.
export async function provisionAfterSignUpAction(): Promise<ActionResult<{ arenaCreated: boolean }>> {
    const observation = await observeServerAction({ component: "auth", operation: "provision_signup" })
    try {
        const supabase = await createSupabaseServerClient()
        const { data: authData, error: authError } = await supabase.auth.getUser()

        if (authError || !authData.user) {
            return finishObservedAction(observation, { success: false, error: "Usuário não autenticado" })
        }

        const admin = getSupabaseAdmin()
        const user = authData.user
        const dbUser = await resolveAuthenticatedDbUser(admin, user.id)
        if (!dbUser?.id) {
            return finishObservedAction(observation, { success: false, error: "Usuário não provisionado" })
        }

        const intent = readArenaSignupIntent(user.app_metadata)
        if (!intent) {
            return finishObservedAction(observation, { success: true, data: { arenaCreated: false } })
        }

        // Intents antigos podiam confundir o documento fiscal da arena com o CPF
        // do responsável. Limpe esse legado em vez de perpetuar um CNPJ em users.cpf.
        const ownerCpf = isValidCpf(intent.cpf) ? onlyDigits(intent.cpf) : null
        const { error: userUpdateError } = await admin
            .from("users")
            .update({ cpf: ownerCpf })
            .eq("id", dbUser.id)
        if (userUpdateError) throw new Error(userUpdateError.message)

        const arenaId = await provisionOwnerArena(
            dbUser.id,
            intent.arenaName,
            intent.phone,
            intent.addressData,
            intent.arenaDocument,
        )

        const { error: consumeError } = await admin.auth.admin.updateUserById(user.id, {
            app_metadata: {
                ...consumeArenaSignupIntentMetadata(user.app_metadata),
                arena_signup_provisioned_at: new Date().toISOString(),
            },
        })
        if (consumeError) throw new Error(consumeError.message)

        return finishObservedAction(observation, { success: true, data: { arenaCreated: Boolean(arenaId) } })
    } catch (error) {
        observation.log("error", "auth.provision_signup.failed", { error })
        return finishObservedAction(observation, { success: false, error: getErrorMessage(error) }, "failed")
    }
}

export async function ensureWebBackofficeAccessAction(): Promise<ActionResult> {
    const observation = await observeServerAction({ component: "auth", operation: "ensure_backoffice_access" })
    try {
        const supabase = await createSupabaseServerClient()
        const { data: authData, error: authError } = await supabase.auth.getUser()

        if (authError || !authData.user) {
            return finishObservedAction(observation, { success: false, error: "Usuário não autenticado" })
        }

        const admin = getSupabaseAdmin()
        const dbUser = await resolveAuthenticatedDbUser(admin, authData.user.id)

        if (!dbUser?.id) {
            await supabase.auth.signOut()
            return finishObservedAction(observation, { success: false, error: "Usuário não provisionado para acessar o painel web." })
        }

        const canAccessWeb = await hasWebBackofficeAccess(dbUser.id)
        if (!canAccessWeb) {
            await supabase.auth.signOut()
            return finishObservedAction(observation, { success: false, error: WEB_BACKOFFICE_ACCESS_DENIED_MESSAGE })
        }

        return finishObservedAction(observation, { success: true })
    } catch (error) {
        observation.log("error", "auth.ensure_backoffice_access.failed", { error })
        return finishObservedAction(observation, { success: false, error: getErrorMessage(error) }, "failed")
    }
}
