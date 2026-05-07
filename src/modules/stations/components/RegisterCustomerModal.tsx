"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
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
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { createCustomerAction } from "@/modules/stations/actions/orderActions"

const registerCustomerSchema = z.object({
    name: z.string().min(2, "O nome deve ter pelo menos 2 caracteres"),
    cpf: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email("E-mail inválido").optional().or(z.literal("")),
})

type RegisterCustomerValues = z.infer<typeof registerCustomerSchema>

interface RegisterCustomerModalProps {
    isOpen: boolean
    onClose: () => void
    arenaId: string
    onSuccess: (customer: any) => void
}

export function RegisterCustomerModal({ isOpen, onClose, arenaId, onSuccess }: RegisterCustomerModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)

    const form = useForm<RegisterCustomerValues>({
        resolver: zodResolver(registerCustomerSchema),
        defaultValues: {
            name: "",
            cpf: "",
            phone: "",
            email: "",
        },
    })

    async function onSubmit(data: RegisterCustomerValues) {
        setIsSubmitting(true)
        try {
            const res = await createCustomerAction(arenaId, data)
            if (!res.success) throw new Error(res.error ?? 'Erro ao cadastrar cliente')
            const newCustomer = res.data
            toast.success("Cliente cadastrado com sucesso!")
            onSuccess(newCustomer)
            form.reset()
            onClose()
        } catch (error) {
            console.error("Error registering customer:", error)
            toast.error("Erro ao cadastrar cliente.")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-black text-arena-navy-800">
                        Cadastro novo cliente
                    </DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-arena-navy-800 font-bold">Nome</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Informe o nome do cliente" {...field} className="h-11 rounded-xl" />
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
                                    <FormLabel className="text-arena-navy-800 font-bold">CPF</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Informe o CPF do cliente" {...field} className="h-11 rounded-xl" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="phone"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-arena-navy-800 font-bold">Telefone (Opcional)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Informe o telefone de contato" {...field} className="h-11 rounded-xl" />
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
                                    <FormLabel className="text-arena-navy-800 font-bold">E-mail (Opcional)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Informe o e-mail do cliente" {...field} className="h-11 rounded-xl" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter className="pt-4 flex !justify-between">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onClose}
                                className="w-full font-semibold rounded-lg text-arena-navy-800/60"
                            >
                                Voltar
                            </Button>
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full bg-arena-button hover:bg-arena-button-hover text-white font-semibold shadow-sm rounded-lg"
                            >
                                {isSubmitting ? "Salvando..." : "Salvar"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
