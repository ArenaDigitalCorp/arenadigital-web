"use client"

import { useUserSync } from "@/hooks/useUserSync";
import { ArenaService } from "@/modules/arenas/services/arenaService";
import { BookingService } from "@/modules/bookings/services/bookingService";
import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarIcon, Clock, User } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function SchedulePage() {
    const { dbUser, isLoading: userLoading } = useUserSync();
    const [arenas, setArenas] = useState<any[]>([]);
    const [selectedArena, setSelectedArena] = useState<string>("");
    const [bookings, setBookings] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function loadArenas() {
            if (dbUser) {
                try {
                    const data = await ArenaService.getArenasByOwner(dbUser.id);
                    setArenas(data);
                    if (data.length > 0) setSelectedArena(data[0].id);
                } catch (error) {
                    toast.error("Erro ao carregar arenas.");
                } finally {
                    setIsLoading(false);
                }
            }
        }
        loadArenas();
    }, [dbUser]);

    useEffect(() => {
        async function loadBookings() {
            if (selectedArena) {
                try {
                    const data = await BookingService.getBookingsByArena(selectedArena);
                    setBookings(data);
                } catch (error) {
                    toast.error("Erro ao carregar agenda.");
                }
            }
        }
        loadBookings();
    }, [selectedArena]);

    if (isLoading || userLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-[500px] w-full" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-3xl font-bold tracking-tight">Agenda</h2>

                {arenas.length > 0 && (
                    <div className="w-full md:w-64">
                        <Select value={selectedArena} onValueChange={setSelectedArena}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione a Arena" />
                            </SelectTrigger>
                            <SelectContent>
                                {arenas.map((arena) => (
                                    <SelectItem key={arena.id} value={arena.id}>
                                        {arena.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>

            <div className="grid gap-4">
                {bookings.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 flex flex-col items-center justify-center text-center">
                            <CalendarIcon className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
                            <CardTitle className="text-muted-foreground">Nenhuma reserva encontrada</CardTitle>
                            <p className="text-sm text-muted-foreground mt-2">
                                As reservas feitas por atletas ou lançadas manualmente aparecerão aqui.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {bookings.map((booking) => (
                            <Card key={booking.id} className="overflow-hidden border-l-4 border-l-primary">
                                <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-start gap-4">
                                        <div className="bg-primary/10 p-2 rounded-lg text-primary">
                                            <Clock className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <div className="font-semibold">
                                                {format(new Date(booking.start_time), "HH:mm")} - {format(new Date(booking.end_time), "HH:mm")}
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                {format(new Date(booking.start_time), "dd 'de' MMMM", { locale: ptBR })}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-1 items-center gap-4 px-4">
                                        <Badge variant="outline" className="bg-background">
                                            {booking.courts?.name}
                                        </Badge>
                                        <div className="flex items-center gap-2 text-sm font-medium">
                                            <User className="h-4 w-4 text-muted-foreground" />
                                            {booking.athlete_name}
                                        </div>
                                    </div>

                                    <div>
                                        <Badge variant={booking.status === 'confirmed' ? "default" : "secondary"}>
                                            {booking.status === 'confirmed' ? "Confirmado" : booking.status}
                                        </Badge>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
