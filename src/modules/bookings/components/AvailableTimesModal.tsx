"use client"

import { useState, useEffect, useCallback } from "react"
import { Loader2, X, Printer, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { getCourtsByArenaAction } from "@/modules/courts/actions/courtActions"
import { getBookingsByArenaAction } from "@/modules/bookings/actions/bookingActions"
import {
    format, addDays, addWeeks, subWeeks,
    startOfWeek, parseISO, startOfDay, endOfDay,
} from "date-fns"
import { ptBR } from "date-fns/locale"
import { cn } from "@/lib/utils"

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

const STATUS_STYLES: Record<SlotStatus, { dot: string; text: string; row: string }> = {
    available:          { dot: 'bg-emerald-500',  text: 'text-emerald-700',     row: '' },
    'booked-avulso':    { dot: 'bg-[#FF6B00]',    text: 'text-[#FF6B00]/80',    row: 'opacity-70' },
    'booked-mensalista':{ dot: 'bg-amber-400',     text: 'text-amber-700/80',    row: 'opacity-70' },
    closed:             { dot: 'bg-slate-200',     text: 'text-slate-300',       row: 'opacity-40' },
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

    const isThisWeek = format(weekStart, 'yyyy-ww') === format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-ww')

    // ── Print ────────────────────────────────────────────────────────────────
    const handlePrint = () => {
        const printWindow = window.open('', '_blank', 'width=1400,height=900')
        if (!printWindow) { alert('Habilite pop-ups para imprimir.'); return }

        const dotColor = (s: SlotStatus) => ({
            available:            '#10b981',
            'booked-avulso':      '#FF6B00',
            'booked-mensalista':  '#f59e0b',
            closed:               '#e2e8f0',
        }[s])

        const textColor = (s: SlotStatus) => ({
            available:            '#047857',
            'booked-avulso':      '#9a3700',
            'booked-mensalista':  '#92400e',
            closed:               '#cbd5e1',
        }[s])

        const cellHtml = (day: Date, hour: number) => {
            const slots = getSlotsForCell(day, hour)
            if (slots.length === 0) return `<div style="color:#e2e8f0;font-size:8px;font-weight:700;text-align:center">—</div>`
            return slots.map(s => `
                <div style="display:flex;align-items:center;gap:3px;margin:1px 0">
                    <span style="width:5px;height:5px;border-radius:50%;background:${dotColor(s.status)};flex-shrink:0"></span>
                    <span style="font-size:8px;font-weight:700;color:${textColor(s.status)};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.name}</span>
                </div>`).join('')
        }

        printWindow.document.write(`
<html><head>
<title>Grade de Horários — Arena Digital</title>
<style>
  @page { size: landscape; margin: 6mm; }
  * { -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; box-sizing:border-box; }
  body { font-family: ui-sans-serif,system-ui,sans-serif; color:#002B40; background:#fff; padding:8px; }
  h1  { font-size:1.2rem; font-weight:900; letter-spacing:-.02em; margin:0 }
  .meta { color:#64748b; font-size:.65rem; font-weight:600; text-align:right }
  table { width:100%; border-collapse:collapse; margin-top:10px; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden }
  th,td { border:1px solid #f1f5f9; padding:3px 4px; vertical-align:top }
  .th-time { width:52px; background:#f8fafc; font-size:.6rem; font-weight:800; color:#64748b; text-align:center }
  .th-day  { background:#f8fafc; font-size:.65rem; font-weight:800; text-align:center; color:#002B40; text-transform:capitalize }
  .th-date { font-weight:500; color:#94a3b8; font-size:.55rem }
  .td-time { text-align:center; font-size:.6rem; font-weight:800; color:#94a3b8; background:#fafafa }
  .td-cell { min-width:80px; padding:3px 5px }
  .legend  { margin-top:10px; display:flex; gap:16px; font-size:.65rem; font-weight:700; align-items:center }
  .dot     { width:7px; height:7px; border-radius:50%; display:inline-block; margin-right:3px }
  footer   { margin-top:8px; font-size:.6rem; color:#94a3b8; text-align:right }
</style>
</head><body>
<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #f1f5f9;padding-bottom:8px;margin-bottom:4px">
  <div>
    <h1>Grade de Horários Disponíveis</h1>
    <div style="font-size:.65rem;color:#64748b;font-weight:600">
      Semana: ${format(weekDays[0], "dd/MM")} a ${format(weekDays[6], "dd/MM/yyyy")}
    </div>
  </div>
  <div class="meta"><div>Arena Digital</div><div>Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</div></div>
</div>
<table>
  <thead><tr>
    <th class="th-time">Horário</th>
    ${weekDays.map(d => `<th class="th-day"><div>${format(d,'EEEE',{locale:ptBR})}</div><div class="th-date">${format(d,'dd/MM')}</div></th>`).join('')}
  </tr></thead>
  <tbody>
    ${hours.map(h => `
    <tr>
      <td class="td-time">${String(h).padStart(2,'0')}h00</td>
      ${weekDays.map(d => `<td class="td-cell">${cellHtml(d,h)}</td>`).join('')}
    </tr>`).join('')}
  </tbody>
</table>
<div class="legend">
  <span><span class="dot" style="background:#10b981"></span>Disponível</span>
  <span><span class="dot" style="background:#FF6B00"></span>Reservado (Avulso)</span>
  <span><span class="dot" style="background:#f59e0b"></span>Reservado (Mensalista)</span>
</div>
${courts.length > 0 ? `
<div style="margin-top:8px;font-size:.65rem;">
  <strong style="color:#002B40;text-transform:uppercase;font-size:.55rem;letter-spacing:.06em">Esportes por espaço: </strong>
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
            <DialogContent className="sm:max-w-[95vw] w-[98vw] max-h-[95vh] overflow-auto p-0 border-none shadow-2xl rounded-3xl bg-[#F8FAFC]">

                {/* ── Header ── */}
                <DialogHeader className="p-6 pb-4 bg-white sticky top-0 z-20 border-b border-[#002B40]/5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <DialogTitle className="text-xl font-black text-[#002B40] tracking-tight">
                            Grade de horários disponíveis
                        </DialogTitle>

                        {/* Week navigation */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center bg-[#F1F5F9] rounded-xl p-1 gap-1">
                                <Button
                                    variant="ghost" size="icon"
                                    onClick={() => setWeekStart(w => subWeeks(w, 1))}
                                    className="h-8 w-8 hover:bg-white rounded-lg"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </Button>
                                <span className="px-3 text-sm font-bold text-[#002B40] min-w-[160px] text-center">
                                    {format(weekDays[0], "dd/MM")} – {format(weekDays[6], "dd/MM/yyyy")}
                                </span>
                                <Button
                                    variant="ghost" size="icon"
                                    onClick={() => setWeekStart(w => addWeeks(w, 1))}
                                    className="h-8 w-8 hover:bg-white rounded-lg"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                            {!isThisWeek && (
                                <Button
                                    variant="outline" size="sm"
                                    onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
                                    className="h-9 font-bold gap-1.5 border-[#002B40]/10 text-[#002B40]/60 hover:text-[#002B40]"
                                >
                                    <CalendarDays className="h-4 w-4" />
                                    Hoje
                                </Button>
                            )}
                            <Button
                                variant="outline" size="sm"
                                onClick={handlePrint}
                                className="h-9 font-bold gap-2 border-[#002B40]/10 text-[#002B40]/60 hover:text-[#002B40]"
                            >
                                <Printer className="h-4 w-4" />
                                Imprimir
                            </Button>
                            <Button
                                variant="ghost" size="icon"
                                onClick={onClose}
                                className="rounded-full hover:bg-gray-100 h-9 w-9"
                            >
                                <X className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                {/* ── Content ── */}
                <div className="p-6 space-y-5">
                    {isLoading ? (
                        <div className="h-96 flex flex-col items-center justify-center gap-4 text-[#002B40]/40 font-bold">
                            <Loader2 className="h-8 w-8 animate-spin text-[#FF6B00]" />
                            Carregando horários…
                        </div>
                    ) : (
                        <>
                            {/* Legend */}
                            <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-[#002B40]/60">
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                                    Disponível
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-[#FF6B00] inline-block" />
                                    Reservado — Avulso
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                                    Reservado — Mensalista
                                </div>
                            </div>

                            {/* Grid */}
                            <Card className="border-none shadow-sm bg-white overflow-hidden overflow-x-auto">
                                <div className="w-full min-w-[900px]">

                                    {/* Header row */}
                                    <div className="grid grid-cols-[72px_repeat(7,1fr)] border-b border-[#002B40]/5 bg-[#F8FAFC]">
                                        <div className="p-3 border-r border-[#002B40]/5 font-bold text-[#002B40]/40 text-[10px] text-center flex items-center justify-center">
                                            Horário
                                        </div>
                                        {weekDays.map((day, i) => (
                                            <div key={i} className={cn(
                                                "p-3 font-bold text-[#002B40] text-xs text-center border-r border-[#002B40]/5 last:border-none",
                                                format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') && "bg-[#FFF5EF]"
                                            )}>
                                                <div className="capitalize font-black">{format(day, "EEEE", { locale: ptBR })}</div>
                                                <div className="text-[#002B40]/40 text-[10px] font-medium">{format(day, "dd/MM")}</div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Hour rows */}
                                    {hours.map((hour) => (
                                        <div key={hour} className="grid grid-cols-[72px_repeat(7,1fr)] border-b border-[#002B40]/5 last:border-none">
                                            <div className="p-2 border-r border-[#002B40]/5 font-bold text-[#002B40]/50 text-[10px] text-center flex items-center justify-center bg-white">
                                                {String(hour).padStart(2, '0')}h00
                                            </div>
                                            {weekDays.map((day, i) => {
                                                const slots = getSlotsForCell(day, hour)
                                                const hasAvailable = slots.some(s => s.status === 'available')

                                                return (
                                                    <div key={i} className={cn(
                                                        "p-1.5 border-r border-[#002B40]/5 last:border-none min-h-[52px]",
                                                        slots.length === 0 && "bg-slate-50/60",
                                                        hasAvailable && "bg-white",
                                                        format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') && "bg-[#FFFBF8]"
                                                    )}>
                                                        {slots.length === 0 ? (
                                                            <span className="text-[9px] text-slate-200 font-bold flex items-center justify-center h-full">—</span>
                                                        ) : (
                                                            <div className="space-y-0.5">
                                                                {slots.map(slot => {
                                                                    const st = STATUS_STYLES[slot.status]
                                                                    return (
                                                                        <div key={slot.id} className={cn("flex items-center gap-1", st.row)}>
                                                                            <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", st.dot)} />
                                                                            <span className={cn("text-[9px] font-bold leading-tight truncate", st.text)}>
                                                                                {slot.name}
                                                                            </span>
                                                                        </div>
                                                                    )
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    ))}
                                </div>
                            </Card>

                            {/* Footer — sports per court */}
                            {courts.length > 0 && (
                                <div className="bg-white rounded-2xl border border-[#002B40]/5 p-5 shadow-sm">
                                    <h3 className="text-[10px] font-black text-[#002B40]/40 uppercase tracking-wider mb-3">
                                        Esportes por espaço
                                    </h3>
                                    <div className="flex flex-wrap gap-x-8 gap-y-1.5">
                                        {courts.map(c => (
                                            <div key={c.id} className="flex items-center gap-2 text-xs">
                                                <span className="font-black text-[#002B40]">{c.name}</span>
                                                <span className="text-[#002B40]/40 font-medium">
                                                    {c.sports?.map((s: any) => s.name).join(', ') || '—'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
