"use client"

import { useState, useEffect, useRef } from "react"
import { Search, Save, X, Loader2, Check, Users } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  SelectValue,
} from "@/components/ui/select"
import { searchAthletesAction } from "@/modules/loyalty/actions/loyaltyActions"
import { getArenaByIdAction } from "@/modules/arenas/actions/arenaActions"
import { createPlanoMensalistaAction } from "@/modules/bookings/actions/mensalistaActions"
import { toast } from "sonner"
import { normalizeString } from "@/lib/utils"

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
  id: string
  nome_perfil: string
  telefone: string
}

interface Sport {
  id: string
  name: string
}

interface MensalistaModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  arenaId: string
  courtId: string
}

export function MensalistaModal({
  isOpen,
  onClose,
  onSuccess,
  arenaId,
  courtId,
}: MensalistaModalProps) {
  const [search, setSearch] = useState("")
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [selectedAthlete, setSelectedAthlete] = useState<Athlete | null>(null)
  const [isSearching, setIsSearching] = useState(false)

  const [diaSemana, setDiaSemana] = useState<string>("1")
  const [horarioInicio, setHorarioInicio] = useState("19:00")
  const [horarioFim, setHorarioFim] = useState("20:00")
  const [sessoesPorMes, setSessoesPorMes] = useState("4")
  const [valorMensal, setValorMensal] = useState("")
  const [selectedSport, setSelectedSport] = useState("")
  const [arenaSports, setArenaSports] = useState<Sport[]>([])
  const [isLoadingSports, setIsLoadingSports] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const searchTimeout = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadArenaSports()
    }
  }, [isOpen])

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

  const handleSave = async () => {
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
    setDiaSemana("1")
    setHorarioInicio("19:00")
    setHorarioFim("20:00")
    setSessoesPorMes("4")
    setValorMensal("")
    setSelectedSport("")
  }

  const valorPorSessao =
    valorMensal && sessoesPorMes
      ? (Number(valorMensal) / Number(sessoesPorMes)).toFixed(2)
      : null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
        <DialogHeader className="p-8 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-arena-button/10">
              <Users className="h-5 w-5 text-arena-button" />
            </div>
            <DialogTitle className="text-2xl font-black text-arena-navy-800 tracking-tight">
              Novo Mensalista
            </DialogTitle>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] px-8">
          <div className="space-y-5 pb-8">
            {/* Atleta */}
            <div className="space-y-2 relative">
              <Label className="text-xs font-bold uppercase text-arena-navy-800/40 tracking-wider">
                Atleta
              </Label>
              {!selectedAthlete ? (
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-arena-navy-800/20" />
                  <Input
                    placeholder="Buscar atleta vinculado à arena"
                    value={search}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="pl-12 h-14 border-arena-navy-800/10 focus:ring-arena-button focus:border-arena-button rounded-xl font-bold text-arena-navy-800"
                  />
                  {isSearching && (
                    <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-arena-button" />
                  )}
                  {athletes.length > 0 && (
                    <div className="absolute z-50 w-full mt-2 bg-white border border-arena-navy-800/10 rounded-2xl shadow-2xl max-h-48 overflow-auto p-2">
                      {athletes.map((athlete) => (
                        <button
                          key={athlete.id}
                          onClick={() => {
                            setSelectedAthlete(athlete)
                            setSearch(athlete.nome_perfil)
                            setAthletes([])
                          }}
                          className="mb-1 flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition-colors last:mb-0 hover:bg-[#FFF5EF]"
                        >
                          <div>
                            <p className="font-bold text-arena-navy-800 text-sm">{athlete.nome_perfil}</p>
                            <p className="text-[10px] uppercase font-black text-arena-navy-800/40 tracking-tight">
                              {athlete.telefone}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-xl border border-[#FFE4D3] bg-[#FFF5EF] p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-arena-button/10">
                      <Check className="h-4 w-4 text-arena-button" />
                    </div>
                    <div>
                      <p className="font-bold text-arena-navy-800 text-sm">{selectedAthlete.nome_perfil}</p>
                      <p className="text-[10px] uppercase font-black text-arena-navy-800/40 tracking-tight">
                        {selectedAthlete.telefone}
                      </p>
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

            {/* Dia da semana */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-arena-navy-800/40 tracking-wider">
                Dia da semana
              </Label>
              <Select value={diaSemana} onValueChange={setDiaSemana}>
                <SelectTrigger className="h-14 border-arena-navy-800/10 focus:ring-arena-button rounded-xl font-bold text-arena-navy-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-arena-navy-800/10 p-2">
                  {DIAS_SEMANA.map((d) => (
                    <SelectItem
                      key={d.value}
                      value={String(d.value)}
                      className="rounded-xl py-3 font-bold text-arena-navy-800"
                    >
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Horários */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-arena-navy-800/40 tracking-wider">
                  Horário início
                </Label>
                <Input
                  type="time"
                  value={horarioInicio}
                  onChange={(e) => setHorarioInicio(e.target.value)}
                  className="h-14 border-arena-navy-800/10 focus:ring-arena-button rounded-xl font-bold text-arena-navy-800"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-arena-navy-800/40 tracking-wider">
                  Horário fim
                </Label>
                <Input
                  type="time"
                  value={horarioFim}
                  onChange={(e) => setHorarioFim(e.target.value)}
                  className="h-14 border-arena-navy-800/10 focus:ring-arena-button rounded-xl font-bold text-arena-navy-800"
                />
              </div>
            </div>

            {/* Esporte */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-arena-navy-800/40 tracking-wider">
                Esporte
              </Label>
              <Select value={selectedSport} onValueChange={setSelectedSport}>
                <SelectTrigger className="h-14 border-arena-navy-800/10 focus:ring-arena-button rounded-xl font-bold text-arena-navy-800">
                  <SelectValue placeholder="Selecione o esporte" />
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
                      Nenhum esporte vinculado
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Sessões e valor */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-arena-navy-800/40 tracking-wider">
                  Sessões/mês
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={8}
                  value={sessoesPorMes}
                  onChange={(e) => setSessoesPorMes(e.target.value)}
                  className="h-14 border-arena-navy-800/10 focus:ring-arena-button rounded-xl font-bold text-arena-navy-800"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-arena-navy-800/40 tracking-wider">
                  Valor mensal (R$)
                </Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-arena-navy-800/40 font-bold text-sm">
                    R$
                  </span>
                  <Input
                    type="number"
                    min={0}
                    value={valorMensal}
                    onChange={(e) => setValorMensal(e.target.value)}
                    className="pl-10 h-14 border-arena-navy-800/10 focus:ring-arena-button rounded-xl font-bold text-arena-navy-800"
                  />
                </div>
              </div>
            </div>

            {/* Resumo */}
            {valorPorSessao && (
              <div className="space-y-1 rounded-2xl border border-arena-button/10 bg-[#FFF5EF] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-arena-button/80">Resumo do plano</p>
                <p className="text-sm font-bold text-arena-navy-800">
                  {sessoesPorMes}x por mês &middot; R$ {valorPorSessao}/sessão &middot; R${" "}
                  {Number(valorMensal).toFixed(2)}/mês
                </p>
                <p className="text-[11px] text-arena-navy-800/50">
                  Serão criadas reservas para o mês atual (confirmado) e os próximos 2 meses (reservado)
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex w-full shrink-0 flex-row items-stretch gap-3 border-t border-slate-100 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="min-w-0 flex-1 basis-0 border-arena-navy-800/20 font-semibold text-arena-navy-800 hover:bg-slate-50"
          >
            Fechar
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="min-w-0 flex-1 basis-0 bg-arena-button font-semibold text-white shadow-sm hover:bg-arena-button-hover disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Criar Plano
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
