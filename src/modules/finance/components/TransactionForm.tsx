"use client"

import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as zod from "zod";
import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { FinanceService } from "../services/financeService";
import { toast } from "sonner";
import { useEffect } from "react";

const transactionSchema = zod.object({
    type: zod.enum(["entrada", "saída"]),
    category: zod.string().min(1, "Selecione uma categoria"),
    description: zod.string().min(3, "Mínimo de 3 caracteres"),
    quantity: zod.coerce.number().min(1, "Mínimo 1"),
    unit_value: zod.coerce.number().min(0.01, "Mínimo R$ 0,01"),
    discount: zod.coerce.number().min(0, "Mínimo 0"),
    total_value: zod.coerce.number(),
    launch_date: zod.string(),
    registration_date: zod.string(),
});

type TransactionFormValues = zod.infer<typeof transactionSchema>;

interface TransactionFormProps {
    arenaId: string;
    registeredBy: string;
    type?: "entrada" | "saída";
    onSuccess: () => void;
    onCancel: () => void;
}

export function TransactionForm({ arenaId, registeredBy, type = "entrada", onSuccess, onCancel }: TransactionFormProps) {
    const form = useForm<TransactionFormValues>({
        resolver: zodResolver(transactionSchema) as any,
        defaultValues: {
            type: type as "entrada" | "saída",
            category: "",
            description: "",
            quantity: 1,
            unit_value: 0,
            discount: 0,
            total_value: 0,
            launch_date: new Date().toISOString().split('T')[0],
            registration_date: new Date().toISOString().split('T')[0],
        },
    });

    const { watch, setValue, control } = form;
    const quantity = watch("quantity");
    const unitValue = watch("unit_value");
    const discount = watch("discount");

    useEffect(() => {
        const total = (Number(quantity) * Number(unitValue)) - Number(discount);
        setValue("total_value", Math.max(0, total));
    }, [quantity, unitValue, discount, setValue]);

    const onSubmit = async (values: any) => {
        try {
            await FinanceService.createTransaction({
                ...values,
                arena_id: arenaId,
                registered_by: registeredBy,
            });
            toast.success("Lançamento realizado com sucesso!");
            onSuccess();
        } catch (error) {
            toast.error("Erro ao realizar lançamento.");
        }
    }

    const categories = type === "entrada"
        ? ["Mensalidade", "Bar", "Loja", "Aluguel"]
        : ["Salário", "Manutenção", "Fornecedores", "Contas Fixas"];

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={control as any}
                        name="registration_date"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Data de registro</FormLabel>
                                <FormControl>
                                    <Input type="date" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="launch_date"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Data de lançamento</FormLabel>
                                <FormControl>
                                    <Input type="date" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Descrição</FormLabel>
                            <FormControl>
                                <Input placeholder="Insira o nome do lançamento" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Tipo de lançamento</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione o tipo" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {categories.map(cat => (
                                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Quantidade</FormLabel>
                            <FormControl>
                                <Input type="number" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="unit_value"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Valor unitário</FormLabel>
                            <FormControl>
                                <Input type="number" step="0.01" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="discount"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Desconto (se houver)</FormLabel>
                            <FormControl>
                                <Input type="number" step="0.01" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="total_value"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Total</FormLabel>
                            <FormControl>
                                <Input type="number" disabled {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="outline" onClick={onCancel} className="flex-1 border-[#002B40]/20 text-[#002B40]">
                        Fechar
                    </Button>
                    <Button type="submit" className="flex-1 bg-[#FF6B00] hover:bg-[#E66000] text-white font-bold">
                        Salvar
                    </Button>
                </div>
            </form>
        </Form>
    );
}
