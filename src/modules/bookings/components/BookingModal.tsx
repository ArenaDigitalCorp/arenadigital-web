"use client"

import { useState, useEffect, useRef } from "react"
import { Search, Save, X, Loader2, Check, Calendar as CalendarIcon, Clock } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
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
import { searchAthletesAction } from "@/modules/loyalty/actions/loyaltyActions"
import { getArenaByIdAction } from "@/modules/arenas/actions/arenaActions"
import { createBookingAction, createRecurringBookingsAction } from "@/modules/bookings/actions/bookingActions"
import { toast } from "sonner"
import { format, addHours, parse, addWeeks } from "date-fns"
import { ptBR } from "date-fns/locale"
import { cn, normalizeString } from "@/lib/utils"

interface Athlete {
    id: string;
    nome_perfil: string;
    telefone: string;
}

interface Sport {
    id: string;
    name: string;
}

interface BookingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    arenaId: string;
    courtId: string;
    selectedDate: Date;
    selectedHour: number;
    defaultPrice: number;
}

export function BookingModal({ isOpen, onClose, onSuccess, arenaId, courtId, selectedDate, selectedHour, defaultPrice }: BookingModalProps) {
    const [search, setSearch] = useState("")
    const [athletes, setAthletes] = useState<Athlete[]>([])
    const [selectedAthlete, setSelectedAthlete] = useState<Athlete | null>(null)
    const [isSearching, setIsSearching] = useState(false)
    const [startTime, setStartTime] = useState("")
    const [endTime, setEndTime] = useState("")
    const [price, setPrice] = useState(defaultPrice.toString())
    const [selectedSport, setSelectedSport] = useState<string>("")
    const [arenaSports, setArenaSports] = useState<Sport[]>([])
    const [isSaving, setIsSaving] = useState(false)
    const [isLoadingSports, setIsLoadingSports] = useState(false)

    // Recorrência
    const [isRecurring, setIsRecurring] = useState(false)
    const [recurrenceWeeks, setRecurrenceWeeks] = useState(12) // Default 3 months

    const searchTimeout = useRef<NodeJS.Timeout | null>(null)

    useEffect(() => {
        if (isOpen) {
            const startStr = `${String(selectedHour).padStart(2, '0')}:00`
            const endStr = `${String(selectedHour + 1).padStart(2, '0')}:00`
            setStartTime(startStr)
            setEndTime(endStr)
            setPrice(defaultPrice.toString())
            loadArenaSports()
        }
    }, [isOpen, selectedHour, defaultPrice])

    async function loadArenaSports() {
        try {
            setIsLoadingSports(true)
            const res = await getArenaByIdAction(arenaId)
            if (res.data && res.data.sports) {
                setArenaSports(res.data.sports)
                if (res.data.sports.length > 0) {
                    setSelectedSport(res.data.sports[0].id)
                }
            }
        } catch (error) {
            console.error("Error loading sports:", error)
        } finally {
            setIsLoadingSports(false)
        }
    }

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
        if (!selectedAthlete && !search) {
            toast.error("Informe o nome do responsável")
            return
        }

        try {
            setIsSaving(true)

            // Construct full timestamps
            const startDateTime = new Date(selectedDate)
            const [sH, sM] = startTime.split(':').map(Number)
            startDateTime.setHours(sH, sM, 0, 0)

            const endDateTime = new Date(selectedDate)
            const [eH, eM] = endTime.split(':').map(Number)
            endDateTime.setHours(eH, eM, 0, 0)

            if (isRecurring) {
                const recurrenceId = (typeof crypto !== 'undefined' && crypto.randomUUID)
                    ? crypto.randomUUID()
                    : Math.random().toString(36).substring(2, 15);
                const bookingsToCreate = []

                for (let i = 0; i < recurrenceWeeks; i++) {
                    const currentStartDate = addWeeks(startDateTime, i)
                    const currentEndDate = addWeeks(endDateTime, i)

                    bookingsToCreate.push({
                        arena_id: arenaId,
                        court_id: courtId,
                        athlete_name: selectedAthlete ? selectedAthlete.nome_perfil : search,
                        athlete_id: selectedAthlete?.id || undefined,
                        sport_id: selectedSport || undefined,
                        start_time: currentStartDate.toISOString(),
                        end_time: currentEndDate.toISOString(),
                        status: 'confirmed' as const,
                        price: Number(price),
                        recurrence_id: recurrenceId
                    })
                }

                await createRecurringBookingsAction(arenaId, bookingsToCreate)
            } else {
                await createBookingAction(arenaId, {
                    arena_id: arenaId,
                    court_id: courtId,
                    athlete_name: selectedAthlete ? selectedAthlete.nome_perfil : search,
                    athlete_id: selectedAthlete?.id || undefined,
                    sport_id: selectedSport || undefined,
                    start_time: startDateTime.toISOString(),
                    end_time: endDateTime.toISOString(),
                    status: 'confirmed',
                    price: Number(price)
                })
            }

            toast.success(isRecurring ? "Agenda recorrente criada com sucesso!" : "Reserva criada com sucesso!")
            onSuccess()
            onClose()
            resetForm()
        } catch (error) {
            toast.error("Erro ao criar reserva")
        } finally {
            setIsSaving(false)
        }
    }

    const resetForm = () => {
        setSearch("")
        setAthletes([])
        setSelectedAthlete(null)
        setSelectedSport("")
        setIsRecurring(false)
        setRecurrenceWeeks(12)
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
                <DialogHeader className="p-8 pb-4">
                    <DialogTitle className="text-2xl font-black text-[#002B40] tracking-tight">Cadastrar nova reserva</DialogTitle>
                </DialogHeader>

                <ScrollArea className="max-h-[70vh] px-8">
                    <div className="space-y-6 pb-8">
                        {/* Data */}
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase text-[#002B40]/40 tracking-wider">Data</Label>
                            <div className="relative">
                                <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#002B40]/20" />
                                <Input
                                    value={format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}
                                    readOnly
                                    className="pl-12 h-14 border-[#002B40]/10 bg-gray-50 focus:ring-0 rounded-xl font-bold text-[#002B40]"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Horário Início */}
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase text-[#002B40]/40 tracking-wider">Horário início</Label>
                                <div className="relative">
                                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#002B40]/20" />
                                    <Input
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                        placeholder="00h00"
                                        className="pl-12 h-14 border-[#002B40]/10 focus:ring-[#FF6B00] focus:border-[#FF6B00] rounded-xl font-bold text-[#002B40]"
                                    />
                                </div>
                            </div>

                            {/* Horário Fim */}
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase text-[#002B40]/40 tracking-wider">Horário fim</Label>
                                <div className="relative">
                                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#002B40]/20" />
                                    <Input
                                        value={endTime}
                                        onChange={(e) => setEndTime(e.target.value)}
                                        placeholder="00h00"
                                        className="pl-12 h-14 border-[#002B40]/10 focus:ring-[#FF6B00] focus:border-[#FF6B00] rounded-xl font-bold text-[#002B40]"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Responsável Search */}
                        <div className="space-y-2 relative">
                            <Label className="text-xs font-bold uppercase text-[#002B40]/40 tracking-wider">Nome do responsável</Label>
                            {!selectedAthlete ? (
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#002B40]/20" />
                                    <Input
                                        placeholder="Selecione um atleta vinculado ou insira um novo"
                                        value={search}
                                        onChange={(e) => handleSearch(e.target.value)}
                                        className="pl-12 h-14 border-[#002B40]/10 focus:ring-[#FF6B00] focus:border-[#FF6B00] rounded-xl font-bold text-[#002B40]"
                                    />
                                    {isSearching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-[#FF6B00]" />}

                                    {athletes.length > 0 && (
                                        <div className="absolute z-50 w-full mt-2 bg-white border border-[#002B40]/10 rounded-2xl shadow-2xl max-h-64 overflow-auto p-2">
                                            {athletes.map((athlete) => (
                                                <button
                                                    key={athlete.id}
                                                    onClick={() => {
                                                        setSelectedAthlete(athlete)
                                                        setSearch(athlete.nome_perfil)
                                                        setAthletes([])
                                                    }}
                                                    className="w-full text-left px-4 py-3 hover:bg-[#FFF5EF] transition-colors flex items-center justify-between rounded-xl mb-1 last:mb-0"
                                                >
                                                    <div>
                                                        <p className="font-bold text-[#002B40] text-sm">{athlete.nome_perfil}</p>
                                                        <p className="text-[10px] uppercase font-black text-[#002B40]/40 tracking-tight">{athlete.telefone}</p>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex items-center justify-between p-4 bg-[#FFF5EF] border border-[#FFE4D3] rounded-xl">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-full bg-[#FF6B00]/10 flex items-center justify-center">
                                            <Check className="h-5 w-5 text-[#FF6B00]" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-[#002B40] text-sm">{selectedAthlete.nome_perfil}</p>
                                            <p className="text-[10px] uppercase font-black text-[#002B40]/40 tracking-tight">{selectedAthlete.telefone}</p>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setSelectedAthlete(null)}
                                        className="h-8 w-8 hover:bg-red-50 text-red-500 rounded-lg"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Valor Pago */}
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase text-[#002B40]/40 tracking-wider">Valor pago</Label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#002B40]/40 font-bold">R$</span>
                                <Input
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value)}
                                    className="pl-12 h-14 border-[#002B40]/10 focus:ring-[#FF6B00] focus:border-[#FF6B00] rounded-xl font-bold text-[#002B40]"
                                />
                            </div>
                        </div>

                        {/* Esporte */}
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase text-[#002B40]/40 tracking-wider">Esporte</Label>
                            <Select value={selectedSport} onValueChange={setSelectedSport}>
                                <SelectTrigger className="h-14 border-[#002B40]/10 focus:ring-[#FF6B00] focus:border-[#FF6B00] rounded-xl font-bold text-[#002B40]">
                                    <SelectValue placeholder="Selecione o tipo de esporte" />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl border-[#002B40]/10 p-2">
                                    {arenaSports.map((sport) => (
                                        <SelectItem key={sport.id} value={sport.id} className="rounded-xl py-3 font-bold text-[#002B40]">
                                            {sport.name}
                                        </SelectItem>
                                    ))}
                                    {arenaSports.length === 0 && !isLoadingSports && (
                                        <div className="p-4 text-center text-xs text-muted-foreground">Nenhum esporte vinculado à arena</div>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Recorrência */}
                        <div className="pt-4 border-t border-dashed border-[#002B40]/10 flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-bold text-[#002B40]">Reserva Recorrente</Label>
                                    <p className="text-[10px] text-[#002B40]/40 font-medium whitespace-nowrap">Repetir este horário toda semana</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsRecurring(!isRecurring)}
                                    className={cn(
                                        "w-12 h-6 rounded-full transition-colors relative",
                                        isRecurring ? "bg-[#FF6B00]" : "bg-gray-200"
                                    )}
                                >
                                    <div className={cn(
                                        "absolute top-1 w-4 h-4 bg-white rounded-full transition-transform",
                                        isRecurring ? "left-7" : "left-1"
                                    )} />
                                </button>
                            </div>

                            {isRecurring && (
                                <div className="bg-[#FFF5EF] p-4 rounded-2xl border border-[#FF6B00]/10 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-black uppercase text-[#FF6B00]/60 tracking-wider">Duração (semanas)</Label>
                                        <div className="flex items-center gap-4">
                                            <Input
                                                type="number"
                                                value={recurrenceWeeks}
                                                onChange={(e) => setRecurrenceWeeks(parseInt(e.target.value) || 1)}
                                                className="h-12 border-[#FF6B00]/10 focus:ring--[#FF6B00] rounded-xl font-bold text-[#002B40] bg-white"
                                            />
                                            <div className="text-[10px] font-bold text-[#FF6B00]/60 leading-tight">
                                                Serão criadas {recurrenceWeeks} reservas<br />
                                                nas próximas {Math.ceil(recurrenceWeeks / 4)} meses
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </ScrollArea>

                <DialogFooter className="p-8 bg-gray-50 flex gap-4 sm:justify-between items-center rounded-b-3xl">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="flex-1 h-14 border-[#002B40]/20 text-[#002B40] hover:bg-white font-bold rounded-xl active:scale-95 transition-all"
                    >
                        Fechar
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex-1 h-14 bg-[#FF6B00] hover:bg-[#E66000] text-white font-black uppercase tracking-widest text-xs rounded-xl shadow-xl shadow-[#FF6B00]/20 transition-all active:scale-95 gap-2"
                    >
                        {isSaving ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <Check className="h-5 w-5" />
                        )}
                        Salvar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
