'use client';

import { Logo } from '@/components/shared/Logo';
import { cn } from '@/lib/utils';
import * as Clerk from '@clerk/elements/common';
import * as SignIn from '@clerk/elements/sign-in';
import { ArrowLeft, ArrowRight } from 'lucide-react';

const inputLight =
  'w-full rounded-lg border border-zinc-700 bg-white px-3 py-2.5 text-sm text-black placeholder-zinc-500 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400';

const btnPrimary =
  'flex w-full items-center justify-center gap-2 rounded-lg bg-arena-button py-2.5 text-sm font-semibold text-white transition hover:bg-arena-button-hover active:scale-[.98]';

const otpCell =
  'flex size-11 shrink-0 items-center justify-center rounded-lg bg-white text-lg font-semibold tabular-nums text-black shadow-none outline-none sm:size-12';

export default function Page() {
  return (
    <div className="flex flex-col min-h-screen bg-[#F0E6D2] overflow-y-auto">
      <div className="m-auto w-full max-w-[500px] bg-arena-navy-800 rounded-3xl p-6 sm:p-10 md:p-20 shadow-2xl flex flex-col items-center">
        <Logo className="mb-12 hover:opacity-80 transition-opacity cursor-pointer" />
        <SignIn.Root>
          <Clerk.GlobalError className="mb-6 block w-full max-w-sm rounded-lg bg-red-500/10 px-3 py-2 text-center text-sm text-red-200" />
          {/* ─── STEP 1: Identifica o usuário ─── */}
          <SignIn.Step name="start" className="w-full max-w-sm space-y-12">
            {/* Header — troque pelo logo/título do seu app */}
            <div className="space-y-1 text-center">
              <h1 className="text-2xl font-semibold text-white tracking-tight">
                Boas vindas!
              </h1>
              <p className="text-sm text-white">Entre com sua conta</p>
              {/* <p className="text-sm text-zinc-400">
                Entre com sua conta ou{' '}
                <Link
                  href="/sign-up"
                  className="text-white underline underline-offset-4 hover:text-zinc-300"
                >
                  Cadastre-se
                </Link>
              </p> */}
            </div>

            <div className="flex flex-col w-full gap-6">
              {/* Campo: email */}
              <Clerk.Field name="identifier" className="space-y-1.5">
                <Clerk.Input
                  type="email"
                  autoComplete="email"
                  className={inputLight}
                  placeholder="Digite seu e-mail"
                />
                <Clerk.FieldError className="block text-xs text-red-400" />
              </Clerk.Field>

              <SignIn.Action submit className={btnPrimary}>
                Continuar <ArrowRight className="w-4 h-4 mt-0.5" />
              </SignIn.Action>
            </div>
          </SignIn.Step>

          {/* ─── STEP 2: Verificação (senha ou código por e-mail) ─── */}
          <SignIn.Step
            name="verifications"
            className="w-full max-w-sm space-y-12"
          >
            {/* Estratégia: senha */}
            <SignIn.Strategy name="password">
              <div className="space-y-1 text-center">
                <h1 className="text-2xl font-semibold text-white tracking-tight">
                  Boas vindas!
                </h1>
                <p className="text-sm text-white">Entre com sua conta</p>
              </div>

              <div className="flex flex-col w-full gap-6">
                <Clerk.Field name="password" className="space-y-1.5">
                  <Clerk.Input
                    type="password"
                    autoComplete="current-password"
                    className={inputLight}
                    placeholder="••••••••"
                  />
                  <Clerk.FieldError className="block text-xs text-red-400" />
                </Clerk.Field>

                <div className="flex items-center justify-center">
                  <SignIn.Action
                    navigate="forgot-password"
                    className="text-xs text-white underline underline-offset-1 hover:text-zinc-200"
                  >
                    Esqueceu minha senha
                  </SignIn.Action>
                </div>

                <SignIn.Action submit className={btnPrimary}>
                  Entrar
                </SignIn.Action>
              </div>

              <div className="flex items-center justify-center">
                <div className="w-full h-px bg-white/10" />
              </div>

              <SignIn.Action
                navigate="start"
                className="flex w-full items-center gap-2 text-sm text-white hover:text-white/80"
              >
                <ArrowLeft className="size-4 shrink-0" /> Voltar para o login
              </SignIn.Action>
            </SignIn.Strategy>

            {/* Estratégia: código por e-mail (fallback) */}
            <SignIn.Strategy name="email_code">
              <div className="space-y-3 text-center">
                <h1 className="text-2xl font-semibold tracking-tight text-white">
                  Verifique seu e-mail
                </h1>
                <p className="text-sm leading-relaxed text-white">
                  Enviamos um e-mail automático com um código de verificação.
                  Digite abaixo o código enviado para{' '}
                  <SignIn.SafeIdentifier transform={(s) => s.toLowerCase()} />{' '}
                  para continuar.
                </p>
                <p className="text-xs text-white/75">
                  Verifique também sua caixa de spam/lixo eletrônico.
                </p>
              </div>

              <Clerk.Field name="code" className="space-y-4">
                <Clerk.Input
                  type="otp"
                  length={6}
                  autoSubmit
                  className="flex justify-center gap-2 sm:gap-3"
                  render={({ value, status, index }) => (
                    <div
                      key={index}
                      className={cn(
                        otpCell,
                        (status === 'cursor' || status === 'selected') &&
                          'ring-2 ring-arena-button ring-offset-2 ring-offset-arena-navy-800'
                      )}
                    >
                      {value || '\u00a0'}
                    </div>
                  )}
                />
                <Clerk.FieldError className="block text-center text-xs text-red-400" />
              </Clerk.Field>

              <SignIn.Action submit className={btnPrimary}>
                Verificar
              </SignIn.Action>

              <div className="h-px w-full bg-white/10" />

              <SignIn.Action
                navigate="start"
                className="flex w-full items-center gap-2 text-sm text-white hover:text-white/80"
              >
                <ArrowLeft className="size-4 shrink-0" /> Voltar para o login
              </SignIn.Action>
            </SignIn.Strategy>

            {/* Código de redefinição de senha (após “Enviar código” em Esqueci a senha) */}
            <SignIn.Strategy name="reset_password_email_code">
              <div className="space-y-3 text-center">
                <h1 className="text-2xl font-semibold tracking-tight text-white">
                  Reset de senha
                </h1>
                <p className="text-sm leading-relaxed text-white">
                  Enviamos um e-mail automático com um código de verificação.
                  Digite abaixo o código enviado para{' '}
                  <SignIn.SafeIdentifier transform={(s) => s.toLowerCase()} />{' '}
                  para continuar.
                </p>
                <p className="text-xs text-white/75">
                  Verifique também sua caixa de spam/lixo eletrônico.
                </p>
              </div>

              <Clerk.Field name="code" className="space-y-4">
                <Clerk.Input
                  type="otp"
                  length={6}
                  autoSubmit
                  className="flex justify-center gap-2 sm:gap-3"
                  render={({ value, status, index }) => (
                    <div
                      key={index}
                      className={cn(
                        otpCell,
                        (status === 'cursor' || status === 'selected') &&
                          'ring-2 ring-arena-button ring-offset-2 ring-offset-arena-navy-800'
                      )}
                    >
                      {value || '\u00a0'}
                    </div>
                  )}
                />
                <Clerk.FieldError className="block text-center text-xs text-red-400" />
              </Clerk.Field>

              <SignIn.Action submit className={btnPrimary}>
                Continuar
              </SignIn.Action>

              <SignIn.Action
                resend
                className="block w-full text-center text-xs text-white/70 underline-offset-2 hover:text-white"
                fallback={({ resendableAfter }) => (
                  <span className="block text-center text-xs text-white/50">
                    Reenviar em {resendableAfter}s
                  </span>
                )}
              >
                Reenviar código
              </SignIn.Action>

              <div className="h-px w-full bg-white/10" />

              <SignIn.Action
                navigate="start"
                className="flex w-full items-center gap-2 text-sm text-white hover:text-white/80"
              >
                <ArrowLeft className="size-4 shrink-0" /> Voltar para o login
              </SignIn.Action>
            </SignIn.Strategy>
          </SignIn.Step>

          {/* ─── STEP 3: Escolher outro método ─── */}
          <SignIn.Step
            name="choose-strategy"
            className="w-full max-w-sm space-y-10"
          >
            <div className="space-y-2 text-center">
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                Outro método
              </h1>
              <p className="text-sm text-white/85">
                Escolha como deseja entrar
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <SignIn.SupportedStrategy name="password" asChild>
                <button type="button" className={btnPrimary}>
                  Entrar com senha
                </button>
              </SignIn.SupportedStrategy>
              <SignIn.SupportedStrategy name="email_code" asChild>
                <button type="button" className={btnPrimary}>
                  Código por e-mail
                </button>
              </SignIn.SupportedStrategy>
            </div>
          </SignIn.Step>

          {/* ─── STEP 4: Esqueceu a senha ─── */}
          <SignIn.Step
            name="forgot-password"
            className="w-full max-w-sm space-y-10"
          >
            <div className="space-y-3 text-center">
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                Recuperar senha
              </h1>
              <p className="text-sm leading-relaxed text-white">
                Enviaremos um e-mail automático com um código de verificação
                para{' '}
                <SignIn.SafeIdentifier transform={(s) => s.toLowerCase()} />.
              </p>
              <p className="text-xs text-white/75">
                Verifique também sua caixa de spam/lixo eletrônico.
              </p>
            </div>

            <SignIn.SupportedStrategy name="reset_password_email_code" asChild>
              <button type="button" className={btnPrimary}>
                Enviar código de redefinição
              </button>
            </SignIn.SupportedStrategy>

            <div className="h-px w-full bg-white/10" />

            <SignIn.Action
              navigate="previous"
              className="flex items-center gap-2 text-sm text-white hover:text-white/80"
            >
              <ArrowLeft className="size-4 shrink-0" /> Voltar para o login
            </SignIn.Action>
          </SignIn.Step>

          {/* ─── STEP 5: Nova senha (código já validado em verifications → reset_password_email_code) ─── */}
          <SignIn.Step
            name="reset-password"
            className="w-full max-w-sm space-y-10"
          >
            <div className="space-y-2 text-center">
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                Cadastro de senha
              </h1>
              <p className="text-sm leading-relaxed text-white/90">
                Defina sua nova senha para acessar o Arena Digital.
              </p>
            </div>

            <div className="flex flex-col gap-5">
              <Clerk.Field name="password" className="space-y-1.5">
                <Clerk.Label className="block text-sm font-medium text-white">
                  Senha
                </Clerk.Label>
                <Clerk.Input
                  type="password"
                  autoComplete="new-password"
                  className={inputLight}
                  placeholder="••••••••"
                />
                <Clerk.FieldError className="block text-xs text-red-400" />
              </Clerk.Field>

              <Clerk.Field name="confirmPassword" className="space-y-1.5">
                <Clerk.Label className="block text-sm font-medium text-white">
                  Confirmação de senha
                </Clerk.Label>
                <Clerk.Input
                  type="password"
                  autoComplete="new-password"
                  className={inputLight}
                  placeholder="••••••••"
                />
                <Clerk.FieldError className="block text-xs text-red-400" />
              </Clerk.Field>
            </div>

            <SignIn.Action submit className={btnPrimary}>
              Cadastrar
            </SignIn.Action>

            <div className="h-px w-full bg-white/10" />

            <SignIn.Action
              navigate="start"
              className="flex items-center gap-2 text-sm text-white hover:text-white/80"
            >
              <ArrowLeft className="size-4 shrink-0" /> Voltar para o login
            </SignIn.Action>
          </SignIn.Step>
        </SignIn.Root>
      </div>
    </div>
  );
}
