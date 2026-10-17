"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { StandardModal } from "@/components/ui/standard-modal"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { MaskedInput } from "@/components/ui/masked-input"
import { registerCustomerSchema } from "@/modules/stations/schemas/customer.schema"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import type { Database } from "@/types/supabase.types"
import { createCustomerAction } from "@/modules/stations/actions/orderActions"

type RegisterCustomerValues = z.input<typeof registerCustomerSchema>

interface RegisterCustomerModalProps {
    isOpen: boolean
    onClose: () => void
    arenaId: string
    onSuccess: (customer: Database["public"]["Tables"]["station_customers"]["Row"]) => void
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
            if (!res.success || !res.data) throw new Error(res.error ?? 'Erro ao cadastrar cliente')
            const newCustomer = res.data
            toast.success("Cliente cadastrado com sucesso!")
            onSuccess(newCustomer)
            form.reset()
            onClose()
        } catch (error) {
            console.error("Error registering customer:", error)
            toast.error(error instanceof Error ? error.message : "Erro ao cadastrar cliente.")
        } finally {
            setIsSubmitting(false)
        }
    }

    const formId = "register-customer-form"

    return (
        <StandardModal
            open={isOpen}
            onOpenChange={(open) => !open && onClose()}
            title="Cadastro novo cliente"
            footer={
                <div className="flex items-center gap-3">
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
                        form={formId}
                        disabled={isSubmitting}
                        className="w-full bg-arena-button hover:bg-arena-button-hover text-white font-semibold shadow-sm rounded-lg"
                    >
                        {isSubmitting ? "Salvando..." : "Salvar"}
                    </Button>
                </div>
            }
        >
            <Form {...form}>
                <form id={formId} onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                                <FormLabel className="text-arena-navy-800 font-bold">CPF (Opcional)</FormLabel>
                                <FormControl>
                                    <MaskedInput mask="cpf" placeholder="000.000.000-00" {...field} className="h-11 rounded-xl" />
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
                                    <MaskedInput mask="phone" placeholder="(00) 00000-0000" {...field} className="h-11 rounded-xl" />
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
                </form>
            </Form>
        </StandardModal>
    )
}
