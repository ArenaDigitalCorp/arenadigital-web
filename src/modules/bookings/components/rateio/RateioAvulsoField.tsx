'use client'

import { useState } from 'react'
import { Plus, Split, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { diferencaRateio } from '@/modules/bookings/lib/booking-rateio'

export type RateioPessoa = {
  /** 'resp' | id do atleta | 'avulso:<uuid>' */
  key: string
  nome: string
  responsavel: boolean
  semCadastro: boolean
  /** Já pagou algo: não pode sair do rateio por aqui (só em Avulsos, com estorno). */
  pago: number
}

interface Props {
  pessoas: RateioPessoa[]
  valores: Record<string, string>
  locacao: number
  servicos: number
  disabled?: boolean
  onValorChange: (key: string, valor: string) => void
  onDividirIgualmente: () => void
  onAddSemCadastro: (nome: string) => void
  onRemoveSemCadastro: (key: string) => void
}

const fmtBrl = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)

/** Painel do rateio no cadastro/edição da reserva avulsa: uma parte por pessoa. */
export function RateioAvulsoField({
  pessoas,
  valores,
  locacao,
  servicos,
  disabled = false,
  onValorChange,
  onDividirIgualmente,
  onAddSemCadastro,
  onRemoveSemCadastro,
}: Props) {
  const [novoNome, setNovoNome] = useState('')
  const partes = pessoas.map((p) => Number((valores[p.key] ?? '0').replace(',', '.')))
  const soma = partes.reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0)
  const diferenca = diferencaRateio(partes, locacao)

  const adicionar = () => {
    const nome = novoNome.trim()
    if (!nome) return
    onAddSemCadastro(nome)
    setNovoNome('')
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {pessoas.map((p) => (
          <li key={p.key} className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-arena-navy-800">
                {p.nome}
                {p.responsavel && (
                  <span className="ml-1.5 text-[9px] font-black uppercase text-arena-button">
                    Responsável
                  </span>
                )}
                {p.semCadastro && (
                  <span className="ml-1.5 text-[10px] font-medium text-arena-navy-800/40">
                    sem cadastro
                  </span>
                )}
              </p>
              {p.responsavel && servicos > 0 && (
                <p className="text-[10px] font-medium text-arena-navy-800/45">
                  + {fmtBrl(servicos)} de serviços na parte dele
                </p>
              )}
              {p.pago > 0 && (
                <p className="text-[10px] font-semibold text-emerald-600">{fmtBrl(p.pago)} já pago</p>
              )}
            </div>
            <div className="relative w-28 shrink-0">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-arena-navy-800/40">
                R$
              </span>
              <Input
                inputMode="decimal"
                aria-label={`Parte de ${p.nome}`}
                value={valores[p.key] ?? ''}
                disabled={disabled}
                onChange={(e) => onValorChange(p.key, e.target.value)}
                className="h-9 rounded-lg border-arena-navy-800/10 pl-8 text-sm font-bold text-arena-navy-800"
              />
            </div>
            {p.semCadastro && p.pago <= 0 ? (
              <button
                type="button"
                onClick={() => onRemoveSemCadastro(p.key)}
                disabled={disabled}
                aria-label={`Remover ${p.nome}`}
                className="text-arena-navy-800/30 hover:text-red-500"
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              <span className="w-4" aria-hidden />
            )}
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-2">
        <Input
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              adicionar()
            }
          }}
          placeholder="Nome de quem não tem cadastro"
          disabled={disabled}
          maxLength={120}
          className="h-9 rounded-lg border-arena-navy-800/10 text-sm"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={adicionar}
          disabled={disabled || !novoNome.trim()}
          className="h-9 shrink-0 gap-1 rounded-lg text-xs font-bold"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar
        </Button>
      </div>

      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-[11px] font-bold',
          Math.abs(diferenca) <= 0.005 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
        )}
      >
        <span>
          Soma das partes {fmtBrl(soma)} · locação {fmtBrl(locacao)}
          {Math.abs(diferenca) > 0.005 &&
            ` (${diferenca > 0 ? 'a mais' : 'faltam'} ${fmtBrl(Math.abs(diferenca))})`}
        </span>
        <button
          type="button"
          onClick={onDividirIgualmente}
          disabled={disabled || pessoas.length === 0}
          className="inline-flex items-center gap-1 text-arena-button hover:underline disabled:opacity-40"
        >
          <Split className="h-3.5 w-3.5" />
          Dividir igualmente
        </button>
      </div>
    </div>
  )
}
