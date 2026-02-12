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
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { StationService, StationType } from "@/modules/stations/services/stationService"
import { useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"

const stationFormSchema = z.object({
    name: z.string().min(2, {
        message: "O nome da estação deve ter pelo menos 2 caracteres.",
    }),
    status: z.enum(["ativo", "inativo", "Em manutenção", "Desativado"]),
    station_type_id: z.string({
        required_error: "Selecione um tipo de estação.",
    }),
})

type StationFormValues = z.infer<typeof stationFormSchema>

interface StationFormProps {
    initialData?: any
    arenaId: string
    onSuccess?: () => void
}

export function StationForm({ initialData, arenaId, onSuccess }: StationFormProps) {
    const router = useRouter()
    const [stationTypes, setStationTypes] = useState<StationType[]>([])
    const [isLoadingTypes, setIsLoadingTypes] = useState(true)

    const form = useForm<StationFormValues>({
        resolver: zodResolver(stationFormSchema),
        defaultValues: {
            name: initialData?.name || "",
            status: (initialData?.status as any) || "ativo",
            station_type_id: initialData?.station_type_id || "",
        },
    })

    useEffect(() => {
        async function loadTypes() {
            try {
                const types = await StationService.getStationTypes()
                setStationTypes(types)
            } catch (error) {
                console.error("Failed to load station types", error)
                toast.error("Erro ao carregar tipos de estação.")
            } finally {
                setIsLoadingTypes(false)
            }
        }
        loadTypes()
    }, [])

    async function onSubmit(data: StationFormValues) {
        try {
            const finalInput = { ...data, arena_id: arenaId }

            if (initialData) {
                await StationService.updateStation(initialData.id, finalInput)
                toast.success("Estação atualizada com sucesso!")
            } else {
                await StationService.createStation(finalInput)
                toast.success("Estação criada com sucesso!")
            }
            if (onSuccess) onSuccess()
            router.refresh()
            router.push(`/dashboard/arenas/${arenaId}/stations`)
        } catch (error) {
            console.error("Error saving station:", error)
            toast.error("Ocorreu um erro ao salvar a estação.")
        }
    }

    if (isLoadingTypes) {
        return <div className="space-y-6 max-w-md">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
        </div>
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-md">
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Nome</FormLabel>
                            <FormControl>
                                <Input placeholder="Informe o nome da estação" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="station_type_id"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Tipo de Estação</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione o tipo" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {stationTypes.map((type) => (
                                        <SelectItem key={type.id} value={type.id}>
                                            {type.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
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

                <Button type="submit" className="w-full bg-[#FF6B00] hover:bg-[#E66000] text-white">
                    {initialData ? "Salvar Alterações" : "Cadastrar Estação"}
                </Button>
            </form>
        </Form>
    )
}
