"use client"

import { useForm } from "react-hook-form";
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
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FinanceService } from "../services/financeService";
import { AthleteService } from "@/modules/athletes/services/athleteService";
import { supabase } from "@/shared/database/supabaseClient";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { transactionSchema, type TransactionFormValues } from "@/modules/finance/schemas/transaction.schema";

interface Atleta {
    id: string;
    name: string;
}

interface ModoPagamento {
    id: string;
    nome: string;
}

export interface TransactionData {
    id: string;
    type: "entrada" | "saída";
    category: string;
    description: string;
    quantity: number;
    unit_value: number;
    discount: number;
    total_value: number;
    launch_date: string;
    registration_date: string;
    atleta_id?: string | null;
    atleta?: { id: string; nome_perfil: string } | null;
    modo_pagamento_id?: string | null;
    modo_pagamento?: { id: string; nome: string } | null;
}

interface TransactionFormProps {
    arenaId: string;
    registeredBy: string;
    type?: "entrada" | "saída";
    /** Quando fornecido, o formulário entra em modo de edição */
    transaction?: TransactionData;
    onSuccess: () => void;
    onCancel: () => void;
}

export function TransactionForm({
    arenaId,
    registeredBy,
    type = "entrada",
    transaction,
    onSuccess,
    onCancel,
}: TransactionFormProps) {
    const isEditing = !!transaction;
    const effectiveType = transaction?.type ?? type;

    const [atletas, setAtletas] = useState<Atleta[]>([]);
    const [isAtletaOpen, setIsAtletaOpen] = useState(false);
    const [selectedAtleta, setSelectedAtleta] = useState<Atleta | null>(
        transaction?.atleta
            ? { id: transaction.atleta.id, name: transaction.atleta.nome_perfil }
            : null
    );
    const [modosPagamento, setModosPagamento] = useState<ModoPagamento[]>([]);

    const form = useForm<TransactionFormValues>({
        resolver: zodResolver(transactionSchema) as any,
        defaultValues: {
            type: effectiveType,
            category: transaction?.category ?? "",
            description: transaction?.description ?? "",
            quantity: transaction?.quantity ?? 1,
            unit_value: transaction?.unit_value ?? 0,
            discount: transaction?.discount ?? 0,
            total_value: transaction?.total_value ?? 0,
            launch_date: transaction?.launch_date?.split("T")[0] ?? new Date().toISOString().split("T")[0],
            registration_date: transaction?.registration_date?.split("T")[0] ?? new Date().toISOString().split("T")[0],
            atleta_id: transaction?.atleta_id ?? undefined,
            modo_pagamento_id: transaction?.modo_pagamento_id ?? undefined,
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

    // Carregar modos de pagamento
    useEffect(() => {
        async function loadModosPagamento() {
            try {
                const { data, error } = await supabase
                    .from('modo_pagamento')
                    .select('id, nome')
                    .order('nome');
                if (error) throw error;
                setModosPagamento(data ?? []);
            } catch (err) {
                console.error("Erro ao carregar modos de pagamento:", err);
            }
        }
        loadModosPagamento();
    }, []);

    // Carregar atletas da carteira da arena (somente para entradas)
    useEffect(() => {
        if (effectiveType !== "entrada") return;
        async function loadAtletas() {
            try {
                const data = await AthleteService.getAthletesByArena(arenaId);
                setAtletas(data);
            } catch (err) {
                console.error("Erro ao carregar atletas:", err);
            }
        }
        loadAtletas();
    }, [arenaId, effectiveType]);

    const onSubmit = async (values: any) => {
        try {
            if (isEditing && transaction) {
                await FinanceService.updateTransaction(transaction.id, {
                    ...values,
                    atleta_id: values.atleta_id || null,
                    modo_pagamento_id: values.modo_pagamento_id || null,
                });
                toast.success("Lançamento atualizado com sucesso!");
            } else {
                await FinanceService.createTransaction({
                    ...values,
                    arena_id: arenaId,
                    registered_by: registeredBy,
                    atleta_id: values.atleta_id || null,
                    modo_pagamento_id: values.modo_pagamento_id || null,
                });
                toast.success("Lançamento realizado com sucesso!");
            }
            onSuccess();
        } catch (error) {
            toast.error(isEditing ? "Erro ao atualizar lançamento." : "Erro ao realizar lançamento.");
        }
    };

    const categories = effectiveType === "entrada"
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
                            <Select onValueChange={field.onChange} value={field.value}>
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
                    name="modo_pagamento_id"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Modo de Pagamento</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value ?? ""}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione o modo de pagamento" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {modosPagamento.map(mp => (
                                        <SelectItem key={mp.id} value={mp.id}>{mp.nome}</SelectItem>
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

                {/* Campo de Atleta — somente para entradas */}
                {effectiveType === "entrada" && (
                    <FormField
                        control={form.control}
                        name="atleta_id"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="flex items-center gap-1.5">
                                    Atleta
                                    <span className="text-[10px] font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                        opcional
                                    </span>
                                </FormLabel>
                                <div className="flex gap-2">
                                    <Popover open={isAtletaOpen} onOpenChange={setIsAtletaOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={isAtletaOpen}
                                                className={cn(
                                                    "flex-1 justify-between font-normal",
                                                    !selectedAtleta && "text-muted-foreground"
                                                )}
                                            >
                                                {selectedAtleta ? selectedAtleta.name : "Selecione um atleta…"}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[280px] p-0" align="start">
                                            <Command>
                                                <CommandInput placeholder="Buscar atleta..." />
                                                <CommandList>
                                                    <CommandEmpty>Nenhum atleta encontrado.</CommandEmpty>
                                                    <CommandGroup>
                                                        {atletas.map((atleta) => (
                                                            <CommandItem
                                                                key={atleta.id}
                                                                value={atleta.name}
                                                                onSelect={() => {
                                                                    setSelectedAtleta(atleta);
                                                                    field.onChange(atleta.id);
                                                                    setIsAtletaOpen(false);
                                                                }}
                                                            >
                                                                <Check
                                                                    className={cn(
                                                                        "mr-2 h-4 w-4",
                                                                        field.value === atleta.id ? "opacity-100" : "opacity-0"
                                                                    )}
                                                                />
                                                                {atleta.name}
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                    {selectedAtleta && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="shrink-0 text-muted-foreground hover:text-destructive"
                                            onClick={() => {
                                                setSelectedAtleta(null);
                                                field.onChange(undefined);
                                            }}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}

                <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="outline" onClick={onCancel} className="flex-1 border-[#002B40]/20 text-[#002B40]">
                        Fechar
                    </Button>
                    <Button type="submit" className="flex-1 bg-[#FF6B00] hover:bg-[#E66000] text-white font-bold">
                        {isEditing ? "Salvar alterações" : "Salvar"}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
