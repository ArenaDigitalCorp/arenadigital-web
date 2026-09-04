"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Button } from "@/components/ui/button"
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
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { createCourtAction, updateCourtAction, getSportsForCourtAction } from "@/modules/courts/actions/courtActions"
import { useRouter } from "next/navigation"
import { Textarea } from "@/components/ui/textarea"
import { useEffect, useState, useRef } from "react"
import { UploadCloud, X, Image as ImageIcon, Loader2 } from "lucide-react"
import Image from "next/image"
import { PriceTablesConfig } from "./PriceTablesConfig"
import { courtSchema, type CourtFormValues } from "@/modules/courts/schemas/court.schema"
import { arenaDashboardPath, type ArenaDashboardTab } from "@/lib/arena-dashboard-navigation"
import { saveDraftPriceTablesAction } from "@/modules/courts/actions/priceTableActions"
import {
    EDITOR_DAY_ORDER,
    dayConfigFromPriceDays,
    draftPriceTables,
    toEditorDays,
} from "@/modules/courts/lib/price-table-editor"
import type { CourtPriceTable } from "@/modules/courts/types/price-table.types"

const courtFormSchema = courtSchema

interface CourtFormProps {
    initialData?: any
    arenaId: string
    onSuccess?: () => void
    /** Aba da arena para onde redirecionar após salvar com sucesso. */
    returnTab?: ArenaDashboardTab
}

/** Dias do editor (7, na ordem segunda→domingo) para o payload das actions. */
function draftDaysPayload(table: CourtPriceTable) {
    const days = toEditorDays(table.days)
    return EDITOR_DAY_ORDER.map((dow) => {
        const d = days.find((x) => x.diaSemana === dow)!
        return {
            diaSemana: dow,
            enabled: d.enabled,
            startTime: d.startTime,
            endTime: d.endTime,
            slotShiftTime: d.slotShiftTime,
            basePrice: d.basePrice,
            bands: d.bands.map((b) => ({ start: b.start, end: b.end, price: b.price })),
        }
    })
}

export function CourtForm({ initialData, arenaId, onSuccess, returnTab = "espacos" }: CourtFormProps) {
    const router = useRouter()
    const [sports, setSports] = useState<{ id: string; name: string }[]>([])
    const [sportsLoading, setSportsLoading] = useState(true)
    const [sportsError, setSportsError] = useState<string | null>(null)
    const [imageFile, setImageFile] = useState<File | null>(null)
    const [imagePreview, setImagePreview] = useState<string | null>(initialData?.image_url || null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [isUploading, setIsUploading] = useState(false)

    // Cadastro: as 3 tabelas fixas já são preenchidas aqui e persistidas logo
    // após criar o espaço. Edição usa o PriceTablesConfig persistido.
    const [draftTables, setDraftTables] = useState<CourtPriceTable[]>(() =>
        draftPriceTables(arenaId)
    )

    useEffect(() => {
        async function loadSports() {
            setSportsLoading(true)
            setSportsError(null)
            try {
                const res = await getSportsForCourtAction()
                if (!res.success) {
                    setSportsError(res.error ?? 'Erro ao carregar esportes')
                } else {
                    setSports(res.data)
                }
            } catch (error) {
                console.error('[CourtForm] Failed to load sports:', error)
                setSportsError('Erro ao carregar esportes')
            } finally {
                setSportsLoading(false)
            }
        }
        loadSports()
    }, [])

    const form = useForm<CourtFormValues>({
        resolver: zodResolver(courtFormSchema as any),
        defaultValues: {
            name: initialData?.name || "",
            status: (initialData?.status as any) || "ativo",
            type: (initialData?.type as any) || "Quadra",
            sportIds: initialData?.sports?.map((s: any) => s.id) || [],
            is_covered: initialData?.is_covered ?? false,
            observations: initialData?.observations || "",
            booking_type: initialData?.booking_type || "hourly",
            image_url: initialData?.image_url || "",
            day_config: initialData?.day_config || [],
            capacity: initialData?.capacity || 2,
        },
    })

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setImageFile(file)
            const reader = new FileReader()
            reader.onloadend = () => {
                setImagePreview(reader.result as string)
            }
            reader.readAsDataURL(file)
        }
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        const file = e.dataTransfer.files?.[0]
        if (file) {
            setImageFile(file)
            const reader = new FileReader()
            reader.onloadend = () => {
                setImagePreview(reader.result as string)
            }
            reader.readAsDataURL(file)
        }
    }

    async function onSubmit(data: any) {
        try {
            // Na criação, a tabela Padrão do rascunho vira o day_config do espaço
            // (obrigatória); na edição os horários/preços são geridos pelo bloco
            // de Tabelas de preço, que salva sozinho.
            const padraoDraft = draftTables.find((t) => t.tipo === 'padrao')
            const padraoDayConfig = padraoDraft
                ? dayConfigFromPriceDays(toEditorDays(padraoDraft.days))
                : []

            if (!initialData && padraoDayConfig.length === 0) {
                toast.error("Habilite pelo menos um dia na tabela Padrão.")
                return
            }

            setIsUploading(true)

            const { sportIds, ...input } = data
            const available_days = padraoDayConfig.map((d) => d.day)
            const price = padraoDayConfig[0]?.price || 0

            if (initialData) {
                // Editing: spaceId already exists — upload image first, then update.
                // day_config/available_days/price ficam a cargo de PriceTablesConfig.
                let imageUrl = data.image_url
                if (imageFile) {
                    try {
                        const fd = new FormData()
                        fd.append('file', imageFile)
                        fd.append('arenaId', arenaId)
                        fd.append('spaceId', initialData.id)
                        fd.append('type', 'space')
                        const uploadRes = await fetch('/api/upload', { method: 'POST', body: fd })
                        if (!uploadRes.ok) throw new Error('Failed to upload image')
                        imageUrl = (await uploadRes.json()).url
                    } catch (error) {
                        console.error("Failed to upload image:", error)
                        toast.error("Falha ao fazer upload da imagem.")
                        setIsUploading(false)
                        return
                    }
                }
                const finalInput = { ...input, image_url: imageUrl }
                const res = await updateCourtAction(arenaId, initialData.id, { ...finalInput }, sportIds)
                if (!res.success) throw new Error(res.error)
                toast.success("Espaço atualizado com sucesso!")
            } else {
                // Creating: create space first to get the ID, then upload image and update
                const finalInput = { ...input, image_url: data.image_url || "", day_config: padraoDayConfig, available_days, price }
                const createRes = await createCourtAction(arenaId, { ...finalInput }, sportIds)
                if (!createRes.success) throw new Error(createRes.error)
                const newCourt = createRes.data

                // O trigger do banco já semeou Padrão/Mensalista/Professor; aqui
                // gravamos exatamente o que o gestor preencheu nas 3 abas.
                if (newCourt?.id) {
                    const tablesRes = await saveDraftPriceTablesAction(
                        arenaId,
                        newCourt.id,
                        draftTables.map((t) => ({
                            tipo: t.tipo,
                            nome: t.nome,
                            days: draftDaysPayload(t),
                        }))
                    )
                    if (!tablesRes.success) {
                        toast.error(
                            tablesRes.error ??
                                "Espaço criado, mas houve erro ao salvar as tabelas de preço."
                        )
                    }
                }

                if (imageFile && newCourt?.id) {
                    try {
                        const fd = new FormData()
                        fd.append('file', imageFile)
                        fd.append('arenaId', arenaId)
                        fd.append('spaceId', newCourt.id)
                        fd.append('type', 'space')
                        const uploadRes = await fetch('/api/upload', { method: 'POST', body: fd })
                        if (uploadRes.ok) {
                            const { url } = await uploadRes.json()
                            const updateRes = await updateCourtAction(arenaId, newCourt.id, { image_url: url }, undefined)
                            if (!updateRes.success) throw new Error(updateRes.error)
                        } else {
                            throw new Error('Failed to upload image')
                        }
                    } catch (error) {
                        console.error("Failed to upload image:", error)
                        toast.error("Espaço criado, mas falha ao fazer upload da imagem.")
                    }
                }

                toast.success("Espaço criado com sucesso!")
            }

            if (onSuccess) onSuccess()
            router.push(arenaDashboardPath(arenaId, returnTab))
        } catch (error) {
            console.error("Error saving space:", error)
            toast.error(error instanceof Error ? error.message : "Ocorreu um erro ao salvar o espaço.")
        } finally {
            setIsUploading(false)
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Image Upload Column */}
                    <div className="lg:col-span-1">
                        <FormLabel className="block mb-2">Foto do espaço</FormLabel>
                        <div
                            className="border-2 border-dashed border-gray-200 rounded-lg p-4 h-[240px] flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors relative overflow-hidden bg-arena-soft"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleImageSelect}
                            />

                            {imagePreview ? (
                                <>
                                    <Image
                                        src={imagePreview}
                                        alt="Preview"
                                        fill
                                        className="object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                        <p className="text-white font-medium">Trocar imagem</p>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center space-y-2">
                                    <div className="bg-white p-3 rounded-full shadow-sm inline-block">
                                        <ImageIcon className="w-6 h-6 text-arena-navy-800/40" />
                                    </div>
                                    <p className="text-xs text-arena-navy-800/40 px-4">
                                        Arraste ou clique aqui para inserir a foto do espaço.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Inputs Column */}
                    <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Left Column */}
                        <div className="space-y-4">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nome</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Informe o nome do espaço" {...field} />
                                        </FormControl>
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
                                                <SelectTrigger className="w-full min-w-0">
                                                    <SelectValue placeholder="Selecione o status" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="ativo">Ativo</SelectItem>
                                                <SelectItem value="inativo">Inativo</SelectItem>
                                                <SelectItem value="Em manutenção">Em manutenção</SelectItem>
                                                <SelectItem value="Desativado">Desativado</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="type"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Tipo do espaço</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="w-full min-w-0">
                                                    <SelectValue placeholder="Selecione o tipo" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="Quadra">Quadra</SelectItem>
                                                <SelectItem value="Espaço social">Espaço social</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="is_covered"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Coberta/Descoberta</FormLabel>
                                        <Select
                                            onValueChange={(val) => field.onChange(val === "true")}
                                            value={field.value ? "true" : "false"}
                                        >
                                            <FormControl>
                                                <SelectTrigger className="w-full min-w-0">
                                                    <SelectValue placeholder="Selecione uma opção" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="true">Coberta</SelectItem>
                                                <SelectItem value="false">Descoberta</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Right Column */}
                        <div className="space-y-4">
                            <FormField
                                control={form.control}
                                name="sportIds"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Esportes</FormLabel>
                                        <div className="border rounded-md p-3 min-h-[80px] max-h-[160px] overflow-y-auto">
                                            {sportsLoading ? (
                                                <p className="text-sm text-arena-navy-800/40 text-center py-2">Carregando esportes...</p>
                                            ) : sportsError ? (
                                                <p className="text-sm text-red-500 text-center py-2">{sportsError}</p>
                                            ) : sports.length === 0 ? (
                                                <p className="text-sm text-arena-navy-800/40 text-center py-2">Nenhum esporte cadastrado.</p>
                                            ) : (
                                                <div className="grid grid-cols-2 gap-2">
                                                    {sports.map((sport) => (
                                                        <div key={sport.id} className="flex items-center space-x-2">
                                                            <Checkbox
                                                                id={`sport-${sport.id}`}
                                                                checked={field.value?.includes(sport.id)}
                                                                onCheckedChange={(checked) => {
                                                                    const current = field.value || []
                                                                    const next = checked
                                                                        ? [...current, sport.id]
                                                                        : current.filter((id: string) => id !== sport.id)
                                                                    field.onChange(next)
                                                                }}
                                                                className="border-arena-slate-muted data-[state=checked]:border-arena-button data-[state=checked]:bg-arena-button data-[state=checked]:text-white"
                                                            />
                                                            <label htmlFor={`sport-${sport.id}`} className="text-sm font-medium leading-none cursor-pointer select-none">
                                                                {sport.name}
                                                            </label>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="booking_type"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Tipo de reserva</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="w-full min-w-0">
                                                    <SelectValue placeholder="Selecione o tipo" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="unique">Valor único</SelectItem>
                                                <SelectItem value="hourly">Por hora</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="capacity"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Capacidade (pessoas)</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                placeholder="Ex: 4"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <h3 className="text-lg font-semibold text-arena-navy-800">Tabelas de preço</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {initialData
                                ? "Padrão (reserva avulsa e app), Mensalista, Professor e personalizadas. Cada tabela tem faixas de horário/preço por dia."
                                : "Configure já as 3 tabelas: Padrão (obrigatória, usada na reserva avulsa e no app), Mensalista e Professor (opcionais). Outras tabelas podem ser criadas depois de salvar."}
                        </p>
                    </div>
                    {initialData ? (
                        <PriceTablesConfig
                            arenaId={arenaId}
                            courtId={initialData.id}
                            fallbackDayConfig={initialData.day_config}
                        />
                    ) : (
                        <PriceTablesConfig
                            arenaId={arenaId}
                            draftTables={draftTables}
                            onDraftChange={setDraftTables}
                        />
                    )}
                </div>

                <FormField
                    control={form.control}
                    name="observations"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Observações</FormLabel>
                            <FormControl>
                                <Textarea
                                    placeholder="Insira aqui informações importantes que o usuário deve conhecer antes de reservar"
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <Button type="submit" disabled={isUploading} className="w-full bg-arena-button hover:bg-arena-button-hover text-white">
                    {isUploading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {initialData ? "Salvando..." : "Cadastrando..."}
                        </>
                    ) : (
                        initialData ? "Salvar Alterações" : "Cadastrar Espaço"
                    )}
                </Button>
            </form>
        </Form>
    )
}
