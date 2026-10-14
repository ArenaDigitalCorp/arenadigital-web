"use client"

import { useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { ConfirmActionDialog } from "@/components/dashboard/ConfirmActionDialog"
import { toast } from "sonner"
import { Check, Loader2, Pencil, Plus, Tags, Trash, X } from "lucide-react"
import {
    createTransactionCategoryAction,
    deleteTransactionCategoryAction,
    updateTransactionCategoryAction,
} from "@/modules/finance/actions/transactionCategoryActions"
import type { TransactionCategory } from "@/modules/finance/types/finance.types"
import { cn } from "@/lib/utils"

interface Props {
    arenaId: string;
    initialCategories: TransactionCategory[];
}

const inputClass =
    "h-10 rounded-lg bg-white border-slate-300 text-slate-800 shadow-none placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-[#20B2AA]";

export function CadastrosAuxiliaresPageClient({ arenaId, initialCategories }: Props) {
    const [categories, setCategories] = useState<TransactionCategory[]>(initialCategories);

    return (
        <div className="space-y-8 pb-10">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-black text-arena-navy-800 tracking-tight">Cadastros Auxiliares</h1>
                <p className="text-arena-navy-800/60 font-medium">
                    Gerencie os tipos de lançamento que aparecem nos formulários de Entrada e Saída do Caixa.
                </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <CategoryTypeSection
                    arenaId={arenaId}
                    type="entrada"
                    title="Categorias de Entrada"
                    categories={categories.filter((c) => c.type === "entrada")}
                    onChanged={setCategories}
                    allCategories={categories}
                />
                <CategoryTypeSection
                    arenaId={arenaId}
                    type="saída"
                    title="Categorias de Saída"
                    categories={categories.filter((c) => c.type === "saída")}
                    onChanged={setCategories}
                    allCategories={categories}
                />
            </div>
        </div>
    );
}

interface CategoryTypeSectionProps {
    arenaId: string;
    type: "entrada" | "saída";
    title: string;
    categories: TransactionCategory[];
    allCategories: TransactionCategory[];
    onChanged: (categories: TransactionCategory[]) => void;
}

function CategoryTypeSection({ arenaId, type, title, categories, allCategories, onChanged }: CategoryTypeSectionProps) {
    const [newName, setNewName] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState("");
    const [busyId, setBusyId] = useState<string | null>(null);
    const [categoryPendingDelete, setCategoryPendingDelete] = useState<TransactionCategory | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const sorted = useMemo(
        () => [...categories].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
        [categories]
    );

    const replaceCategory = (updated: TransactionCategory) => {
        onChanged(allCategories.map((c) => (c.id === updated.id ? updated : c)));
    };

    const removeCategory = (id: string) => {
        onChanged(allCategories.filter((c) => c.id !== id));
    };

    const handleCreate = async () => {
        const name = newName.trim();
        if (name.length < 2) {
            toast.error("Informe um nome com pelo menos 2 caracteres");
            return;
        }
        setIsCreating(true);
        try {
            const res = await createTransactionCategoryAction(arenaId, { name, type });
            if (!res.success || !res.data) throw new Error(res.error);
            toast.success("Categoria criada com sucesso");
            setNewName("");
            onChanged([...allCategories, res.data]);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Erro ao criar categoria");
        } finally {
            setIsCreating(false);
        }
    };

    const startEdit = (category: TransactionCategory) => {
        setEditingId(category.id);
        setEditingName(category.name);
    };

    const handleRename = async (category: TransactionCategory) => {
        const name = editingName.trim();
        if (name === category.name) {
            setEditingId(null);
            return;
        }
        setBusyId(category.id);
        try {
            const res = await updateTransactionCategoryAction(arenaId, category.id, { name });
            if (!res.success || !res.data) throw new Error(res.error);
            toast.success("Categoria renomeada");
            setEditingId(null);
            replaceCategory(res.data);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Erro ao renomear categoria");
        } finally {
            setBusyId(null);
        }
    };

    const handleToggleActive = async (category: TransactionCategory, active: boolean) => {
        setBusyId(category.id);
        try {
            const res = await updateTransactionCategoryAction(arenaId, category.id, { active });
            if (!res.success || !res.data) throw new Error(res.error);
            toast.success(active ? "Categoria ativada" : "Categoria inativada");
            replaceCategory(res.data);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Erro ao atualizar categoria");
        } finally {
            setBusyId(null);
        }
    };

    const confirmDelete = async () => {
        if (!categoryPendingDelete) return;
        setIsDeleting(true);
        try {
            const res = await deleteTransactionCategoryAction(arenaId, categoryPendingDelete.id);
            if (!res.success) throw new Error(res.error);
            toast.success("Categoria excluída");
            removeCategory(categoryPendingDelete.id);
            setCategoryPendingDelete(null);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Erro ao excluir categoria");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <>
            <Card className="border-none shadow-xl rounded-2xl bg-white p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Tags className="h-5 w-5 text-arena-button" />
                    <h2 className="text-lg font-bold text-arena-navy-800">{title}</h2>
                </div>

                <div className="flex items-center gap-2">
                    <Input
                        placeholder={`Nova categoria de ${type}`}
                        className={inputClass}
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                handleCreate();
                            }
                        }}
                    />
                    <Button
                        type="button"
                        onClick={handleCreate}
                        disabled={isCreating}
                        className="h-10 shrink-0 rounded-md bg-arena-button px-4 text-sm font-bold text-white shadow-none hover:bg-arena-button-hover"
                    >
                        {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    </Button>
                </div>

                <div className="mt-4 space-y-2">
                    {sorted.length === 0 ? (
                        <p className="py-8 text-center text-sm text-arena-navy-800/40">
                            Nenhuma categoria cadastrada ainda.
                        </p>
                    ) : (
                        sorted.map((category) => {
                            const isEditing = editingId === category.id;
                            const isBusy = busyId === category.id;
                            return (
                                <div
                                    key={category.id}
                                    className={cn(
                                        "flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3",
                                        !category.active && "bg-slate-50 opacity-70"
                                    )}
                                >
                                    <div className="flex-1 min-w-0">
                                        {isEditing ? (
                                            <Input
                                                autoFocus
                                                className="h-9 rounded-lg border-slate-300 text-sm"
                                                value={editingName}
                                                onChange={(e) => setEditingName(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        e.preventDefault();
                                                        handleRename(category);
                                                    }
                                                    if (e.key === "Escape") setEditingId(null);
                                                }}
                                            />
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <span className="truncate text-sm font-semibold text-arena-navy-800">
                                                    {category.name}
                                                </span>
                                                {!category.active && (
                                                    <Badge className="shrink-0 bg-slate-400 text-[10px] font-bold uppercase text-white hover:bg-slate-400">
                                                        Inativa
                                                    </Badge>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex shrink-0 items-center gap-1.5">
                                        {isBusy ? (
                                            <Loader2 className="h-4 w-4 animate-spin text-arena-button" />
                                        ) : isEditing ? (
                                            <>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                                                    onClick={() => handleRename(category)}
                                                    aria-label="Salvar nome"
                                                >
                                                    <Check className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-slate-500 hover:bg-slate-100"
                                                    onClick={() => setEditingId(null)}
                                                    aria-label="Cancelar edição"
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </>
                                        ) : (
                                            <>
                                                <Switch
                                                    checked={category.active}
                                                    onCheckedChange={(checked) => handleToggleActive(category, checked)}
                                                    aria-label={category.active ? "Inativar categoria" : "Ativar categoria"}
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-arena-navy-800/60 hover:bg-slate-100 hover:text-arena-navy-800"
                                                    onClick={() => startEdit(category)}
                                                    aria-label="Renomear categoria"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                                                    onClick={() => setCategoryPendingDelete(category)}
                                                    aria-label="Excluir categoria"
                                                    title="Excluir categoria"
                                                >
                                                    <Trash className="h-4 w-4" />
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </Card>

            <ConfirmActionDialog
                open={!!categoryPendingDelete}
                onOpenChange={(o) => {
                    if (!o && !isDeleting) setCategoryPendingDelete(null);
                }}
                title="Excluir categoria"
                description={`Tem certeza que deseja excluir a categoria "${categoryPendingDelete?.name ?? ""}"? Se houver lançamentos com esta categoria, a exclusão será bloqueada — use "inativar" nesse caso. Essa ação não pode ser desfeita.`}
                confirmLabel="Excluir"
                loadingLabel="Excluindo..."
                loading={isDeleting}
                onConfirm={confirmDelete}
            />
        </>
    );
}
