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
import { CourtService } from "@/modules/courts/services/courtService"
import { useRouter } from "next/navigation"
import { Textarea } from "@/components/ui/textarea"
import { SportService, Sport } from "@/modules/courts/services/sportService"
import { useEffect, useState, useRef } from "react"
import { UploadCloud, X, Image as ImageIcon } from "lucide-react"
import Image from "next/image"

const courtFormSchema = z.object({
    name: z.string().min(2, {
        message: "O nome do espaço deve ter pelo menos 2 caracteres.",
    }),
    status: z.enum(["ativo", "inativo", "Em manutenção", "Desativado"]),
    type: z.enum(["Quadra", "Espaço social"]),
    sportIds: z.array(z.string()).optional(),
    is_covered: z.boolean().default(false),
    observations: z.string().optional(),
    available_days: z.array(z.string()).min(1, {
        message: "Selecione pelo menos um dia disponível.",
    }),
    price: z.coerce.number().min(0),
    booking_type: z.enum(["unique", "hourly"]),
    image_url: z.string().optional(),
})

type CourtFormValues = z.infer<typeof courtFormSchema>

interface CourtFormProps {
    initialData?: any
    arenaId: string
    onSuccess?: () => void
}

export function CourtForm({ initialData, arenaId, onSuccess }: CourtFormProps) {
    const router = useRouter()
    const [sports, setSports] = useState<Sport[]>([])
    const [imageFile, setImageFile] = useState<File | null>(null)
    const [imagePreview, setImagePreview] = useState<string | null>(initialData?.image_url || null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [isUploading, setIsUploading] = useState(false)

    useEffect(() => {
        async function loadSports() {
            try {
                const sportsData = await SportService.getSports()
                setSports(sportsData)
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
            available_days: initialData?.available_days || [
                "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"
            ],
            price: initialData?.price || 0,
            booking_type: initialData?.booking_type || "hourly",
            image_url: initialData?.image_url || "",
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
            setIsUploading(true)
            let imageUrl = data.image_url

            if (imageFile) {
                try {
                    imageUrl = await CourtService.uploadImage(imageFile, arenaId)
                } catch (error) {
                    console.error("Failed to upload image:", error)
                    toast.error("Falha ao fazer upload da imagem.")
                    setIsUploading(false)
                    return
                }
            }

            const { sportIds, ...input } = data
            const finalInput = { ...input, image_url: imageUrl }

            if (initialData) {
                await CourtService.updateCourt(initialData.id, { ...finalInput, arena_id: arenaId } as any, sportIds)
                toast.success("Espaço atualizado com sucesso!")
            } else {
                await CourtService.createCourt({ ...finalInput, arena_id: arenaId } as any, sportIds)
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
                            className="border-2 border-dashed border-gray-200 rounded-lg p-4 h-[240px] flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors relative overflow-hidden bg-[#F8FAFC]"
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
                                        <ImageIcon className="w-6 h-6 text-[#002B40]/40" />
                                    </div>
                                    <p className="text-xs text-[#002B40]/40 px-4">
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
                                                <SelectTrigger>
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
                                                <SelectTrigger>
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
                                                <SelectTrigger>
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
                                name="available_days"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Dias disponíveis</FormLabel>
                                        <div className="grid grid-cols-2 gap-2 border rounded-md p-3 max-h-[120px] overflow-y-auto">
                                            {["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"].map((day) => (
                                                <div key={day} className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id={day}
                                                        checked={field.value?.includes(day)}
                                                        onCheckedChange={(checked) => {
                                                            const current = field.value || []
                                                            const next = checked
                                                                ? [...current, day]
                                                                : current.filter(d => d !== day)
                                                            field.onChange(next)
                                                        }}
                                                    />
                                                    <label htmlFor={day} className="text-sm font-medium leading-none cursor-pointer">
                                                        {day}
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="price"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Valor da reserva</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">R$</span>
                                                    <Input type="number" step="0.01" className="pl-8" {...field} />
                                                </div>
                                            </FormControl>
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
                                                    <SelectTrigger>
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
                            </div>
                        </div>
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

                <Button type="submit" className="w-full bg-[#FF6B00] hover:bg-[#E66000] text-white">
                    {initialData ? "Salvar Alterações" : "Cadastrar Espaço"}
                </Button>
            </form>
        </Form>
    )
}
