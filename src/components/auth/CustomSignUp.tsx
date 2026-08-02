"use client"

import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Loader2, Check, ChevronsUpDown, Eye, EyeOff, X } from "lucide-react"
import { supabase as supabasePublic } from "@/shared/database/supabaseClient"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { cn } from "@/lib/utils"
import {
    checkArenaSignupEmailAction,
    startSignUpAction,
} from "@/modules/auth/actions/authActions"
import { isValidCpf, isValidCpfOrCnpj } from "@/lib/brasil-document"

const maskCpf = (value: string) => {
    return value
        .replace(/\D/g, "")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})/, "$1-$2")
        .replace(/(-\d{2})\d+?$/, "$1");
};

const maskPhone = (value: string) => {
    return value
        .replace(/\D/g, "")
        .replace(/(\d{2})(\d)/, "($1) $2")
        .replace(/(\d{5})(\d)/, "$1-$2")
        .replace(/(-\d{4})\d+?$/, "$1");
};

const maskCep = (value: string) => {
    return value
        .replace(/\D/g, "")
        .replace(/(\d{5})(\d)/, "$1-$2")
        .replace(/(-\d{3})\d+?$/, "$1");
};

const maskCpfCnpj = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 14)
    if (digits.length <= 11) return maskCpf(digits)
    return digits
        .replace(/(\d{2})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1/$2")
        .replace(/(\d{4})(\d{1,2})/, "$1-$2")
        .replace(/(-\d{2})\d+?$/, "$1")
}

type EstadoRow = { codigo_uf: number; nome: string; uf: string }
type MunicipioRow = { codigo_ibge: number; nome: string; codigo_uf: number }
type AccountMode = "email" | "new-user"

export function CustomSignUp() {
    const [firstName, setFirstName] = React.useState("")
    const [lastName, setLastName] = React.useState("")
    const [responsibleCpf, setResponsibleCpf] = React.useState("")
    const [phone, setPhone] = React.useState("")
    const [arenaName, setArenaName] = React.useState("")
    const [arenaDocument, setArenaDocument] = React.useState("")

    const [cep, setCep] = React.useState("")
    const [state, setState] = React.useState("")
    const [city, setCity] = React.useState("")
    const [municipioId, setMunicipioId] = React.useState<number | null>(null)
    const [neighborhood, setNeighborhood] = React.useState("")
    const [street, setStreet] = React.useState("")
    const [addressNumber, setAddressNumber] = React.useState("")
    const [complement, setComplement] = React.useState("")

    const [estados, setEstados] = React.useState<EstadoRow[]>([])
    const [municipios, setMunicipios] = React.useState<MunicipioRow[]>([])
    const [selectedEstadoId, setSelectedEstadoId] = React.useState<number | null>(null)
    const [isEstadoOpen, setIsEstadoOpen] = React.useState(false)
    const [isMunicipioOpen, setIsMunicipioOpen] = React.useState(false)

    React.useEffect(() => {
        async function loadEstados() {
            try {
                const { data } = await supabasePublic.from('estados').select('*').order('nome')
                if (data) setEstados(data as EstadoRow[])
            } catch (error) {
                console.error("Failed to load states:", error)
            }
        }
        loadEstados()
    }, [])

    React.useEffect(() => {
        async function loadMunicipios() {
            if (!selectedEstadoId) {
                setMunicipios([])
                return
            }
            try {
                const { data } = await supabasePublic.from('municipios').select('*').eq('codigo_uf', selectedEstadoId).order('nome')
                if (data) setMunicipios(data as MunicipioRow[])
            } catch (error) {
                console.error("Failed to load cities:", error)
            }
        }
        loadMunicipios()
    }, [selectedEstadoId])

    const [emailAddress, setEmailAddress] = React.useState("")
    const [accountMode, setAccountMode] = React.useState<AccountMode>("email")
    const [password, setPassword] = React.useState("")
    const [confirmPassword, setConfirmPassword] = React.useState("")
    const [showPassword, setShowPassword] = React.useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = React.useState(false)

    const [pendingVerification, setPendingVerification] = React.useState(false)
    const [loading, setLoading] = React.useState(false)
    const [emailLookupLoading, setEmailLookupLoading] = React.useState(false)

    const passwordRequirements = React.useMemo(() => ([
        { label: "Mínimo de 8 caracteres", valid: password.length >= 8 },
        { label: "Uma letra maiúscula", valid: /[A-Z]/.test(password) },
        { label: "Uma letra minúscula", valid: /[a-z]/.test(password) },
        { label: "Um número", valid: /\d/.test(password) },
        { label: "Um caractere especial", valid: /[^A-Za-z0-9]/.test(password) },
    ]), [password])

    const isPasswordValid = passwordRequirements.every((req) => req.valid)

    const resetEmailCheck = () => {
        setAccountMode("email")
        setPassword("")
        setConfirmPassword("")
    }

    const handleEmailContinue = async () => {
        const cleanEmail = emailAddress.trim().toLowerCase()
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            toast.error("Informe um e-mail válido.")
            return
        }

        setEmailAddress(cleanEmail)
        setEmailLookupLoading(true)
        const res = await checkArenaSignupEmailAction(cleanEmail)
        setEmailLookupLoading(false)

        if (!res.success) {
            toast.error(res.error)
            return
        }

        if (!res.data) {
            toast.error("Não foi possível verificar esse e-mail agora.")
            return
        }

        setAccountMode(res.data.status)
    }

    const handleCepBlur = async () => {
        const cleanCep = cep.replace(/\D/g, '')
        if (cleanCep.length !== 8) return

        try {
            const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`)
            const data = await res.json()

            if (!data.erro) {
                setStreet(data.logradouro || "")
                setNeighborhood(data.bairro || "")

                const estadoEncontrado = estados.find(e => e.uf === data.uf)
                if (estadoEncontrado) {
                    setSelectedEstadoId(estadoEncontrado.codigo_uf)
                    setState(estadoEncontrado.uf)

                    const { data: muns } = await supabasePublic
                        .from('municipios')
                        .select('*')
                        .eq('codigo_uf', estadoEncontrado.codigo_uf)
                        .order('nome')

                    if (muns) {
                        const typedMuns = muns as MunicipioRow[]
                        setMunicipios(typedMuns)
                        const cidadeEncontrada = typedMuns.find(m => m.codigo_ibge.toString() === data.ibge)
                        if (cidadeEncontrada) {
                            setMunicipioId(cidadeEncontrada.codigo_ibge)
                            setCity(cidadeEncontrada.nome)
                        }
                    }
                }
            } else {
                toast.error("CEP não encontrado.")
            }
        } catch (error) {
            console.error("Erro ao buscar CEP:", error)
            toast.error("Falha ao comunicar com o serviço de CEP.")
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (accountMode === "email") {
            await handleEmailContinue()
            return
        }

        if (!isPasswordValid) {
            toast.error("A senha não atende a todos os requisitos.")
            return
        }

        if (!isValidCpf(responsibleCpf)) {
            toast.error("Informe um CPF válido para o responsável.")
            return
        }

        if (!isValidCpfOrCnpj(arenaDocument)) {
            toast.error("Informe um CPF ou CNPJ válido.")
            return
        }

        if (password !== confirmPassword) {
            toast.error("As senhas não coincidem.")
            return
        }

        if (!municipioId) {
            toast.error("Por favor, selecione uma cidade.")
            return
        }

        setLoading(true)

        const addressData = {
            cep,
            state,
            city,
            id_municipio: municipioId,
            neighborhood,
            street,
            number: addressNumber,
            complement,
        }

        const res = await startSignUpAction({
            email: emailAddress,
            password,
            firstName,
            lastName,
            cpf: responsibleCpf,
            phone,
            arenaName,
            arenaDocument,
            addressData,
        })

        setLoading(false)

        if (!res.success) {
            toast.error(res.error || "Erro ao criar conta.")
            return
        }

        setPendingVerification(true)
        toast.success("Link de confirmação enviado para seu e-mail!")
    }

    if (pendingVerification) {
        return (
            <div className="w-full space-y-5 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-arena-button text-white">
                    <Check className="h-6 w-6" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-xl font-semibold text-white">
                        Confirme seu e-mail
                    </h2>
                    <p className="text-sm leading-relaxed text-white/75">
                        Enviamos um link de confirmação para ativar sua conta gestora e entrar no dashboard.
                        {" "}
                        <span className="font-semibold text-white">{emailAddress}</span>
                    </p>
                </div>
                <Link href="/sign-in" className="block">
                    <Button
                        type="button"
                        className="w-full bg-arena-button hover:bg-arena-button-hover h-12 rounded-lg text-lg font-bold shadow-lg"
                    >
                        Ir para login
                    </Button>
                </Link>
                <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setPendingVerification(false)}
                    className="w-full text-white/75 hover:bg-white/10 hover:text-white"
                >
                    Corrigir e-mail
                </Button>
            </div>
        )
    }

    return (
        <form onSubmit={handleSubmit} className="w-full space-y-6">
            <div className="space-y-4">
                <h2 className="text-xl font-semibold text-white border-b border-white/20 pb-2">E-mail da conta</h2>
                <div className="space-y-2">
                    <Label htmlFor="email" className="text-white/70">E-mail</Label>
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <Input
                            id="email"
                            type="email"
                            value={emailAddress}
                            onChange={(e) => {
                                setEmailAddress(e.target.value)
                                if (accountMode !== "email") resetEmailCheck()
                            }}
                            className="bg-white border-none h-12 rounded-lg text-black"
                            disabled={emailLookupLoading || loading}
                            required
                        />
                        <Button
                            type="button"
                            onClick={handleEmailContinue}
                            disabled={emailLookupLoading || loading}
                            className="h-12 shrink-0 rounded-lg bg-white px-5 text-sm font-bold text-arena-navy-800 hover:bg-white/90"
                        >
                            {emailLookupLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {accountMode === "email" ? "Continuar" : "Verificar novamente"}
                        </Button>
                    </div>
                </div>

                {accountMode === "new-user" && (
                    <p className="rounded-lg border border-green-400/30 bg-green-500/10 px-3 py-2 text-sm text-green-100">
                        E-mail disponível. Continue o cadastro para criar sua conta gestora.
                    </p>
                )}

            </div>

            {accountMode === "new-user" && (
                <>
            <div className="space-y-4">
                <h2 className="text-xl font-semibold text-white border-b border-white/20 pb-2">
                    Dados Pessoais (Responsável)
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="firstName" className="text-white/70">Nome</Label>
                        <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="bg-white border-none h-12 rounded-lg text-black" required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="lastName" className="text-white/70">Sobrenome</Label>
                        <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} className="bg-white border-none h-12 rounded-lg text-black" required />
                    </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="responsibleCpf" className="text-white/70">CPF do responsável</Label>
                        <Input id="responsibleCpf" value={responsibleCpf} onChange={(e) => setResponsibleCpf(maskCpf(e.target.value))} inputMode="numeric" placeholder="000.000.000-00" className="bg-white border-none h-12 rounded-lg text-black" required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="phone" className="text-white/70">Telefone da Arena</Label>
                        <Input id="phone" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} placeholder="(00) 00000-0000" className="bg-white border-none h-12 rounded-lg text-black" required />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="arenaName" className="text-white/70">Nome da Arena</Label>
                    <Input id="arenaName" value={arenaName} placeholder="Ex: Arena Beach Tennis" onChange={(e) => setArenaName(e.target.value)} className="bg-white border-none h-12 rounded-lg text-black" required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="arenaDocument" className="text-white/70">CPF/CNPJ da Arena</Label>
                    <Input id="arenaDocument" value={arenaDocument} onChange={(e) => setArenaDocument(maskCpfCnpj(e.target.value))} inputMode="numeric" placeholder="000.000.000-00 ou 00.000.000/0000-00" className="bg-white border-none h-12 rounded-lg text-black" required />
                </div>
            </div>

            <div className="space-y-4 pt-2">
                <h2 className="text-xl font-semibold text-white border-b border-white/20 pb-2">Endereço da Arena</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="cep" className="text-white/70">CEP</Label>
                        <Input id="cep" value={cep} onChange={(e) => setCep(maskCep(e.target.value))} onBlur={handleCepBlur} placeholder="00000-000" className="bg-white border-none h-12 rounded-lg text-black" required />
                    </div>

                    <div className="space-y-2">
                        <Label className="text-white/70">Estado</Label>
                        <Popover open={isEstadoOpen} onOpenChange={setIsEstadoOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={isEstadoOpen}
                                    className={cn("w-full justify-between h-12 bg-white border-none text-black hover:bg-white/90", !selectedEstadoId && "text-muted-foreground")}
                                >
                                    {selectedEstadoId
                                        ? estados.find((est) => est.codigo_uf === selectedEstadoId)?.nome
                                        : "Selecione"}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0" align="start">
                                <Command>
                                    <CommandInput placeholder="Buscar estado..." />
                                    <CommandList>
                                        <CommandEmpty>Nenhum estado encontrado.</CommandEmpty>
                                        <CommandGroup>
                                            {estados.map((estado) => (
                                                <CommandItem
                                                    key={estado.codigo_uf}
                                                    value={estado.nome}
                                                    onSelect={() => {
                                                        setSelectedEstadoId(estado.codigo_uf)
                                                        setState(estado.uf)
                                                        setMunicipioId(null)
                                                        setCity("")
                                                        setIsEstadoOpen(false)
                                                    }}
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            estado.codigo_uf === selectedEstadoId ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    {estado.nome}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-white/70">Cidade</Label>
                        <Popover open={isMunicipioOpen} onOpenChange={setIsMunicipioOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={isMunicipioOpen}
                                    className={cn("w-full justify-between h-12 bg-white border-none text-black hover:bg-white/90", !municipioId && "text-muted-foreground")}
                                    disabled={!selectedEstadoId}
                                >
                                    {municipioId
                                        ? municipios.find((mun) => mun.codigo_ibge === municipioId)?.nome
                                        : "Selecione"}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0" align="start">
                                <Command>
                                    <CommandInput placeholder="Buscar cidade..." />
                                    <CommandList>
                                        <CommandEmpty>Nenhuma cidade encontrada.</CommandEmpty>
                                        <CommandGroup>
                                            {municipios.map((municipio) => (
                                                <CommandItem
                                                    key={municipio.codigo_ibge}
                                                    value={municipio.nome}
                                                    onSelect={() => {
                                                        setMunicipioId(municipio.codigo_ibge)
                                                        setCity(municipio.nome)
                                                        setIsMunicipioOpen(false)
                                                    }}
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            municipio.codigo_ibge === municipioId ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    {municipio.nome}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="neighborhood" className="text-white/70">Bairro</Label>
                        <Input id="neighborhood" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} className="bg-white border-none h-12 rounded-lg text-black" required />
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="street" className="text-white/70">Logradouro</Label>
                        <Input id="street" value={street} onChange={(e) => setStreet(e.target.value)} className="bg-white border-none h-12 rounded-lg text-black" required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="addressNumber" className="text-white/70">Número</Label>
                        <Input id="addressNumber" value={addressNumber} onChange={(e) => setAddressNumber(e.target.value)} className="bg-white border-none h-12 rounded-lg text-black" required />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="complement" className="text-white/70">Complemento</Label>
                    <Input id="complement" value={complement} onChange={(e) => setComplement(e.target.value)} className="bg-white border-none h-12 rounded-lg text-black" />
                </div>
            </div>

                <div className="space-y-4 pt-2">
                    <h2 className="text-xl font-semibold text-white border-b border-white/20 pb-2">Senha de acesso</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-white/70">Senha</Label>
                            <div className="relative">
                                <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="bg-white border-none h-12 rounded-lg text-black pr-10" required />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((prev) => !prev)}
                                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword" className="text-white/70">Confirme a Senha</Label>
                            <div className="relative">
                                <Input id="confirmPassword" type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="bg-white border-none h-12 rounded-lg text-black pr-10" required />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                                    aria-label={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>
                    </div>

                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 pt-1">
                        {passwordRequirements.map((req) => (
                            <li
                                key={req.label}
                                className={cn(
                                    "flex items-center gap-2 text-sm transition-colors",
                                    req.valid ? "text-green-400" : "text-white/50"
                                )}
                            >
                                <span
                                    className={cn(
                                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                                        req.valid ? "bg-green-500 text-white" : "bg-white/15 text-white/50"
                                    )}
                                >
                                    {req.valid ? <Check className="h-3 w-3" strokeWidth={3} /> : <X className="h-3 w-3" strokeWidth={3} />}
                                </span>
                                {req.label}
                            </li>
                        ))}
                    </ul>

                    {confirmPassword.length > 0 && password !== confirmPassword && (
                        <p className="text-sm text-red-400">As senhas não coincidem.</p>
                    )}
                </div>

            <Button
                type="submit"
                disabled={loading}
                className="w-full bg-arena-button hover:bg-arena-button-hover h-12 rounded-lg text-lg font-bold shadow-lg mt-8"
            >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Criar Conta"}
            </Button>
                </>
            )}
        </form>
    )
}
