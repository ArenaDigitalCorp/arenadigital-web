"use client"

import { useState, useTransition, useEffect, useRef } from "react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Search, Filter, Plus, ChevronLeft, ChevronRight, Loader2, Medal, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DecimalInput } from "@/components/ui/decimal-input"
import { parsePositiveInteger, parseRotativoPackages } from "@/modules/rotativos/utils/rotativo-input"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { cn } from "@/lib/utils"
import { arenaDataTable } from "@/lib/arena-data-table"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import {
  getRotativoCreditMovementsAction,
  launchRotativoCreditAction,
  saveRotativoPacotesAction,
  getTopRotativoAthletesAction,
  previewCreditPurchaseValueAction,
} from "@/modules/rotativos/actions/rotativoActions"
import { getAthletesByArenaAction } from "@/modules/athletes/actions/athleteActions"
import {
  ROTATIVO_VALIDITY_OPTIONS,
  type RotativoCreditoMovimento,
  type RotativoCreditoSaldo,
  type RotativoPacote,
  type ModoPagamentoOption,
} from "@/modules/rotativos/types/rotativo.types"
import { getModoPagamentoAction } from "@/modules/finance/actions/financeActions"

const PAGE_SIZE = 10

const creditSchema = z.object({
  athleteId: z.string().min(1, "Selecione o atleta"),
  quantidade: z.string().refine(value => parsePositiveInteger(value) !== null, "Informe uma quantidade inteira maior que zero."),
  validityDays: z.string().min(1, "Selecione a validade"),
  modo_pagamento_id: z.string().min(1, "Selecione a forma de pagamento"),
})

type CreditFormValues = z.infer<typeof creditSchema>

interface Props {
  arenaId: string
  initialPacotes: RotativoPacote[]
  initialMovements: RotativoCreditoMovimento[]
  initialMovementsTotal: number
  initialTopAthletes: RotativoCreditoSaldo[]
}

interface PacoteDraft {
  quantidade: string
  valor_reais: string
}

interface CreditQuote {
  arenaId: string
  quantity: number
  amount: number
}

interface PendingCreditOperation {
  uncertain: boolean
  payload: {
    operationId: string
    arenaId: string
    athleteId: string
    quantidade: number
    validityDays: number
    modo_pagamento_id: string
  }
  athlete: { id: string; nome_perfil: string }
  quote: CreditQuote
}

function medalColor(index: number) {
  if (index === 0) return "text-yellow-500"
  if (index === 1) return "text-slate-400"
  if (index === 2) return "text-amber-700"
  return "text-muted-foreground"
}

export function CreditosTab({
  arenaId,
  initialPacotes,
  initialMovements,
  initialMovementsTotal,
  initialTopAthletes,
}: Props) {
  const [pacotes, setPacotes] = useState<PacoteDraft[]>(
    initialPacotes.length > 0
      ? initialPacotes.map((p) => ({
          quantidade: String(p.quantidade),
          valor_reais: p.valor_reais.toFixed(2).replace(".", ","),
        }))
      : [{ quantidade: "1", valor_reais: "30,00" }]
  )
  const [movements, setMovements] = useState(initialMovements)
  const [movementsTotal, setMovementsTotal] = useState(initialMovementsTotal)
  const [topAthletes, setTopAthletes] = useState(initialTopAthletes)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [creditOpen, setCreditOpen] = useState(false)
  const [athleteSearch, setAthleteSearch] = useState("")
  const [athleteResults, setAthleteResults] = useState<{ id: string; nome_perfil: string }[]>([])
  const [selectedAthlete, setSelectedAthlete] = useState<{ id: string; nome_perfil: string } | null>(null)
  const [isSearchingAthletes, setIsSearchingAthletes] = useState(false)
  const athleteSearchTimeout = useRef<NodeJS.Timeout | null>(null)
  // Retain uncertain purchases across modal sessions for this mounted component.
  const pendingCreditOperations = useRef(new Map<string, PendingCreditOperation>())
  const [, updatePendingOperations] = useState(0)
  const pendingCredit = pendingCreditOperations.current.get(arenaId)
  const [paymentMethods, setPaymentMethods] = useState<ModoPagamentoOption[]>([])
  const [creditQuote, setCreditQuote] = useState<CreditQuote | null>(null)
  const [isSavingPacotes, setIsSavingPacotes] = useState(false)
  const [isQuotingCredit, setIsQuotingCredit] = useState(false)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [quoteRetry, setQuoteRetry] = useState(0)
  const [isLaunchingCredit, setIsLaunchingCredit] = useState(false)
  const quoteRequest = useRef(0)
  const creditSubmitPending = useRef(false)
  const [isPending, startTransition] = useTransition()

  const form = useForm<CreditFormValues>({
    resolver: zodResolver(creditSchema),
    defaultValues: { athleteId: "", quantidade: "1", validityDays: "", modo_pagamento_id: "" },
  })

  const watchedQuantidade = form.watch("quantidade")
  const creditQuantity = parsePositiveInteger(watchedQuantidade)
  const quoteContext = useRef({ arenaId, quantity: creditQuantity, open: creditOpen })
  quoteContext.current = { arenaId, quantity: creditQuantity, open: creditOpen }
  const currentQuote = creditQuote?.arenaId === arenaId && creditQuote.quantity === creditQuantity
    ? creditQuote : null

  useEffect(() => {
    const request = quoteRequest.current + 1
    quoteRequest.current = request
    setCreditQuote(null)
    setQuoteError(null)
    if (!creditOpen || creditQuantity === null) {
      setIsQuotingCredit(false)
      return
    }
    const pending = pendingCreditOperations.current.get(arenaId)
    if (pending) {
      setCreditQuote(pending.quote)
      setIsQuotingCredit(false)
      return
    }
    const quantity = creditQuantity
    const isCurrent = () => request === quoteRequest.current
      && quoteContext.current.open && quoteContext.current.arenaId === arenaId
      && quoteContext.current.quantity === quantity
    setIsQuotingCredit(true)
    void previewCreditPurchaseValueAction(arenaId, quantity).then(result => {
      if (!isCurrent()) return
      if (!result.success || typeof result.valor !== 'number' || !Number.isFinite(result.valor) || result.valor < 0) {
        setQuoteError('Não foi possível consultar o valor dos créditos. Tente novamente.')
        return
      }
      setCreditQuote({ arenaId, quantity, amount: result.valor })
    }).catch(() => {
      if (isCurrent()) setQuoteError('Não foi possível consultar o valor dos créditos. Tente novamente.')
    }).finally(() => {
      if (isCurrent()) setIsQuotingCredit(false)
    })
    return () => {
      if (request === quoteRequest.current) quoteRequest.current = request + 1
    }
  }, [arenaId, creditQuantity, creditOpen, quoteRetry])

  const firstPackage = parseRotativoPackages(pacotes)?.[0]
  const unitPriceHint = firstPackage ? firstPackage.valor_reais / firstPackage.quantidade : 0

  function reloadMovements(nextPage = page, nextSearch = search) {
    startTransition(async () => {
      const [movementsResult, topResult] = await Promise.all([
        getRotativoCreditMovementsAction(arenaId, {
          search: nextSearch || undefined,
          page: nextPage,
          pageSize: PAGE_SIZE,
        }),
        getTopRotativoAthletesAction(arenaId, 5),
      ])
      if (quoteContext.current.arenaId !== arenaId) return
      if (movementsResult.success) {
        setMovements(movementsResult.data ?? [])
        setMovementsTotal(movementsResult.total ?? 0)
      }
      if (topResult.success) {
        setTopAthletes(topResult.data ?? [])
      }
    })
  }

  function addPacote() {
    setPacotes((prev) => [...prev, { quantidade: "1", valor_reais: "" }])
  }

  function updatePacote(index: number, field: keyof PacoteDraft, value: string) {
    setPacotes((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)))
  }

  async function savePacotes() {
    setIsSavingPacotes(true)
    try {
      const parsed = parseRotativoPackages(pacotes)
      if (parsed === null) {
        toast.error("Informe quantidades inteiras e valores válidos para todos os pacotes.")
        return
      }

      const result = await saveRotativoPacotesAction({ arenaId, pacotes: parsed })
      if (result.success) {
        toast.success("Pacotes salvos!")
      } else {
        toast.error(result.error)
      }
    } finally {
      setIsSavingPacotes(false)
    }
  }

  async function openCreditModal() {
    const pending = pendingCreditOperations.current.get(arenaId)
    setCreditOpen(true)
    form.reset(pending ? {
      athleteId: pending.payload.athleteId,
      quantidade: String(pending.payload.quantidade),
      validityDays: String(pending.payload.validityDays),
      modo_pagamento_id: pending.payload.modo_pagamento_id,
    } : { athleteId: "", quantidade: "1", validityDays: "", modo_pagamento_id: "" })
    setAthleteSearch(pending?.athlete.nome_perfil ?? "")
    setAthleteResults([])
    setSelectedAthlete(pending?.athlete ?? null)

    const methodsRes = await getModoPagamentoAction()
    if (methodsRes.success) {
      setPaymentMethods(methodsRes.data ?? [])
    }
  }

  function closeCreditModal() {
    quoteRequest.current++
    quoteContext.current = { ...quoteContext.current, open: false }
    setCreditQuote(null)
    setCreditOpen(false)
  }

  function handleAthleteSearch(value: string) {
    setAthleteSearch(value)
    if (selectedAthlete) {
      setSelectedAthlete(null)
      form.setValue("athleteId", "")
    }

    if (athleteSearchTimeout.current) clearTimeout(athleteSearchTimeout.current)

    const term = value.trim()
    if (term.length < 3) {
      setAthleteResults([])
      setIsSearchingAthletes(false)
      return
    }

    setIsSearchingAthletes(true)
    athleteSearchTimeout.current = setTimeout(async () => {
      try {
        const res = await getAthletesByArenaAction(arenaId, term)
        setAthleteResults(
          res.success
            ? (res.data ?? []).map((a) => ({ id: a.id, nome_perfil: a.name }))
            : []
        )
      } finally {
        setIsSearchingAthletes(false)
      }
    }, 400)
  }

  function selectAthlete(athlete: { id: string; nome_perfil: string }) {
    setSelectedAthlete(athlete)
    setAthleteSearch(athlete.nome_perfil)
    setAthleteResults([])
    form.setValue("athleteId", athlete.id, { shouldValidate: true })
  }

  async function onSubmitCredit(values: CreditFormValues) {
    if (creditSubmitPending.current || !quoteContext.current.open) return
    let operation = pendingCreditOperations.current.get(arenaId)
    const quantity = operation?.payload.quantidade ?? parsePositiveInteger(values.quantidade)
    const validityDays = operation?.payload.validityDays ?? parsePositiveInteger(values.validityDays)
    if (quantity === null || validityDays === null) {
      toast.error("Informe uma quantidade inteira e uma validade válida.")
      return
    }
    if (!operation && (!currentQuote || currentQuote.quantity !== quantity || isQuotingCredit || quoteError)) {
      toast.error('Aguarde uma estimativa válida para a quantidade informada.')
      return
    }
    // Snapshot all purchase data before the first await. Unknown outcomes must
    // retry this exact operation, even if packages or the visible context change.
    const candidate: PendingCreditOperation = operation ?? {
      uncertain: false,
      payload: {
        operationId: crypto.randomUUID(), arenaId, athleteId: values.athleteId,
        quantidade: quantity, validityDays, modo_pagamento_id: values.modo_pagamento_id,
      },
      athlete: selectedAthlete ?? { id: values.athleteId, nome_perfil: athleteSearch || "Atleta selecionado" },
      quote: currentQuote!,
    }
    creditSubmitPending.current = true
    setIsLaunchingCredit(true)
    const request = quoteRequest.current
    const isCurrent = () => request === quoteRequest.current && quoteContext.current.open
      && quoteContext.current.arenaId === arenaId && quoteContext.current.quantity === quantity
    const clearPending = () => {
      if (pendingCreditOperations.current.get(arenaId)?.payload.operationId === candidate.payload.operationId) {
        pendingCreditOperations.current.delete(arenaId)
        updatePendingOperations(version => version + 1)
      }
    }
    try {
      if (!operation) {
        const refreshed = await previewCreditPurchaseValueAction(arenaId, quantity)
        if (!isCurrent()) return
        if (!refreshed.success || typeof refreshed.valor !== 'number' || !Number.isFinite(refreshed.valor) || refreshed.valor < 0) {
          setCreditQuote(null)
          setQuoteError('Não foi possível confirmar o valor dos créditos. Consulte novamente.')
          return
        }
        if (refreshed.valor !== candidate.quote.amount) {
          setCreditQuote({ arenaId, quantity, amount: refreshed.valor })
          toast.error('O valor dos créditos mudou. Confira a nova estimativa e confirme novamente.')
          return
        }
        operation = candidate
        pendingCreditOperations.current.set(arenaId, operation)
        updatePendingOperations(version => version + 1)
      }
      const result = await launchRotativoCreditAction(operation.payload)
      // A late receipt still resolves the ledger, but must not close a newer
      // modal or publish its result into another arena's view.
      if (result.success) {
        clearPending()
        if (!isCurrent()) return
        const paid = result.valorPago
        toast.success(typeof paid === 'number' && Number.isFinite(paid) && paid >= 0
          ? `Crédito lançado! Valor pago: ${paid.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
          : 'Crédito lançado! Consulte o valor no histórico.')
        closeCreditModal()
        reloadMovements()
      } else {
        if (result.outcome === 'rejected' && !operation.uncertain) clearPending()
        else {
          operation.uncertain = true
          updatePendingOperations(version => version + 1)
        }
        if (isCurrent()) toast.error(result.error)
      }
    } catch {
      if (operation) {
        operation.uncertain = true
        updatePendingOperations(version => version + 1)
      }
      if (isCurrent()) {
        if (pendingCreditOperations.current.has(arenaId)) {
          toast.error('Não foi possível confirmar o lançamento. Tente confirmar a operação pendente novamente.')
        } else {
          setCreditQuote(null)
          setQuoteError('Não foi possível confirmar o valor dos créditos. Consulte novamente.')
        }
      }
    } finally {
      creditSubmitPending.current = false
      setIsLaunchingCredit(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(movementsTotal / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5">
            <h3 className="font-bold text-arena-navy-800 mb-4">Top atletas com mais créditos</h3>
            <div className="space-y-3">
              {topAthletes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum atleta com créditos ainda.</p>
              ) : (
                topAthletes.map((item, index) => (
                  <div key={item.atleta_id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Medal className={cn("h-4 w-4", medalColor(index))} />
                      <span className="text-sm font-medium">
                        {(item.atleta as { nome_perfil?: string } | undefined)?.nome_perfil ?? "Atleta"}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-arena-navy-800">
                      {String(item.saldo).padStart(2, "0")}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 space-y-4">
            <div>
              <h3 className="font-bold text-arena-navy-800">Configuração de valores</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Configure quanto o rotativo equivale em reais para cada uma das opções. É possível
                definir valores diferentes para cada pacote.
              </p>
            </div>

            {pacotes.map((pacote, index) => (
              <div key={index} className="flex items-center gap-2 flex-wrap">
                <Input
                  inputMode="numeric"
                  className="w-16 text-center"
                  value={pacote.quantidade}
                  onChange={(e) => updatePacote(index, "quantidade", e.target.value)}
                />
                <span className="text-sm text-muted-foreground">rotativos =</span>
                <DecimalInput
                  className="w-28"
                  placeholder="R$ 30,00"
                  value={pacote.valor_reais}
                  onChange={(e) => updatePacote(index, "valor_reais", e.target.value)}
                />
              </div>
            ))}

            {unitPriceHint > 0 && (
              <p className="text-xs text-muted-foreground text-right">
                1 crédito = {unitPriceHint.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
            )}

            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" size="sm" onClick={addPacote} className="gap-1">
                Adicionar pacote
                <Plus className="h-4 w-4" />
              </Button>
              <Button onClick={savePacotes} disabled={isSavingPacotes}>
                {isSavingPacotes && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Salvar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-bold text-arena-navy-800 flex-1">Movimentações</h3>
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por atleta"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setPage(1)
                    reloadMovements(1, search)
                  }
                }}
                className="pl-9"
              />
            </div>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-4 w-4" />
              Todos os status
            </Button>
            <Button onClick={openCreditModal} className="gap-2">
              Lançar crédito
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className={arenaDataTable.table}>
              <thead>
                <tr className={arenaDataTable.theadRow}>
                  <th className={arenaDataTable.th}>Data da movimentação</th>
                  <th className={arenaDataTable.th}>Tipo</th>
                  <th className={arenaDataTable.th}>Atleta</th>
                  <th className={arenaDataTable.th}>Quantidade</th>
                  <th className={arenaDataTable.th}>Validade</th>
                </tr>
              </thead>
              <tbody>
                {isPending ? (
                  <tr>
                    <td colSpan={5} className={arenaDataTable.emptyCell}>
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-arena-button" />
                    </td>
                  </tr>
                ) : movements.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={arenaDataTable.emptyCell}>
                      Nenhuma movimentação encontrada.
                    </td>
                  </tr>
                ) : (
                  movements.map((mov) => {
                    const isPositive = mov.quantidade > 0
                    const validity = mov.lote?.data_vencimento
                      ? `Válido até ${format(parseISO(mov.lote.data_vencimento), "dd/MM/yyyy", { locale: ptBR })}.`
                      : mov.tipo === "uso"
                        ? "—"
                        : "—"

                    return (
                      <tr key={mov.id} className={arenaDataTable.tbodyRow}>
                        <td className={cn(arenaDataTable.td, "text-arena-navy-800/60")}>
                          {format(parseISO(mov.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </td>
                        <td className={arenaDataTable.tdBold}>
                          {mov.tipo === "compra"
                            ? "Crédito"
                            : mov.tipo === "uso"
                              ? "Uso"
                              : "Vencimento"}
                        </td>
                        <td className={arenaDataTable.tdBold}>
                          {mov.atleta?.nome_perfil ?? "—"}
                        </td>
                        <td className={cn(arenaDataTable.tdBold, isPositive ? "text-green-600" : "text-red-600")}>
                          {isPositive ? `+ ${mov.quantidade}` : `- ${Math.abs(mov.quantidade)}`}
                        </td>
                        <td className={cn(arenaDataTable.td, "text-arena-navy-800/60")}>{validity}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Exibindo {movementsTotal === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, movementsTotal)} de {movementsTotal}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page === 1}
                onClick={() => {
                  const next = page - 1
                  setPage(next)
                  reloadMovements(next)
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs px-2">{String(page).padStart(2, "0")}</span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page >= totalPages}
                onClick={() => {
                  const next = page + 1
                  setPage(next)
                  reloadMovements(next)
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={creditOpen}
        onOpenChange={(open) => {
          if (open) setCreditOpen(true)
          else closeCreditModal()
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo crédito</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitCredit)} className="space-y-4">
              <fieldset disabled={isLaunchingCredit || Boolean(pendingCredit)} className="m-0 min-w-0 space-y-4 border-0 p-0">
              <FormField
                control={form.control}
                name="athleteId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Selecione o atleta</FormLabel>
                    {selectedAthlete ? (
                      <div className="flex items-center justify-between rounded-md border border-input bg-muted/30 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium text-arena-navy-800">
                            {selectedAthlete.nome_perfil}
                          </span>
                        </div>
                        <button
                          type="button"
                          aria-label="Remover atleta selecionado"
                          onClick={() => {
                            setSelectedAthlete(null)
                            setAthleteSearch("")
                            field.onChange("")
                          }}
                          className="text-red-500 hover:text-red-600 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <FormControl>
                          <Input
                            placeholder="Digite o nome do atleta (mín. 3 letras)"
                            value={athleteSearch}
                            onChange={(e) => handleAthleteSearch(e.target.value)}
                            className="pl-9"
                          />
                        </FormControl>
                        {isSearchingAthletes && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-arena-button" />
                        )}
                        {athleteSearch.trim().length >= 3 && !isSearchingAthletes && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-input rounded-md shadow-lg max-h-48 overflow-auto">
                            {athleteResults.length === 0 ? (
                              <p className="px-4 py-3 text-sm text-muted-foreground">
                                Nenhum atleta encontrado.
                              </p>
                            ) : (
                              athleteResults.map((athlete) => (
                                <button
                                  key={athlete.id}
                                  type="button"
                                  onClick={() => selectAthlete(athlete)}
                                  className="w-full text-left px-4 py-2.5 hover:bg-muted transition-colors text-sm font-medium text-arena-navy-800 border-b border-arena-navy-800/5 last:border-0"
                                >
                                  {athlete.nome_perfil}
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="quantidade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantidade de rotativos</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="validityDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Validade</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a validade" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ROTATIVO_VALIDITY_OPTIONS.map((opt) => (
                          <SelectItem key={opt.days} value={String(opt.days)}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="modo_pagamento_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Forma de pagamento</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a forma de pagamento" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {paymentMethods.map((method) => (
                          <SelectItem key={method.id} value={method.id}>
                            {method.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              </fieldset>
              {pendingCredit && (
                <p role="alert" className="text-sm text-amber-700">
                  Há um lançamento aguardando confirmação. Os dados estão preservados para confirmar a mesma operação sem duplicá-la.
                </p>
              )}
              {isQuotingCredit && <p role="status" className="text-sm text-muted-foreground">Consultando valor dos créditos…</p>}
              {quoteError && (
                <div role="alert" className="space-y-2 text-sm text-red-600">
                  <p>{quoteError}</p>
                  <Button type="button" variant="outline" onClick={() => setQuoteRetry(value => value + 1)}>Consultar novamente</Button>
                </div>
              )}
              {currentQuote && !isQuotingCredit && !quoteError && (
                <p className="text-sm text-muted-foreground">
                  Valor estimado:{" "}
                  <span className="font-semibold text-arena-navy-800">
                    {currentQuote.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={closeCreditModal}>
                  Fechar
                </Button>
                <Button type="submit" className="flex-1" disabled={isLaunchingCredit || (!pendingCredit && (isQuotingCredit || !currentQuote || Boolean(quoteError)))}>
                  {isLaunchingCredit ? 'Confirmando…' : pendingCredit ? 'Confirmar lançamento pendente' : 'Finalizar'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
