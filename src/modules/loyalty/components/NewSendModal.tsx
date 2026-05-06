"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useUser } from "@clerk/nextjs"
import { Search, Save, X, Loader2, Check } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
import { searchAthletesAction, createCreditTransactionAction } from "../actions/loyaltyActions"
import { normalizeString } from "@/lib/utils"
import { toast } from "sonner"

interface Athlete {
    id: string;
    nome_perfil: string;
    telefone: string;
}

interface NewSendModalProps {
    arenaId: string;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function NewSendModal({ arenaId, isOpen, onClose, onSuccess }: NewSendModalProps) {
    const [search, setSearch] = useState("")
    const [athletes, setAthletes] = useState<Athlete[]>([])
    const [selectedAthlete, setSelectedAthlete] = useState<Athlete | null>(null)
    const [isSearching, setIsSearching] = useState(false)
    const [quantity, setQuantity] = useState("")
    const [validity, setValidity] = useState("indeterminate")
    const [description, setDescription] = useState("")
    const [isSaving, setIsSaving] = useState(false)

    // Manual debounce implementation
    const searchTimeout = useRef<NodeJS.Timeout | null>(null)

    const handleSearch = (value: string) => {
        setSearch(value)
        if (selectedAthlete) setSelectedAthlete(null)

        if (searchTimeout.current) clearTimeout(searchTimeout.current)

        if (value.length < 2) {
            setAthletes([])
            return
        }

        setIsSearching(true)
        searchTimeout.current = setTimeout(async () => {
            try {
                // Fetch all athletes for the arena to filter in frontend (accent-insensitive)
                const result = await searchAthletesAction(arenaId)
                if (result.success && result.data) {
                    const normalizedSearch = normalizeString(value);
                    const filtered = (result.data as Athlete[]).filter(athlete =>
                        athlete && normalizeString(athlete.nome_perfil).includes(normalizedSearch)
                    );
                    setAthletes(filtered)
                }
            } catch (error) {
                console.error("Search error:", error)
            } finally {
                setIsSearching(false)
            }
        }, 500)
    }

    const handleSave = async () => {
        if (!selectedAthlete) {
            toast.error("Selecione um atleta")
            return
        }
        if (!quantity || isNaN(Number(quantity)) || Number(quantity) <= 0) {
            toast.error("Informe uma quantidade válida")
            return
        }

        try {
            setIsSaving(true)
            const result = await createCreditTransactionAction({
                arenaId,
                id_atleta: selectedAthlete.id,
                valor: Number(quantity),
                validade: validity,
                descricao: description
            })

            if (result.success) {
                toast.success("Envio realizado com sucesso!")
                resetForm()
                onSuccess()
                onClose()
            } else {
                toast.error(result.error || "Erro ao realizar envio")
            }
        } catch (error) {
            toast.error("Erro inesperado")
        } finally {
            setIsSaving(false)
        }
    }

    const resetForm = () => {
        setSearch("")
        setAthletes([])
        setSelectedAthlete(null)
        setQuantity("")
        setValidity("indeterminate")
        setDescription("")
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
                <DialogHeader className="p-6 pb-0">
                    <DialogTitle className="text-2xl font-bold text-arena-navy-800">Novo envio</DialogTitle>
                </DialogHeader>

                <div className="p-6 space-y-6">
                    {/* Atleta Search */}
                    <div className="space-y-2 relative">
                        <Label className="text-sm font-semibold text-arena-navy-800/70">Selecione o atleta</Label>
                        {!selectedAthlete ? (
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Nome do atleta"
                                    value={search}
                                    onChange={(e) => handleSearch(e.target.value)}
                                    className="pl-10 h-12 border-arena-navy-800/10 focus:ring-arena-button focus:border-arena-button rounded-lg"
                                />
                                {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-arena-button" />}

                                {athletes.length > 0 && (
                                    <div className="absolute z-50 w-full mt-1 bg-white border border-arena-navy-800/10 rounded-lg shadow-lg max-h-48 overflow-auto">
                                        {athletes.map((athlete) => athlete && (
                                            <button
                                                key={athlete.id}
                                                onClick={() => {
                                                    setSelectedAthlete(athlete)
                                                    setSearch(athlete.nome_perfil)
                                                    setAthletes([])
                                                }}
                                                className="w-full text-left px-4 py-3 hover:bg-[#FFF5EF] transition-colors flex items-center justify-between border-b border-arena-navy-800/5 last:border-0"
                                            >
                                                <div>
                                                    <p className="font-semibold text-arena-navy-800 text-sm">{athlete.nome_perfil}</p>
                                                    <p className="text-xs text-muted-foreground">{athlete.telefone}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center justify-between p-3 bg-[#FFF5EF] border border-[#FFE4D3] rounded-lg">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-arena-button/10 flex items-center justify-center">
                                        <Check className="h-4 w-4 text-arena-button" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-arena-navy-800 text-sm">{selectedAthlete.nome_perfil}</p>
                                        <p className="text-xs text-muted-foreground">{selectedAthlete.telefone}</p>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setSelectedAthlete(null)}
                                    className="hover:bg-red-50 text-red-500"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Quantidade */}
                        <div className="space-y-2 text-left">
                            <Label className="text-sm font-semibold text-arena-navy-800/70">Quantidade</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">$</span>
                                <Input
                                    placeholder="00"
                                    type="number"
                                    value={quantity}
                                    onChange={(e) => setQuantity(e.target.value)}
                                    className="pl-7 h-12 border-arena-navy-800/10 focus:ring-arena-button focus:border-arena-button rounded-lg"
                                />
                            </div>
                        </div>

                        {/* Validade */}
                        <div className="space-y-2 text-left">
                            <Label className="text-sm font-semibold text-arena-navy-800/70">Validade</Label>
                            <Select value={validity} onValueChange={setValidity}>
                                <SelectTrigger className="h-12 border-arena-navy-800/10 focus:ring-arena-button focus:border-arena-button rounded-lg">
                                    <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-arena-navy-800/10">
                                    <SelectItem value="indeterminate" className="rounded-lg">Indeterminado</SelectItem>
                                    <SelectItem value="1_mes" className="rounded-lg">1 mês</SelectItem>
                                    <SelectItem value="2_meses" className="rounded-lg">2 meses</SelectItem>
                                    <SelectItem value="3_meses" className="rounded-lg">3 meses</SelectItem>
                                    <SelectItem value="6_meses" className="rounded-lg">6 meses</SelectItem>
                                    <SelectItem value="1_ano" className="rounded-lg">1 ano</SelectItem>
                                    <SelectItem value="2_anos" className="rounded-lg">2 anos</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Descrição */}
                    <div className="space-y-2 text-left">
                        <Label className="text-sm font-semibold text-arena-navy-800/70">Descrição (opcional)</Label>
                        <Input
                            placeholder="Ex: Bônus de aniversário"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="h-12 border-arena-navy-800/10 focus:ring-arena-button focus:border-arena-button rounded-lg"
                        />
                    </div>
                </div>

                <DialogFooter className="p-6 bg-gray-50 flex gap-3 sm:gap-0 sm:justify-between items-center rounded-b-2xl">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="flex-1 h-12 border-arena-navy-800/10 text-arena-navy-800 hover:bg-gray-100 font-semibold rounded-xl"
                    >
                        Fechar
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex-1 h-12 bg-arena-button hover:bg-arena-button-hover text-white font-bold rounded-xl shadow-lg shadow-arena-button/20 transition-all active:scale-95 gap-2"
                    >
                        {isSaving ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <Save className="h-5 w-5" />
                        )}
                        Enviar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
