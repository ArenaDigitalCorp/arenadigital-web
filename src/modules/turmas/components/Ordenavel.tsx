'use client'

import { useState } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export type Direcao = 'asc' | 'desc'
export interface Ordem<C extends string> {
  coluna: C
  direcao: Direcao
}

type Valor = string | number

/**
 * Ordenação de tabela por coluna, no mesmo comportamento da lista de Atletas:
 * clicar na coluna ativa inverte o sentido; clicar em outra começa ascendente.
 */
export function useOrdenacao<T, C extends string>(
  itens: T[],
  inicial: Ordem<C>,
  valores: Record<C, (item: T) => Valor>,
) {
  const [ordem, setOrdem] = useState<Ordem<C>>(inicial)

  const alternar = (coluna: C) =>
    setOrdem((atual) =>
      atual.coluna === coluna
        ? { coluna, direcao: atual.direcao === 'asc' ? 'desc' : 'asc' }
        : { coluna, direcao: 'asc' },
    )

  const valor = valores[ordem.coluna]
  const ordenados = [...itens].sort((a, b) => {
    const va = valor(a)
    const vb = valor(b)
    const cmp =
      typeof va === 'number' && typeof vb === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb), 'pt-BR', { sensitivity: 'base', numeric: true })
    return ordem.direcao === 'asc' ? cmp : -cmp
  })

  return { ordem, setOrdem, alternar, ordenados }
}

export function Ordenavel<C extends string>({
  coluna,
  ordem,
  onOrdenar,
  children,
  alinhar = 'esquerda',
}: {
  coluna: C
  ordem: Ordem<C>
  onOrdenar: (coluna: C) => void
  children: React.ReactNode
  alinhar?: 'esquerda' | 'direita'
}) {
  const ativo = ordem.coluna === coluna
  const Icone = !ativo ? ChevronsUpDown : ordem.direcao === 'asc' ? ArrowUp : ArrowDown
  return (
    <button
      type="button"
      onClick={() => onOrdenar(coluna)}
      aria-label={`Ordenar por ${typeof children === 'string' ? children : coluna}`}
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap transition-colors hover:text-arena-navy-800',
        alinhar === 'direita' && 'flex-row-reverse',
        ativo && 'text-arena-navy-800',
      )}
    >
      {children}
      <Icone className={cn('h-3 w-3', ativo ? 'opacity-100' : 'opacity-40')} />
    </button>
  )
}
