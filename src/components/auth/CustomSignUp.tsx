"use client"

import * as React from "react"
import { useSignUp } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Loader2, Check, ChevronsUpDown } from "lucide-react"
import { supabase } from "@/shared/database/supabaseClient"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { cn } from "@/lib/utils"

// Masks
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

export function CustomSignUp() {
    const { isLoaded, signUp, setActive } = useSignUp()
    const router = useRouter()

    // Personal Data
    const [firstName, setFirstName] = React.useState("")
    const [lastName, setLastName] = React.useState("")
    const [cpf, setCpf] = React.useState("")
    const [phone, setPhone] = React.useState("")
    const [arenaName, setArenaName] = React.useState("")

    // Address Data
    const [cep, setCep] = React.useState("")
    const [state, setState] = React.useState("")
    const [city, setCity] = React.useState("")
    const [municipioId, setMunicipioId] = React.useState<number | null>(null)
    const [neighborhood, setNeighborhood] = React.useState("")
    const [street, setStreet] = React.useState("")
    const [addressNumber, setAddressNumber] = React.useState("")
    const [complement, setComplement] = React.useState("")

    // States and Cities for Selects
    const [estados, setEstados] = React.useState<any[]>([])
    const [municipios, setMunicipios] = React.useState<any[]>([])
    const [selectedEstadoId, setSelectedEstadoId] = React.useState<number | null>(null)
    const [isEstadoOpen, setIsEstadoOpen] = React.useState(false)
    const [isMunicipioOpen, setIsMunicipioOpen] = React.useState(false)

    // Load states on mount
    React.useEffect(() => {
        async function loadEstados() {
            try {
                const { data, error } = await supabase.from('estados').select('*').order('nome')
                console.log("Supabase estados response in CustomSignUp:", { data, error })
                if (data) setEstados(data)
                if (error) console.error("Supabase error for estados:", error)
            } catch (error) {
                console.error("Failed to load states:", error)
            }
        }
        loadEstados()
    }, [])

    // Load cities when state changes
    React.useEffect(() => {
        async function loadMunicipios() {
            if (!selectedEstadoId) {
                setMunicipios([])
                return
            }
            try {
                const { data } = await supabase.from('municipios').select('*').eq('codigo_uf', selectedEstadoId).order('nome')
                if (data) setMunicipios(data)
            } catch (error) {
                console.error("Failed to load cities:", error)
            }
        }
        loadMunicipios()
    }, [selectedEstadoId])

    // Access Data
    const [emailAddress, setEmailAddress] = React.useState("")
    const [password, setPassword] = React.useState("")
    const [confirmPassword, setConfirmPassword] = React.useState("")

    const [pendingVerification, setPendingVerification] = React.useState(false)
    const [code, setCode] = React.useState("")
    const [loading, setLoading] = React.useState(false)

    const handleCepBlur = async () => {
        const cleanCep = cep.replace(/\D/g, '')
        if (cleanCep.length !== 8) return

        try {
            const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`)
            const data = await res.json()

            if (!data.erro) {
                setStreet(data.logradouro || "")
                setNeighborhood(data.bairro || "")

                // Find state
                const estadoEncontrado = estados.find(e => e.uf === data.uf)
                if (estadoEncontrado) {
                    setSelectedEstadoId(estadoEncontrado.codigo_uf)
                    setState(estadoEncontrado.uf)

                    // Fetch cities for this state to find the specific city ID
                    const { data: muns } = await supabase
                        .from('municipios')
                        .select('*')
                        .eq('codigo_uf', estadoEncontrado.codigo_uf)
                        .order('nome')

                    if (muns) {
                        setMunicipios(muns)
                        const cidadeEncontrada = muns.find(m => m.codigo_ibge.toString() === data.ibge)
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
        if (!isLoaded) return

        if (password !== confirmPassword) {
            toast.error("As senhas não coincidem.")
            return
        }

        if (!municipioId) {
            toast.error("Por favor, selecione uma cidade.")
            return
        }

        setLoading(true)

        try {
            await signUp.create({
                emailAddress,
                password,
                firstName,
                lastName,
                unsafeMetadata: {
                    arenaName,
                    cpf,
                    phone,
                    addressData: {
                        cep,
                        state,
                        city,
                        municipio_id: municipioId,
                        neighborhood,
                        street,
                        number: addressNumber,
                        complement
                    }
                }
            })

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
        <form onSubmit={handleSubmit} className="w-full space-y-6">

            {/* Sessão: Dados Pessoais */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold text-white border-b border-white/20 pb-2">Dados Pessoais (Responsável)</h2>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="firstName" className="text-white/70">Nome</Label>
                        <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="bg-white border-none h-12 rounded-lg text-black" required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="lastName" className="text-white/70">Sobrenome</Label>
                        <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} className="bg-white border-none h-12 rounded-lg text-black" required />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="cpf" className="text-white/70">CPF</Label>
                        <Input id="cpf" value={cpf} onChange={(e) => setCpf(maskCpf(e.target.value))} placeholder="000.000.000-00" className="bg-white border-none h-12 rounded-lg text-black" required />
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
            </div>

            {/* Sessão: Endereço da Arena */}
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

            {/* Sessão: Dados de Acesso */}
            <div className="space-y-4 pt-2">
                <h2 className="text-xl font-semibold text-white border-b border-white/20 pb-2">Dados de Acesso</h2>
                <div className="space-y-2">
                    <Label htmlFor="email" className="text-white/70">E-mail (Login)</Label>
                    <Input id="email" type="email" value={emailAddress} onChange={(e) => setEmailAddress(e.target.value)} className="bg-white border-none h-12 rounded-lg text-black" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="password" className="text-white/70">Senha</Label>
                        <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-white border-none h-12 rounded-lg text-black" required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="confirmPassword" className="text-white/70">Confirme a Senha</Label>
                        <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="bg-white border-none h-12 rounded-lg text-black" required />
                    </div>
                </div>
            </div>

            <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[#FF6B00] hover:bg-[#E66000] h-12 rounded-lg text-lg font-bold shadow-lg mt-8"
            >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Criar Conta"}
            </Button>
        </form>
    )
}
