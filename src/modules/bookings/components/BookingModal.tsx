"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import {
    Search,
    X,
    Loader2,
    Check,
    Calendar as CalendarIcon,
    Clock,
    Users,
    UserPlus,
    AlertTriangle,
    Minus,
    Plus,
} from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
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
import { searchAthletesAction } from "@/modules/loyalty/actions/loyaltyActions"
import { getArenaByIdAction } from "@/modules/arenas/actions/arenaActions"
import { createBookingAction, createRecurringBookingsAction, checkBookingConflictsAction, updateBookingAction } from "@/modules/bookings/actions/bookingActions"
import type { BookingConflict } from "@/modules/bookings/actions/bookingActions"
import { replaceBookingServicesAction } from "@/modules/bookings/actions/bookingServiceActions"
import type { Booking } from "@/modules/bookings/types/booking.types"
import { getProductsByArenaAction } from "@/modules/products/actions/stockActions"
import { isCatalogService, type Product } from "@/modules/products/types/product.types"
import {
    BookingServicesSection,
    sumBookingServiceLines,
    type BookingServiceLineLocal,
} from "@/modules/bookings/components/BookingServicesSection"
import { createPlanoMensalistaAction } from "@/modules/bookings/actions/mensalistaActions"
import { AthleteRegistrationModal } from "@/modules/athletes/components/AthleteRegistrationModal"
import { toast } from "sonner"
import { format, addWeeks, addDays, addMonths, startOfMonth, endOfMonth, parseISO } from "date-fns"
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
            <Label className="text-xs font-bold uppercase text-arena-navy-800/40 tracking-wider">
                {mensalista ? "Atleta" : "Nome do responsável"}
            </Label>
            {!selectedAthlete ? (
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-arena-navy-800/20" />
                    <Input
                        placeholder={mensalista ? "Buscar atleta vinculado à arena" : "Selecione um atleta vinculado ou insira um novo"}
                        value={search}
                        onChange={(e) => onSearch(e.target.value)}
                        className="pl-12 h-14 border-arena-navy-800/10 focus:ring-arena-button focus:border-arena-button rounded-xl font-bold text-arena-navy-800"
                    />
                    {isSearching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-arena-button" />}
                    {showDropdown && (athletes.length > 0 || !isSearching) && (
                        <div className="absolute z-50 w-full mt-2 bg-white border border-arena-navy-800/10 rounded-2xl shadow-2xl max-h-48 overflow-auto p-2">
                            {athletes.map((athlete) => (
                                <button
                                    key={athlete.id}
                                    type="button"
                                    onClick={() => onSelectAthlete(athlete)}
                                    className="w-full text-left px-4 py-3 transition-colors flex items-center justify-between rounded-xl mb-1 last:mb-0 hover:bg-[#FFF5EF]"
                                >
                                    <div>
                                        <p className="font-bold text-arena-navy-800 text-sm">{athlete.nome_perfil}</p>
                                        <p className="text-[10px] uppercase font-black text-arena-navy-800/40 tracking-tight">{athlete.telefone}</p>
                                    </div>
                                </button>
                            ))}
                            {athletes.length === 0 && !isSearching && (
                                <button
                                    type="button"
                                    onClick={onRegisterNew}
                                    className="w-full text-left px-4 py-3 transition-colors flex items-center gap-3 rounded-xl hover:bg-[#FFF5EF]"
                                >
                                    <div className="h-8 w-8 rounded-full bg-arena-button/10 flex items-center justify-center flex-shrink-0">
                                        <UserPlus className="h-4 w-4 text-arena-button" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-arena-button text-sm">Cadastrar &ldquo;{search}&rdquo;</p>
                                        <p className="text-[10px] text-arena-navy-800/40">Nenhum atleta encontrado · Criar novo</p>
                                    </div>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex items-center justify-between p-4 rounded-xl border bg-[#FFF5EF] border-[#FFE4D3]">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full flex items-center justify-center bg-arena-button/10">
                            <Check className="h-4 w-4 text-arena-button" />
                        </div>
                        <div>
                            <p className="font-bold text-arena-navy-800 text-sm">{selectedAthlete.nome_perfil}</p>
                            <p className="text-[10px] uppercase font-black text-arena-navy-800/40 tracking-tight">{selectedAthlete.telefone}</p>
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
    selectedMinute?: number;
    defaultPrice: number;
    /** Quando informado, o modal abre em modo edição (reserva avulsa). */
    existingBooking?: Booking | null;
}

export function BookingModal({ isOpen, onClose, onSuccess, arenaId, courtId, selectedDate, selectedHour, selectedMinute = 0, defaultPrice, existingBooking = null }: BookingModalProps) {
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
    const [conflicts, setConflicts] = useState<BookingConflict[]>([])
    const [isCheckingConflicts, setIsCheckingConflicts] = useState(false)

    // Avulso
    const [startTime, setStartTime] = useState("")
    const [endTime, setEndTime] = useState("")
    /** Valor da locação (quadra), sem serviços — o total enviado ao servidor inclui serviços. */
    const [courtPrice, setCourtPrice] = useState(defaultPrice.toString())
    const [serviceLines, setServiceLines] = useState<BookingServiceLineLocal[]>([])
    const [catalogServiceProducts, setCatalogServiceProducts] = useState<Product[]>([])
    const [isRecurring, setIsRecurring] = useState(false)
    const [recurrenceWeeks, setRecurrenceWeeks] = useState(2)
    const [includeServices, setIncludeServices] = useState(false)

    // Mensal
    const [diaSemana, setDiaSemana] = useState<string>(String(selectedDate.getDay()))
    const [horarioInicio, setHorarioInicio] = useState("19:00")
    const [horarioFim, setHorarioFim] = useState("20:00")
    const [sessoesPorMes, setSessoesPorMes] = useState("4")
    const [valorMensal, setValorMensal] = useState("")

    const searchTimeout = useRef<NodeJS.Timeout | null>(null)

    async function loadArenaSports(preferredSportId?: string | null) {
        try {
            setIsLoadingSports(true)
            const res = await getArenaByIdAction(arenaId)
            if (res.data?.sports) {
                const sports = res.data.sports
                setArenaSports(sports)
                if (sports.length > 0) {
                    const pick =
                        preferredSportId && sports.some((s) => s.id === preferredSportId)
                            ? preferredSportId
                            : sports[0].id
                    setSelectedSport(pick)
                }
            }
        } finally {
            setIsLoadingSports(false)
        }
    }

    useEffect(() => {
        if (!isOpen) return

        if (existingBooking) {
            const start = parseISO(existingBooking.start_time)
            const end = parseISO(existingBooking.end_time)
            setStartTime(format(start, "HH:mm"))
            setEndTime(format(end, "HH:mm"))
            setBookingType("avulso")
            setIsRecurring(false)
            setConflicts([])
            if (existingBooking.atleta) {
                setSelectedAthlete({
                    id: existingBooking.atleta.id,
                    nome_perfil: existingBooking.atleta.nome_perfil,
                    telefone: existingBooking.atleta.telefone ?? "",
                })
                setSearch(existingBooking.atleta.nome_perfil)
            } else {
                setSelectedAthlete(null)
                setSearch(existingBooking.athlete_name ?? "")
            }
            void loadArenaSports(existingBooking.sport_id ?? null)
            const raw = existingBooking.booking_services
            const mapped: BookingServiceLineLocal[] = (raw ?? []).map((s) => ({
                productId: s.product_id,
                quantity: s.quantity,
                unitPrice: Number(s.unit_price),
                name: s.products?.name ?? "Serviço",
            }))
            setServiceLines(mapped)
            setIncludeServices(mapped.length > 0)
            const svcSum = mapped.reduce((a, l) => a + l.quantity * l.unitPrice, 0)
            setCourtPrice(String(Math.max(0, (existingBooking.price ?? 0) - svcSum)))
            return
        }

        const startTotal = selectedHour * 60 + selectedMinute
        const endTotal = startTotal + 60
        const endHour = Math.floor(endTotal / 60) % 24
        const endMin = endTotal % 60
        const startStr = `${String(selectedHour).padStart(2, '0')}:${String(selectedMinute).padStart(2, '0')}`
        const endStr = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`
        setStartTime(startStr)
        setEndTime(endStr)
        setHorarioInicio(startStr)
        setHorarioFim(endStr)
        setCourtPrice(defaultPrice.toString())
        setServiceLines([])
        setIncludeServices(false)
        setDiaSemana(String(selectedDate.getDay()))
        void loadArenaSports()
    }, [isOpen, existingBooking, selectedDate, selectedHour, selectedMinute, defaultPrice, arenaId])

    // Limpa conflitos quando qualquer campo relevante muda
    useEffect(() => {
        setConflicts([])
    }, [startTime, endTime, horarioInicio, horarioFim, diaSemana, isRecurring, recurrenceWeeks, bookingType])

    useEffect(() => {
        if (!isOpen) return
        getProductsByArenaAction(arenaId).then((r) => {
            if (r.success && r.data) {
                setCatalogServiceProducts((r.data as Product[]).filter((p) => isCatalogService(p)))
            } else {
                setCatalogServiceProducts([])
            }
        })
    }, [isOpen, arenaId])


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
        const court = Number(courtPrice)
        if (Number.isNaN(court) || court < 0) {
            toast.error("Informe um valor válido para a locação")
            return
        }
        const totalPrice = court + sumBookingServiceLines(serviceLines)
        const servicePayload = serviceLines.map((l) => ({ product_id: l.productId, quantity: l.quantity }))

        try {
            setIsSaving(true)
            const startDateTime = new Date(selectedDate)
            const [sH, sM] = startTime.split(":").map(Number)
            startDateTime.setHours(sH, sM, 0, 0)
            const endDateTime = new Date(selectedDate)
            const [eH, eM] = endTime.split(":").map(Number)
            endDateTime.setHours(eH, eM, 0, 0)

            if (existingBooking) {
                const result = await updateBookingAction(arenaId, existingBooking.id, {
                    athlete_name: selectedAthlete ? selectedAthlete.nome_perfil : search,
                    athlete_id: selectedAthlete?.id ?? null,
                    sport_id: selectedSport || null,
                    start_time: startDateTime.toISOString(),
                    end_time: endDateTime.toISOString(),
                    price: totalPrice,
                })
                if (!result.success) {
                    toast.error(result.error ?? "Erro ao atualizar reserva")
                    return
                }
                const sRes = await replaceBookingServicesAction(arenaId, existingBooking.id, servicePayload)
                if (!sRes.success) {
                    toast.error(sRes.error ?? "Erro ao salvar serviços da reserva")
                    return
                }
                toast.success("Reserva atualizada com sucesso!")
                onSuccess()
                onClose()
                resetForm()
                return
            }

            if (isRecurring) {
                const weeks = Math.max(1, Math.floor(recurrenceWeeks) || 1)
                const recurrenceId = crypto.randomUUID()
                const bookingsToCreate = []
                for (let i = 0; i < weeks; i++) {
                    bookingsToCreate.push({
                        arena_id: arenaId,
                        court_id: courtId,
                        athlete_name: selectedAthlete ? selectedAthlete.nome_perfil : search,
                        athlete_id: selectedAthlete?.id || undefined,
                        sport_id: selectedSport || undefined,
                        start_time: addWeeks(startDateTime, i).toISOString(),
                        end_time: addWeeks(endDateTime, i).toISOString(),
                        status: "confirmed" as const,
                        price: totalPrice,
                        recurrence_id: recurrenceId,
                    })
                }
                const recRes = await createRecurringBookingsAction(arenaId, bookingsToCreate)
                if (!recRes.success) {
                    toast.error(recRes.error ?? "Erro ao criar reservas recorrentes")
                    return
                }
                if (servicePayload.length > 0 && recRes.data?.length) {
                    for (const b of recRes.data) {
                        const sRes = await replaceBookingServicesAction(arenaId, b.id, servicePayload)
                        if (!sRes.success) {
                            toast.error(sRes.error ?? "Erro ao salvar serviços em uma das reservas")
                            return
                        }
                    }
                }
            } else {
                const created = await createBookingAction(arenaId, {
                    arena_id: arenaId,
                    court_id: courtId,
                    athlete_name: selectedAthlete ? selectedAthlete.nome_perfil : search,
                    athlete_id: selectedAthlete?.id || undefined,
                    sport_id: selectedSport || undefined,
                    start_time: startDateTime.toISOString(),
                    end_time: endDateTime.toISOString(),
                    status: "confirmed",
                    price: totalPrice,
                })
                if (!created.success) {
                    toast.error(created.error ?? "Erro ao criar reserva")
                    return
                }
                if (servicePayload.length > 0 && created.data?.id) {
                    const sRes = await replaceBookingServicesAction(arenaId, created.data.id, servicePayload)
                    if (!sRes.success) {
                        toast.error(sRes.error ?? "Erro ao salvar serviços da reserva")
                        return
                    }
                }
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
        setConflicts([])
        setCourtPrice(defaultPrice.toString())
        setServiceLines([])
        setIncludeServices(false)
    }

    // ── Helpers para gerar slots a verificar ────────────────────────────────
    function buildSlotsAvulso(): { startTime: string; endTime: string }[] {
        const startDateTime = new Date(selectedDate)
        const [sH, sM] = startTime.split(':').map(Number)
        startDateTime.setHours(sH, sM, 0, 0)
        const endDateTime = new Date(selectedDate)
        const [eH, eM] = endTime.split(':').map(Number)
        endDateTime.setHours(eH, eM, 0, 0)

        if (!isRecurring) return [{ startTime: startDateTime.toISOString(), endTime: endDateTime.toISOString() }]

        const weeks = Math.max(1, Math.floor(recurrenceWeeks) || 1)
        const slots = []
        for (let i = 0; i < weeks; i++) {
            slots.push({
                startTime: addWeeks(startDateTime, i).toISOString(),
                endTime: addWeeks(endDateTime, i).toISOString(),
            })
        }
        return slots
    }

    function buildSlotsMensal(): { startTime: string; endTime: string }[] {
        const slots: { startTime: string; endTime: string }[] = []
        const now = new Date()
        const [sH, sM] = horarioInicio.split(':').map(Number)
        const [eH, eM] = horarioFim.split(':').map(Number)
        const diaSemanaNum = Number(diaSemana)
        const sessoes = Number(sessoesPorMes) || 4

        for (let monthOffset = 0; monthOffset < 3; monthOffset++) {
            const targetDate = addMonths(now, monthOffset)
            const year = targetDate.getFullYear()
            const month = targetDate.getMonth()

            let current = startOfMonth(new Date(year, month, 1))
            const end = endOfMonth(new Date(year, month, 1))
            while (current.getDay() !== diaSemanaNum) current = addDays(current, 1)

            let count = 0
            while (current <= end && count < sessoes) {
                const startDt = new Date(current)
                startDt.setHours(sH, sM, 0, 0)
                const endDt = new Date(current)
                endDt.setHours(eH, eM, 0, 0)
                if (startDt > now) {
                    slots.push({ startTime: startDt.toISOString(), endTime: endDt.toISOString() })
                }
                current = addDays(current, 7)
                count++
            }
        }
        return slots
    }

    // ── Pre-save: verifica conflitos antes de salvar ─────────────────────────
    async function handlePreSave() {
        setConflicts([])
        setIsCheckingConflicts(true)
        try {
            const slots = bookingType === 'avulso' ? buildSlotsAvulso() : buildSlotsMensal()
            if (slots.length === 0) {
                // Sem slots futuros (todos no passado), deixa o server action tratar
                bookingType === 'avulso' ? await handleSaveAvulso() : await handleSaveMensal()
                return
            }
            const result = await checkBookingConflictsAction(
                arenaId,
                courtId,
                slots,
                existingBooking?.id
            )
            if (!result.success) {
                toast.error(result.error ?? 'Erro ao verificar conflitos')
                return
            }
            if (result.conflicts.length > 0) {
                setConflicts(result.conflicts)
                return
            }
            // Sem conflitos — prossegue
            bookingType === 'avulso' ? await handleSaveAvulso() : await handleSaveMensal()
        } finally {
            setIsCheckingConflicts(false)
        }
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

    const servicesSumDisplay = useMemo(() => sumBookingServiceLines(serviceLines), [serviceLines])
    const totalDisplay = (Number(courtPrice) || 0) + servicesSumDisplay
    const fmtBrl = (n: number) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n)
    const recurrenceWeeksDisplay = Math.max(1, Math.floor(recurrenceWeeks) || 1)
    const recurrenceMesesAprox = Math.max(1, Math.ceil(recurrenceWeeksDisplay / 4))

    return (
        <>
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                className={cn(
                    "!flex max-h-[90vh] min-h-0 w-full max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden rounded-3xl border-none p-0 shadow-2xl",
                    "sm:max-w-[min(995px,calc(100vw-2rem))] sm:w-full"
                )}
            >
                <DialogHeader className="shrink-0 space-y-0 px-6 pb-4 pt-6 text-left sm:px-10 sm:pb-5 sm:pt-8">
                    <DialogTitle className="text-2xl font-black text-arena-navy-800 tracking-tight">
                        {existingBooking ? "Editar reserva" : bookingType === "avulso" ? "Cadastrar nova reserva" : "Novo Mensalista"}
                    </DialogTitle>
                </DialogHeader>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 sm:px-10">
                    <div className="space-y-6 pb-6 sm:space-y-8 sm:pb-8">

                        {/* Tipo de reserva */}
                        {!existingBooking && (
                        <div className="flex items-center gap-1 p-1 bg-[#F1F5F9] rounded-xl">
                            <button
                                type="button"
                                onClick={() => setBookingType("avulso")}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all",
                                    bookingType === "avulso"
                                        ? "bg-white text-arena-button shadow-sm"
                                        : "text-arena-navy-800/50 hover:text-arena-navy-800"
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
                                        ? "bg-white text-arena-button shadow-sm"
                                        : "text-arena-navy-800/50 hover:text-arena-navy-800"
                                )}
                            >
                                <Users className="h-4 w-4" />
                                Mensal
                            </button>
                        </div>
                        )}

                        {/* ── AVULSO ── */}
                        {bookingType === "avulso" && (
                            <>
                                <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
                                    <div className="min-w-0 lg:col-span-6">
                                        <AthleteSearchField {...athleteSearchProps} />
                                    </div>
                                    <div className="space-y-2 lg:col-span-3">
                                        <Label className="text-xs font-bold uppercase text-arena-navy-800/40 tracking-wider">
                                            Data
                                        </Label>
                                        <div className="relative">
                                            <CalendarIcon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-arena-navy-800/20" />
                                            <Input
                                                value={format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}
                                                readOnly
                                                placeholder="dd/mm/aaaa"
                                                className="h-14 rounded-xl border-arena-navy-800/10 bg-gray-50 pl-12 font-bold text-arena-navy-800 focus:ring-0"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2 lg:col-span-3">
                                        <Label className="text-xs font-bold uppercase text-arena-navy-800/40 tracking-wider">
                                            Esporte
                                        </Label>
                                        <Select value={selectedSport} onValueChange={setSelectedSport}>
                                            <SelectTrigger className="h-14 rounded-xl border-arena-navy-800/10 font-bold text-arena-navy-800 focus:border-arena-button focus:ring-arena-button">
                                                <SelectValue placeholder="Selecione o tipo de esporte" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-2xl border-arena-navy-800/10 p-2">
                                                {arenaSports.map((sport) => (
                                                    <SelectItem
                                                        key={sport.id}
                                                        value={sport.id}
                                                        className="rounded-xl py-3 font-bold text-arena-navy-800"
                                                    >
                                                        {sport.name}
                                                    </SelectItem>
                                                ))}
                                                {arenaSports.length === 0 && !isLoadingSports && (
                                                    <div className="p-4 text-center text-xs text-muted-foreground">
                                                        Nenhum esporte vinculado à arena
                                                    </div>
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
                                    <div className="space-y-2 lg:col-span-3">
                                        <Label className="text-xs font-bold uppercase text-arena-navy-800/40 tracking-wider">
                                            Horário início
                                        </Label>
                                        <div className="relative">
                                            <Clock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-arena-navy-800/20" />
                                            <Input
                                                value={startTime}
                                                onChange={(e) => setStartTime(e.target.value)}
                                                placeholder="08h00"
                                                className="h-14 rounded-xl border-arena-navy-800/10 pl-12 font-bold text-arena-navy-800 focus:border-arena-button focus:ring-arena-button"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2 lg:col-span-3">
                                        <Label className="text-xs font-bold uppercase text-arena-navy-800/40 tracking-wider">
                                            Horário fim
                                        </Label>
                                        <div className="relative">
                                            <Clock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-arena-navy-800/20" />
                                            <Input
                                                value={endTime}
                                                onChange={(e) => setEndTime(e.target.value)}
                                                placeholder="09h00"
                                                className="h-14 rounded-xl border-arena-navy-800/10 pl-12 font-bold text-arena-navy-800 focus:border-arena-button focus:ring-arena-button"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2 lg:col-span-6">
                                        <Label className="text-xs font-bold uppercase text-arena-navy-800/40 tracking-wider">
                                            Valor pago
                                        </Label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-arena-navy-800/40">
                                                R$
                                            </span>
                                            <Input
                                                value={courtPrice}
                                                onChange={(e) => setCourtPrice(e.target.value)}
                                                placeholder="00,00"
                                                className="h-14 rounded-xl border-arena-navy-800/10 pl-12 font-bold text-arena-navy-800 focus:border-arena-button focus:ring-arena-button"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div
                                    className={cn(
                                        "grid gap-8 border-t border-slate-200 pt-6",
                                        existingBooking ? "grid-cols-1" : "md:grid-cols-2 md:gap-0"
                                    )}
                                >
                                    {!existingBooking && (
                                        <div className="flex min-w-0 flex-col md:border-r md:border-slate-200 md:pr-8">
                                            <div className="flex items-start gap-3 border-b border-slate-200 pb-4">
                                                <button
                                                    type="button"
                                                    onClick={() => setIsRecurring(!isRecurring)}
                                                    className={cn(
                                                        "relative mt-0.5 h-6 w-12 shrink-0 rounded-full transition-colors",
                                                        isRecurring ? "bg-arena-button" : "bg-gray-200"
                                                    )}
                                                    aria-pressed={isRecurring}
                                                >
                                                    <div
                                                        className={cn(
                                                            "absolute top-1 h-4 w-4 rounded-full bg-white transition-transform",
                                                            isRecurring ? "left-7" : "left-1"
                                                        )}
                                                    />
                                                </button>
                                                <div className="min-w-0 flex-1 space-y-0.5">
                                                    <Label className="text-sm font-bold text-arena-navy-800">
                                                        Reserva recorrente
                                                    </Label>
                                                    <p className="text-[10px] font-medium leading-snug text-arena-navy-800/40">
                                                        Repetir este horário toda semana
                                                    </p>
                                                </div>
                                            </div>
                                            {isRecurring && (
                                                <div className="animate-in fade-in slide-in-from-top-2 mt-4 duration-300">
                                                    <div className="rounded-xl border border-slate-200/90 bg-slate-100 p-4">
                                                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                                            <div className="min-w-0 space-y-1.5">
                                                                <p className="text-sm font-semibold text-arena-navy-800">
                                                                    Selecione a duração (semanas)
                                                                </p>
                                                                <p className="text-xs leading-relaxed text-arena-navy-800/50">
                                                                    Serão criadas {recurrenceWeeksDisplay}{" "}
                                                                    {recurrenceWeeksDisplay === 1
                                                                        ? "reserva"
                                                                        : "reservas"}{" "}
                                                                    nas próximas{" "}
                                                                    {recurrenceMesesAprox === 1
                                                                        ? "1 mês"
                                                                        : `${recurrenceMesesAprox} meses`}{" "}
                                                                    (aprox.)
                                                                </p>
                                                            </div>
                                                            <div className="flex h-10 shrink-0 items-stretch overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setRecurrenceWeeks((w) =>
                                                                            Math.max(1, (Math.floor(w) || 1) - 1)
                                                                        )
                                                                    }
                                                                    className="flex w-10 items-center justify-center text-arena-navy-800 transition-colors hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-35"
                                                                    disabled={recurrenceWeeksDisplay <= 1}
                                                                    aria-label="Menos uma semana"
                                                                >
                                                                    <Minus className="h-4 w-4" strokeWidth={2.5} />
                                                                </button>
                                                                <span className="flex min-w-[2.5rem] items-center justify-center border-x border-slate-200 text-sm font-black tabular-nums text-arena-navy-800">
                                                                    {recurrenceWeeksDisplay}
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setRecurrenceWeeks((w) =>
                                                                            Math.min(52, (Math.floor(w) || 1) + 1)
                                                                        )
                                                                    }
                                                                    className="flex w-10 items-center justify-center text-arena-navy-800 transition-colors hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-35"
                                                                    disabled={recurrenceWeeksDisplay >= 52}
                                                                    aria-label="Mais uma semana"
                                                                >
                                                                    <Plus className="h-4 w-4" strokeWidth={2.5} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div
                                        className={cn(
                                            "flex min-w-0 flex-col",
                                            !existingBooking && "md:pl-8"
                                        )}
                                    >
                                        <div className="flex items-start gap-3 border-b border-slate-200 pb-4">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIncludeServices((prev) => {
                                                        if (prev) setServiceLines([])
                                                        return !prev
                                                    })
                                                }}
                                                className={cn(
                                                    "relative mt-0.5 h-6 w-12 shrink-0 rounded-full transition-colors",
                                                    includeServices ? "bg-arena-button" : "bg-gray-200"
                                                )}
                                                aria-pressed={includeServices}
                                            >
                                                <div
                                                    className={cn(
                                                        "absolute top-1 h-4 w-4 rounded-full bg-white transition-transform",
                                                        includeServices ? "left-7" : "left-1"
                                                    )}
                                                />
                                            </button>
                                            <div className="min-w-0 flex-1 space-y-0.5">
                                                <Label className="text-sm font-bold text-arena-navy-800">
                                                    Adicionar serviço
                                                </Label>
                                                <p className="text-[10px] font-medium leading-snug text-arena-navy-800/40">
                                                    Inclua serviços nessa reserva e já calcule o valor de forma única
                                                </p>
                                            </div>
                                        </div>
                                        {includeServices && (
                                            <div className="animate-in fade-in slide-in-from-top-2 mt-4 duration-300">
                                                <BookingServicesSection
                                                    compact
                                                    catalogServices={catalogServiceProducts.map((p) => ({
                                                        id: p.id,
                                                        name: p.name,
                                                        price: p.price,
                                                        stockQuantity: p.stock_quantity,
                                                    }))}
                                                    lines={serviceLines}
                                                    onLinesChange={setServiceLines}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-6 border-t border-slate-200 pt-6">
                                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                                        <span className="text-sm font-medium text-arena-navy-800/70">
                                            Total da reserva
                                        </span>
                                        <span className="text-2xl font-black tracking-tight text-arena-button">
                                            {fmtBrl(totalDisplay)}
                                        </span>
                                    </div>
                                    {serviceLines.length > 0 && (
                                        <p className="mt-2 text-[11px] font-medium text-arena-navy-800/45">
                                            Locação {fmtBrl(Number(courtPrice) || 0)} + serviços{" "}
                                            {fmtBrl(servicesSumDisplay)}
                                        </p>
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
                                    <Label className="text-xs font-bold uppercase text-arena-navy-800/40 tracking-wider">Dia da semana</Label>
                                    <Select value={diaSemana} onValueChange={setDiaSemana}>
                                        <SelectTrigger className="h-14 border-arena-navy-800/10 focus:ring-arena-button focus:border-arena-button rounded-xl font-bold text-arena-navy-800">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-2xl border-arena-navy-800/10 p-2">
                                            {DIAS_SEMANA.map((d) => (
                                                <SelectItem key={d.value} value={String(d.value)} className="rounded-xl py-3 font-bold text-arena-navy-800">
                                                    {d.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Horários */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase text-arena-navy-800/40 tracking-wider">Horário início</Label>
                                        <Input type="time" value={horarioInicio} onChange={(e) => setHorarioInicio(e.target.value)} className="h-14 border-arena-navy-800/10 focus:ring-arena-button focus:border-arena-button rounded-xl font-bold text-arena-navy-800" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase text-arena-navy-800/40 tracking-wider">Horário fim</Label>
                                        <Input type="time" value={horarioFim} onChange={(e) => setHorarioFim(e.target.value)} className="h-14 border-arena-navy-800/10 focus:ring-arena-button focus:border-arena-button rounded-xl font-bold text-arena-navy-800" />
                                    </div>
                                </div>

                                {/* Esporte */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase text-arena-navy-800/40 tracking-wider">Esporte</Label>
                                    <Select value={selectedSport} onValueChange={setSelectedSport}>
                                        <SelectTrigger className="h-14 border-arena-navy-800/10 focus:ring-arena-button focus:border-arena-button rounded-xl font-bold text-arena-navy-800">
                                            <SelectValue placeholder="Selecione o esporte" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-2xl border-arena-navy-800/10 p-2">
                                            {arenaSports.map((sport) => (
                                                <SelectItem key={sport.id} value={sport.id} className="rounded-xl py-3 font-bold text-arena-navy-800">{sport.name}</SelectItem>
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
                                        <Label className="text-xs font-bold uppercase text-arena-navy-800/40 tracking-wider">Sessões/mês</Label>
                                        <Input type="number" min={1} max={8} value={sessoesPorMes} onChange={(e) => setSessoesPorMes(e.target.value)} className="h-14 border-arena-navy-800/10 focus:ring-arena-button focus:border-arena-button rounded-xl font-bold text-arena-navy-800" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase text-arena-navy-800/40 tracking-wider">Valor mensal (R$)</Label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-arena-navy-800/40 font-bold text-sm">R$</span>
                                            <Input type="number" min={0} value={valorMensal} onChange={(e) => setValorMensal(e.target.value)} className="pl-10 h-14 border-arena-navy-800/10 focus:ring-arena-button focus:border-arena-button rounded-xl font-bold text-arena-navy-800" />
                                        </div>
                                    </div>
                                </div>

                                {/* Resumo */}
                                {valorPorSessao && (
                                    <div className="rounded-2xl border border-arena-button/10 bg-[#FFF5EF] p-4 space-y-1">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-arena-button/80">Resumo do plano</p>
                                        <p className="text-sm font-bold text-arena-navy-800">
                                            {sessoesPorMes}x por mês &middot; R$ {valorPorSessao}/sessão &middot; R$ {Number(valorMensal).toFixed(2)}/mês
                                        </p>
                                        <p className="text-[11px] text-arena-navy-800/50">
                                            Reservas geradas para o mês atual (confirmado) e os próximos 2 meses (reservado)
                                        </p>
                                    </div>
                                )}
                            </>
                        )}

                        {/* ── ALERTA DE CONFLITOS ── */}
                        {conflicts.length > 0 && (
                            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                                    <p className="text-sm font-black text-red-700">
                                        {conflicts.length === 1
                                            ? 'Conflito de horário encontrado'
                                            : `${conflicts.length} conflitos de horário encontrados`}
                                    </p>
                                </div>
                                <p className="text-xs text-red-600 font-medium">
                                    Os horários abaixo já estão ocupados. Altere o horário ou data antes de prosseguir.
                                </p>
                                <div className="space-y-2">
                                    {conflicts.map((c, i) => (
                                        <div key={i} className="bg-white border border-red-100 rounded-xl px-3 py-2.5 flex items-start gap-2">
                                            <div className="h-5 w-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                <span className="text-[9px] font-black text-red-500">{i + 1}</span>
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-black text-red-700 uppercase tracking-wider">
                                                    {c.proposedDate}
                                                </p>
                                                <p className="text-xs text-red-600 font-medium">
                                                    Ocupado por <span className="font-black">{c.athleteName}</span> ({c.startTime}–{c.endTime})
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                    </div>
                </div>

                <div className="flex shrink-0 flex-col gap-3 border-t border-slate-100 px-6 py-4 sm:flex-row sm:justify-center sm:gap-4 sm:px-10 sm:py-5">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        className="h-11 w-full rounded-xl border-arena-navy-800/25 font-semibold text-arena-navy-800 hover:bg-slate-50 sm:w-auto sm:min-w-[200px]"
                    >
                        Fechar
                    </Button>
                    <Button
                        type="button"
                        onClick={handlePreSave}
                        disabled={isSaving || isCheckingConflicts}
                        className="h-11 w-full rounded-xl bg-arena-button font-semibold text-white shadow-sm hover:bg-arena-button-hover disabled:opacity-50 sm:w-auto sm:min-w-[200px]"
                    >
                        {isSaving || isCheckingConflicts ? (
                            <span className="inline-flex items-center justify-center gap-2">
                                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                                {isCheckingConflicts ? "Verificando…" : "Salvando…"}
                            </span>
                        ) : existingBooking ? (
                            "Salvar alterações"
                        ) : bookingType === "avulso" ? (
                            "Salvar"
                        ) : (
                            "Criar Plano"
                        )}
                    </Button>
                </div>
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
