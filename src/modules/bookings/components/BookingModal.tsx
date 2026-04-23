"use client"

import { useState, useEffect, useRef } from "react"
import { Search, Save, X, Loader2, Check, Calendar as CalendarIcon, Clock, Users, UserPlus } from "lucide-react"
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
import { createPlanoMensalistaAction } from "@/modules/bookings/actions/mensalistaActions"
import { AthleteRegistrationModal } from "@/modules/athletes/components/AthleteRegistrationModal"
import { toast } from "sonner"
import { format, addWeeks } from "date-fns"
import { ptBR } from "date-fns/locale"
import { cn, normalizeString } from "@/lib/utils"

const DIAS_SEMANA = [
    { value: 0, label: "Domingo" },
    { value: 1, label: "Segunda-feira" },
    { value: 2, label: "Terça-feira" },
    { value: 3, label: "Quarta-feira" },
    { value: 4, label: "Quinta-feira" },
    { value: 5, label: "Sexta-feira" },
    { value: 6, label: "Sábado" },
]

interface Athlete {
    id: string;
    nome_perfil: string;
    telefone: string;
}

interface Sport {
    id: string;
    name: string;
}

interface AthleteSearchFieldProps {
    search: string
    athletes: Athlete[]
    selectedAthlete: Athlete | null
    isSearching: boolean
    mensalista?: boolean
    onSearch: (value: string) => void
    onSelectAthlete: (athlete: Athlete) => void
    onClearAthlete: () => void
    onRegisterNew: () => void
}

function AthleteSearchField({
    search,
    athletes,
    selectedAthlete,
    isSearching,
    mensalista = false,
    onSearch,
    onSelectAthlete,
    onClearAthlete,
    onRegisterNew,
}: AthleteSearchFieldProps) {
    const showDropdown = search.length >= 2 && !selectedAthlete
    return (
        <div className="space-y-2 relative">
            <Label className="text-xs font-bold uppercase text-[#002B40]/40 tracking-wider">
                {mensalista ? "Atleta" : "Nome do responsável"}
            </Label>
            {!selectedAthlete ? (
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#002B40]/20" />
                    <Input
                        placeholder={mensalista ? "Buscar atleta vinculado à arena" : "Selecione um atleta vinculado ou insira um novo"}
                        value={search}
                        onChange={(e) => onSearch(e.target.value)}
                        className="pl-12 h-14 border-[#002B40]/10 focus:ring-[#FF6B00] focus:border-[#FF6B00] rounded-xl font-bold text-[#002B40]"
                    />
                    {isSearching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-[#FF6B00]" />}
                    {showDropdown && (athletes.length > 0 || !isSearching) && (
                        <div className="absolute z-50 w-full mt-2 bg-white border border-[#002B40]/10 rounded-2xl shadow-2xl max-h-48 overflow-auto p-2">
                            {athletes.map((athlete) => (
                                <button
                                    key={athlete.id}
                                    type="button"
                                    onClick={() => onSelectAthlete(athlete)}
                                    className={cn(
                                        "w-full text-left px-4 py-3 transition-colors flex items-center justify-between rounded-xl mb-1 last:mb-0",
                                        mensalista ? "hover:bg-amber-50" : "hover:bg-[#FFF5EF]"
                                    )}
                                >
                                    <div>
                                        <p className="font-bold text-[#002B40] text-sm">{athlete.nome_perfil}</p>
                                        <p className="text-[10px] uppercase font-black text-[#002B40]/40 tracking-tight">{athlete.telefone}</p>
                                    </div>
                                </button>
                            ))}
                            {athletes.length === 0 && !isSearching && (
                                <button
                                    type="button"
                                    onClick={onRegisterNew}
                                    className="w-full text-left px-4 py-3 transition-colors flex items-center gap-3 rounded-xl hover:bg-[#FFF5EF]"
                                >
                                    <div className="h-8 w-8 rounded-full bg-[#FF6B00]/10 flex items-center justify-center flex-shrink-0">
                                        <UserPlus className="h-4 w-4 text-[#FF6B00]" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-[#FF6B00] text-sm">Cadastrar &ldquo;{search}&rdquo;</p>
                                        <p className="text-[10px] text-[#002B40]/40">Nenhum atleta encontrado · Criar novo</p>
                                    </div>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <div className={cn(
                    "flex items-center justify-between p-4 rounded-xl border",
                    mensalista ? "bg-amber-50 border-amber-200" : "bg-[#FFF5EF] border-[#FFE4D3]"
                )}>
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "h-9 w-9 rounded-full flex items-center justify-center",
                            mensalista ? "bg-amber-100" : "bg-[#FF6B00]/10"
                        )}>
                            <Check className={cn("h-4 w-4", mensalista ? "text-amber-600" : "text-[#FF6B00]")} />
                        </div>
                        <div>
                            <p className="font-bold text-[#002B40] text-sm">{selectedAthlete.nome_perfil}</p>
                            <p className="text-[10px] uppercase font-black text-[#002B40]/40 tracking-tight">{selectedAthlete.telefone}</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClearAthlete} className="h-8 w-8 hover:bg-red-50 text-red-500 rounded-lg">
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            )}
        </div>
    )
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
    const [bookingType, setBookingType] = useState<"avulso" | "mensal">("avulso")

    // Shared
    const [search, setSearch] = useState("")
    const [athletes, setAthletes] = useState<Athlete[]>([])
    const [selectedAthlete, setSelectedAthlete] = useState<Athlete | null>(null)
    const [isSearching, setIsSearching] = useState(false)
    const [arenaSports, setArenaSports] = useState<Sport[]>([])
    const [selectedSport, setSelectedSport] = useState<string>("")
    const [isLoadingSports, setIsLoadingSports] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [isAthleteModalOpen, setIsAthleteModalOpen] = useState(false)

    // Avulso
    const [startTime, setStartTime] = useState("")
    const [endTime, setEndTime] = useState("")
    const [price, setPrice] = useState(defaultPrice.toString())
    const [isRecurring, setIsRecurring] = useState(false)
    const [recurrenceWeeks, setRecurrenceWeeks] = useState(2)

    // Mensal
    const [diaSemana, setDiaSemana] = useState<string>(String(selectedDate.getDay()))
    const [horarioInicio, setHorarioInicio] = useState("19:00")
    const [horarioFim, setHorarioFim] = useState("20:00")
    const [sessoesPorMes, setSessoesPorMes] = useState("4")
    const [valorMensal, setValorMensal] = useState("")

    const searchTimeout = useRef<NodeJS.Timeout | null>(null)

    useEffect(() => {
        if (isOpen) {
            const startStr = `${String(selectedHour).padStart(2, '0')}:00`
            const endStr = `${String(selectedHour + 1).padStart(2, '0')}:00`
            setStartTime(startStr)
            setEndTime(endStr)
            setHorarioInicio(startStr)
            setHorarioFim(endStr)
            setPrice(defaultPrice.toString())
            setDiaSemana(String(selectedDate.getDay()))
            loadArenaSports()
        }
    }, [isOpen, selectedHour, defaultPrice])

    async function loadArenaSports() {
        try {
            setIsLoadingSports(true)
            const res = await getArenaByIdAction(arenaId)
            if (res.data?.sports) {
                setArenaSports(res.data.sports)
                if (res.data.sports.length > 0) setSelectedSport(res.data.sports[0].id)
            }
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
                const result = await searchAthletesAction(arenaId)
                if (result.success && result.data) {
                    const normalizedSearch = normalizeString(value)
                    const filtered = (result.data as Athlete[]).filter(
                        (a) => a && normalizeString(a.nome_perfil).includes(normalizedSearch)
                    )
                    setAthletes(filtered)
                }
            } finally {
                setIsSearching(false)
            }
        }, 500)
    }

    const handleSaveAvulso = async () => {
        if (!selectedAthlete && !search) {
            toast.error("Informe o nome do responsável")
            return
        }
        try {
            setIsSaving(true)
            const startDateTime = new Date(selectedDate)
            const [sH, sM] = startTime.split(':').map(Number)
            startDateTime.setHours(sH, sM, 0, 0)
            const endDateTime = new Date(selectedDate)
            const [eH, eM] = endTime.split(':').map(Number)
            endDateTime.setHours(eH, eM, 0, 0)

            if (isRecurring) {
                const recurrenceId = crypto.randomUUID()
                const bookingsToCreate = []
                for (let i = 0; i < recurrenceWeeks; i++) {
                    bookingsToCreate.push({
                        arena_id: arenaId,
                        court_id: courtId,
                        athlete_name: selectedAthlete ? selectedAthlete.nome_perfil : search,
                        athlete_id: selectedAthlete?.id || undefined,
                        sport_id: selectedSport || undefined,
                        start_time: addWeeks(startDateTime, i).toISOString(),
                        end_time: addWeeks(endDateTime, i).toISOString(),
                        status: 'confirmed' as const,
                        price: Number(price),
                        recurrence_id: recurrenceId,
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
                    price: Number(price),
                })
            }

            toast.success(isRecurring ? "Agenda recorrente criada com sucesso!" : "Reserva criada com sucesso!")
            onSuccess()
            onClose()
            resetForm()
        } catch {
            toast.error("Erro ao criar reserva")
        } finally {
            setIsSaving(false)
        }
    }

    const handleSaveMensal = async () => {
        if (!selectedAthlete) {
            toast.error("Selecione um atleta vinculado à arena")
            return
        }
        if (!valorMensal || isNaN(Number(valorMensal))) {
            toast.error("Informe o valor mensal")
            return
        }
        if (!horarioInicio || !horarioFim) {
            toast.error("Informe o horário de início e fim")
            return
        }

        setIsSaving(true)
        try {
            const result = await createPlanoMensalistaAction(arenaId, {
                court_id: courtId,
                athlete_id: selectedAthlete.id,
                athlete_name: selectedAthlete.nome_perfil,
                sport_id: selectedSport || undefined,
                dia_semana: Number(diaSemana),
                horario_inicio: horarioInicio,
                horario_fim: horarioFim,
                sessoes_por_mes: Number(sessoesPorMes),
                valor_mensal: Number(valorMensal),
            })

            if (!result.success) throw new Error(result.error)

            toast.success("Plano mensalista criado com sucesso!")
            onSuccess()
            onClose()
            resetForm()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Erro ao criar mensalista")
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
        setRecurrenceWeeks(2)
        setDiaSemana("1")
        setHorarioInicio("19:00")
        setHorarioFim("20:00")
        setSessoesPorMes("4")
        setValorMensal("")
        setBookingType("avulso")
    }

    const valorPorSessao =
        valorMensal && sessoesPorMes && Number(sessoesPorMes) > 0
            ? (Number(valorMensal) / Number(sessoesPorMes)).toFixed(2)
            : null

    const handleAthleteRegistered = async () => {
        setIsAthleteModalOpen(false)
        try {
            setIsSearching(true)
            const result = await searchAthletesAction(arenaId)
            if (result.success && result.data) {
                const normalizedSearch = normalizeString(search)
                const filtered = (result.data as Athlete[]).filter(
                    (a) => a && normalizeString(a.nome_perfil).includes(normalizedSearch)
                )
                if (filtered.length === 1) {
                    setSelectedAthlete(filtered[0])
                    setSearch(filtered[0].nome_perfil)
                    setAthletes([])
                } else {
                    setAthletes(filtered)
                }
            }
        } finally {
            setIsSearching(false)
        }
    }

    const athleteSearchProps = {
        search,
        athletes,
        selectedAthlete,
        isSearching,
        onSearch: handleSearch,
        onSelectAthlete: (athlete: Athlete) => {
            setSelectedAthlete(athlete)
            setSearch(athlete.nome_perfil)
            setAthletes([])
        },
        onClearAthlete: () => setSelectedAthlete(null),
        onRegisterNew: () => setIsAthleteModalOpen(true),
    }

    return (
        <>
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
                <DialogHeader className="p-8 pb-4">
                    <DialogTitle className="text-2xl font-black text-[#002B40] tracking-tight">
                        {bookingType === "avulso" ? "Cadastrar nova reserva" : "Novo Mensalista"}
                    </DialogTitle>
                </DialogHeader>

                <ScrollArea className="max-h-[70vh] px-8">
                    <div className="space-y-6 pb-8">

                        {/* Tipo de reserva */}
                        <div className="flex items-center gap-1 p-1 bg-[#F1F5F9] rounded-xl">
                            <button
                                type="button"
                                onClick={() => setBookingType("avulso")}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all",
                                    bookingType === "avulso"
                                        ? "bg-white text-[#FF6B00] shadow-sm"
                                        : "text-[#002B40]/50 hover:text-[#002B40]"
                                )}
                            >
                                <CalendarIcon className="h-4 w-4" />
                                Avulso
                            </button>
                            <button
                                type="button"
                                onClick={() => setBookingType("mensal")}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all",
                                    bookingType === "mensal"
                                        ? "bg-white text-amber-600 shadow-sm"
                                        : "text-[#002B40]/50 hover:text-[#002B40]"
                                )}
                            >
                                <Users className="h-4 w-4" />
                                Mensal
                            </button>
                        </div>

                        {/* ── AVULSO ── */}
                        {bookingType === "avulso" && (
                            <>
                                <AthleteSearchField {...athleteSearchProps} />

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
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase text-[#002B40]/40 tracking-wider">Horário início</Label>
                                        <div className="relative">
                                            <Clock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#002B40]/20" />
                                            <Input value={startTime} onChange={(e) => setStartTime(e.target.value)} placeholder="00:00" className="pl-12 h-14 border-[#002B40]/10 focus:ring-[#FF6B00] focus:border-[#FF6B00] rounded-xl font-bold text-[#002B40]" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase text-[#002B40]/40 tracking-wider">Horário fim</Label>
                                        <div className="relative">
                                            <Clock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#002B40]/20" />
                                            <Input value={endTime} onChange={(e) => setEndTime(e.target.value)} placeholder="00:00" className="pl-12 h-14 border-[#002B40]/10 focus:ring-[#FF6B00] focus:border-[#FF6B00] rounded-xl font-bold text-[#002B40]" />
                                        </div>
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
                                                <SelectItem key={sport.id} value={sport.id} className="rounded-xl py-3 font-bold text-[#002B40]">{sport.name}</SelectItem>
                                            ))}
                                            {arenaSports.length === 0 && !isLoadingSports && (
                                                <div className="p-4 text-center text-xs text-muted-foreground">Nenhum esporte vinculado à arena</div>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Valor Pago */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase text-[#002B40]/40 tracking-wider">Valor pago</Label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#002B40]/40 font-bold">R$</span>
                                        <Input value={price} onChange={(e) => setPrice(e.target.value)} className="pl-12 h-14 border-[#002B40]/10 focus:ring-[#FF6B00] focus:border-[#FF6B00] rounded-xl font-bold text-[#002B40]" />
                                    </div>
                                </div>

                                {/* Recorrência */}
                                <div className="pt-4 border-t border-dashed border-[#002B40]/10 flex flex-col gap-4">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label className="text-sm font-bold text-[#002B40]">Reserva Recorrente</Label>
                                            <p className="text-[10px] text-[#002B40]/40 font-medium">Repetir este horário toda semana</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setIsRecurring(!isRecurring)}
                                            className={cn("w-12 h-6 rounded-full transition-colors relative", isRecurring ? "bg-[#FF6B00]" : "bg-gray-200")}
                                        >
                                            <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full transition-transform", isRecurring ? "left-7" : "left-1")} />
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
                                                        className="h-12 border-[#FF6B00]/10 rounded-xl font-bold text-[#002B40] bg-white"
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
                            </>
                        )}

                        {/* ── MENSAL ── */}
                        {bookingType === "mensal" && (
                            <>
                                <AthleteSearchField {...athleteSearchProps} mensalista />

                                {/* Dia da semana */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase text-[#002B40]/40 tracking-wider">Dia da semana</Label>
                                    <Select value={diaSemana} onValueChange={setDiaSemana}>
                                        <SelectTrigger className="h-14 border-[#002B40]/10 focus:ring-amber-500 rounded-xl font-bold text-[#002B40]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-2xl border-[#002B40]/10 p-2">
                                            {DIAS_SEMANA.map((d) => (
                                                <SelectItem key={d.value} value={String(d.value)} className="rounded-xl py-3 font-bold text-[#002B40]">
                                                    {d.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Horários */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase text-[#002B40]/40 tracking-wider">Horário início</Label>
                                        <Input type="time" value={horarioInicio} onChange={(e) => setHorarioInicio(e.target.value)} className="h-14 border-[#002B40]/10 focus:ring-amber-500 rounded-xl font-bold text-[#002B40]" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase text-[#002B40]/40 tracking-wider">Horário fim</Label>
                                        <Input type="time" value={horarioFim} onChange={(e) => setHorarioFim(e.target.value)} className="h-14 border-[#002B40]/10 focus:ring-amber-500 rounded-xl font-bold text-[#002B40]" />
                                    </div>
                                </div>

                                {/* Esporte */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase text-[#002B40]/40 tracking-wider">Esporte</Label>
                                    <Select value={selectedSport} onValueChange={setSelectedSport}>
                                        <SelectTrigger className="h-14 border-[#002B40]/10 focus:ring-amber-500 rounded-xl font-bold text-[#002B40]">
                                            <SelectValue placeholder="Selecione o esporte" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-2xl border-[#002B40]/10 p-2">
                                            {arenaSports.map((sport) => (
                                                <SelectItem key={sport.id} value={sport.id} className="rounded-xl py-3 font-bold text-[#002B40]">{sport.name}</SelectItem>
                                            ))}
                                            {arenaSports.length === 0 && !isLoadingSports && (
                                                <div className="p-4 text-center text-xs text-muted-foreground">Nenhum esporte vinculado</div>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Sessões e valor */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase text-[#002B40]/40 tracking-wider">Sessões/mês</Label>
                                        <Input type="number" min={1} max={8} value={sessoesPorMes} onChange={(e) => setSessoesPorMes(e.target.value)} className="h-14 border-[#002B40]/10 focus:ring-amber-500 rounded-xl font-bold text-[#002B40]" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase text-[#002B40]/40 tracking-wider">Valor mensal (R$)</Label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#002B40]/40 font-bold text-sm">R$</span>
                                            <Input type="number" min={0} value={valorMensal} onChange={(e) => setValorMensal(e.target.value)} className="pl-10 h-14 border-[#002B40]/10 focus:ring-amber-500 rounded-xl font-bold text-[#002B40]" />
                                        </div>
                                    </div>
                                </div>

                                {/* Resumo */}
                                {valorPorSessao && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-1">
                                        <p className="text-xs font-black uppercase text-amber-600 tracking-wider">Resumo do plano</p>
                                        <p className="text-sm font-bold text-[#002B40]">
                                            {sessoesPorMes}x por mês &middot; R$ {valorPorSessao}/sessão &middot; R$ {Number(valorMensal).toFixed(2)}/mês
                                        </p>
                                        <p className="text-[11px] text-[#002B40]/50">
                                            Reservas geradas para o mês atual (confirmado) e os próximos 2 meses (reservado)
                                        </p>
                                    </div>
                                )}
                            </>
                        )}

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
                        onClick={bookingType === "avulso" ? handleSaveAvulso : handleSaveMensal}
                        disabled={isSaving}
                        className={cn(
                            "flex-1 h-14 text-white font-black uppercase tracking-widest text-xs rounded-xl shadow-xl transition-all active:scale-95 gap-2",
                            bookingType === "avulso"
                                ? "bg-[#FF6B00] hover:bg-[#E66000] shadow-[#FF6B00]/20"
                                : "bg-amber-500 hover:bg-amber-600 shadow-amber-500/20"
                        )}
                    >
                        {isSaving ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : bookingType === "avulso" ? (
                            <Check className="h-5 w-5" />
                        ) : (
                            <Save className="h-5 w-5" />
                        )}
                        {bookingType === "avulso" ? "Salvar" : "Criar Plano"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <AthleteRegistrationModal
            arenaId={arenaId}
            open={isAthleteModalOpen}
            onOpenChange={setIsAthleteModalOpen}
            onSuccess={handleAthleteRegistered}
        />
        </>
    )
}
