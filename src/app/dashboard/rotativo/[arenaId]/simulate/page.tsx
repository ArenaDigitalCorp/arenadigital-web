"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Activity, User, Calendar as CalendarIcon, Loader2, CheckCircle2, AlertCircle, Search } from "lucide-react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { getAthletesByArenaAction } from "@/modules/athletes/actions/athleteActions"
import { getRotativosAction, registerAthleteAction } from "@/modules/rotativos/actions/rotativoActions"
import { toast } from "sonner"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

export default function SimulateRegistrationPage({ params }: { params: { arenaId: string } }) {
    const [date, setDate] = useState<Date>(new Date())
    const [rotativos, setRotativos] = useState<any[]>([])
    const [athletes, setAthletes] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [selectedRotativo, setSelectedRotativo] = useState<string>("")
    const [selectedAthlete, setSelectedAthlete] = useState<string>("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")

    const loadData = useCallback(async () => {
        try {
            setIsLoading(true)
            const dateStr = format(date, 'yyyy-MM-dd')
            const rotativoRes = await getRotativosAction(params.arenaId, dateStr)

            // Since we don't have a specific getAthletes action without arenaId, 
            // we'll need to fetch them. In real app, the athlete would be logged in.
            // For simulation, we'll fetch athletes from the same arena.
            // We need to know the arenaId. Let's assume the service handles context or returns first arena's athletes.
            // Wait, AthleteService.getAthletesByArena needs arenaId.
            // The getRotativosAction already knows the arena.
            // Let's modify the action or fetch it here.

            if (rotativoRes.success) {
                setRotativos(rotativoRes.data || [])
                // After getting rotativos, we can use the id_arena from the first one to fetch athletes if needed
                if (rotativoRes.data && rotativoRes.data.length > 0) {
                    const athletesRes = await getAthletesByArenaAction(rotativoRes.data[0].id_arena)
                    setAthletes(athletesRes.data ?? [])
                }
            } else {
                toast.error(rotativoRes.error)
            }
        } catch (error) {
            console.error("Error loading simulation data:", error)
        } finally {
            setIsLoading(false)
        }
    }, [date])

    useEffect(() => {
        loadData()
    }, [loadData])

    const filteredAthletes = athletes.filter(a =>
        a.name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    async function handleRegister() {
        if (!selectedRotativo || !selectedAthlete) {
            toast.error("Selecione uma sessão e um atleta")
            return
        }

        const rotativo = rotativos.find(r => r.id === selectedRotativo)
        if (!rotativo) return

        try {
            setIsSubmitting(true)
            const result = await registerAthleteAction(selectedRotativo, selectedAthlete, rotativo.valor)

            if (result.success) {
                toast.success("Inscrição realizada com sucesso!")
                setSelectedAthlete("")
                loadData() // Refresh counts
            } else {
                toast.error(result.error)
            }
        } catch (error: any) {
            toast.error(error.message || "Erro ao realizar inscrição.")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8">
            <div className="space-y-1 text-center">
                <Badge variant="outline" className="text-[#FF6B00] border-[#FF6B00]/20 bg-[#FF6B00]/5 px-3 py-1 mb-2">
                    Área Experimental
                </Badge>
                <h1 className="text-3xl font-black text-[#002B40] uppercase tracking-tight">Simulador de Inscrição</h1>
                <p className="text-muted-foreground font-medium">
                    Simule a experiência do atleta no aplicativo e valide as regras do Rotativo.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Step 1: Select Session */}
                <Card className="border-none shadow-xl shadow-gray-100 rounded-3xl overflow-hidden">
                    <CardHeader className="bg-[#002B40] text-white">
                        <div className="flex items-center gap-2">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#FF6B00] text-xs font-bold">1</span>
                            <CardTitle className="text-lg font-bold uppercase tracking-widest">Sessão</CardTitle>
                        </div>
                        <CardDescription className="text-white/60">Escolha o horário para jogar</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                        <div className="flex items-center gap-2 text-sm font-bold text-[#002B40] uppercase tracking-wider mb-2">
                            <CalendarIcon className="h-4 w-4" />
                            {format(date, "PPPP", { locale: ptBR })}
                        </div>

                        {isLoading ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="h-8 w-8 animate-spin text-[#FF6B00]" />
                            </div>
                        ) : rotativos.length === 0 ? (
                            <div className="text-center py-8 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-100">
                                <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                                <p className="text-sm text-muted-foreground font-medium">Nenhum rotativo aberto hoje.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {rotativos.map((r) => {
                                    const isFull = r.limitado && r.inscricoes_count >= r.limite_participantes;
                                    const isSelected = selectedRotativo === r.id;

                                    return (
                                        <button
                                            key={r.id}
                                            disabled={isFull}
                                            onClick={() => setSelectedRotativo(r.id)}
                                            className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${isSelected
                                                ? "border-[#FF6B00] bg-[#FFF5EF]"
                                                : isFull
                                                    ? "opacity-50 border-gray-50 bg-gray-50 cursor-not-allowed"
                                                    : "border-gray-100 hover:border-[#FF6B00]/40"
                                                }`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="space-y-1">
                                                    <span className="block font-black text-[#002B40] uppercase tracking-tight">{r.esporte?.name}</span>
                                                    <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase">
                                                        <Clock className="h-3 w-3" />
                                                        {r.hora_inicio.slice(0, 5)} - {r.hora_fim.slice(0, 5)}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="block text-sm font-bold text-[#FF6B00]">R$ {r.valor.toFixed(2)}</span>
                                                    <span className={`text-[10px] font-black uppercase tracking-tighter ${isFull ? "text-red-500" : "text-green-600"}`}>
                                                        {r.inscricoes_count} {r.limitado ? `/ ${r.limite_participantes}` : ""} VAGAS
                                                    </span>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Step 2: Select Athlete */}
                <Card className="border-none shadow-xl shadow-gray-100 rounded-3xl overflow-hidden">
                    <CardHeader className="bg-[#002B40] text-white">
                        <div className="flex items-center gap-2">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#FF6B00] text-xs font-bold">2</span>
                            <CardTitle className="text-lg font-bold uppercase tracking-widest">Atleta</CardTitle>
                        </div>
                        <CardDescription className="text-white/60">Quem vai participar?</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Buscar atleta pelo nome..."
                                className="h-12 pl-10 rounded-xl border-gray-100 bg-gray-50/50"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="h-64 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
                            {filteredAthletes.map(a => (
                                <button
                                    key={a.id}
                                    onClick={() => setSelectedAthlete(a.id)}
                                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${selectedAthlete === a.id
                                        ? "border-[#FF6B00] bg-[#FFF5EF]"
                                        : "border-gray-50 hover:bg-gray-50"
                                        }`}
                                >
                                    <div className="bg-[#002B40] text-white h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs">
                                        {a.name?.[0]?.toUpperCase()}
                                    </div>
                                    <span className="font-bold text-[#002B40] text-sm uppercase tracking-tight">{a.name}</span>
                                    {selectedAthlete === a.id && <CheckCircle2 className="h-4 w-4 text-[#FF6B00] ml-auto" />}
                                </button>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex justify-center pt-8">
                <Button
                    onClick={handleRegister}
                    disabled={!selectedRotativo || !selectedAthlete || isSubmitting}
                    className="h-16 px-12 bg-[#FF6B00] hover:bg-[#E66000] text-white font-black uppercase tracking-widest rounded-3xl shadow-2xl shadow-orange-500/20 active:scale-95 transition-all text-lg disabled:opacity-50 disabled:grayscale"
                >
                    {isSubmitting ? (
                        <div className="flex items-center gap-3">
                            <Loader2 className="h-6 w-6 animate-spin" />
                            PROCESSANDO...
                        </div>
                    ) : (
                        "Confirmar Inscrição"
                    )}
                </Button>
            </div>
        </div>
    )
}

function Clock(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </svg>
    )
}
