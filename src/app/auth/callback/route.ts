import { NextResponse } from "next/server"
import type { EmailOtpType } from "@supabase/supabase-js"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { provisionAfterSignUpAction } from "@/modules/auth/actions/authActions"

function normalizeRedirectPath(value: string | null) {
    if (!value || !value.startsWith("/") || value.startsWith("//")) {
        return "/dashboard"
    }

    return value
}

export async function GET(request: Request) {
    const url = new URL(request.url)
    const code = url.searchParams.get("code")
    const tokenHash = url.searchParams.get("token_hash")
    const type = url.searchParams.get("type") as EmailOtpType | null
    const next = normalizeRedirectPath(url.searchParams.get("next"))
    const errorDescription = url.searchParams.get("error_description")

    if (errorDescription) {
        return NextResponse.redirect(new URL(`/sign-in?error=${encodeURIComponent(errorDescription)}`, url.origin))
    }

    const supabase = await createSupabaseServerClient()
    const { error } = tokenHash && type
        ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
        : code
            ? await supabase.auth.exchangeCodeForSession(code)
            : { error: new Error("Missing auth callback token") }

    if (error) {
        return NextResponse.redirect(new URL(`/sign-in?error=${encodeURIComponent(error.message)}`, url.origin))
    }

    // Garante que gestores autenticados via OAuth/magic link tenham provisionamento
    // (se o metadata tiver arenaName, provisionAfterSignUpAction cria arena+arena_user).
    await provisionAfterSignUpAction()

    return NextResponse.redirect(new URL(next, url.origin))
}
