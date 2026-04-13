"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import {
    ChevronLeft,
    Plus
} from "lucide-react"
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
import { toast } from "sonner"
import { useEffect, useState } from "react"
import { AthleteService } from "@/modules/athletes/services/athleteService"
import { linkAthlete } from "@/modules/athletes/actions/athleteActions"
import { athleteFormSchema, type AthleteFormValues } from "@/modules/athletes/schemas/athlete.schema"

interface AthleteRegistrationModalProps {
    arenaId: string
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
}

export function AthleteRegistrationModal({
    arenaId,
    open,
    onOpenChange,
    onSuccess
}: AthleteRegistrationModalProps) {
    const [sports, setSports] = useState<{ id: string, name: string }[]>([])
    const [isLoadingSports, setIsLoadingSports] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        if (open) {
            loadSports()
        }
    }, [open])

    async function loadSports() {
        try {
            setIsLoadingSports(true)
            const data = await AthleteService.getSports()
            setSports(data)
        } catch (error) {
            console.error("Error loading sports:", error)
        } finally {
            setIsLoadingSports(false)
        }
    }

    const form = useForm<AthleteFormValues>({
        resolver: zodResolver(athleteFormSchema),
        defaultValues: {
            name: "",
            cpf: "",
            phone: "",
            email: "",
            sport: "",
        },
    })

    async function onSubmit(data: AthleteFormValues) {
        try {
            setIsSubmitting(true)
            const result = await linkAthlete({
                name: data.name,
                cpf: data.cpf,
                phone: data.phone,
                email: data.email,
                sportId: data.sport,
                arenaId: arenaId,
            })

            if (result.success) {
                toast.success("Atleta vinculado com sucesso!")
                onSuccess()
                onOpenChange(false)
                form.reset()
            } else {
                toast.error(result.error || "Ocorreu um erro ao vincular o atleta.")
            }
        } catch (error) {
            console.error("Error linking athlete:", error)
            toast.error("Ocorreu um erro inesperado ao vincular o atleta.")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] p-0 border-none">
                <div className="p-8 space-y-8 bg-white rounded-lg">
                    <div className="flex items-center gap-2 text-[#002B40] text-sm font-medium cursor-pointer hover:opacity-70 transition-opacity" onClick={() => onOpenChange(false)}>
                        <ChevronLeft className="h-4 w-4" />
                        Voltar
                    </div>

                    <div className="space-y-1">
                        <DialogTitle className="text-3xl font-bold text-[#002B40]">Novo atleta</DialogTitle>
                    </div>

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[#002B40] font-medium">Nome</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Informe o nome do atleta" {...field} className="h-12" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="cpf"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[#002B40] font-medium">CPF</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Informe o CPF do atleta" {...field} className="h-12" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <FormField
                                    control={form.control}
                                    name="phone"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[#002B40] font-medium">Telefone</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Informe o número para contato" {...field} className="h-12" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[#002B40] font-medium">E-mail</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Informe o e-mail para contato" {...field} className="h-12" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField
                                control={form.control}
                                name="sport"
                                render={({ field }) => (
                                    <FormItem className="max-w-[335px]">
                                        <FormLabel className="text-[#002B40] font-medium">Esporte</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="h-12">
                                                    <SelectValue placeholder="Selecione o esporte do atleta" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {sports.map((sport) => (
                                                    <SelectItem key={sport.id} value={sport.id}>
                                                        {sport.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="flex justify-end pt-4">
                                <Button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="bg-[#FF6B00] hover:bg-[#E66000] text-white px-12 py-6 h-auto text-base rounded-lg font-semibold shadow-md active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSubmitting ? "Salvando..." : "Salvar"}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </div>
            </DialogContent>
        </Dialog >
    )
}
