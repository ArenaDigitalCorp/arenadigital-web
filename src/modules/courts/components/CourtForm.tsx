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
import { createCourtAction, updateCourtAction } from "@/modules/courts/actions/courtActions"
import { useRouter } from "next/navigation"
import { Textarea } from "@/components/ui/textarea"
import { getSportsAction } from "@/modules/athletes/actions/athleteActions"
import { useEffect, useState, useRef } from "react"
import { UploadCloud, X, Image as ImageIcon } from "lucide-react"
import Image from "next/image"
import { DayScheduleConfig, DayConfig } from "./DayScheduleConfig"
import { courtSchema, type CourtFormValues } from "@/modules/courts/schemas/court.schema"

const courtFormSchema = courtSchema

interface CourtFormProps {
    initialData?: any
    arenaId: string
    onSuccess?: () => void
}

const DAYS_OF_WEEK = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"]

const DEFAULT_DAY_CONFIG: DayConfig = {
    day: "",
    enabled: false,
    startTime: "06:00",
    endTime: "23:00",
    price: 0,
    customPrices: []
}

export function CourtForm({ initialData, arenaId, onSuccess }: CourtFormProps) {
    const router = useRouter()
    const [sports, setSports] = useState<any[]>([])
    const [imageFile, setImageFile] = useState<File | null>(null)
    const [imagePreview, setImagePreview] = useState<string | null>(initialData?.image_url || null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [isUploading, setIsUploading] = useState(false)

    // Initialize day configs
    const [dayConfigs, setDayConfigs] = useState<DayConfig[]>(() => {
        if (initialData?.day_config && Array.isArray(initialData.day_config) && initialData.day_config.length > 0) {
            // Merge with default days to ensure all days are present
            return DAYS_OF_WEEK.map(day => {
                const existing = initialData.day_config.find((d: any) => d.day === day)
                return { ...DEFAULT_DAY_CONFIG, ...existing, day }
            })
        }
        return DAYS_OF_WEEK.map(day => ({ ...DEFAULT_DAY_CONFIG, day }))
    })

    useEffect(() => {
        async function loadSports() {
            try {
                const res = await getSportsAction()
                setSports(res.data ?? [])
            } catch (error) {
                console.error("Failed to load sports:", error)
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

    const handleDayConfigChange = (index: number, newConfig: DayConfig) => {
        const newConfigs = [...dayConfigs]
        newConfigs[index] = newConfig
        setDayConfigs(newConfigs)
    }

    const handleReplicateDayConfig = (sourceIndex: number) => {
        const sourceConfig = dayConfigs[sourceIndex]
        const newConfigs = dayConfigs.map((config, index) => {
            if (index === sourceIndex) return config
            return {
                ...config,
                enabled: true,
                startTime: sourceConfig.startTime,
                endTime: sourceConfig.endTime,
                price: sourceConfig.price,
                customPrices: [...sourceConfig.customPrices],
                slotShiftTime: sourceConfig.slotShiftTime ?? null
            }
        })
        setDayConfigs(newConfigs)
        toast.success(`Configuração de ${sourceConfig.day} replicada para todos os dias!`)
    }

    async function onSubmit(data: any) {
        try {
            // Validate that at least one day is enabled
            const enabledDays = dayConfigs.filter(d => d.enabled)
            if (enabledDays.length === 0) {
                toast.error("Selecione pelo menos um dia disponível de funcionamento.")
                return
            }

            setIsUploading(true)

            const { sportIds, ...input } = data
            const available_days = enabledDays.map(d => d.day)
            const price = enabledDays[0]?.price || 0

            if (initialData) {
                // Editing: spaceId already exists — upload image first, then update
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
                const finalInput = { ...input, image_url: imageUrl, day_config: dayConfigs, available_days, price }
                const res = await updateCourtAction(arenaId, initialData.id, { ...finalInput }, sportIds)
                if (!res.success) throw new Error(res.error)
                toast.success("Espaço atualizado com sucesso!")
            } else {
                // Creating: create space first to get the ID, then upload image and update
                const finalInput = { ...input, image_url: data.image_url || "", day_config: dayConfigs, available_days, price }
                const createRes = await createCourtAction(arenaId, { ...finalInput }, sportIds)
                if (!createRes.success) throw new Error(createRes.error)
                const newCourt = createRes.data

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
                            await updateCourtAction(arenaId, newCourt.id, { image_url: url }, undefined)
                        }
                    } catch (error) {
                        console.error("Failed to upload image:", error)
                        toast.error("Espaço criado, mas falha ao fazer upload da imagem.")
                    }
                }

                toast.success("Espaço criado com sucesso!")
            }

            if (onSuccess) onSuccess()
            router.refresh()
        } catch (error) {
            console.error("Error saving space:", error)
            toast.error("Ocorreu um erro ao salvar o espaço.")
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
                                                                : current.filter(id => id !== sport.id)
                                                            field.onChange(next)
                                                        }}
                                                        className="border-arena-slate-muted text-arena-slate-muted data-[state=checked]:border-arena-slate-muted data-[state=checked]:bg-arena-slate-muted data-[state=checked]:text-white"
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
                    <h3 className="text-lg font-semibold text-arena-navy-800">Configuração de Horários e Preços</h3>
                    <div className="grid grid-cols-1 gap-4">
                        {dayConfigs.map((config, index) => (
                            <DayScheduleConfig
                                key={config.day}
                                day={config.day}
                                config={config}
                                onChange={(newConfig) => handleDayConfigChange(index, newConfig)}
                                onReplicate={() => handleReplicateDayConfig(index)}
                            />
                        ))}
                    </div>
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

                <Button type="submit" className="w-full bg-arena-button hover:bg-arena-button-hover text-white">
                    {initialData ? "Salvar Alterações" : "Cadastrar Espaço"}
                </Button>
            </form>
        </Form>
    )
}
