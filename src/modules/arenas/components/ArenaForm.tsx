"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormDescription,
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
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { createArenaAction, updateArenaAction } from "@/modules/arenas/actions/arenaActions"
import { useRouter } from "next/navigation"
import { ImageUpload } from "@/components/ui/image-upload"
import { getEstadosAction, getMunicipiosByEstadoAction, getMunicipioByIbgeAction, getComodidadesAction } from "@/modules/arenas/actions/arenaActions"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Check, ChevronsUpDown, Copy, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { isValidCnpj, onlyDigits } from "@/lib/brasil-document"
import { getSportsAction } from "@/modules/athletes/actions/athleteActions"
import { useEffect, useState } from "react"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { arenaSchema, type ArenaFormValues } from "@/modules/arenas/schemas/arena.schema"

const arenaFormSchema = arenaSchema

export const DAYS_OF_WEEK = [
    { value: "0", label: "Domingo" },
    { value: "1", label: "Segunda-feira" },
    { value: "2", label: "Terça-feira" },
    { value: "3", label: "Quarta-feira" },
    { value: "4", label: "Quinta-feira" },
    { value: "5", label: "Sexta-feira" },
    { value: "6", label: "Sábado" },
];

export const DEFAULT_OPENING_HOURS = DAYS_OF_WEEK.reduce((acc, day) => {
    acc[day.value] = { isOpen: false, start: "06:00", end: "23:00" };
    return acc;
}, {} as Record<string, { isOpen: boolean; start: string; end: string }>);

interface ArenaFormProps {
    initialData?: any
    ownerId: string
}

const mapStatusFromDB = (status: string): "ativo" | "inativo" | "Em manutenção" => {
    const s = status?.toLowerCase()
    if (s === 'active' || s === 'ativo') return 'ativo'
    if (s === 'inactive' || s === 'inativo') return 'inativo'
    if (s === 'maintenance' || s === 'em manutenção' || s === 'em manutencao') return 'Em manutenção'
    return 'ativo'
}

export function ArenaForm({ initialData, ownerId }: ArenaFormProps) {
    const router = useRouter()
    const [sports, setSports] = useState<any[]>([])
    const [comodidades, setComodidades] = useState<any[]>([])
    const [bannerFile, setBannerFile] = useState<File | null>(null)
    const [isUploading, setIsUploading] = useState(false)

    const [estados, setEstados] = useState<any[]>([])
    const [municipios, setMunicipios] = useState<any[]>([])
    const [selectedEstadoId, setSelectedEstadoId] = useState<number | null>(null)
    const [isEstadoOpen, setIsEstadoOpen] = useState(false)
    const [isMunicipioOpen, setIsMunicipioOpen] = useState(false)
    const [cnpjLookupLoading, setCnpjLookupLoading] = useState(false)

    useEffect(() => {
        async function loadSports() {
            try {
                const res = await getSportsAction()
                setSports(res.data ?? [])
            } catch (error) {
                console.error("Failed to load sports:", error)
            }
        }
        async function loadComodidades() {
            try {
                const res = await getComodidadesAction()
                setComodidades(res.data ?? [])
            } catch (error) {
                console.error("Failed to load comodidades:", error)
            }
        }
        async function loadEstados() {
            try {
                const res = await getEstadosAction()
                const data = res.data
                if (data) setEstados(data)

                if (initialData?.id_municipio) {
                    const munRes = await getMunicipioByIbgeAction(initialData.id_municipio)
                    const munData = munRes.data
                    if (munData) {
                        setSelectedEstadoId(munData.codigo_uf)
                        setTimeout(() => form.setValue("id_municipio", initialData.id_municipio), 100)
                    }
                }
            } catch (error) {
                console.error("Failed to load states:", error)
            }
        }
        loadSports()
        loadComodidades()
        loadEstados()
    }, [initialData?.id_municipio])

    useEffect(() => {
        async function loadMunicipios() {
            if (!selectedEstadoId) {
                setMunicipios([])
                return
            }
            try {
                const munListRes = await getMunicipiosByEstadoAction(selectedEstadoId)
                const data = munListRes.data
                if (data) setMunicipios(data)
            } catch (error) {
                console.error("Failed to load cities:", error)
            }
        }
        loadMunicipios()
    }, [selectedEstadoId])

    const form = useForm<ArenaFormValues>({
        resolver: zodResolver(arenaFormSchema) as any,
        defaultValues: {
            name: initialData?.name || "",
            status: mapStatusFromDB(initialData?.status),
            sports: initialData?.sports?.map((s: any) => s.id || s) || [], // Handle object or ID
            comodidades: initialData?.comodidades?.map((c: any) => c.id || c) || [],
            phone: initialData?.phone || "",
            email: initialData?.email || "",
            description: initialData?.description || "",
            banner_url: initialData?.banner_url || "",
            zip_code: initialData?.zip_code || "",
            cpf_cnpj: initialData?.cpf_cnpj ? String(initialData.cpf_cnpj) : "",
            address: typeof initialData?.address === 'string' ? initialData.address : initialData?.address?.street || "",
            neighborhood: initialData?.neighborhood || "",
            number: initialData?.number || "",
            complement: initialData?.complement || "",
            id_municipio: typeof initialData?.id_municipio === 'number' ? initialData.id_municipio : undefined,
            facebook: initialData?.facebook || "",
            instagram: initialData?.instagram || "",
            tiktok: initialData?.tiktok || "",
            opening_hours: (initialData?.opening_hours && !initialData.opening_hours.weekdays)
                ? initialData.opening_hours
                : DEFAULT_OPENING_HOURS
        },
    })

    async function fetchAddressByCep(cep: string) {
        const cleanCep = cep.replace(/\D/g, '');
        if (cleanCep.length !== 8) return;

        try {
            const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
            const data = await res.json();

            if (data.erro) {
                toast.error("CEP não encontrado.");
                return;
            }

            form.setValue("address", data.logradouro, { shouldValidate: true, shouldDirty: true });
            form.setValue("neighborhood", data.bairro, { shouldValidate: true, shouldDirty: true });

            // Tentar setar estado e cidade pelo UF e IBGE
            const estadoEncontrado = estados.find(e => e.uf === data.uf);
            if (estadoEncontrado) {
                setSelectedEstadoId(estadoEncontrado.codigo_uf);

                // Precisamos buscar os municipios desse estado para setar a cidade
                const munsRes = await getMunicipiosByEstadoAction(estadoEncontrado.codigo_uf);
                const muns = munsRes.data
                if (muns) {
                    setMunicipios(muns); // atualiza estado local
                    const cidadeEncontrada = muns.find(m => m.codigo_ibge.toString() === data.ibge);
                    if (cidadeEncontrada) {
                        form.setValue("id_municipio", parseInt(data.ibge), { shouldValidate: true, shouldDirty: true });
                    }
                }
            }
        } catch (error) {
            console.error("Erro ao buscar CEP:", error);
            toast.error("Falha ao comunicar com ViaCEP.");
        }
    }

    async function applyCnpjFromReceitaFederal() {
        const digits = onlyDigits(form.getValues("cpf_cnpj"))
        if (digits.length !== 14 || !isValidCnpj(digits)) {
            toast.error("Informe um CNPJ válido (14 dígitos) para consultar os dados na Receita.")
            return
        }
        setCnpjLookupLoading(true)
        try {
            const res = await fetch(`/api/lookup-cnpj?cnpj=${encodeURIComponent(digits)}`)
            const json = await res.json()
            if (!res.ok) {
                toast.error(typeof json.error === "string" ? json.error : "Não foi possível consultar o CNPJ.")
                return
            }
            const d = json.data as {
                razaoSocial: string
                nomeFantasia: string | null
                cep: string
                logradouro: string
                numero: string
                complemento: string | null
                bairro: string
                uf: string | null
                codigoMunicipioIbge: number | null
            }
            const nome =
                (d.nomeFantasia && d.nomeFantasia.trim()) || d.razaoSocial || ""
            if (nome) {
                form.setValue("name", nome, { shouldValidate: true, shouldDirty: true })
            }
            if (d.logradouro) {
                form.setValue("address", d.logradouro, { shouldValidate: true, shouldDirty: true })
            }
            const num = (d.numero ?? "").toUpperCase().trim()
            if (num && num !== "S/N" && num !== "SN") {
                form.setValue("number", d.numero, { shouldValidate: true, shouldDirty: true })
            }
            if (d.complemento) {
                form.setValue("complement", d.complemento, { shouldValidate: true, shouldDirty: true })
            }
            if (d.bairro) {
                form.setValue("neighborhood", d.bairro, { shouldValidate: true, shouldDirty: true })
            }
            if (d.cep && d.cep.length === 8) {
                form.setValue("zip_code", `${d.cep.slice(0, 5)}-${d.cep.slice(5)}`, {
                    shouldValidate: true,
                    shouldDirty: true,
                })
            }

            if (d.codigoMunicipioIbge) {
                const munRes = await getMunicipioByIbgeAction(d.codigoMunicipioIbge)
                if (munRes.success && munRes.data) {
                    const codigoUf = (munRes.data as { codigo_uf: number }).codigo_uf
                    setSelectedEstadoId(codigoUf)
                    const munsRes = await getMunicipiosByEstadoAction(codigoUf)
                    if (munsRes.success && munsRes.data) setMunicipios(munsRes.data)
                    form.setValue("id_municipio", d.codigoMunicipioIbge, {
                        shouldValidate: true,
                        shouldDirty: true,
                    })
                    toast.success("Dados da empresa carregados. Revise os campos antes de salvar.")
                } else if (d.uf && estados.length > 0) {
                    const est = estados.find((e: { uf: string }) => e.uf === d.uf)
                    if (est) {
                        setSelectedEstadoId(est.codigo_uf)
                        const munsRes = await getMunicipiosByEstadoAction(est.codigo_uf)
                        if (munsRes.success && munsRes.data) setMunicipios(munsRes.data)
                        toast.success(
                            "Dados da empresa carregados. Selecione o município manualmente e revise os demais campos."
                        )
                    } else {
                        toast.success("Dados da empresa carregados. Revise estado, cidade e endereço antes de salvar.")
                    }
                } else {
                    toast.success("Dados da empresa carregados. Revise os campos antes de salvar.")
                }
            } else if (d.uf && estados.length > 0) {
                const est = estados.find((e: { uf: string }) => e.uf === d.uf)
                if (est) {
                    setSelectedEstadoId(est.codigo_uf)
                    const munsRes = await getMunicipiosByEstadoAction(est.codigo_uf)
                    if (munsRes.success && munsRes.data) setMunicipios(munsRes.data)
                    toast.success(
                        "Dados da empresa carregados. Selecione o município manualmente e revise os demais campos."
                    )
                } else {
                    toast.success("Dados da empresa carregados. Revise os campos antes de salvar.")
                }
            } else {
                toast.success("Dados da empresa carregados. Revise os campos antes de salvar.")
            }
        } catch {
            toast.error("Falha ao consultar o CNPJ.")
        } finally {
            setCnpjLookupLoading(false)
        }
    }

    async function getCoordinatesFromAddress(addressData: { street: string, number: string, neighborhood: string, city: string, state: string }) {
        const query = `${addressData.street}, ${addressData.number}, ${addressData.city}, ${addressData.state}, Brasil`;
        const encodedQuery = encodeURIComponent(query);
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&limit=1`, {
                headers: {
                    'Accept-Language': 'pt-BR'
                }
            });
            const geoData = await res.json();
            if (geoData && geoData.length > 0) {
                return `POINT(${geoData[0].lon} ${geoData[0].lat})`;
            }
        } catch (error) {
            console.error("Erro ao obter coordenadas Nominatim:", error);
        }
        return null;
    }

    async function onSubmit(values: any) {
        try {
            setIsUploading(true)
            let bannerUrl = values.banner_url

            // Construct the final object
            // Ensure opening_hours is structurally correct if we modified it
            // For now, we are passing values directly, but if we add specific controls for days/time, we might need to reconstruct it.
            // But the current 'opening' inputs below are UNBOUND. We need to bind them.
            // Let's assume for now valid JSON is passed or we stick to the default.

            const data = { ...values, banner_url: bannerUrl } as ArenaFormValues

            // Tentar obter geolocalização se houver endereco e municipio preenchido
            let locationPoint = null;
            if (values.address && values.id_municipio) {
                const munInfo = municipios.find(m => m.codigo_ibge === values.id_municipio);
                const ufInfo = estados.find(e => e.codigo_uf === selectedEstadoId);

                if (munInfo && ufInfo) {
                    locationPoint = await getCoordinatesFromAddress({
                        street: values.address,
                        number: values.number || "",
                        neighborhood: values.neighborhood || "",
                        city: munInfo.nome,
                        state: ufInfo.uf
                    });
                }
            }

            const payload: any = { ...data };
            const docDigits = onlyDigits(data.cpf_cnpj ?? "");
            payload.cpf_cnpj = docDigits.length > 0 ? docDigits : null;
            if (locationPoint) {
                payload.location = locationPoint;
            }
            if (initialData) {
                if (bannerFile) {
                    try {
                        const formData = new FormData()
                        formData.append('file', bannerFile)
                        formData.append('arenaId', initialData.id)
                        formData.append('type', 'banner')
                        const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
                        if (!uploadRes.ok) throw new Error('Failed to upload image')
                        bannerUrl = (await uploadRes.json()).url
                        payload.banner_url = bannerUrl
                    } catch (error) {
                        console.error("Failed to upload image:", error)
                        toast.error("Falha ao fazer upload da imagem.")
                        setIsUploading(false)
                        return
                    }
                }

                const res = await updateArenaAction(initialData.id, payload)
                if (!res.success) throw new Error(res.error)
                toast.success("Arena atualizada com sucesso!")
                router.refresh()
            } else {
                const res = await createArenaAction({ ...payload, owner_id: ownerId })
                if (!res.success) throw new Error(res.error)
                const createdArena = res.data

                if (bannerFile && createdArena) {
                    try {
                        const formData = new FormData()
                        formData.append('file', bannerFile)
                        formData.append('arenaId', createdArena.id)
                        formData.append('type', 'banner')
                        const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
                        if (!uploadRes.ok) throw new Error('Failed to upload image')
                        bannerUrl = (await uploadRes.json()).url

                        const updateRes = await updateArenaAction(createdArena.id, { ...payload, banner_url: bannerUrl })
                        if (!updateRes.success) throw new Error(updateRes.error)
                    } catch (error) {
                        console.error("Failed to upload image after arena creation:", error)
                        toast.error("Arena criada, mas falha ao fazer upload da imagem.")
                    }
                }

                toast.success("Arena criada com sucesso!")
                router.push("/dashboard/settings/arenas")
                router.refresh()
            }
        } catch (error: any) {
            console.error('Error saving arena:', error)
            toast.error(`Erro ao salvar: ${error.message || "Ocorreu um erro inesperado."}`)
        } finally {
            setIsUploading(false)
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Inputs Column */}
                    <div className="lg:col-span-2 space-y-6">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nome</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Informe o nome da arena" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="cpf_cnpj"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>CPF ou CNPJ</FormLabel>
                                    <FormControl>
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                                            <Input
                                                placeholder="Somente números ou com formatação"
                                                inputMode="numeric"
                                                autoComplete="off"
                                                className="sm:flex-1"
                                                {...field}
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                disabled={
                                                    cnpjLookupLoading ||
                                                    onlyDigits(field.value).length !== 14 ||
                                                    !isValidCnpj(onlyDigits(field.value))
                                                }
                                                onClick={() => void applyCnpjFromReceitaFederal()}
                                                className="shrink-0 border-[#0D3B45] text-[#0D3B45] hover:bg-[#0D3B45]/5"
                                            >
                                                {cnpjLookupLoading ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        Consultando…
                                                    </>
                                                ) : (
                                                    "Preencher com CNPJ (Receita)"
                                                )}
                                            </Button>
                                        </div>
                                    </FormControl>
                                    <FormDescription>
                                        Opcional no cadastro. Necessário para cobrança com Asaas. CPF não possui consulta
                                        automática gratuita; com CNPJ válido use o botão para buscar razão social e
                                        endereço na{" "}
                                        <a
                                            href="https://brasilapi.com.br/"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="font-medium text-arena-button underline underline-offset-2"
                                        >
                                            Brasil API
                                        </a>
                                        .
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="status"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Status</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecione o status" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="ativo">Ativo</SelectItem>
                                            <SelectItem value="inativo">Inativo</SelectItem>
                                            <SelectItem value="Em manutenção">Em manutenção</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="sports"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Esportes</FormLabel>
                                    <div className="grid grid-cols-2 gap-2 border rounded-md p-3 max-h-[120px] overflow-y-auto">
                                        {sports.map((sport) => (
                                            <div key={sport.id} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={sport.id}
                                                    checked={field.value?.includes(sport.id)}
                                                    onCheckedChange={(checked) => {
                                                        const current = field.value || []
                                                        const next = checked
                                                            ? [...current, sport.id]
                                                            : current.filter((id: string) => id !== sport.id)
                                                        field.onChange(next)
                                                    }}
                                                />
                                                <label htmlFor={sport.id} className="text-sm font-medium leading-none cursor-pointer">
                                                    {sport.name}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="comodidades"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Comodidades</FormLabel>
                                    <div className="grid grid-cols-2 gap-2 border rounded-md p-3 max-h-[120px] overflow-y-auto">
                                        {comodidades.map((comodidade) => (
                                            <div key={comodidade.id} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={comodidade.id}
                                                    checked={field.value?.includes(comodidade.id)}
                                                    onCheckedChange={(checked) => {
                                                        const current = field.value || []
                                                        const next = checked
                                                            ? [...current, comodidade.id]
                                                            : current.filter((id: string) => id !== comodidade.id)
                                                        field.onChange(next)
                                                    }}
                                                />
                                                <label htmlFor={comodidade.id} className="text-sm font-medium leading-none cursor-pointer">
                                                    {comodidade.name}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="pt-4 border-t border-gray-100 mt-6">
                            <h3 className="text-lg font-semibold text-arena-navy-800 mb-4">Endereço</h3>
                            <div className="flex flex-col gap-5">
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                    <div className="md:col-span-1">
                                        <FormField
                                            control={form.control}
                                            name="zip_code"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>CEP</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            placeholder="00000-000"
                                                            {...field}
                                                            onBlur={(e) => {
                                                                field.onBlur();
                                                                if (e.target.value) {
                                                                    fetchAddressByCep(e.target.value);
                                                                }
                                                            }}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <FormItem>
                                            <FormLabel>Estado</FormLabel>
                                            <Popover open={isEstadoOpen} onOpenChange={setIsEstadoOpen}>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                        <Button
                                                            variant="outline"
                                                            role="combobox"
                                                            aria-expanded={isEstadoOpen}
                                                            className={cn("w-full justify-between h-9", !selectedEstadoId && "text-muted-foreground")}
                                                        >
                                                            {selectedEstadoId
                                                                ? estados.find((est) => est.codigo_uf === selectedEstadoId)?.nome
                                                                : "Selecionar estado"}
                                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                        </Button>
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[300px] p-0">
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
                                                                            form.setValue("id_municipio", undefined as any)
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
                                            <FormMessage />
                                        </FormItem>
                                    </div>
                                    <div className="md:col-span-2">
                                        <FormField
                                            control={form.control}
                                            name="id_municipio"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Cidade</FormLabel>
                                                    <Popover open={isMunicipioOpen} onOpenChange={setIsMunicipioOpen}>
                                                        <PopoverTrigger asChild>
                                                            <FormControl>
                                                                <Button
                                                                    variant="outline"
                                                                    role="combobox"
                                                                    aria-expanded={isMunicipioOpen}
                                                                    className={cn("w-full justify-between h-9", !field.value && "text-muted-foreground")}
                                                                    disabled={!selectedEstadoId}
                                                                >
                                                                    {field.value
                                                                        ? municipios.find((mun) => mun.codigo_ibge === field.value)?.nome
                                                                        : "Selecionar cidade"}
                                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                                </Button>
                                                            </FormControl>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-[400px] p-0">
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
                                                                                    form.setValue("id_municipio", municipio.codigo_ibge)
                                                                                    setIsMunicipioOpen(false)
                                                                                }}
                                                                            >
                                                                                <Check
                                                                                    className={cn(
                                                                                        "mr-2 h-4 w-4",
                                                                                        municipio.codigo_ibge === field.value ? "opacity-100" : "opacity-0"
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
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                    <div className="md:col-span-1">
                                        <FormField
                                            control={form.control}
                                            name="neighborhood"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Bairro</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Bairro" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                    <div className="md:col-span-3">
                                        <FormField
                                            control={form.control}
                                            name="address"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Logradouro</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Rua, Avenida, etc." {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                    <div className="md:col-span-1">
                                        <FormField
                                            control={form.control}
                                            name="number"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Número</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="123" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="complement"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Complemento</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Sala, Bloco, etc." {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-gray-100">
                            <h3 className="text-lg font-semibold text-arena-navy-800 mb-4">Redes Sociais</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <FormField
                                    control={form.control}
                                    name="facebook"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Facebook</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Link ou @usuario" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="instagram"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Instagram</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Link ou @usuario" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="tiktok"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>TikTok</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Link ou @usuario" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        {/* Opening Hours */}
                        <div className="pt-4 border-t border-gray-100 mt-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-arena-navy-800">Dias de funcionamento</h3>
                            </div>

                            <div className="flex flex-col gap-4">
                                {DAYS_OF_WEEK.map((day) => (
                                    <FormField
                                        key={day.value}
                                        control={form.control}
                                        name={`opening_hours.${day.value}`}
                                        render={({ field }) => {
                                            const value = field.value || { isOpen: false, start: "06:00", end: "23:00" }
                                            return (
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 rounded-lg border">
                                                    <div className="flex items-center gap-3 mb-3 sm:mb-0 min-w-[150px]">
                                                        <Switch
                                                            checked={value.isOpen}
                                                            onCheckedChange={(checked) => field.onChange({ ...value, isOpen: checked })}
                                                        />
                                                        <span className="font-medium text-sm">{day.label}</span>
                                                    </div>

                                                    {value.isOpen ? (
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm text-gray-500">Abre:</span>
                                                                <Input
                                                                    type="time"
                                                                    className="w-[110px]"
                                                                    value={value.start}
                                                                    onChange={(e) => field.onChange({ ...value, start: e.target.value })}
                                                                />
                                                            </div>
                                                            <span className="text-gray-400">-</span>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm text-gray-500">Fecha:</span>
                                                                <Input
                                                                    type="time"
                                                                    className="w-[110px]"
                                                                    value={value.end}
                                                                    onChange={(e) => field.onChange({ ...value, end: e.target.value })}
                                                                />
                                                            </div>
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                className="ml-2 h-9 text-xs border-orange-200 text-orange-700 hover:bg-orange-50"
                                                                title="Replicar este horário para todos os dias"
                                                                onClick={() => {
                                                                    DAYS_OF_WEEK.forEach(d => {
                                                                        if (d.value !== day.value) {
                                                                            form.setValue(`opening_hours.${d.value}` as any, {
                                                                                isOpen: true,
                                                                                start: value.start,
                                                                                end: value.end
                                                                            }, {
                                                                                shouldDirty: true,
                                                                                shouldValidate: true,
                                                                                shouldTouch: true
                                                                            });
                                                                        }
                                                                    });
                                                                    toast.success("Horários replicados com sucesso!");
                                                                }}
                                                            >
                                                                <Copy className="h-3 w-3 mr-1" />
                                                                Replicar
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <div className="text-sm text-gray-400 italic">Fechado</div>
                                                    )}
                                                </div>
                                            )
                                        }}
                                    />
                                ))}
                            </div>
                            {form.formState.errors.opening_hours && (
                                <p className="text-sm text-red-500 mt-2">{form.formState.errors.opening_hours.message as string}</p>
                            )}
                        </div>

                        <FormField
                            control={form.control}
                            name="phone"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Telefone</FormLabel>
                                    <FormControl>
                                        <Input placeholder="(00) 00000-0000" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Observações</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Insira aqui informações importantes que o usuário deve conhecer antes de reservar"
                                            className="min-h-[100px]"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    {/* Image Column */}
                    <div className="lg:col-span-1">
                        <div className="sticky top-6">
                            <FormLabel className="block mb-2">Perfil da arena</FormLabel>
                            <p className="text-xs text-muted-foreground mb-4">Gerencie as informações que irão aparecer no perfil comercial da sua arena.</p>
                            <ImageUpload
                                value={initialData?.banner_url}
                                onChange={setBannerFile}
                                className="w-full h-[300px]"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end">
                    <Button type="submit" size="lg" className="bg-arena-button hover:bg-arena-button-hover text-white min-w-[150px]" disabled={isUploading}>
                        {isUploading ? "Salvando..." : "Salvar"}
                    </Button>
                </div>
            </form>
        </Form>
    )
}
