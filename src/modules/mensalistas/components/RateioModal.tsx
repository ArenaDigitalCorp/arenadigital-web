'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Plus, Search, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/format'
import { searchAthletesAction } from '@/modules/loyalty/actions/loyaltyActions'
import { configureRateioAction } from '@/modules/mensalistas/actions/mensalistaActions'
import type {
  CobrancaRow,
  MensalidadeRow,
} from '@/modules/mensalistas/types/mensalista.types'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  arenaId: string
  mensalidade: MensalidadeRow | null
  cobrancas: CobrancaRow[]
}

interface Row {
  key: string
  atletaId: string | null
  nome: string
  ativo: boolean
  locked: boolean
  valor: number
  manual: boolean
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** Split `remaining` equally across active non-manual rows, last absorbs the rest. */
function redistribute(rows: Row[], remaining: number): Row[] {
  const manualActiveSum = rows
    .filter((r) => r.ativo && !r.locked && r.manual)
    .reduce((s, r) => s + r.valor, 0)
  const auto = rows.filter((r) => r.ativo && !r.locked && !r.manual)
  let pool = round2(remaining - manualActiveSum)
  const per = auto.length > 0 ? round2(pool / auto.length) : 0
  return rows.map((r) => {
    if (!r.ativo && !r.locked) return { ...r, valor: 0 }
    if (r.locked || r.manual || !r.ativo) return r
    const idx = auto.indexOf(r)
    if (idx === -1) return r
    if (idx === auto.length - 1) return { ...r, valor: round2(pool) }
    pool = round2(pool - per)
    return { ...r, valor: per }
  })
}

export function RateioModal({
  open,
  onClose,
  onSuccess,
  arenaId,
  mensalidade,
  cobrancas,
}: Props) {
  const valorTotal = Number(mensalidade?.valor_total ?? 0)

  const [rows, setRows] = useState<Row[]>([])
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<
    { id: string; nome_perfil: string }[]
  >([])
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const lockedSum = useMemo(
    () => round2(rows.filter((r) => r.locked).reduce((s, r) => s + r.valor, 0)),
    [rows]
  )
  const remaining = round2(valorTotal - lockedSum)
  const activeSum = useMemo(
    () =>
      round2(
        rows.filter((r) => r.ativo && !r.locked).reduce((s, r) => s + r.valor, 0)
      ),
    [rows]
  )
  const balanced = Math.abs(activeSum - remaining) <= 0.01

  useEffect(() => {
    if (!open || !mensalidade) return
    // Keep the existing split as-is on open; redistribution only kicks in when
    // the manager toggles a participant or edits a value.
    const initial: Row[] = cobrancas.map((c) => {
      const locked =
        Number(c.valor_pago) > 0 ||
        Number(c.credito_aplicado) > 0 ||
        c.pago_em != null
      return {
        key: c.id,
        atletaId: c.atleta_id,
        nome: c.nome,
        ativo: locked ? true : c.ativo,
        locked,
        valor: Number(c.valor_devido),
        manual: false,
      }
    })
    // Single non-locked participant covering the whole remainder: treat as the
    // "no rateio" base so it stays balanced.
    setRows(initial)
    setAdding(false)
    setQuery('')
    setResults([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mensalidade?.id])

  const setRowsRedistributed = (next: Row[]) => {
    const ls = round2(next.filter((r) => r.locked).reduce((s, r) => s + r.valor, 0))
    setRows(redistribute(next, round2(valorTotal - ls)))
  }

  const toggle = (key: string) => {
    setRowsRedistributed(
      rows.map((r) => (r.key === key ? { ...r, ativo: !r.ativo, manual: false } : r))
    )
  }

  const editValor = (key: string, raw: string) => {
    const v = round2(Number(raw.replace(',', '.')) || 0)
    setRows((prev) => {
      const next = prev.map((r) =>
        r.key === key ? { ...r, valor: v, manual: true } : r
      )
      const ls = round2(next.filter((r) => r.locked).reduce((s, r) => s + r.valor, 0))
      return redistribute(next, round2(valorTotal - ls))
    })
  }

  const removeRow = (key: string) => {
    setRowsRedistributed(rows.filter((r) => r.key !== key))
  }

  const addRow = (atletaId: string | null, nome: string) => {
    if (!nome.trim()) return
    setRowsRedistributed([
      ...rows,
      {
        key: `new-${crypto.randomUUID()}`,
        atletaId,
        nome: nome.trim(),
        ativo: true,
        locked: false,
        valor: 0,
        manual: false,
      },
    ])
    setAdding(false)
    setQuery('')
    setResults([])
  }

  useEffect(() => {
    if (!adding || query.trim().length < 2) {
      setResults([])
      return
    }
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      const res = await searchAthletesAction(arenaId, query.trim())
      setSearching(false)
      if (res.success) setResults(res.data ?? [])
    }, 300)
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [adding, query, arenaId])

  const handleSave = async (disableRateio = false) => {
    if (!mensalidade) return
    if (!disableRateio && !balanced) {
      toast.error('A soma dos participantes não confere com o valor a distribuir.')
      return
    }
    setSaving(true)
    try {
      const res = await configureRateioAction({
        arenaId,
        mensalidadeId: mensalidade.id,
        rateio: !disableRateio,
        participantes: disableRateio
          ? []
          : rows
              .filter((r) => !r.locked)
              .map((r) => ({
                atleta_id: r.atletaId,
                nome: r.nome,
                ativo: r.ativo,
                valor: r.ativo ? round2(r.valor) : 0,
              })),
      })
      if (res.success) {
        toast.success(disableRateio ? 'Rateio desativado.' : 'Rateio salvo.')
        onSuccess()
        onClose()
      } else {
        toast.error(res.error ?? 'Erro ao salvar rateio')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Rateio da mensalidade</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-arena-navy-800/60">
            O valor total de <b>{formatCurrency(valorTotal)}</b> é rateado
            igualmente entre os participantes ativos. Desative um participante
            para redistribuir entre os demais, ou edite um valor manualmente.
          </p>

          <div className="space-y-2 max-h-[46vh] overflow-y-auto pr-1">
            {rows.map((r) => (
              <div
                key={r.key}
                className={cn(
                  'flex items-center gap-3 rounded-xl border p-3',
                  r.ativo ? 'border-arena-navy-800/10' : 'border-dashed border-arena-navy-800/10 opacity-60'
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-arena-navy-800 truncate">
                    {r.nome}
                    {!r.atletaId && (
                      <span className="ml-1.5 text-[10px] font-medium text-arena-navy-800/40">
                        avulso
                      </span>
                    )}
                  </p>
                  {r.locked && (
                    <p className="text-[11px] text-emerald-600 font-medium">
                      já pago · valor fixo
                    </p>
                  )}
                </div>

                <div className="relative w-28">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-arena-navy-800/40">
                    R$
                  </span>
                  <Input
                    inputMode="decimal"
                    value={r.valor.toFixed(2)}
                    disabled={r.locked || !r.ativo}
                    onChange={(e) => editValor(r.key, e.target.value)}
                    className="pl-7 h-9 text-sm"
                  />
                </div>

                {!r.locked && (
                  <Switch
                    checked={r.ativo}
                    onCheckedChange={() => toggle(r.key)}
                  />
                )}
                {!r.locked && r.key.startsWith('new-') && (
                  <button
                    onClick={() => removeRow(r.key)}
                    className="text-arena-navy-800/30 hover:text-red-500"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {adding ? (
            <div className="rounded-xl border border-arena-navy-800/10 p-3 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-arena-navy-800/30" />
                <Input
                  autoFocus
                  placeholder="Buscar atleta ou digitar um nome..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              {searching && (
                <p className="text-[11px] text-arena-navy-800/40">Buscando...</p>
              )}
              {results.length > 0 && (
                <div className="space-y-1">
                  {results.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => addRow(a.id, a.nome_perfil)}
                      className="block w-full text-left text-sm px-2 py-1.5 rounded-lg hover:bg-slate-50"
                    >
                      {a.nome_perfil}
                    </button>
                  ))}
                </div>
              )}
              {query.trim().length >= 2 && (
                <button
                  onClick={() => addRow(null, query)}
                  className="text-sm text-arena-button font-bold"
                >
                  + Adicionar “{query.trim()}” como participante avulso
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 text-sm text-arena-button font-bold"
            >
              <Plus className="h-4 w-4" /> Adicionar participante
            </button>
          )}

          <div
            className={cn(
              'rounded-xl p-3 text-sm flex items-center justify-between',
              balanced ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
            )}
          >
            <span>A distribuir: {formatCurrency(remaining)}</span>
            <span className="font-bold">Somado: {formatCurrency(activeSum)}</span>
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            variant="ghost"
            onClick={() => handleSave(true)}
            disabled={saving}
            className="text-arena-navy-800/60"
          >
            Desativar rateio
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button
              onClick={() => handleSave(false)}
              disabled={saving || !balanced}
              className="bg-arena-button hover:bg-arena-button-hover text-white"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
