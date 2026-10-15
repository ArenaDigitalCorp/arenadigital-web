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
import { DecimalInput } from "@/components/ui/decimal-input";
import { formatDecimalInput, parseBrazilianDecimal } from "@/lib/format";
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
import { createTransactionAction, updateTransactionAction, getModoPagamentoAction } from "@/modules/finance/actions/financeActions";
import { getTransactionCategoriesAction } from "@/modules/finance/actions/transactionCategoryActions";
import { getAthletesByArenaAction } from "@/modules/athletes/actions/athleteActions";
import { toast } from "sonner";
import { trackAction } from "@/lib/telemetry/client";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { integerInput } from "@/shared/schemas/numeric.schema";
import { transactionSchema, type TransactionFormValues } from "@/modules/finance/schemas/transaction.schema";

// Keep the user's text while editing; convert complete BRL values only at
// validation/submission boundaries. An omitted optional discount means zero.
const transactionInputSchema = transactionSchema.extend({
    quantity: integerInput(zod.number().int("Informe uma quantidade inteira").min(1, "Mínimo 1").max(100000)),
    unit_value: zod.preprocess(value =>
        typeof value === "string" || typeof value === "number" ? parseBrazilianDecimal(value) : undefined,
        zod.number({ error: "Informe um valor unitário válido" }).min(0.01, "Mínimo R$ 0,01").max(99999999.99)),
    discount: zod.preprocess(value =>
        typeof value === "string" && value.trim() === "" ? 0
            : typeof value === "string" || typeof value === "number" ? parseBrazilianDecimal(value) : undefined,
        zod.number({ error: "Informe um desconto válido" }).min(0, "Mínimo 0").max(99999999.99)),
    total_value: zod.number().finite().min(0).max(99999999.99),
});

function calculatedTotal(quantity: number | string, unit: number | string, discount: number | string) {
    const count = Number(quantity);
    const unitAmount = parseBrazilianDecimal(unit);
    const discountAmount = typeof discount === "string" && discount.trim() === "" ? 0 : parseBrazilianDecimal(discount);
    if (!Number.isFinite(count) || unitAmount === null || discountAmount === null) return 0;
    const total = count * unitAmount - discountAmount;
    return Number.isFinite(total) ? Number(Math.max(0, total).toFixed(2)) : 0;
}

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
    const [categoryOptions, setCategoryOptions] = useState<string[]>([]);

    const form = useForm<TransactionFormValues>({
        resolver: zodResolver(transactionInputSchema) as any,
        defaultValues: {
            type: effectiveType,
            category: transaction?.category ?? "",
            description: transaction?.description ?? "",
            quantity: transaction?.quantity ?? 1,
            unit_value: transaction?.unit_value ?? 0,
            discount: transaction?.discount ?? 0,
            total_value: transaction?.total_value ?? 0,
            launch_date: transaction?.launch_date?.split("T")[0] ?? format(new Date(), "yyyy-MM-dd"),
            registration_date: transaction?.registration_date?.split("T")[0] ?? format(new Date(), "yyyy-MM-dd"),
            atleta_id: transaction?.atleta_id ?? undefined,
            modo_pagamento_id: transaction?.modo_pagamento_id ?? undefined,
        },
    });

    const { watch, setValue, control } = form;
    const quantity = watch("quantity");
    const unitValue = watch("unit_value");
    const discount = watch("discount");

    useEffect(() => {
        setValue("total_value", calculatedTotal(quantity, unitValue, discount));
    }, [quantity, unitValue, discount, setValue]);

    // Carregar modos de pagamento
    useEffect(() => {
        async function loadModosPagamento() {
            try {
                const res = await getModoPagamentoAction();
                setModosPagamento(res.data ?? []);
            } catch (err) {
                console.error("Erro ao carregar modos de pagamento:", err);
            }
        }
        loadModosPagamento();
    }, []);

    // Carregar categorias de lançamento cadastradas pela arena (Cadastros Auxiliares)
    useEffect(() => {
        async function loadCategories() {
            try {
                const res = await getTransactionCategoriesAction(arenaId);
                const names = (res.data ?? [])
                    .filter((c) => c.type === effectiveType && c.active)
                    .map((c) => c.name);
                setCategoryOptions(names);
            } catch (err) {
                console.error("Erro ao carregar categorias de lançamento:", err);
            }
        }
        loadCategories();
    }, [arenaId, effectiveType]);

    // Carregar atletas da carteira da arena (somente para entradas)
    useEffect(() => {
        if (effectiveType !== "entrada") return;
        async function loadAtletas() {
            try {
                const res = await getAthletesByArenaAction(arenaId);
                setAtletas(res.data ?? []);
            } catch (err) {
                console.error("Erro ao carregar atletas:", err);
            }
        }
        loadAtletas();
    }, [arenaId, effectiveType]);

    const onSubmit = async (input: TransactionFormValues) => {
        const parsed = transactionInputSchema.safeParse({
            ...input,
            total_value: calculatedTotal(input.quantity, input.unit_value, input.discount),
        });
        if (!parsed.success) {
            for (const issue of parsed.error.issues) {
                const field = issue.path[0] as keyof TransactionFormValues;
                if (field) form.setError(field, { type: "validate", message: issue.message });
            }
            return;
        }
        const values = parsed.data;
        try {
            if (isEditing && transaction) {
                const res = await updateTransactionAction(arenaId, transaction.id, {
                    ...values,
                    atleta_id: values.atleta_id || null,
                    modo_pagamento_id: values.modo_pagamento_id || null,
                });
                if (!res.success) throw new Error(res.error)
                trackAction("finance_transaction", "success", {
                    arena_id: arenaId,
                    entity_id: transaction.id,
                    entity_type: "transaction",
                    edit_mode: true,
                });
                toast.success("Lançamento atualizado com sucesso!");
            } else {
                const res = await createTransactionAction(arenaId, {
                    ...values,
                    atleta_id: values.atleta_id || null,
                    modo_pagamento_id: values.modo_pagamento_id || null,
                });
                if (!res.success) throw new Error(res.error)
                trackAction("finance_transaction", "success", {
                    arena_id: arenaId,
                    entity_type: "transaction",
                    edit_mode: false,
                });
                toast.success("Lançamento realizado com sucesso!");
            }
            onSuccess();
        } catch (error) {
            trackAction("finance_transaction", "failure", {
                arena_id: arenaId,
                entity_type: "transaction",
                edit_mode: isEditing,
                source: error instanceof Error ? "exception" : "unknown_error",
            });
            toast.error(isEditing ? "Erro ao atualizar lançamento." : "Erro ao realizar lançamento.");
        }
    };

    // Inclui a categoria atual do lançamento mesmo que tenha sido inativada/renomeada
    // depois, para não deixar o Select em branco ao editar um lançamento antigo.
    const categories = transaction?.category && !categoryOptions.includes(transaction.category)
        ? [transaction.category, ...categoryOptions]
        : categoryOptions;

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-0 pt-2">
                <div className="overflow-y-auto max-h-[calc(100svh-14rem)] pr-1 space-y-4 pb-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                <DecimalInput {...field} value={typeof field.value === "number" ? formatDecimalInput(field.value) : field.value} />
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
                                <DecimalInput {...field} value={typeof field.value === "number" ? formatDecimalInput(field.value) : field.value} />
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
                                <DecimalInput {...field} disabled value={formatDecimalInput(field.value)} />
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

                </div>{/* fim scroll */}

                <div className="flex justify-end gap-3 pt-4 border-t border-arena-navy-800/5 mt-2">
                    <Button type="button" variant="outline" onClick={onCancel} className="flex-1 border-arena-navy-800/20 text-arena-navy-800">
                        Fechar
                    </Button>
                    <Button type="submit" className="flex-1 bg-arena-button hover:bg-arena-button-hover text-white font-bold">
                        {isEditing ? "Salvar alterações" : "Salvar"}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
