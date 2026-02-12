"use client"

import * as React from "react"
import { useSignUp } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

export function CustomSignUp() {
    const { isLoaded, signUp, setActive } = useSignUp()
    const [emailAddress, setEmailAddress] = React.useState("")
    const [password, setPassword] = React.useState("")
    const [firstName, setFirstName] = React.useState("")
    const [lastName, setLastName] = React.useState("")
    const [arenaName, setArenaName] = React.useState("")
    const [pendingVerification, setPendingVerification] = React.useState(false)
    const [code, setCode] = React.useState("")
    const [loading, setLoading] = React.useState(false)
    const router = useRouter()

    // Handle initial sign-up submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!isLoaded) return

        setLoading(true)

        try {
            await signUp.create({
                emailAddress,
                password,
                firstName,
                lastName,
                unsafeMetadata: {
                    arenaName
                }
            })

            // Send verification email
            await signUp.prepareEmailAddressVerification({ strategy: "email_code" })

            setPendingVerification(true)
            toast.success("Código de verificação enviado para seu e-mail!")
        } catch (err: any) {
            console.error(JSON.stringify(err, null, 2))
            toast.error(err.errors?.[0]?.message || "Erro ao criar conta.")
        } finally {
            setLoading(false)
        }
    }

    // Handle email verification
    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!isLoaded) return

        setLoading(true)

        try {
            const completeSignUp = await signUp.attemptEmailAddressVerification({
                code,
            })

            if (completeSignUp.status !== "complete") {
                console.log(JSON.stringify(completeSignUp, null, 2))
                toast.error("Erro ao verificar código.")
            }

            if (completeSignUp.status === "complete") {
                await setActive({ session: completeSignUp.createdSessionId })
                router.push("/dashboard")
            }
        } catch (err: any) {
            console.error(JSON.stringify(err, null, 2))
            toast.error(err.errors?.[0]?.message || "Código inválido.")
        } finally {
            setLoading(false)
        }
    }

    if (pendingVerification) {
        return (
            <form onSubmit={handleVerify} className="w-full space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="code" className="text-white/70">Código de Verificação</Label>
                    <Input
                        id="code"
                        value={code}
                        placeholder="Digite o código enviado ao seu e-mail"
                        onChange={(e) => setCode(e.target.value)}
                        className="bg-white border-none h-12 rounded-lg"
                        required
                    />
                </div>
                <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#FF6B00] hover:bg-[#E66000] h-12 rounded-lg text-lg font-bold shadow-lg"
                >
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Verificar E-mail"}
                </Button>
            </form>
        )
    }

    return (
        <form onSubmit={handleSubmit} className="w-full space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-white/70">Nome</Label>
                    <Input
                        id="firstName"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="bg-white border-none h-12 rounded-lg"
                        required
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-white/70">Sobrenome</Label>
                    <Input
                        id="lastName"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="bg-white border-none h-12 rounded-lg"
                        required
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="email" className="text-white/70">E-mail</Label>
                <Input
                    id="email"
                    type="email"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    className="bg-white border-none h-12 rounded-lg"
                    required
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="arenaName" className="text-white/70">Nome da Arena</Label>
                <Input
                    id="arenaName"
                    value={arenaName}
                    placeholder="Ex: Arena Beach Tennis"
                    onChange={(e) => setArenaName(e.target.value)}
                    className="bg-white border-none h-12 rounded-lg"
                    required
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="password" className="text-white/70">Senha</Label>
                <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-white border-none h-12 rounded-lg"
                    required
                />
            </div>

            <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[#FF6B00] hover:bg-[#E66000] h-12 rounded-lg text-lg font-bold shadow-lg mt-4"
            >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Criar Conta"}
            </Button>
        </form>
    )
}
