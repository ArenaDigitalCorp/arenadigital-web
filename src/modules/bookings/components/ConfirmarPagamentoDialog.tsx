"use client"

import { parseBrazilianDecimal } from '@/lib/format'
import { DecimalInput } from '@/components/ui/decimal-input'
import { useEffect, useState } from "react"
import { Loader2, CheckCircle2, DollarSign } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

interface ConfirmarPagamentoDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (valor: number) => Promise<void>
  atletaNome: string
  mesDevido: string
  valorPadrao: number
  isLoading?: boolean
  /** mensalista (padrão) ou reserva avulsa */
  tipo?: "mensalista" | "avulso"
}

export function ConfirmarPagamentoDialog({
  isOpen,
  onClose,
  onConfirm,
  atletaNome,
  mesDevido,
  valorPadrao,
  isLoading = false,
  tipo = "mensalista",
}: ConfirmarPagamentoDialogProps) {
  const [valor, setValor] = useState(valorPadrao.toString())

  useEffect(() => {
    if (isOpen) setValor(valorPadrao.toString())
  }, [isOpen, valorPadrao])

  const valorNum = (parseBrazilianDecimal(valor) ?? Number.NaN)

  const handleConfirm = async () => {
    if (!Number.isFinite(valorNum) || valorNum <= 0) return
    await onConfirm(valorNum)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[400px] rounded-2xl">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-2xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <DialogTitle className="text-xl font-black text-arena-navy-800">
              Confirmar pagamento
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-arena-navy-800/60 font-medium pl-[52px]">
            {tipo === "avulso" ? (
              <>
                Reserva avulsa de <span className="font-bold text-arena-navy-800">{atletaNome}</span> em{" "}
                <span className="font-bold text-arena-navy-800">{mesDevido}</span>.
              </>
            ) : (
              <>
                Mensalidade de <span className="font-bold text-arena-navy-800">{atletaNome}</span> referente a{" "}
                <span className="font-bold text-arena-navy-800 capitalize">{mesDevido}</span>.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 pt-2">
          <Label className="text-xs font-bold uppercase text-arena-navy-800/40 tracking-wider flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5" />
            Valor recebido (R$)
          </Label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-arena-navy-800/40 font-bold text-sm">
              R$
            </span>
            <DecimalInput
              type="number"
              min={0}
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="pl-10 h-12 border-arena-navy-800/10 focus:ring-emerald-500 focus:border-emerald-500 rounded-xl font-bold text-arena-navy-800 text-base"
            />
          </div>
          {valorNum !== valorPadrao && valorPadrao > 0 && (
            <p className="text-[11px] text-amber-600 font-bold">
              Valor padrão{tipo === "avulso" ? " da reserva" : " do plano"}: R$ {valorPadrao.toFixed(2).replace(".", ",")}
            </p>
          )}
        </div>

        <DialogFooter className="flex gap-3 sm:justify-end pt-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 border-arena-navy-800/20 text-arena-navy-800 font-bold rounded-xl h-11"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading || !Number.isFinite(valorNum) || valorNum <= 0}
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold gap-2 rounded-xl h-11"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
