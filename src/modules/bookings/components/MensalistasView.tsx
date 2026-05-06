"use client"

import { useState, useEffect, useCallback } from "react"
import { Users, Plus, Loader2, CheckCircle2, XCircle, Calendar, Clock, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { toast } from "sonner"
import {
  getPlanosMensalistaAction,
  cancelPlanoMensalistaAction,
  confirmarMesMensalistaAction,
} from "@/modules/bookings/actions/mensalistaActions"
import { MensalistaModal } from "@/modules/bookings/components/MensalistaModal"
import { ConfirmarPagamentoDialog } from "@/modules/bookings/components/ConfirmarPagamentoDialog"
import type { PlanoMensalistaComDetalhes } from "@/modules/bookings/types/booking.types"

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

interface MensalistasViewProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  arenaId: string
  courtId: string
}

export function MensalistasView({
  isOpen,
  onClose,
  onSuccess,
  arenaId,
  courtId,
}: MensalistasViewProps) {
  const [planos, setPlanos] = useState<PlanoMensalistaComDetalhes[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isMensalistaModalOpen, setIsMensalistaModalOpen] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<PlanoMensalistaComDetalhes | null>(null)

  const loadPlanos = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await getPlanosMensalistaAction(arenaId, courtId)
      if (res.success && res.data) setPlanos(res.data)
    } finally {
      setIsLoading(false)
    }
  }, [arenaId, courtId])

  useEffect(() => {
    if (isOpen) loadPlanos()
  }, [isOpen, loadPlanos])

  const handleConfirmarPagamento = async (valor: number) => {
    if (!confirmDialog) return
    setConfirmingId(confirmDialog.id)
    try {
      const res = await confirmarMesMensalistaAction(arenaId, confirmDialog.id, valor)
      if (!res.success) throw new Error(res.error)
      toast.success("Pagamento confirmado! Próximo mês gerado.")
      setConfirmDialog(null)
      await loadPlanos()
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao confirmar pagamento")
    } finally {
      setConfirmingId(null)
    }
  }

  const handleCancelar = async (planoId: string, nome: string) => {
    if (
      !confirm(
        `Tem certeza que deseja cancelar o plano de ${nome}? Todas as reservas futuras "Ag. Confirmação" serão canceladas.`
      )
    )
      return

    setCancellingId(planoId)
    try {
      const res = await cancelPlanoMensalistaAction(arenaId, planoId)
      if (!res.success) throw new Error(res.error)
      toast.success("Plano mensalista cancelado.")
      await loadPlanos()
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao cancelar plano")
    } finally {
      setCancellingId(null)
    }
  }

  const formatNextMonth = (dateStr: string | null) => {
    if (!dateStr) return "Sem reservas pendentes"
    const date = parseISO(dateStr)
    return format(date, "MMMM/yyyy", { locale: ptBR })
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-[680px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl bg-arena-soft">
          <DialogHeader className="p-8 pb-4 bg-white border-b border-arena-navy-800/5 flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-amber-100 flex items-center justify-center">
                <Users className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black text-arena-navy-800 tracking-tight">
                  Mensalistas
                </DialogTitle>
                <p className="text-xs text-arena-navy-800/50 font-medium">
                  {planos.length} plano{planos.length !== 1 ? "s" : ""} ativo{planos.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <Button
              onClick={() => setIsMensalistaModalOpen(true)}
              className="bg-amber-500 hover:bg-amber-600 text-white font-bold gap-2 rounded-xl"
            >
              <Plus className="h-4 w-4" />
              Novo mensalista
            </Button>
          </DialogHeader>

          <ScrollArea className="max-h-[65vh]">
            <div className="p-8 space-y-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
                </div>
              ) : planos.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <div className="h-16 w-16 rounded-3xl bg-amber-100 flex items-center justify-center mx-auto">
                    <Users className="h-8 w-8 text-amber-500" />
                  </div>
                  <p className="font-bold text-arena-navy-800">Nenhum mensalista ativo</p>
                  <p className="text-sm text-arena-navy-800/50">
                    Clique em "Novo mensalista" para criar o primeiro plano
                  </p>
                </div>
              ) : (
                planos.map((plano) => (
                  <div
                    key={plano.id}
                    className="bg-white rounded-2xl border border-arena-navy-800/5 p-5 shadow-sm space-y-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-black text-arena-navy-800">
                            {plano.atleta?.nome_perfil || plano.athlete_name}
                          </p>
                          <Badge className="bg-amber-100 text-amber-700 border-none text-[10px] font-black uppercase px-2">
                            Mensalista
                          </Badge>
                        </div>
                        {plano.atleta?.telefone && (
                          <p className="text-xs text-arena-navy-800/50">{plano.atleta.telefone}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-arena-button">
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(plano.valor_mensal)}
                          <span className="text-xs font-medium text-arena-navy-800/40">/mês</span>
                        </p>
                        <p className="text-xs text-arena-navy-800/40">
                          {plano.sessoes_por_mes}x por mês
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-arena-soft rounded-xl p-3 space-y-0.5">
                        <p className="text-[10px] font-black uppercase text-arena-navy-800/40 tracking-wider flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> Dia fixo
                        </p>
                        <p className="text-sm font-bold text-arena-navy-800">
                          {DIAS_SEMANA[plano.dia_semana]}
                        </p>
                      </div>
                      <div className="bg-arena-soft rounded-xl p-3 space-y-0.5">
                        <p className="text-[10px] font-black uppercase text-arena-navy-800/40 tracking-wider flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Horário
                        </p>
                        <p className="text-sm font-bold text-arena-navy-800">
                          {plano.horario_inicio} – {plano.horario_fim}
                        </p>
                      </div>
                      <div className="bg-arena-soft rounded-xl p-3 space-y-0.5">
                        <p className="text-[10px] font-black uppercase text-arena-navy-800/40 tracking-wider">
                          Esporte
                        </p>
                        <p className="text-sm font-bold text-arena-navy-800">
                          {plano.sports?.name || "—"}
                        </p>
                      </div>
                    </div>

                    {plano.proximo_mes_reservado && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase text-amber-600 tracking-wider">
                            Ag. confirmação de pagamento
                          </p>
                          <p className="text-sm font-bold text-arena-navy-800 capitalize">
                            {formatNextMonth(plano.proximo_mes_reservado)}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => setConfirmDialog(plano)}
                          disabled={confirmingId === plano.id}
                          className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold gap-1.5 rounded-xl shrink-0"
                        >
                          {confirmingId === plano.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                          Confirmar pagamento
                        </Button>
                      </div>
                    )}

                    {!plano.proximo_mes_reservado && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                        <p className="text-[10px] font-black uppercase text-emerald-600 tracking-wider">
                          Todos os meses confirmados
                        </p>
                      </div>
                    )}

                    <div className="flex justify-end pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleCancelar(
                            plano.id,
                            plano.atleta?.nome_perfil || plano.athlete_name
                          )
                        }
                        disabled={cancellingId === plano.id}
                        className="text-red-500 hover:bg-red-50 hover:text-red-600 font-bold gap-1.5 rounded-xl text-xs"
                      >
                        {cancellingId === plano.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5" />
                        )}
                        Cancelar plano
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          <div className="p-8 pt-4 bg-white border-t border-arena-navy-800/5">
            <Button
              variant="outline"
              onClick={onClose}
              className="w-full h-12 border-arena-navy-800/10 text-arena-navy-800 font-bold rounded-xl"
            >
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <MensalistaModal
        isOpen={isMensalistaModalOpen}
        onClose={() => setIsMensalistaModalOpen(false)}
        onSuccess={async () => {
          await loadPlanos()
          onSuccess()
        }}
        arenaId={arenaId}
        courtId={courtId}
      />

      <ConfirmarPagamentoDialog
        isOpen={!!confirmDialog}
        onClose={() => setConfirmDialog(null)}
        onConfirm={handleConfirmarPagamento}
        atletaNome={confirmDialog?.atleta?.nome_perfil ?? confirmDialog?.athlete_name ?? ""}
        mesDevido={confirmDialog?.proximo_mes_reservado
          ? format(parseISO(confirmDialog.proximo_mes_reservado), "MMMM/yyyy", { locale: ptBR })
          : ""}
        valorPadrao={confirmDialog?.valor_mensal ?? 0}
        isLoading={confirmingId !== null}
      />
    </>
  )
}
