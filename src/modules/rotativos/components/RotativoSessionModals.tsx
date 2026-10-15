"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Loader2, Calendar, Users } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { DecimalInput } from "@/components/ui/decimal-input"
import { parsePositiveInteger, parseRotativoAmount } from "@/modules/rotativos/utils/rotativo-input"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { rotativoSchema, type RotativoFormValues } from "@/modules/rotativos/schemas/rotativo.schema"
import { createRotativoAction, updateRotativoAction } from "@/modules/rotativos/actions/rotativoActions"
import type { CourtOption, Rotativo, RotativoInscricao } from "@/modules/rotativos/types/rotativo.types"
import { canReactivateRotativo, formatRotativoTime } from "@/modules/rotativos/utils/rotativo.utils"
import type { Sport } from "@/modules/arenas/types/arena.types"
import { cn } from "@/lib/utils"

interface Props {
  isOpen: boolean
  onClose: () => void
  arenaId: string
  sports: Sport[]
  courts: CourtOption[]
  rotativo?: Rotativo | null
  onSuccess: () => void
}

function formatTimeForInput(time: string) {
  return formatRotativoTime(time)
}

export function RotativoFormModal({
  isOpen,
  onClose,
  arenaId,
  sports,
  courts,
  rotativo,
  onSuccess,
}: Props) {
  const isEditing = Boolean(rotativo)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<RotativoFormValues>({
    resolver: zodResolver(rotativoSchema),
    defaultValues: {
      data: format(new Date(), "yyyy-MM-dd"),
      id_esporte: "",
      court_ids: [],
      hora_inicio: "08:00",
      hora_fim: "09:00",
      valor: "",
      limitado: false,
      limite_participantes: "",
    },
  })

  useEffect(() => {
    if (!isOpen) return
    if (rotativo) {
      form.reset({
        data: rotativo.data,
        id_esporte: rotativo.id_esporte,
        court_ids: rotativo.courts?.map((c) => c.id) ?? [],
        hora_inicio: formatTimeForInput(rotativo.hora_inicio),
        hora_fim: formatTimeForInput(rotativo.hora_fim),
        valor: rotativo.valor.toFixed(2).replace(".", ","),
        limitado: rotativo.limitado,
        limite_participantes: rotativo.limite_participantes?.toString() ?? "",
      })
    } else {
      form.reset({
        data: format(new Date(), "yyyy-MM-dd"),
        id_esporte: "",
        court_ids: [],
        hora_inicio: "08:00",
        hora_fim: "09:00",
        valor: "",
        limitado: false,
        limite_participantes: "",
      })
    }
  }, [isOpen, rotativo, form])

  const limitado = form.watch("limitado")
  const selectedCourts = form.watch("court_ids")

  function toggleCourt(courtId: string) {
    const current = form.getValues("court_ids")
    if (current.includes(courtId)) {
      form.setValue("court_ids", current.filter((id) => id !== courtId), { shouldValidate: true })
    } else {
      form.setValue("court_ids", [...current, courtId], { shouldValidate: true })
    }
  }

  async function onSubmit(values: RotativoFormValues) {
    const amount = parseRotativoAmount(values.valor)
    if (amount === null) {
      form.setError("valor", { message: "Informe um valor válido maior que zero." })
      return
    }
    const participantLimit = values.limitado ? parsePositiveInteger(values.limite_participantes ?? "") : null
    if (values.limitado && participantLimit === null) {
      form.setError("limite_participantes", { message: "Informe uma quantidade inteira maior que zero." })
      return
    }
    setIsSubmitting(true)
    try {
      const payload = {
        arenaId,
        data: values.data,
        id_esporte: values.id_esporte,
        court_ids: values.court_ids,
        hora_inicio: values.hora_inicio,
        hora_fim: values.hora_fim,
        valor: amount,
        limitado: values.limitado,
        limite_participantes: participantLimit,
      }

      const result = isEditing && rotativo
        ? await updateRotativoAction({ ...payload, rotativoId: rotativo.id })
        : await createRotativoAction(payload)

      if (result.success) {
        toast.success(isEditing ? "Rotativo atualizado!" : "Rotativo cadastrado!")
        onSuccess()
        onClose()
      } else {
        toast.error(result.error)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar rotativo" : "Novo rotativo"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="data"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="id_esporte"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Esporte</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo de esporte" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {sports.map((sport) => (
                        <SelectItem key={sport.id} value={sport.id}>
                          {sport.name}
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
              name="court_ids"
              render={() => (
                <FormItem>
                  <FormLabel>Quadra</FormLabel>
                  <div className="rounded-lg border border-slate-200 p-3 space-y-2 max-h-36 overflow-y-auto">
                    {courts.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhuma quadra cadastrada.</p>
                    ) : (
                      courts.map((court) => (
                        <label
                          key={court.id}
                          className={cn(
                            "flex items-center gap-2 text-sm cursor-pointer rounded-md px-2 py-1.5",
                            selectedCourts.includes(court.id) && "bg-arena-button/10"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={selectedCourts.includes(court.id)}
                            onChange={() => toggleCourt(court.id)}
                            className="accent-arena-button"
                          />
                          {court.name}
                        </label>
                      ))
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="hora_inicio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Horário início</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
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
                    <FormLabel>Horário fim</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
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
                  <FormLabel>Valor da inscrição</FormLabel>
                  <FormControl>
                    <DecimalInput placeholder="R$ 00,00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="limitado"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <FormLabel>Limitar participantes</FormLabel>
                    <p className="text-xs text-muted-foreground">
                      Informar o número máximo de inscritos nesse rotativo.
                    </p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            {limitado && (
              <FormField
                control={form.control}
                name="limite_participantes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Limite de inscritos</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                Fechar
              </Button>
              <Button type="submit" className="flex-1" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {isEditing ? "Salvar" : "Cadastrar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export function RotativoDetailsModal({
  isOpen,
  onClose,
  rotativo,
  participants,
  isLoadingParticipants,
  onEdit,
  onDeactivate,
  onReactivate,
}: {
  isOpen: boolean
  onClose: () => void
  rotativo: Rotativo | null
  participants: RotativoInscricao[]
  isLoadingParticipants?: boolean
  onEdit: () => void
  onDeactivate: () => void
  onReactivate: () => void
}) {
  if (!rotativo) return null

  const isActive = (rotativo.status ?? "ativo") === "ativo"
  const canReactivate = !isActive && canReactivateRotativo(rotativo.data)
  const courtNames = rotativo.courts?.map((c) => c.name).join(", ")

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Detalhes do rotativo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase">Período</p>
            <div className="mt-2 inline-flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              {format(parseISO(rotativo.data), "dd/MM/yyyy", { locale: ptBR })}
            </div>
            <p className="text-sm text-arena-button font-semibold mt-2">
              {formatTimeForInput(rotativo.hora_inicio)} → {formatTimeForInput(rotativo.hora_fim)}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase">Status</p>
              <span className={cn(
                "inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-bold",
                isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              )}>
                {isActive ? "ATIVO" : "DESATIVADO"}
              </span>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase">Esporte</p>
              <p className="font-medium mt-1">{rotativo.esporte?.name ?? "—"}</p>
            </div>
            {courtNames && (
              <div className="col-span-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Quadras</p>
                <p className="font-medium mt-1">{courtNames}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase">Valor da inscrição</p>
              <p className="font-medium mt-1">
                {rotativo.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase">Limite de inscritos</p>
              <p className="font-medium mt-1">
                {rotativo.limitado ? rotativo.limite_participantes : "Não"}
              </p>
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Total de inscritos</p>
            <p className="text-3xl font-bold text-arena-button mt-1">{rotativo.inscricoes_count ?? 0}</p>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs font-semibold text-muted-foreground uppercase">Inscritos</p>
            </div>
            {isLoadingParticipants ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-arena-button" />
              </div>
            ) : participants.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum atleta inscrito ainda.</p>
            ) : (
              <ul className="space-y-2 max-h-40 overflow-y-auto">
                {participants.map((p) => (
                  <li key={p.id} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{p.atleta?.nome_perfil ?? "Atleta"}</span>
                    <span className="text-xs text-muted-foreground">
                      {p.tipo_pagamento === "credito"
                        ? "Crédito"
                        : p.modo_pagamento?.nome ?? "Avulso"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Voltar
            </Button>
            {canReactivate ? (
              <Button className="flex-1" onClick={onReactivate}>
                Reativar
              </Button>
            ) : (
              <>
                <Button className="flex-1" onClick={onEdit} disabled={!isActive}>
                  Editar
                </Button>
                {isActive && (
                  <Button variant="destructive" size="icon" onClick={onDeactivate}>
                    ×
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function ReactivateRotativoModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  isLoading?: boolean
}) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reativar rotativo</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Deseja reativar este rotativo? Ele voltará a aceitar novas inscrições.
        </p>
        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Fechar
          </Button>
          <Button className="flex-1" onClick={onConfirm} disabled={isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Reativar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function DeactivateRotativoModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  isLoading?: boolean
}) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Desativar rotativo</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Tem certeza que deseja desativar este rotativo cadastrado? Ao desativar você pode ativá-lo
          novamente anteriormente à data de acontecimento.
        </p>
        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Fechar
          </Button>
          <Button className="flex-1" onClick={onConfirm} disabled={isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Desativar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
