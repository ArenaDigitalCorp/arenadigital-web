"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useEffect, useState } from "react"
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
import { Input } from "@/components/ui/input"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { supabase } from "@/shared/database/supabaseClient"
import { linkAthlete, getSportsAction, getNiveisHabilidadeAction } from "@/modules/athletes/actions/athleteActions"
import { athleteFormSchema, type AthleteFormValues } from "@/modules/athletes/schemas/athlete.schema"

interface AthleteRegistrationModalProps {
    arenaId: string
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
}

const maskCep = (value: string) =>
    value.replace(/\D/g, "").replace(/(\d{5})(\d)/, "$1-$2").replace(/(-\d{3})\d+?$/, "$1")

const maskCpf = (value: string) =>
    value.replace(/\D/g, "").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})/, "$1-$2").replace(/(-\d{2})\d+?$/, "$1")

const maskPhone = (value: string) =>
    value.replace(/\D/g, "").replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2").replace(/(-\d{4})\d+?$/, "$1")

export function AthleteRegistrationModal({
    arenaId,
    open,
    onOpenChange,
    onSuccess
}: AthleteRegistrationModalProps) {
    const [sports, setSports] = useState<{ id: string; name: string }[]>([])
    const [niveis, setNiveis] = useState<{ id: string; nivel: string }[]>([])
    const [isLoadingNiveis, setIsLoadingNiveis] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isFetchingCep, setIsFetchingCep] = useState(false)

    // Estado / Municipio state (same pattern as sign-up)
    const [estados, setEstados] = useState<any[]>([])
    const [municipios, setMunicipios] = useState<any[]>([])
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

    // Load sports on modal open
    useEffect(() => {
        if (open) {
            getSportsAction().then(r => setSports(r.data))
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
    }

    // CEP lookup — same as sign-up
    async function handleCepBlur() {
        const cleanCep = form.getValues("cep")?.replace(/\D/g, "") ?? ""
        if (cleanCep.length !== 8) return
        setIsFetchingCep(true)
        try {
            const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`)
            const data = await res.json()
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
                    const cidade = muns.find((m: any) => m.codigo_ibge.toString() === data.ibge)
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
                toast.success("Atleta vinculado com sucesso!")
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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="!w-[70vw] !max-w-[70vw] p-0 border-none rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                <div className="bg-white flex flex-col flex-1 min-h-0">

                    {/* Header */}
                    <DialogHeader className="px-8 pt-7 pb-5 border-b border-arena-navy-800/8 shrink-0">
                        <DialogTitle className="text-xl font-bold text-arena-navy-800">
                            Cadastrar novo atleta
                        </DialogTitle>
                    </DialogHeader>

                    {/* Scrollable body */}
                    <ScrollArea className="flex-1 min-h-0 overflow-y-auto">
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
                                                    <Input placeholder="000.000.000-00"
                                                        {...field}
                                                        onChange={e => field.onChange(maskCpf(e.target.value))}
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
                                                    <Input placeholder="(00) 00000-0000"
                                                        {...field}
                                                        onChange={e => field.onChange(maskPhone(e.target.value))}
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
                                                <Select value={field.value} onValueChange={v => handleSportChange(v, field.onChange)}>
                                                    <FormControl>
                                                        <SelectTrigger className={selectTriggerCls}>
                                                            <SelectValue placeholder="Selecione o esporte" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent className="rounded-lg border-border">
                                                        {sports.map(s => (
                                                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={form.control} name="nivelHabilidade" render={({ field }) => (
                                            <FormItem className="min-w-0">
                                                <FormLabel className={labelCls}>Nível de habilidade</FormLabel>
                                                <Select value={field.value ?? ""} onValueChange={field.onChange}
                                                    disabled={niveis.length === 0}>
                                                    <FormControl>
                                                        <SelectTrigger className={cn(selectTriggerCls, niveis.length === 0 && "opacity-50")}>
                                                            {isLoadingNiveis
                                                                ? <span className="flex min-w-0 flex-1 items-center gap-2 truncate text-muted-foreground"><Loader2 className="h-3 w-3 shrink-0 animate-spin" />Carregando...</span>
                                                                : <SelectValue placeholder="Selecione o nível" />}
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent className="rounded-lg border-border">
                                                        {niveis.map(n => (
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
                                                        <Input placeholder="00000-000"
                                                            {...field}
                                                            onChange={e => field.onChange(maskCep(e.target.value))}
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
                                            <FormLabel className={labelCls}>Estado</FormLabel>
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
                                                <PopoverContent className="w-[260px] p-0" align="start">
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
                                            <FormLabel className={labelCls}>Cidade</FormLabel>
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
                                                <PopoverContent className="w-[340px] p-0" align="start">
                                                    <Command>
                                                        <CommandInput placeholder="Buscar cidade..." />
                                                        <CommandList>
                                                            <CommandEmpty>Nenhuma cidade encontrada.</CommandEmpty>
                                                            <CommandGroup>
                                                                {municipios.map((municipio: any) => (
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
                    </ScrollArea>

                    {/* Footer — fora do ScrollArea para não ficar sobreposto */}
                    <div className="px-8 py-5 border-t border-arena-navy-800/10 flex gap-3 justify-end shrink-0 bg-white">
                        <Button type="button" variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="border-arena-navy-800/20 text-arena-navy-800 font-semibold rounded-lg hover:bg-gray-50">
                            Fechar
                        </Button>
                        <Button type="submit" form="athlete-form" disabled={isSubmitting}
                            className="bg-arena-button hover:bg-arena-button-hover text-white font-semibold rounded-lg shadow-sm disabled:opacity-50">
                            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : "Salvar"}
                        </Button>
                    </div>

                </div>
            </DialogContent>
        </Dialog>
    )
}
