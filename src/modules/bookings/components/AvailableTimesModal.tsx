"use client"

import { useState, useEffect } from "react"
import { Calendar as CalendarIcon, Clock, Loader2, X, Check, Info, Printer } from "lucide-react"
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
import { format, addDays, startOfWeek, parseISO, getHours, isSameDay, startOfDay, endOfDay } from "date-fns"
import { ptBR } from "date-fns/locale"
import { cn } from "@/lib/utils"

interface AvailableTimesModalProps {
    isOpen: boolean;
    onClose: () => void;
    arenaId: string;
    currentDate: Date;
}

export function AvailableTimesModal({ isOpen, onClose, arenaId, currentDate }: AvailableTimesModalProps) {
    const [courts, setCourts] = useState<any[]>([])
    const [bookings, setBookings] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(false)

    const weekDays = Array.from({ length: 7 }, (_, i) => {
        const date = addDays(startOfWeek(currentDate, { weekStartsOn: 1 }), i);
        return date;
    });

    const hours = Array.from({ length: 18 }, (_, i) => i + 6); // 06:00 to 23:00

    useEffect(() => {
        if (isOpen) {
            loadData()
        }
    }, [isOpen, arenaId, currentDate])

    async function loadData() {
        setIsLoading(true)
        try {
            const startStr = startOfDay(weekDays[0]).toISOString()
            const endStr = endOfDay(weekDays[6]).toISOString()

            const [courtsRes, bookingsRes] = await Promise.all([
                getCourtsByArenaAction(arenaId),
                getBookingsByArenaAction(arenaId, startStr, endStr)
            ])
            setCourts(courtsRes.data ?? [])
            setBookings(bookingsRes.data ?? [])
        } catch (error) {
            console.error("Error loading availability data:", error)
        } finally {
            setIsLoading(false)
        }
    }

    const getAvailableCourtsForSlot = (date: Date, hour: number) => {
        return courts.filter(court => {
            const dayName = format(date, 'EEEE', { locale: ptBR });
            const formattedDayName = dayName.charAt(0).toUpperCase() + dayName.slice(1);
            const config = court.day_config?.find((d: any) => d.day.toLowerCase() === formattedDayName.toLowerCase());

            if (!config || !config.enabled) return false;

            const startH = parseInt(config.startTime.split(':')[0]);
            const endH = parseInt(config.endTime.split(':')[0]);
            const isWithinSchedule = hour >= startH && hour < endH;

            if (!isWithinSchedule) return false;

            const hasBooking = bookings.some(b => {
                const bookingStart = parseISO(b.start_time);
                const bookingEnd = parseISO(b.end_time);

                const slotStart = new Date(date);
                slotStart.setHours(hour, 0, 0, 0);
                const slotEnd = new Date(date);
                slotEnd.setHours(hour + 1, 0, 0, 0);

                return b.court_id === court.id &&
                    b.status !== 'cancelled' &&
                    !(bookingEnd <= slotStart || bookingStart >= slotEnd);
            });

            return !hasBooking;
        });
    };

    const handlePrint = () => {
        const printContent = document.getElementById('report-content-to-print');
        if (!printContent) return;

        const printWindow = window.open('', '_blank', 'width=1200,height=800');
        if (!printWindow) {
            alert('Por favor, habilite pop-ups para imprimir o relatório.');
            return;
        }

        // We need to inject Tailwind reset and basic styles for the report
        printWindow.document.write(`
            <html>
                <head>
                    <title>Relatório de Disponibilidade - Arena Digital</title>
                    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
                    <style>
                        @page { size: landscape; margin: 5mm; }
                        body { 
                            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                            padding: 10px;
                            color: #002B40;
                            background: white;
                        }
                        .report-header { margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #f1f5f9; padding-bottom: 1rem; }
                        .report-title { font-size: 1.5rem; font-weight: 900; color: #002B40; letter-spacing: -0.025em; }
                        .report-meta { text-align: right; color: #64748b; font-size: 0.75rem; font-weight: 600; }
                        
                        /* Replicating the web UI grid */
                        .grid-container { 
                            border: 1px solid #e2e8f0; 
                            border-radius: 1rem; 
                            overflow: hidden; 
                            background: white;
                            width: 100%;
                        }
                        .grid-row { 
                            display: grid; 
                            grid-template-columns: 70px repeat(7, 1fr); 
                            border-bottom: 1px solid #f1f5f9; 
                        }
                        .grid-row:last-child { border-bottom: none; }
                        
                        .cell { 
                            padding: 4px; 
                            text-align: center; 
                            display: flex; 
                            flex-direction: column; 
                            justify-content: center; 
                            align-items: center; 
                            min-height: 45px; 
                            border-right: 1px solid #f1f5f9;
                        }
                        .cell:last-child { border-right: none; }
                        
                        .header-row { background-color: #f8fafc; }
                        .header-cell { 
                            padding: 8px; 
                            font-weight: 800; 
                            font-size: 0.7rem; 
                            color: #002B40;
                            text-transform: capitalize;
                        }
                        .header-date { font-weight: 500; color: #64748b; font-size: 0.6rem; }
                        
                        .time-cell { 
                            font-weight: 800; 
                            color: #64748b; 
                            font-size: 0.65rem; 
                            background: white;
                        }
                        
                        .avail-badge { 
                            font-size: 8px; 
                            font-weight: 900; 
                            text-transform: uppercase; 
                            letter-spacing: 0.05em;
                            color: #10b981;
                        }
                        .unavail-badge { 
                            font-size: 8px; 
                            font-weight: 900; 
                            text-transform: uppercase; 
                            letter-spacing: 0.05em;
                            color: #cbd5e1;
                        }
                        .court-text { 
                            font-size: 9px; 
                            font-weight: 700; 
                            color: #002B40; 
                            line-height: 1.1;
                            margin-top: 1px;
                        }
                        .gray-bg { background-color: #f9fafb; }
                        
                        .footer { margin-top: 1.5rem; padding: 1rem; border: 1px solid #f1f5f9; border-radius: 1rem; }
                        .footer-title { font-size: 0.75rem; font-weight: 900; color: #002B40; text-transform: uppercase; margin-bottom: 0.75rem; }
                        .footer-item { display: grid; grid-template-columns: 120px 1fr; font-size: 0.7rem; padding: 4px 0; border-bottom: 1px solid #f8fafc; }
                        .footer-item:last-child { border-bottom: none; }
                        .court-label { font-weight: 800; color: #002B40; }
                        .sports-label { color: #64748b; font-weight: 500; }
                        
                        /* High quality print settings */
                        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    </style>
                </head>
                <body>
                    <div class="report-header">
                        <h1 class="report-title">Grade de Horários Disponíveis</h1>
                        <div class="report-meta">
                            <div>Arena Digital - Gestão de Arenas</div>
                            <div>Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</div>
                        </div>
                    </div>
                    
                    <div class="grid-container">
                        <!-- Header -->
                        <div class="grid-row header-row">
                            <div class="cell header-cell">HORÁRIO</div>
                            ${weekDays.map(day => `
                                <div class="cell header-cell">
                                    <div>${format(day, "EEEE", { locale: ptBR })}</div>
                                    <div class="header-date">(${format(day, "dd/MM")})</div>
                                </div>
                            `).join('')}
                        </div>

                        <!-- Rows -->
                        ${hours.map(hour => `
                            <div class="grid-row">
                                <div class="cell time-cell">${String(hour).padStart(2, '0')}h00</div>
                                ${weekDays.map(day => {
            const availableCourts = getAvailableCourtsForSlot(day, hour);
            const isAvailable = availableCourts.length > 0;
            const names = availableCourts.map(c => c.name.replace('Quadra ', '').trim());

            let courtLabel = "";
            if (isAvailable) {
                if (names.length === courts.length) courtLabel = "Todas as quadras";
                else if (names.length === 1) courtLabel = "Quadra " + names[0];
                else courtLabel = "Qds: " + names.join(', ');
            }

            return `
                                        <div class="cell ${!isAvailable ? 'gray-bg' : ''}">
                                            <span class="${isAvailable ? 'avail-badge' : 'unavail-badge'}">
                                                ${isAvailable ? 'Disponível' : 'Indisponível'}
                                            </span>
                                            ${isAvailable ? `<span class="court-text">${courtLabel}</span>` : ''}
                                        </div>
                                    `;
        }).join('')}
                            </div>
                        `).join('')}
                    </div>

                    <div class="footer">
                        <div class="footer-title">Esportes por quadra</div>
                        ${courts.map(court => `
                            <div class="footer-item">
                                <span class="court-label">${court.name}</span>
                                <span class="sports-label">${court.sports?.map((s: any) => s.name).join(', ') || 'Nenhum esporte'}</span>
                            </div>
                        `).join('')}
                    </div>

                    <script>
                        window.onload = () => {
                            setTimeout(() => {
                                window.print();
                            }, 500);
                        };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[95vw] w-[98vw] xl:w-[95%] max-h-[95vh] overflow-auto p-0 border-none shadow-2xl rounded-3xl bg-[#F8FAFC]">
                <DialogHeader className="p-8 pb-4 bg-white sticky top-0 z-20 border-b border-[#002B40]/5 flex flex-row items-center justify-between print:hidden">
                    <DialogTitle className="text-2xl font-black text-[#002B40] tracking-tight">Grade de horários disponíveis</DialogTitle>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handlePrint}
                            className="h-9 font-bold gap-2 border-[#002B40]/10 text-[#002B40]/60 hover:text-[#002B40]"
                        >
                            <Printer className="h-4 w-4" />
                            Imprimir
                        </Button>
                        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-gray-100 h-9 w-9">
                            <X className="h-5 w-5" />
                        </Button>
                    </div>
                </DialogHeader>

                <div id="report-content-to-print" className="p-8 print:p-0 text-[#002B40]">
                    {isLoading ? (
                        <div className="h-96 flex flex-col items-center justify-center gap-4 text-[#002B40]/40 font-bold">
                            <Loader2 className="h-8 w-8 animate-spin text-[#FF6B00]" />
                            Carregando horários...
                        </div>
                    ) : (
                        <div className="space-y-8">
                            <Card className="border-none shadow-sm bg-white overflow-hidden overflow-x-auto">
                                <div className="w-full min-w-[1000px]">
                                    {/* Header Row */}
                                    <div className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-[#002B40]/5 bg-[#F8FAFC]">
                                        <div className="p-4 border-r border-[#002B40]/5 font-bold text-[#002B40]/40 text-xs text-center flex items-center justify-center">
                                            Horário
                                        </div>
                                        {weekDays.map((day, i) => (
                                            <div key={i} className="p-4 font-bold text-[#002B40] text-sm text-center border-r border-[#002B40]/5 last:border-none">
                                                <div className="capitalize">{format(day, "EEEE", { locale: ptBR })}</div>
                                                <div className="text-[#002B40]/40 text-xs font-normal">({format(day, "dd/MM")})</div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Content Rows */}
                                    {hours.map((hour) => (
                                        <div key={hour} className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-[#002B40]/5 last:border-none min-h-[60px]">
                                            <div className="p-3 border-r border-[#002B40]/5 font-bold text-[#002B40]/60 text-xs text-center flex items-center justify-center bg-white cursor-default">
                                                {String(hour).padStart(2, '0')}h00
                                            </div>
                                            {weekDays.map((day, i) => {
                                                const availableCourts = getAvailableCourtsForSlot(day, hour);
                                                const isAvailable = availableCourts.length > 0;

                                                return (
                                                    <div key={i} className={cn(
                                                        "p-2 border-r border-[#002B40]/5 last:border-none flex flex-col items-center justify-center text-center gap-0.5 transition-colors",
                                                        !isAvailable && "bg-gray-50/30"
                                                    )}>
                                                        <span className={cn(
                                                            "text-[9px] font-black uppercase tracking-wider",
                                                            isAvailable ? "text-emerald-600" : "text-[#002B40]/10"
                                                        )}>
                                                            {isAvailable ? "Disponível" : "Indisponível"}
                                                        </span>
                                                        {isAvailable ? (
                                                            <span className="text-[10px] font-bold text-[#002B40] leading-tight">
                                                                {(() => {
                                                                    const names = availableCourts.map(c => c.name.replace('Quadra ', '').trim());
                                                                    if (names.length === 0) return "";
                                                                    if (names.length === courts.length) return "Todas as quadras";
                                                                    if (names.length === 1) return `Quadra ${names[0]}`;
                                                                    if (names.length === 2) return `Quadra ${names[0]} e ${names[1]}`;
                                                                    const last = names.pop();
                                                                    return `Quadra ${names.join(', ')} e ${last}`;
                                                                })()}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[9px] font-medium text-[#002B40]/5">-</span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            </Card>

                            {/* Footer - Esportes por quadra */}
                            {courts.length > 0 && (
                                <div className="bg-white rounded-2xl border border-[#002B40]/5 p-6 space-y-4 shadow-sm">
                                    <h3 className="text-sm font-black text-[#002B40] uppercase tracking-wider">Esportes por quadra</h3>
                                    <div className="space-y-2">
                                        {courts.map((court) => (
                                            <div key={court.id} className="flex grid grid-cols-[120px_1fr] border-b border-[#002B40]/5 last:border-none py-2 gap-4">
                                                <span className="text-xs font-bold text-[#002B40]">{court.name}</span>
                                                <span className="text-xs text-[#002B40]/60 font-medium">
                                                    {court.sports?.map((s: any) => s.name).join(', ') || 'Nenhum esporte vinculado'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
