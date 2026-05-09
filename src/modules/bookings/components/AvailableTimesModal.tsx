"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import { Loader2, Download, ChevronLeft, ChevronRight } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { getCourtsByArenaAction } from "@/modules/courts/actions/courtActions"
import { getBookingsByArenaAction } from "@/modules/bookings/actions/bookingActions"
import {
    format, addDays, addWeeks, subWeeks,
    startOfWeek, parseISO, startOfDay, endOfDay,
} from "date-fns"
import { ptBR } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { ARENA_BRAND_HEX } from "@/constants/arena-brand-hex"

interface AvailableTimesModalProps {
    isOpen: boolean
    onClose: () => void
    arenaId: string
    currentDate: Date
}

type SlotStatus = 'available' | 'booked-avulso' | 'booked-mensalista' | 'closed'

interface CourtSlot {
    id: string
    name: string
    status: SlotStatus
}

const formatCourtNames = (names: string[]) => {
    const items = names.map(name => name.trim()).filter(Boolean)
    if (items.length <= 1) return items[0] ?? ''

    const groups = new Map<string, string[]>()
    const standalone: string[] = []

    items.forEach((name) => {
        const match = name.match(/^(.+?)\s+(\d+)$/)

        if (!match) {
            standalone.push(name)
            return
        }

        const [, prefix, number] = match
        groups.set(prefix, [...(groups.get(prefix) ?? []), number])
    })

    const compactGroups = Array.from(groups.entries()).map(([prefix, numbers]) => (
        `${prefix} ${joinPt(numbers)}`
    ))
    const compactItems = [...standalone, ...compactGroups]

    return joinPt(compactItems)
}

const joinPt = (items: string[]) => {
    if (items.length <= 1) return items[0] ?? ''
    return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`
}

export function AvailableTimesModal({ isOpen, onClose, arenaId, currentDate }: AvailableTimesModalProps) {
    const [weekStart, setWeekStart] = useState(() => startOfWeek(currentDate, { weekStartsOn: 1 }))
    const [courts, setCourts] = useState<any[]>([])
    const [bookings, setBookings] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(false)

    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
    const hours = Array.from({ length: 18 }, (_, i) => i + 6) // 06h – 23h

    const loadData = useCallback(async (ws: Date) => {
        setIsLoading(true)
        try {
            const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i))
            const startStr = startOfDay(days[0]).toISOString()
            const endStr = endOfDay(days[6]).toISOString()
            const [courtsRes, bookingsRes] = await Promise.all([
                getCourtsByArenaAction(arenaId),
                getBookingsByArenaAction(arenaId, startStr, endStr),
            ])
            setCourts(courtsRes.data ?? [])
            setBookings(bookingsRes.data ?? [])
        } catch (e) {
            console.error(e)
        } finally {
            setIsLoading(false)
        }
    }, [arenaId])

    useEffect(() => {
        if (isOpen) loadData(weekStart)
    }, [isOpen, weekStart, loadData])

    // Reset week when modal reopens
    useEffect(() => {
        if (isOpen) setWeekStart(startOfWeek(currentDate, { weekStartsOn: 1 }))
    }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

    const getCourtStatusForSlot = (court: any, date: Date, hour: number): SlotStatus => {
        const dayName = format(date, 'EEEE', { locale: ptBR })
        const formatted = dayName.charAt(0).toUpperCase() + dayName.slice(1)
        const config = court.day_config?.find(
            (d: any) => d.day.toLowerCase() === formatted.toLowerCase()
        )
        if (!config || !config.enabled) return 'closed'

        const startH = parseInt(config.startTime.split(':')[0])
        const endH = parseInt(config.endTime.split(':')[0])
        const inSchedule = startH < endH
            ? hour >= startH && hour < endH
            : hour >= startH || hour < endH
        if (!inSchedule) return 'closed'

        const slotStart = new Date(date); slotStart.setHours(hour, 0, 0, 0)
        const slotEnd   = new Date(date); slotEnd.setHours(hour + 1, 0, 0, 0)

        const booking = bookings.find(b =>
            b.court_id === court.id &&
            b.status !== 'cancelled' &&
            !(parseISO(b.end_time) <= slotStart || parseISO(b.start_time) >= slotEnd)
        )
        if (!booking) return 'available'
        if (booking.booking_type === 'mensalista') return 'booked-mensalista'
        return 'booked-avulso'
    }

    const getSlotsForCell = (date: Date, hour: number): CourtSlot[] =>
        courts
            .filter(c => getCourtStatusForSlot(c, date, hour) !== 'closed')
            .map(c => ({ id: c.id, name: c.name, status: getCourtStatusForSlot(c, date, hour) }))

    const getAvailableSlotsForCell = (date: Date, hour: number): CourtSlot[] =>
        getSlotsForCell(date, hour).filter(slot => slot.status === 'available')

    // ── Print ────────────────────────────────────────────────────────────────
    const handlePrint = () => {
        const printWindow = window.open('', '_blank', 'width=1400,height=900')
        if (!printWindow) { alert('Habilite pop-ups para imprimir.'); return }
        const logoUrl = `${window.location.origin}/logo_arena_front_bgbranco.png`

        const cellHtml = (day: Date, hour: number) => {
            const slots = getAvailableSlotsForCell(day, hour)
            if (slots.length === 0) return `<div class="cell unavailable">Indisponível</div>`

            return `
                <div class="cell">
                    <strong>Disponível</strong>
                    <span>${formatCourtNames(slots.map(slot => slot.name))}</span>
                </div>`
        }

        printWindow.document.write(`
<html><head>
<title>Grade de Horários — Arena Digital</title>
<style>
  @page { size: landscape; margin: 6mm; }
  * { -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; box-sizing:border-box; }
  body { font-family: Manrope, ui-sans-serif, system-ui, sans-serif; color:${ARENA_BRAND_HEX.navy800}; background:#fff; padding:8px; }
  h1  { font-family: Exo, Manrope, sans-serif; font-size:1rem; font-weight:800; letter-spacing:0; margin:0 }
  .meta { color:${ARENA_BRAND_HEX.navy800}; font-size:.62rem; font-weight:700; text-align:right }
  table { width:100%; border-collapse:collapse; margin-top:12px; border-top:1px solid #cbd5e1; }
  th,td { border-bottom:1px solid #cbd5e1; padding:0; vertical-align:middle }
  .th-time { width:64px; font-size:.55rem; font-weight:500; color:#007793; text-align:left; padding:8px 12px }
  .th-day  { font-size:.55rem; font-weight:500; text-align:center; color:#007793; text-transform:capitalize; padding:8px 10px }
  .td-time { text-align:left; font-size:.6rem; font-weight:700; color:${ARENA_BRAND_HEX.navy800}; padding:12px }
  .td-cell { min-width:86px; height:36px; padding:0 }
  .cell { min-height:36px; display:flex; flex-direction:column; align-items:center; justify-content:center; color:${ARENA_BRAND_HEX.navy800}; font-size:.56rem; line-height:1.25; text-align:center }
  .cell strong { font-size:.6rem; font-weight:500 }
  .cell span { font-size:.53rem; font-weight:700 }
  .cell.unavailable { background:#f2f4f7; font-weight:500 }
  footer   { margin-top:8px; font-size:.6rem; color:#94a3b8; text-align:right }
</style>
</head><body>
<div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding-bottom:8px;margin-bottom:4px">
  <div>
    <h1>Grade de horários disponíveis</h1>
  </div>
  <img src="${logoUrl}" style="width:118px;height:auto" alt="Arena Digital" />
  <div class="meta"><div>${format(weekDays[0], "dd/MM")} - ${format(weekDays[6], "dd/MM")}</div><div>Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</div></div>
</div>
<table>
  <thead><tr>
    <th class="th-time">Horário</th>
    ${weekDays.map(d => `<th class="th-day">${format(d,'EEEE',{locale:ptBR})} (${format(d,'dd/MM')})</th>`).join('')}
  </tr></thead>
  <tbody>
    ${hours.map(h => `
    <tr>
      <td class="td-time">${String(h).padStart(2,'0')}h00</td>
      ${weekDays.map(d => `<td class="td-cell">${cellHtml(d,h)}</td>`).join('')}
    </tr>`).join('')}
  </tbody>
</table>
${courts.length > 0 ? `
<div style="margin-top:8px;font-size:.65rem;">
  <strong style="color:${ARENA_BRAND_HEX.navy800};text-transform:uppercase;font-size:.55rem;letter-spacing:.06em">Esportes por quadra: </strong>
  ${courts.map(c => `<span style="margin-right:12px"><b>${c.name}</b> — ${c.sports?.map((s:any)=>s.name).join(', ')||'—'}</span>`).join('')}
</div>` : ''}
<footer>Arena Digital · Relatório gerado automaticamente</footer>
<script>window.onload=()=>{setTimeout(()=>window.print(),400)}</script>
</body></html>`)
        printWindow.document.close()
    }

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                showCloseButton={false}
                className="sm:max-w-[96vw] w-[98vw] max-h-[95vh] overflow-hidden gap-0 p-5 border border-slate-200 shadow-xl rounded-lg bg-white text-arena-navy-800"
            >
                {/* DialogTitle sempre presente para acessibilidade (Radix UI exige) */}
                <DialogTitle className="sr-only">Grade de horários disponíveis</DialogTitle>
                {/* ── Content ── */}
                <div className="max-h-[calc(95vh-2.5rem)] overflow-hidden">
                    {isLoading ? (
                        <div className="h-96 flex flex-col items-center justify-center gap-4 text-arena-navy-800/50 font-semibold">
                            <Loader2 className="h-8 w-8 animate-spin text-arena-button" />
                            Carregando horários…
                        </div>
                    ) : (
                        <div className="flex max-h-[calc(95vh-2.5rem)] flex-col gap-5 overflow-hidden">
                            <section className="flex max-h-[calc(95vh-14.75rem)] min-h-[18rem] flex-col rounded-lg border border-slate-200 bg-white px-6 py-5 shadow-sm">
                                <DialogHeader className="shrink-0 pb-5">
                                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
                                        <h2 className="font-heading text-2xl font-bold leading-none tracking-normal text-arena-navy-800 lg:justify-self-start">
                                            Grade de horários disponíveis
                                        </h2>

                                        <div className="flex justify-start lg:justify-center">
                                            <Image
                                                src="/logo_arena_front_bgbranco.png"
                                                alt="Arena Digital"
                                                width={124}
                                                height={42}
                                                className="h-auto w-[124px]"
                                                priority={false}
                                            />
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                                            <Button
                                                variant="outline" size="icon-sm"
                                                aria-label="Semana anterior"
                                                onClick={() => setWeekStart(w => subWeeks(w, 1))}
                                                className="size-9 rounded-md border-slate-200 bg-white text-arena-navy-800 shadow-none hover:bg-slate-50"
                                            >
                                                <ChevronLeft className="w-4 h-4" />
                                            </Button>

                                            <span className="flex h-9 min-w-[106px] items-center justify-center text-sm font-semibold text-arena-navy-800">
                                                {format(weekDays[0], "dd/MM")} - {format(weekDays[6], "dd/MM")}
                                            </span>

                                            <Button
                                                variant="outline" size="icon-sm"
                                                aria-label="Próxima semana"
                                                onClick={() => setWeekStart(w => addWeeks(w, 1))}
                                                className="size-9 rounded-md border-slate-200 bg-white text-arena-navy-800 shadow-none hover:bg-slate-50"
                                            >
                                                <ChevronRight className="w-4 h-4" />
                                            </Button>

                                            <Button
                                                variant="outline" size="sm"
                                                onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
                                                className="h-9 rounded-md border-slate-200 px-4 text-sm font-semibold text-arena-navy-800 shadow-none hover:bg-slate-50"
                                            >
                                                Hoje
                                            </Button>
                                            <Button
                                                size="sm"
                                                onClick={handlePrint}
                                                className="h-9 rounded-md bg-arena-navy-800 px-4 text-sm font-bold text-white shadow-none hover:bg-arena-navy-900"
                                            >
                                                Download
                                                <Download className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </DialogHeader>

                                <div className="min-h-0 overflow-auto">
                                    <div className="min-w-[980px]">
                                        <div className="grid grid-cols-[120px_repeat(7,minmax(124px,1fr))] border-b border-t border-slate-300">
                                            <div className="flex h-14 items-center px-3 text-sm font-medium text-[#007793]">
                                                Horário
                                            </div>
                                            {weekDays.map((day, i) => (
                                                <div
                                                    key={i}
                                                    className="flex h-14 items-center justify-center px-3 text-center text-sm font-medium capitalize text-[#007793]"
                                                >
                                                    {format(day, "EEEE", { locale: ptBR })} ({format(day, "dd/MM")})
                                                </div>
                                            ))}
                                        </div>

                                        {hours.map((hour) => (
                                            <div
                                                key={hour}
                                                className="grid grid-cols-[120px_repeat(7,minmax(124px,1fr))] border-b border-slate-300"
                                            >
                                                <div className="flex min-h-14 items-center px-3 text-sm font-bold text-arena-navy-800">
                                                    {String(hour).padStart(2, '0')}h00
                                                </div>
                                                {weekDays.map((day, i) => {
                                                    const availableSlots = getAvailableSlotsForCell(day, hour)
                                                    const isUnavailable = availableSlots.length === 0

                                                    return (
                                                        <div
                                                            key={i}
                                                            className={cn(
                                                                "flex min-h-14 items-center justify-center px-2 py-2 text-center",
                                                                isUnavailable && "bg-[#f3f5f8]"
                                                            )}
                                                        >
                                                            {isUnavailable ? (
                                                                <span className="text-sm font-medium text-arena-navy-800">
                                                                    Indisponível
                                                                </span>
                                                            ) : (
                                                                <div className="flex flex-col items-center justify-center leading-tight text-arena-navy-800">
                                                                    <span className="text-sm font-medium">
                                                                        Disponível
                                                                    </span>
                                                                    <span className="mt-0.5 max-w-full text-xs font-bold">
                                                                        {formatCourtNames(availableSlots.map(slot => slot.name))}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </section>

                            {courts.length > 0 && (
                                <section className="flex max-h-[180px] shrink-0 flex-col rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm">
                                    <h3 className="font-heading text-base font-bold text-arena-navy-800">
                                        Esportes por quadra
                                    </h3>

                                    <div className="mt-3 min-h-0 overflow-auto border-b border-slate-200">
                                        {courts.map(court => (
                                            <div
                                                key={court.id}
                                                className="grid grid-cols-[160px_1fr] items-center border-t border-slate-200 px-4 py-2 text-sm text-arena-navy-800"
                                            >
                                                <span className="font-bold">
                                                    {court.name}
                                                </span>
                                                <span className="font-medium">
                                                    {court.sports?.map((sport: any) => sport.name).join(', ') || '—'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
