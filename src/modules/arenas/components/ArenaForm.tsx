"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
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
import { ArenaService } from "@/modules/arenas/services/arenaService"
import { useRouter } from "next/navigation"
import { ImageUpload } from "@/components/ui/image-upload"
import { SportService, Sport } from "@/modules/courts/services/sportService"
import { useEffect, useState } from "react"
import { Textarea } from "@/components/ui/textarea"

const arenaFormSchema = z.object({
    name: z.string().min(2, {
        message: "O nome da arena deve ter pelo menos 2 caracteres.",
    }),
    status: z.enum(["ativo", "inativo", "Em manutenção"]),
    sports: z.array(z.string()).optional(),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    description: z.string().optional(),
    banner_url: z.string().optional(),
    address: z.string().min(2, "O logradouro é obrigatório."),
    number: z.string().optional(),
    complement: z.string().optional(),
    city: z.string().optional(),
    state: z.string().max(2, "UF deve ter no máximo 2 caracteres.").optional(),
    zip_code: z.string().optional(),
    facebook: z.string().optional(),
    instagram: z.string().optional(),
    tiktok: z.string().optional(),
    opening_hours: z.any().optional(),
})

type ArenaFormValues = z.infer<typeof arenaFormSchema>

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
    const [sports, setSports] = useState<Sport[]>([])
    const [bannerFile, setBannerFile] = useState<File | null>(null)
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

    const form = useForm<ArenaFormValues>({
        resolver: zodResolver(arenaFormSchema) as any,
        defaultValues: {
            name: initialData?.name || "",
            status: mapStatusFromDB(initialData?.status),
            sports: initialData?.sports?.map((s: any) => s.id || s) || [], // Handle object or ID
            phone: initialData?.phone || "",
            email: initialData?.email || "",
            description: initialData?.description || "",
            banner_url: initialData?.banner_url || "",
            zip_code: initialData?.zip_code || "",
            address: typeof initialData?.address === 'string' ? initialData.address : initialData?.address?.street || "",
            number: initialData?.number || "",
            complement: initialData?.complement || "",
            city: initialData?.city || "",
            state: initialData?.state || "",
            facebook: initialData?.facebook || "",
            instagram: initialData?.instagram || "",
            tiktok: initialData?.tiktok || "",
            opening_hours: initialData?.opening_hours || {
                weekdays: { start: "06:00", end: "23:00" },
                weekends: { start: "06:00", end: "23:00" }
            }
        },
    })

    async function onSubmit(values: any) {
        try {
            setIsUploading(true)
            let bannerUrl = values.banner_url

            if (bannerFile) {
                try {
                    // We need an ID to upload. If creating, we might need a temp ID or upload 
                    // after creation? 
                    // Strategy: 
                    // If editing, use initialData.id.
                    // If creating, we can't upload to a specific folder yet if we follow /arenas/[id] pattern.
                    // But we can use a temp ID or just upload to a 'temp' folder and move? 
                    // Or just use the user ID as a bucket?
                    // For now, let's assume we use 'temp' or just a random ID if not exists.
                    // Actually, the previous implementation for Court used court-specific path.
                    // For Arena, we can use 'arenas/banner/[random]'.
                    // Let's use 'arenas' prefix.
                    // Wait, `ArenaService.uploadBanner` takes `arenaId`.
                    // If creating, we don't have ID.
                    // We can create the arena first, then upload, then update?
                    // Or finding a way to generate ID first? Supabase allows client-side UUID generation?
                    // Let's go with Create -> Upload -> Update for now to be safe, or 
                    // just upload to a general 'arenas' folder and not worry about ID in path.

                    const uploadId = initialData?.id || 'new-arena-' + Date.now();
                    bannerUrl = await ArenaService.uploadBanner(bannerFile, uploadId)
                } catch (error) {
                    console.error("Failed to upload image:", error)
                    toast.error("Falha ao fazer upload da imagem.")
                    setIsUploading(false)
                    return
                }
            }

            // Construct the final object
            // Ensure opening_hours is structurally correct if we modified it
            // For now, we are passing values directly, but if we add specific controls for days/time, we might need to reconstruct it.
            // But the current 'opening' inputs below are UNBOUND. We need to bind them.
            // Let's assume for now valid JSON is passed or we stick to the default.

            const data = { ...values, banner_url: bannerUrl } as ArenaFormValues

            if (initialData) {
                await ArenaService.updateArena(initialData.id, data as any)
                toast.success("Arena atualizada com sucesso!")
            } else {
                await ArenaService.createArena({ ...data, owner_id: ownerId } as any)
                toast.success("Arena criada com sucesso!")
            }
            router.push("/dashboard/arenas")
            router.refresh()
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

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            <FormField
                                control={form.control}
                                name="zip_code"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>CEP</FormLabel>
                                        <FormControl>
                                            <Input placeholder="00000-000" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="md:col-span-3">
                                <FormField
                                    control={form.control}
                                    name="city"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Cidade</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Informe a cidade" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <div className="md:col-span-1">
                                <FormField
                                    control={form.control}
                                    name="state"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Estado</FormLabel>
                                            <FormControl>
                                                <Input placeholder="UF" {...field} maxLength={2} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        <div className="pt-4 border-t border-gray-100">
                            <h3 className="text-lg font-semibold text-[#002B40] mb-4">Redes Sociais</h3>
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

                        {/* Opening Hours - Placeholder for now as complex object */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="opening_hours"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Dias de funcionamento</FormLabel>
                                        <Select
                                            onValueChange={(val) => {
                                                // Minimal implementation: Update the whole object or just a part?
                                                // For now, let's just pretend we handle 'todos'.
                                                // Ideally detailed schedule requires more UI.
                                                // We'll just preserve existing value or set simple default.
                                                field.onChange({ ...field.value, type: val })
                                            }}
                                            defaultValue={field.value?.type || "todos"}
                                        >
                                            <FormControl>
                                                <SelectTrigger><SelectValue placeholder="Selecione os dias" /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="todos">Todos os dias</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="opening_hours"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Horário de funcionamento</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="06:00 às 23:00"
                                                value={field.value?.display || "06:00 às 23:00"}
                                                onChange={(e) => field.onChange({ ...field.value, display: e.target.value })}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
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
                    <Button type="submit" size="lg" className="bg-[#FF6B00] hover:bg-[#E66000] text-white min-w-[150px]" disabled={isUploading}>
                        {isUploading ? "Salvando..." : "Salvar"}
                    </Button>
                </div>
            </form>
        </Form>
    )
}
