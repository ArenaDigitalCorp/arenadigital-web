import { NextResponse } from "next/server"
import type { EmailOtpType } from "@supabase/supabase-js"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { observeHttpRequest } from "@/lib/observability/server"
import { ensureWebBackofficeAccessAction, provisionAfterSignUpAction } from "@/modules/auth/actions/authActions"

function normalizeRedirectPath(value: string | null) {
    if (!value || !value.startsWith("/") || value.startsWith("//")) {
        return "/dashboard"
    }

    return value
}

export async function GET(request: Request) {
    const observation = observeHttpRequest(request, {
        component: "auth",
        operation: "callback",
    })
    const url = new URL(request.url)
    const code = url.searchParams.get("code")
    const tokenHash = url.searchParams.get("token_hash")
    const type = url.searchParams.get("type") as EmailOtpType | null
    const next = normalizeRedirectPath(url.searchParams.get("next"))
    const errorDescription = url.searchParams.get("error_description")

    if (errorDescription) {
        observation.log("warn", "auth.callback.provider_rejected")
        return observation.respond(NextResponse.redirect(new URL(`/sign-in?error=${encodeURIComponent(errorDescription)}`, url.origin)))
    }

    const supabase = await createSupabaseServerClient()
    const { error } = tokenHash && type
        ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
        : code
            ? await supabase.auth.exchangeCodeForSession(code)
            : { error: new Error("Missing auth callback token") }

    if (error) {
        observation.log("warn", "auth.callback.verification_failed", { error })
        return observation.respond(NextResponse.redirect(new URL(`/sign-in?error=${encodeURIComponent(error.message)}`, url.origin)))
    }

    // Resolve o signup depois da confirmação. Uma correspondência com o catálogo
    // abre análise manual; somente cadastros sem correspondência criam um tenant.
    // A falha aqui é best-effort: quem já tem conta segue para o painel, onde o
    // acesso continua sendo validado por ensureWebBackofficeAccessAction.
    const provision = await provisionAfterSignUpAction()
    if (!provision.success) {
        observation.log("error", "auth.callback.provision_failed")
    }

    if (provision.success && provision.data && ['claim_pending', 'access_conflict', 'rejected'].includes(provision.data.status)) {
        observation.log("info", "auth.callback.signup_requires_review", { status: provision.data.status })
        return observation.respond(NextResponse.redirect(new URL('/sign-up/status', url.origin)))
    }

    const webAccess = await ensureWebBackofficeAccessAction()
    if (!webAccess.success) {
        observation.log("warn", "auth.callback.access_denied")
        await supabase.auth.signOut()
        return observation.respond(NextResponse.redirect(new URL(`/sign-in?error=${encodeURIComponent(webAccess.error)}`, url.origin)))
    }

    const destination = next === '/reset-password'
        ? next
        : webAccess.data?.adminDestination ?? next

    return observation.respond(NextResponse.redirect(new URL(destination, url.origin)))
}
