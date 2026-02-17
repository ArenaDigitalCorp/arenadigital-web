"use client"

import { useState, useEffect, useCallback } from "react"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Activity, Clock, Users, DollarSign, Loader2, ClipboardList, Info } from "lucide-react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { toast } from "sonner"
import { AthleteService } from "@/modules/athletes/services/athleteService"
import { createRotativoAction, getRotativosAction, getParticipantsAction } from "@/modules/rotativos/actions/rotativoActions"
import { Badge } from "@/components/ui/badge"

const rotativoFormSchema = z.object({
    id_esporte: z.string().min(1, "Selecione o esporte"),
    hora_inicio: z.string().min(5, "Hora de início é obrigatória"),
    hora_fim: z.string().min(5, "Hora de fim é obrigatória"),
    valor: z.string().min(1, "Valor é obrigatório"),
    limitado: z.boolean().default(false),
    limite_participantes: z.string().optional(),
})

type RotativoFormValues = z.infer<typeof rotativoFormSchema>

export default function RotativoPage() {
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
    const [rotativos, setRotativos] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [isParticipantsModalOpen, setIsParticipantsModalOpen] = useState(false)
    const [sports, setSports] = useState<any[]>([])
    const [selectedRotativo, setSelectedRotativo] = useState<any>(null)
    const [participants, setParticipants] = useState<any[]>([])
    const [isLoadingParticipants, setIsLoadingParticipants] = useState(false)

    const loadRotativos = useCallback(async () => {
        if (!selectedDate) return
        try {
            setIsLoading(true)
            const dateStr = format(selectedDate, 'yyyy-MM-dd')
            const result = await getRotativosAction(dateStr)
            if (result.success) {
                setRotativos(result.data || [])
            } else {
                toast.error(result.error)
            }
        } catch (error) {
            console.error("Error loading rotativos:", error)
        } finally {
            setIsLoading(false)
        }
    }, [selectedDate])

    useEffect(() => {
        loadRotativos()
    }, [loadRotativos])

    useEffect(() => {
        async function loadSports() {
            try {
                const data = await AthleteService.getSports()
                setSports(data)
            } catch (error) {
                console.error("Error loading sports:", error)
            }
        }
        loadSports()
    }, [])

    const form = useForm<RotativoFormValues>({
        resolver: zodResolver(rotativoFormSchema),
        defaultValues: {
            id_esporte: "",
            hora_inicio: "08:00",
            hora_fim: "12:00",
            valor: "50",
            limitado: false,
            limite_participantes: "20",
        },
    })

    const isLimitado = form.watch("limitado")

    async function onSubmit(values: RotativoFormValues) {
        if (!selectedDate) return
        try {
            const result = await createRotativoAction({
                ...values,
                data: format(selectedDate, 'yyyy-MM-dd'),
                valor: parseFloat(values.valor),
                limite_participantes: values.limitado ? parseInt(values.limite_participantes || "0") : null
            })

            if (result.success) {
                toast.success("Rotativo aberto com sucesso!")
                setIsCreateModalOpen(false)
                form.reset()
                loadRotativos()
            } else {
                toast.error(result.error)
            }
        } catch (error) {
            toast.error("Erro inesperado ao salvar.")
        }
    }

    const viewParticipants = async (rotativo: any) => {
        setSelectedRotativo(rotativo)
        setIsParticipantsModalOpen(true)
        try {
            setIsLoadingParticipants(true)
            const result = await getParticipantsAction(rotativo.id)
            if (result.success) {
                setParticipants(result.data || [])
            } else {
                toast.error(result.error)
            }
        } catch (error) {
            console.error("Error loading participants:", error)
        } finally {
            setIsLoadingParticipants(false)
        }
    }

    return (
        <div className="p-8 space-y-8">
            <div className="flex items-start justify-between">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold text-[#002B40]">Gestão de Rotativo</h1>
                    <p className="text-muted-foreground">
                        Organize sessões de jogo aberto e gerencie os participantes.
                    </p>
                </div>
                <Button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="bg-[#FF6B00] hover:bg-[#E66000] text-white gap-2 px-6 py-6 h-auto text-base rounded-lg font-semibold shadow-md active:scale-95 transition-all"
                >
                    Abrir Rotativo
                    <Plus className="h-5 w-5" />
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                {/* Calendar Section */}
                <div className="md:col-span-4 lg:col-span-3">
                    <Card className="border-none shadow-sm h-fit">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg font-bold text-[#002B40]">Selecionar Dia</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Calendar
                                mode="single"
                                selected={selectedDate}
                                onSelect={setSelectedDate}
                                locale={ptBR}
                                className="w-full"
                            />
                        </CardContent>
                    </Card>
                </div>

                {/* Rotativos List Section */}
                <div className="md:col-span-8 lg:col-span-9 space-y-6">
                    <Card className="border-none shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-xl font-bold text-[#002B40]">
                                {selectedDate ? format(selectedDate, "dd 'de' MMMM", { locale: ptBR }) : "Selecione uma data"}
                            </CardTitle>
                            <Badge variant="outline" className="text-[#FF6B00] border-[#FF6B00]/20 bg-[#FF6B00]/5 px-3 py-1">
                                {rotativos.length} sessões
                            </Badge>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? (
                                <div className="flex justify-center py-12">
                                    <Loader2 className="h-10 w-10 animate-spin text-[#FF6B00]" />
                                </div>
                            ) : rotativos.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                                    <div className="bg-gray-100 p-6 rounded-full">
                                        <Activity className="h-10 w-10 text-gray-400" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-lg font-semibold text-[#002B40]">Nenhum rotativo aberto</p>
                                        <p className="text-sm text-muted-foreground">Clique no botão "Abrir Rotativo" para começar.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                    {rotativos.map((r) => (
                                        <div key={r.id} className="relative group overflow-hidden bg-white border border-gray-100 rounded-2xl p-6 hover:shadow-xl hover:border-[#FF6B00]/20 transition-all duration-300">
                                            <div className="flex justify-between items-start mb-6">
                                                <div className="bg-[#FFF5EF] p-3 rounded-xl">
                                                    <Activity className="h-6 w-6 text-[#FF6B00]" />
                                                </div>
                                                <div className="text-right">
                                                    <span className="block text-2xl font-black text-[#FF6B00]">R$ {r.valor.toFixed(2)}</span>
                                                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Investimento</span>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <div>
                                                    <h3 className="text-lg font-bold text-[#002B40] uppercase tracking-tight">{r.esporte?.name}</h3>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="bg-gray-50 p-2 rounded-lg">
                                                            <Clock className="h-4 w-4 text-gray-400" />
                                                        </div>
                                                        <div>
                                                            <span className="block text-[10px] text-muted-foreground font-bold uppercase">Horário</span>
                                                            <span className="text-sm font-semibold text-[#002B40]">{r.hora_inicio.slice(0, 5)} - {r.hora_fim.slice(0, 5)}</span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-3">
                                                        <div className="bg-gray-50 p-2 rounded-lg">
                                                            <Users className="h-4 w-4 text-gray-400" />
                                                        </div>
                                                        <div>
                                                            <span className="block text-[10px] text-muted-foreground font-bold uppercase">Inscritos</span>
                                                            <span className="text-sm font-semibold text-[#002B40]">
                                                                {r.inscricoes_count} {r.limitado ? `/ ${r.limite_participantes}` : ""}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <Button
                                                    variant="secondary"
                                                    onClick={() => viewParticipants(r)}
                                                    className="w-full mt-4 bg-[#002B40] text-white hover:bg-[#003650] gap-2 font-bold py-6 rounded-xl transition-all"
                                                >
                                                    <ClipboardList className="h-5 w-5" />
                                                    Ver Inscritos
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Modal de Abertura */}
            <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                <DialogContent className="sm:max-w-[500px] p-0 border-none overflow-hidden rounded-3xl">
                    <div className="bg-[#002B40] p-8 text-white relative">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-black uppercase tracking-tight">Novo Rotativo</DialogTitle>
                            <DialogDescription className="text-white/60 font-medium">
                                Configure os detalhes da sessão para {selectedDate && format(selectedDate, "dd/MM")}.
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="p-8 bg-white">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                <FormField
                                    control={form.control}
                                    name="id_esporte"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[#002B40] font-bold uppercase text-[10px] tracking-widest">Esporte</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="h-12 rounded-xl border-gray-100 bg-gray-50/50">
                                                        <SelectValue placeholder="Selecione o esporte" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {sports.map((s) => (
                                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="grid grid-cols-2 gap-6">
                                    <FormField
                                        control={form.control}
                                        name="hora_inicio"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[#002B40] font-bold uppercase text-[10px] tracking-widest">Início</FormLabel>
                                                <FormControl>
                                                    <Input type="time" {...field} className="h-12 rounded-xl border-gray-100 bg-gray-50/50" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="hora_fim"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[#002B40] font-bold uppercase text-[10px] tracking-widest">Término</FormLabel>
                                                <FormControl>
                                                    <Input type="time" {...field} className="h-12 rounded-xl border-gray-100 bg-gray-50/50" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <FormField
                                    control={form.control}
                                    name="valor"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[#002B40] font-bold uppercase text-[10px] tracking-widest">Valor da Inscrição (R$)</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                                    <Input placeholder="50.00" {...field} className="h-12 pl-10 rounded-xl border-gray-100 bg-gray-50/50" />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="space-y-4 pt-4 border-t border-gray-50">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <FormLabel className="text-[#002B40] font-bold text-sm">Limitar Participantes</FormLabel>
                                            <p className="text-xs text-muted-foreground font-medium">Controle o número máximo de inscritos.</p>
                                        </div>
                                        <FormField
                                            control={form.control}
                                            name="limitado"
                                            render={({ field }) => (
                                                <FormControl>
                                                    <Switch
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                    />
                                                </FormControl>
                                            )}
                                        />
                                    </div>

                                    {isLimitado && (
                                        <FormField
                                            control={form.control}
                                            name="limite_participantes"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <Input type="number" placeholder="Limite de pessoas" {...field} className="h-12 rounded-xl border-gray-100 bg-gray-50/50" />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    )}
                                </div>

                                <Button type="submit" className="w-full h-14 bg-[#FF6B00] hover:bg-[#E66000] text-white font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-orange-500/20 active:scale-95 transition-all">
                                    Abrir Sessão
                                </Button>
                            </form>
                        </Form>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Modal de Inscritos (Relatório) */}
            <Dialog open={isParticipantsModalOpen} onOpenChange={setIsParticipantsModalOpen}>
                <DialogContent className="sm:max-w-[600px] p-0 border-none rounded-3xl overflow-hidden">
                    <div className="bg-[#002B40] p-8 text-white relative">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-black uppercase tracking-tight">Inscritos no Rotativo</DialogTitle>
                            <DialogDescription className="text-white/60 font-medium">
                                {selectedRotativo?.esporte?.name} | {selectedRotativo?.hora_inicio.slice(0, 5)} - {selectedRotativo?.hora_fim.slice(0, 5)}
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="p-8 bg-white min-h-[400px]">
                        {isLoadingParticipants ? (
                            <div className="flex justify-center items-center h-[300px]">
                                <Loader2 className="h-10 w-10 animate-spin text-[#FF6B00]" />
                            </div>
                        ) : participants.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-[300px] text-center space-y-4">
                                <div className="bg-orange-50 p-6 rounded-full">
                                    <Users className="h-10 w-10 text-[#FF6B00]" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-lg font-bold text-[#002B40]">Nenhum inscrito ainda</p>
                                    <p className="text-sm text-muted-foreground">As inscrições realizadas via App aparecerão aqui.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between px-4 py-2 bg-gray-50 rounded-lg text-[10px] font-black uppercase text-gray-400 tracking-widest">
                                    <span>Atleta</span>
                                    <span>Data Inscrição</span>
                                </div>
                                <div className="space-y-2">
                                    {participants.map((p) => (
                                        <div key={p.id} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl hover:border-[#FF6B00]/20 hover:bg-[#FFF5EF]/10 transition-all">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-[#002B40] text-white h-10 w-10 rounded-xl flex items-center justify-center font-bold">
                                                    {p.atleta?.nome_perfil?.[0]?.toUpperCase()}
                                                </div>
                                                <div>
                                                    <span className="block font-bold text-[#002B40] uppercase tracking-tight">{p.atleta?.nome_perfil}</span>
                                                    <span className="text-[10px] text-[#FF6B00] font-black tracking-widest uppercase">PAGO</span>
                                                </div>
                                            </div>
                                            <div className="text-right text-xs font-medium text-gray-500">
                                                {format(new Date(p.data_inscricao), "dd/MM/yyyy HH:mm")}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
