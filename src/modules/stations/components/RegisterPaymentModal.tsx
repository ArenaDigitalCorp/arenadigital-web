"use client"

import { useState, useEffect } from "react"
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
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import type { StationOrder } from "@/modules/stations/types/station.types"
import { addPaymentAction, closeOrderAndGenerateFinanceAction } from "@/modules/stations/actions/orderActions"
import { Loader2, X } from "lucide-react"

const paymentSchema = z.object({
    amount: z.string().min(1, "Informe o valor"),
    payment_method: z.string().min(1, "Selecione a forma de pagamento"),
    observation: z.string().optional(),
    paid_by_name: z.string().optional(),
})

type PaymentValues = z.infer<typeof paymentSchema>

interface RegisterPaymentModalProps {
    isOpen: boolean
    onClose: () => void
    order: StationOrder | null
    onSuccess: () => void
}

export function RegisterPaymentModal({
    isOpen,
    onClose,
    order,
    onSuccess
}: RegisterPaymentModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [showCloseConfirmation, setShowCloseConfirmation] = useState(false)
    const [currentBalance, setCurrentBalance] = useState(0)

    const form = useForm<PaymentValues>({
        resolver: zodResolver(paymentSchema),
        defaultValues: {
            amount: "",
            payment_method: "",
            observation: "",
            paid_by_name: "",
        },
    })

    useEffect(() => {
        if (order) {
            const paid = order.station_payments?.reduce((acc, p) => acc + p.amount, 0) || 0
            const balance = order.total_value - paid
            setCurrentBalance(balance)
            form.setValue("amount", balance.toFixed(2))
        }
    }, [order, form, isOpen])

    async function onSubmit(data: PaymentValues) {
        if (!order) return

        setIsSubmitting(true)
        try {
            const amount = parseFloat(data.amount.replace(',', '.'))

            const payRes = await addPaymentAction(order.arena_id, {
                order_id: order.id,
                amount,
                payment_method: data.payment_method,
                observation: data.observation,
                paid_by_name: data.paid_by_name,
            })
            if (!payRes.success) throw new Error(payRes.error)

            const newPaid = (order.station_payments?.reduce((acc, p) => acc + p.amount, 0) || 0) + amount
            const newBalance = order.total_value - newPaid

            if (newBalance <= 0) {
                setShowCloseConfirmation(true)
            } else {
                toast.success("Pagamento registrado!")
                onSuccess()
                handleClose()
            }
        } catch (error) {
            console.error("Error registering payment:", error)
            toast.error("Erro ao registrar pagamento.")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleCloseComanda = async () => {
        if (!order) return

        setIsSubmitting(true)
        try {
            const res = await closeOrderAndGenerateFinanceAction(order.arena_id, order.id)
            if (!res.success) throw new Error(res.error)
            toast.success("Comanda fechada com sucesso!")
            onSuccess()
            handleClose()
        } catch (error) {
            console.error("Error closing comanda:", error)
            toast.error("Erro ao fechar comanda.")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleClose = () => {
        form.reset()
        setShowCloseConfirmation(false)
        onClose()
    }

    if (!order) return null

    if (showCloseConfirmation) {
        return (
            <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
                <DialogContent className="sm:max-w-[450px] p-8 border-none shadow-2xl rounded-3xl">
                    <DialogHeader className="space-y-4">
                        <DialogTitle className="text-2xl font-black text-arena-navy-800">
                            Quer fechar a comanda?
                        </DialogTitle>
                        <p className="text-arena-navy-800/60 font-medium leading-relaxed">
                            O saldo da comanda agora é zero, com isso, deseja dar baixar ou continuar com ela aberta?
                        </p>
                    </DialogHeader>

                    <DialogFooter className="mt-8 flex flex-row items-center gap-3">
                        <Button
                            variant="outline"
                            onClick={() => {
                                onSuccess()
                                handleClose()
                            }}
                            className="flex-1 font-bold h-12 rounded-xl text-arena-navy-800/60 border-arena-navy-800/10"
                        >
                            Continuar aberta
                        </Button>
                        <Button
                            onClick={handleCloseComanda}
                            disabled={isSubmitting}
                            className="flex-1 bg-arena-button hover:bg-arena-button-hover text-white font-bold h-12 rounded-xl shadow-lg shadow-arena-button/20"
                        >
                            {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Fechar comanda"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        )
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
                <DialogHeader className="p-8 pb-0">
                    <DialogTitle className="text-2xl font-black text-arena-navy-800">
                        Registrar pagamento
                    </DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="p-8 space-y-6">
                        <div className="space-y-2">
                            <FormLabel className="text-arena-navy-800/60 font-bold text-sm">Valor pago</FormLabel>
                            <FormField
                                control={form.control}
                                name="amount"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <Input
                                                placeholder="R$ 0,00"
                                                {...field}
                                                className="h-12 border-arena-navy-800/10 focus:ring-arena-button focus:border-arena-button rounded-xl font-bold text-arena-navy-800"
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="space-y-2">
                            <FormLabel className="text-arena-navy-800/60 font-bold text-sm">Forma de pagamento</FormLabel>
                            <FormField
                                control={form.control}
                                name="payment_method"
                                render={({ field }) => (
                                    <FormItem>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="h-12 border-arena-navy-800/10 rounded-xl font-bold text-arena-navy-800/40">
                                                    <SelectValue placeholder="Selecione a forma de pagamento" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="rounded-xl border-arena-navy-800/10">
                                                <SelectItem value="Cartão de crédito">Cartão de crédito</SelectItem>
                                                <SelectItem value="Cartão de débito">Cartão de débito</SelectItem>
                                                <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                                                <SelectItem value="Pix">Pix</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="space-y-2">
                            <FormLabel className="text-arena-navy-800/60 font-bold text-sm">Observação (opcional)</FormLabel>
                            <FormField
                                control={form.control}
                                name="observation"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <Input
                                                {...field}
                                                className="h-12 border-arena-navy-800/10 focus:ring-arena-button focus:border-arena-button rounded-xl font-medium text-arena-navy-800"
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="space-y-2">
                            <FormLabel className="text-arena-navy-800/60 font-bold text-sm">Pago por (opcional)</FormLabel>
                            <FormField
                                control={form.control}
                                name="paid_by_name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <Input
                                                placeholder="Nome de quem pagou"
                                                {...field}
                                                className="h-12 border-arena-navy-800/10 focus:ring-arena-button focus:border-arena-button rounded-xl font-medium text-arena-navy-800"
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        </div>

                        <DialogFooter className="pt-6 border-t border-gray-100 flex flex-row items-center gap-3 w-full">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleClose}
                                className="flex-1 font-bold h-12 rounded-xl text-arena-navy-800/60 border-arena-navy-800/10"
                            >
                                Fechar
                            </Button>
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex-1 bg-arena-button hover:bg-arena-button-hover text-white font-bold h-12 rounded-xl shadow-lg shadow-arena-button/20"
                            >
                                {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Salvar"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
