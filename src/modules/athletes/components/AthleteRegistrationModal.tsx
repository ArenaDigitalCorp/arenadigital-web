"use client"

import { notifyAthletesChanged } from '@/modules/athletes/lib/athlete-cache-events'

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { type FormEvent, useEffect, useState } from "react"
import { Check, ChevronsUpDown, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { MaskedInput } from "@/components/ui/masked-input"
import { formatCpf, isValidCpf, isValidCep, normalizeCep, normalizeCpf } from "@/lib/brasil-document"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { supabase } from "@/shared/database/supabaseClient"
import {
    linkAthlete,
    getSportsAction,
    getNiveisHabilidadeAction,
    linkExistingAthleteToArenaAction,
    lookupAthleteByCpfAction,
} from "@/modules/athletes/actions/athleteActions"
import { athleteFormSchema, type AthleteFormValues } from "@/modules/athletes/schemas/athlete.schema"

interface AthleteRegistrationModalProps {
    arenaId: string
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
}

type ModalStep = "lookup" | "existing" | "create"

type LookupAthlete = {
    id: string
    name: string
    cpf: string
    phone: string
    email: string
    sport: string | null
    alreadyLinked: boolean
}

type Estado = {
    codigo_uf: number
    nome: string
    uf: string
}

type Municipio = {
    codigo_ibge: number
    nome: string
}

type ViaCepResponse = {
    erro?: boolean
    logradouro?: string
    bairro?: string
    uf?: string
    ibge?: string
}

export function AthleteRegistrationModal({
    arenaId,
    open,
    onOpenChange,
    onSuccess
}: AthleteRegistrationModalProps) {
    const [sports, setSports] = useState<{ id: string; name: string }[]>([])
    const [isLoadingSports, setIsLoadingSports] = useState(false)
    const [niveis, setNiveis] = useState<{ id: string; nivel: string }[]>([])
    const [isLoadingNiveis, setIsLoadingNiveis] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isFetchingCep, setIsFetchingCep] = useState(false)
    const [step, setStep] = useState<ModalStep>("lookup")
    const [lookupCpf, setLookupCpf] = useState("")
    const [lookupAthlete, setLookupAthlete] = useState<LookupAthlete | null>(null)

    // Estado / Municipio state (same pattern as sign-up)
    const [estados, setEstados] = useState<Estado[]>([])
    const [municipios, setMunicipios] = useState<Municipio[]>([])
    const [selectedEstadoId, setSelectedEstadoId] = useState<number | null>(null)
    const [municipioId, setMunicipioId] = useState<number | null>(null)
    const [isEstadoOpen, setIsEstadoOpen] = useState(false)
    const [isMunicipioOpen, setIsMunicipioOpen] = useState(false)

    const form = useForm<AthleteFormValues>({
        resolver: zodResolver(athleteFormSchema),
        defaultValues: {
            name: "", cpf: "", phone: "", email: "",
            birthDate: "", sport: "", nivelHabilidade: "",
            cep: "", endereco: "", enderecoNumero: "", bairro: "",
            idMunicipio: undefined,
        },
    })

    // Load estados on mount
    useEffect(() => {
        supabase.from("estados").select("*").order("nome").then(({ data }) => {
            if (data) setEstados(data)
        })
    }, [])

    // Load municipios when estado changes
    useEffect(() => {
        if (!selectedEstadoId) { setMunicipios([]); return }
        supabase.from("municipios").select("*").eq("codigo_uf", selectedEstadoId).order("nome")
            .then(({ data }) => { if (data) setMunicipios(data) })
    }, [selectedEstadoId])

    // Catálogo global de esportes (não filtra por arena nem por espaço)
    useEffect(() => {
        if (open) {
            setIsLoadingSports(true)
            getSportsAction()
                .then((r) => {
                    if (r.success && r.data) {
                        setSports(r.data)
                    } else {
                        setSports([])
                        toast.error(r.error ?? "Não foi possível carregar os esportes.")
                    }
                })
                .finally(() => setIsLoadingSports(false))
        } else {
            resetAll()
        }
    }, [open])

    function resetAll() {
        form.reset()
        setNiveis([])
        setSelectedEstadoId(null)
        setMunicipioId(null)
        setMunicipios([])
        setStep("lookup")
        setLookupCpf("")
        setLookupAthlete(null)
    }

    // CEP lookup — same as sign-up
    async function handleCepBlur() {
        const cleanCep = normalizeCep(form.getValues("cep") ?? "")
        if (!isValidCep(cleanCep)) return
        setIsFetchingCep(true)
        try {
            const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`)
            const data = await res.json() as ViaCepResponse
            if (data.erro) { toast.error("CEP não encontrado."); return }

            form.setValue("endereco", data.logradouro || "")
            form.setValue("bairro", data.bairro || "")

            const estadoEncontrado = estados.find(e => e.uf === data.uf)
            if (estadoEncontrado) {
                setSelectedEstadoId(estadoEncontrado.codigo_uf)
                const { data: muns } = await supabase
                    .from("municipios").select("*")
                    .eq("codigo_uf", estadoEncontrado.codigo_uf).order("nome")
                if (muns) {
                    setMunicipios(muns)
                    const cidade = (muns as Municipio[]).find((m) => m.codigo_ibge.toString() === data.ibge)
                    if (cidade) {
                        setMunicipioId(cidade.codigo_ibge)
                        form.setValue("idMunicipio", cidade.codigo_ibge)
                    }
                }
            }
        } catch {
            toast.error("Falha ao consultar o CEP.")
        } finally {
            setIsFetchingCep(false)
        }
    }

    // Load skill levels when sport changes
    async function handleSportChange(sportId: string, fieldOnChange: (v: string) => void) {
        fieldOnChange(sportId)
        form.setValue("nivelHabilidade", "")
        setNiveis([])
        if (!sportId) return
        setIsLoadingNiveis(true)
        try {
            const res = await getNiveisHabilidadeAction(sportId)
            if (res.success) setNiveis(res.data)
        } finally {
            setIsLoadingNiveis(false)
        }
    }

    async function handleLookupSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const cleanCpf = normalizeCpf(lookupCpf)
        if (!isValidCpf(cleanCpf)) {
            toast.error("Informe um CPF válido para buscar o atleta.")
            return
        }

        setIsSubmitting(true)
        try {
            const result = await lookupAthleteByCpfAction({ cpf: cleanCpf, arenaId })
            if (!result.success) {
                toast.error(result.error || "Erro ao buscar atleta.")
                return
            }

            if (result.data) {
                setLookupAthlete(result.data)
                setStep("existing")
                return
            }

            form.setValue("cpf", formatCpf(cleanCpf))
            setStep("create")
        } finally {
            setIsSubmitting(false)
        }
    }

    async function handleLinkExisting() {
        if (!lookupAthlete) return
        setIsSubmitting(true)
        try {
            const result = await linkExistingAthleteToArenaAction({
                athleteId: lookupAthlete.id,
                arenaId,
            })

            if (result.success) {
                notifyAthletesChanged(arenaId)
                toast.success(lookupAthlete.alreadyLinked ? "Atleta já estava vinculado." : "Atleta vinculado com sucesso!")
                onSuccess()
                onOpenChange(false)
            } else {
                toast.error(result.error || "Erro ao vincular atleta.")
            }
        } finally {
            setIsSubmitting(false)
        }
    }

    async function onSubmit(data: AthleteFormValues) {
        setIsSubmitting(true)
        try {
            const result = await linkAthlete({
                name: data.name,
                cpf: data.cpf,
                phone: data.phone,
                email: data.email,
                sportId: data.sport,
                arenaId,
                nivelHabilidadeId: data.nivelHabilidade || undefined,
                birthDate: data.birthDate || undefined,
                cep: data.cep || undefined,
                endereco: data.endereco || undefined,
                enderecoNumero: data.enderecoNumero || undefined,
                bairro: data.bairro || undefined,
                idMunicipio: municipioId ?? undefined,
            })
            if (result.success) {
                notifyAthletesChanged(arenaId)
                toast.success("Atleta cadastrado e vinculado com sucesso.")
                onSuccess()
                onOpenChange(false)
            } else {
                toast.error(result.error || "Erro ao vincular atleta.")
            }
        } catch {
            toast.error("Ocorreu um erro inesperado.")
        } finally {
            setIsSubmitting(false)
        }
    }

    const labelCls = "text-sm font-semibold text-arena-navy-800"
    /** Base alinhada ao Input (altura, borda, largura total na grid). */
    const controlCls =
        "h-11 w-full min-w-0 rounded-lg border border-arena-navy-800/15 bg-transparent px-3 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
    const inputCls = controlCls
    const selectTriggerCls = cn(
        controlCls,
        "flex items-center justify-between gap-2 font-normal text-left data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground"
    )
    const dropdownContentCls =
        "z-[100] rounded-lg border-border bg-popover text-popover-foreground shadow-md"

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="!z-[60] !w-[70vw] !max-w-[70vw] p-0 border-none rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                <div className="bg-white flex flex-col flex-1 min-h-0">

                    {/* Header */}
                    <DialogHeader className="px-8 pt-7 pb-5 border-b border-arena-navy-800/8 shrink-0">
                        <DialogTitle className="text-xl font-bold text-arena-navy-800">
                            {step === "lookup" ? "Vincular atleta" : step === "existing" ? "Atleta encontrado" : "Cadastrar novo atleta"}
                        </DialogTitle>
                    </DialogHeader>

                    {/* Corpo rolável — overflow nativo evita conflito do ScrollArea com Select/Popover */}
                    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                        {step === "lookup" ? (
                            <form id="athlete-lookup-form" onSubmit={handleLookupSubmit} className="px-8 py-6 space-y-5">
                                <div className="space-y-2">
                                    <Label className={labelCls}>CPF do atleta</Label>
                                    <MaskedInput mask="cpf"
                                        placeholder="000.000.000-00"
                                        value={lookupCpf}
                                        onChange={(event) => setLookupCpf(event.target.value)}
                                        className={inputCls}
                                    />
                                    <p className="text-sm text-arena-navy-800/55">
                                        Primeiro buscamos pelo CPF. Se o atleta já existir, basta vincular à arena; se não existir, abrimos o cadastro.
                                    </p>
                                </div>
                            </form>
                        ) : step === "existing" && lookupAthlete ? (
                            <div className="px-8 py-6 space-y-5">
                                <div className="rounded-lg border border-arena-navy-800/10 bg-arena-navy-800/[0.03] p-5">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <h3 className="text-lg font-bold text-arena-navy-800">{lookupAthlete.name}</h3>
                                            <p className="text-sm text-arena-navy-800/60">{formatCpf(lookupAthlete.cpf)}</p>
                                        </div>
                                        <span className={cn(
                                            "rounded-full px-3 py-1 text-xs font-semibold",
                                            lookupAthlete.alreadyLinked
                                                ? "bg-amber-100 text-amber-800"
                                                : "bg-emerald-100 text-emerald-800"
                                        )}>
                                            {lookupAthlete.alreadyLinked ? "Já vinculado" : "Disponível para vínculo"}
                                        </span>
                                    </div>
                                    <div className="mt-5 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                                        <div>
                                            <p className="font-semibold text-arena-navy-800">E-mail</p>
                                            <p className="text-arena-navy-800/65">{lookupAthlete.email || "---"}</p>
                                        </div>
                                        <div>
                                            <p className="font-semibold text-arena-navy-800">Telefone</p>
                                            <p className="text-arena-navy-800/65">{lookupAthlete.phone || "---"}</p>
                                        </div>
                                        <div>
                                            <p className="font-semibold text-arena-navy-800">Esporte</p>
                                            <p className="text-arena-navy-800/65">{lookupAthlete.sport || "---"}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                        <Form {...form}>
                            <form id="athlete-form" onSubmit={form.handleSubmit(onSubmit)}>
                                <div className="px-8 py-6 space-y-5">

                                    {/* Row 1: Nome | CPF */}
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <FormField control={form.control} name="name" render={({ field }) => (
                                            <FormItem className="min-w-0">
                                                <FormLabel className={labelCls}>Nome</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Informe o nome do atleta" {...field} className={inputCls} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={form.control} name="cpf" render={({ field }) => (
                                            <FormItem className="min-w-0">
                                                <FormLabel className={labelCls}>CPF</FormLabel>
                                                <FormControl>
                                                    <MaskedInput mask="cpf" placeholder="000.000.000-00"
                                                        {...field}
                                                        onChange={field.onChange}
                                                        className={inputCls} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    </div>

                                    {/* Row 2: Telefone | E-mail */}
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <FormField control={form.control} name="phone" render={({ field }) => (
                                            <FormItem className="min-w-0">
                                                <FormLabel className={labelCls}>Telefone</FormLabel>
                                                <FormControl>
                                                    <MaskedInput mask="phone" placeholder="(00) 00000-0000"
                                                        {...field}
                                                        onChange={field.onChange}
                                                        className={inputCls} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={form.control} name="email" render={({ field }) => (
                                            <FormItem className="min-w-0">
                                                <FormLabel className={labelCls}>E-mail</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Informe o e-mail para contato" {...field} className={inputCls} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    </div>

                                    {/* Row 3: Data de nascimento | Esporte | Nível */}
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                        <FormField control={form.control} name="birthDate" render={({ field }) => (
                                            <FormItem className="min-w-0">
                                                <FormLabel className={labelCls}>Data de nascimento</FormLabel>
                                                <FormControl>
                                                    <Input type="date" {...field} className={inputCls} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={form.control} name="sport" render={({ field }) => (
                                            <FormItem className="min-w-0">
                                                <FormLabel className={labelCls}>Esporte</FormLabel>
                                                <Select
                                                    value={field.value || undefined}
                                                    onValueChange={(v) => handleSportChange(v, field.onChange)}
                                                    disabled={isLoadingSports}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger className={selectTriggerCls}>
                                                            <SelectValue
                                                                placeholder={
                                                                    isLoadingSports
                                                                        ? "Carregando esportes..."
                                                                        : "Selecione o esporte"
                                                                }
                                                            />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent position="popper" className={dropdownContentCls}>
                                                        {sports.map((s) => (
                                                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                                        ))}
                                                        {sports.length === 0 && !isLoadingSports && (
                                                            <SelectItem value="__no_sports" disabled>
                                                                Nenhum esporte cadastrado no sistema
                                                            </SelectItem>
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={form.control} name="nivelHabilidade" render={({ field }) => (
                                            <FormItem className="min-w-0">
                                                <FormLabel className={labelCls}>Nível de habilidade</FormLabel>
                                                <Select
                                                    value={field.value || undefined}
                                                    onValueChange={field.onChange}
                                                    disabled={niveis.length === 0 && !isLoadingNiveis}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger className={cn(selectTriggerCls, niveis.length === 0 && !isLoadingNiveis && "opacity-50")}>
                                                            {isLoadingNiveis
                                                                ? <span className="flex min-w-0 flex-1 items-center gap-2 truncate text-muted-foreground"><Loader2 className="h-3 w-3 shrink-0 animate-spin" />Carregando...</span>
                                                                : <SelectValue placeholder="Selecione o nível" />}
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent position="popper" className={dropdownContentCls}>
                                                        {niveis.map((n) => (
                                                            <SelectItem key={n.id} value={n.id}>{n.nivel}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    </div>

                                    {/* Row 4: CEP | Endereço */}
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,11rem)_1fr]">
                                        <FormField control={form.control} name="cep" render={({ field }) => (
                                            <FormItem className="min-w-0">
                                                <FormLabel className={labelCls}>CEP</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <MaskedInput mask="cep" placeholder="00000-000"
                                                            {...field}
                                                            onChange={field.onChange}
                                                            onBlur={handleCepBlur}
                                                            className={inputCls} />
                                                        {isFetchingCep && (
                                                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-arena-navy-800/40" />
                                                        )}
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={form.control} name="endereco" render={({ field }) => (
                                            <FormItem className="min-w-0">
                                                <FormLabel className={labelCls}>Endereço</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Informe o endereço" {...field} className={inputCls} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    </div>

                                    {/* Row 5: Número | Bairro */}
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,11rem)_1fr]">
                                        <FormField control={form.control} name="enderecoNumero" render={({ field }) => (
                                            <FormItem className="min-w-0">
                                                <FormLabel className={labelCls}>Número</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Informe o número" {...field} className={inputCls} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={form.control} name="bairro" render={({ field }) => (
                                            <FormItem className="min-w-0">
                                                <FormLabel className={labelCls}>Bairro</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Informe o bairro" {...field} className={inputCls} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    </div>

                                    {/* Row 6: Estado | Cidade (Popover+Command — same as sign-up) */}
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,12rem)_1fr]">
                                        <FormItem className="min-w-0">
                                            <Label className={labelCls}>Estado</Label>
                                            <Popover open={isEstadoOpen} onOpenChange={setIsEstadoOpen}>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        role="combobox"
                                                        className={cn(selectTriggerCls, "hover:bg-muted/50", !selectedEstadoId && "text-muted-foreground")}
                                                    >
                                                        <span className="min-w-0 flex-1 truncate text-left font-normal">
                                                            {selectedEstadoId
                                                                ? estados.find(e => e.codigo_uf === selectedEstadoId)?.uf
                                                                : "Selecione"}
                                                        </span>
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className={cn("w-[260px] p-0", dropdownContentCls)} align="start">
                                                    <Command>
                                                        <CommandInput placeholder="Buscar estado..." />
                                                        <CommandList>
                                                            <CommandEmpty>Nenhum estado encontrado.</CommandEmpty>
                                                            <CommandGroup>
                                                                {estados.map(estado => (
                                                                    <CommandItem key={estado.codigo_uf} value={estado.nome}
                                                                        onSelect={() => {
                                                                            setSelectedEstadoId(estado.codigo_uf)
                                                                            setMunicipioId(null)
                                                                            form.setValue("idMunicipio", undefined)
                                                                            setIsEstadoOpen(false)
                                                                        }}>
                                                                        <Check className={cn("mr-2 h-4 w-4",
                                                                            estado.codigo_uf === selectedEstadoId ? "opacity-100" : "opacity-0")} />
                                                                        {estado.uf} — {estado.nome}
                                                                    </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                        </FormItem>

                                        <FormItem className="min-w-0">
                                            <Label className={labelCls}>Cidade</Label>
                                            <Popover open={isMunicipioOpen} onOpenChange={setIsMunicipioOpen}>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    role="combobox"
                                                    disabled={!selectedEstadoId}
                                                    className={cn(
                                                        selectTriggerCls,
                                                        "hover:bg-muted/50",
                                                        !municipioId && "text-muted-foreground"
                                                    )}
                                                >
                                                    <span className="min-w-0 flex-1 truncate text-left font-normal">
                                                        {municipioId
                                                            ? municipios.find(m => m.codigo_ibge === municipioId)?.nome
                                                            : "Selecione a cidade"}
                                                    </span>
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className={cn("w-[340px] p-0", dropdownContentCls)} align="start">
                                                    <Command>
                                                        <CommandInput placeholder="Buscar cidade..." />
                                                        <CommandList>
                                                            <CommandEmpty>Nenhuma cidade encontrada.</CommandEmpty>
                                                            <CommandGroup>
                                                                {municipios.map((municipio) => (
                                                                    <CommandItem key={municipio.codigo_ibge} value={municipio.nome}
                                                                        onSelect={() => {
                                                                            setMunicipioId(municipio.codigo_ibge)
                                                                            form.setValue("idMunicipio", municipio.codigo_ibge)
                                                                            setIsMunicipioOpen(false)
                                                                        }}>
                                                                        <Check className={cn("mr-2 h-4 w-4",
                                                                            municipio.codigo_ibge === municipioId ? "opacity-100" : "opacity-0")} />
                                                                        {municipio.nome}
                                                                    </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                        </FormItem>
                                    </div>

                                </div>
                            </form>
                        </Form>
                        )}
                    </div>

                    {/* Footer — fora do ScrollArea para não ficar sobreposto */}
                    <div className="px-8 py-5 border-t border-arena-navy-800/10 flex gap-3 justify-end shrink-0 bg-white">
                        <Button type="button" variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="border-arena-navy-800/20 text-arena-navy-800 font-semibold rounded-lg hover:bg-gray-50">
                            Fechar
                        </Button>
                        {step !== "lookup" && (
                            <Button type="button" variant="outline"
                                onClick={() => {
                                    setStep("lookup")
                                    setLookupAthlete(null)
                                }}
                                className="border-arena-navy-800/20 text-arena-navy-800 font-semibold rounded-lg hover:bg-gray-50">
                                Voltar
                            </Button>
                        )}
                        {step === "lookup" && (
                            <Button type="submit" form="athlete-lookup-form" disabled={isSubmitting}
                                className="bg-arena-button hover:bg-arena-button-hover text-white font-semibold rounded-lg shadow-sm disabled:opacity-50">
                                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Buscando...</> : "Buscar"}
                            </Button>
                        )}
                        {step === "existing" && (
                            <Button type="button" onClick={handleLinkExisting} disabled={isSubmitting || !!lookupAthlete?.alreadyLinked}
                                className="bg-arena-button hover:bg-arena-button-hover text-white font-semibold rounded-lg shadow-sm disabled:opacity-50">
                                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Vinculando...</> : lookupAthlete?.alreadyLinked ? "Vínculo existente" : "Vincular"}
                            </Button>
                        )}
                        {step === "create" && (
                            <Button type="submit" form="athlete-form" disabled={isSubmitting}
                                className="bg-arena-button hover:bg-arena-button-hover text-white font-semibold rounded-lg shadow-sm disabled:opacity-50">
                                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : "Salvar e enviar convite"}
                            </Button>
                        )}
                    </div>

                </div>
            </DialogContent>
        </Dialog>
    )
}
