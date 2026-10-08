'use client'

import { useState } from 'react'
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Eye, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { arenaDataTable } from '@/lib/arena-data-table'
import { cn, normalizeString } from '@/lib/utils'
import { formatData, formatHoras, resumoProfessor, type ResumoProfessor as Linha } from '../lib'
import type { Professor, Turma, TurmasCatalogo } from '../types'
import { Ordenavel, useOrdenacao } from './Ordenavel'

interface Props {
  turmas: Turma[]
  catalogo: TurmasCatalogo
  onVer: (professor: Professor) => void
}

type Coluna = 'nome' | 'telefone' | 'email' | 'esportes' | 'turmas' | 'alunos' | 'horas' | 'desde'
type Filtro = 'todos' | 'com' | 'sem'

const FILTROS: { valor: Filtro; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'com', rotulo: 'Com turmas' },
  { valor: 'sem', rotulo: 'Sem turmas' },
]

export function ProfessoresTab({ turmas, catalogo, onVer }: Props) {
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')

  const linhas = catalogo.professores.map((p) => resumoProfessor(p, turmas, catalogo))
  const maxTurmas = Math.max(1, ...linhas.map((l) => l.turmas))
  const contagem: Record<Filtro, number> = {
    todos: linhas.length,
    com: linhas.filter((l) => l.turmas > 0).length,
    sem: linhas.filter((l) => l.turmas === 0).length,
  }

  const q = normalizeString(busca.trim())
  const filtradas = linhas.filter(
    (l) =>
      (filtro === 'todos' || (filtro === 'com' ? l.turmas > 0 : l.turmas === 0)) &&
      (!q || normalizeString(`${l.professor.nome} ${l.professor.email ?? ''}`).includes(q)),
  )

  const { ordem, setOrdem, alternar, ordenados } = useOrdenacao<Linha, Coluna>(
    filtradas,
    { coluna: 'turmas', direcao: 'desc' },
    {
      nome: (l) => l.professor.nome,
      telefone: (l) => l.professor.telefone ?? '',
      email: (l) => l.professor.email ?? '',
      esportes: (l) => l.esportes.join(', '),
      turmas: (l) => l.turmas,
      alunos: (l) => l.alunos,
      horas: (l) => l.minutosSemana,
      desde: (l) => l.professor.professorDesde ?? '',
    },
  )

  const porTurmas = ordem.coluna === 'turmas' ? ordem.direcao : null

  return (
    <Card className="rounded-lg border border-slate-100 bg-white px-6 py-6 shadow-sm">
      <div className="mb-8 flex flex-col items-start gap-3">
        <div className="flex w-full flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-heading text-xl font-bold text-arena-navy-800">Professores da arena</h3>
          <p className="text-xs font-medium text-arena-navy-800/50">
            Atletas com o perfil Professor nesta arena
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-3">
          <div className="relative w-full max-w-sm">
            <Input
              placeholder="Buscar por professor"
              className="h-10 w-full rounded-md border-slate-300 pl-3 pr-10 text-sm text-arena-navy-800 shadow-none placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-[#20B2AA]"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {FILTROS.map(({ valor, rotulo }) => {
              const ativo = filtro === valor
              return (
                <button
                  key={valor}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => setFiltro(valor)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                    ativo
                      ? 'border-arena-navy-800 bg-arena-navy-800 text-white'
                      : 'border-slate-200 text-arena-navy-800/60 hover:border-slate-300 hover:bg-slate-50',
                  )}
                >
                  {rotulo}
                  <span className={cn('ml-1.5', ativo ? 'text-white/60' : 'text-arena-navy-800/35')}>
                    {contagem[valor]}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-1.5 sm:ml-auto">
            <span className="text-xs font-medium text-arena-navy-800/50">Ordenar:</span>
            <BotaoOrdem
              ativo={porTurmas === 'desc'}
              onClick={() => setOrdem({ coluna: 'turmas', direcao: 'desc' })}
              icone={<ArrowDownWideNarrow className="h-3.5 w-3.5" />}
            >
              Mais turmas
            </BotaoOrdem>
            <BotaoOrdem
              ativo={porTurmas === 'asc'}
              onClick={() => setOrdem({ coluna: 'turmas', direcao: 'asc' })}
              icone={<ArrowUpNarrowWide className="h-3.5 w-3.5" />}
            >
              Menos turmas
            </BotaoOrdem>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className={arenaDataTable.table}>
          <thead>
            <tr className={arenaDataTable.theadRow}>
              <th className={arenaDataTable.th}>
                <Ordenavel coluna="nome" ordem={ordem} onOrdenar={alternar}>Professor</Ordenavel>
              </th>
              <th className={arenaDataTable.th}>
                <Ordenavel coluna="telefone" ordem={ordem} onOrdenar={alternar}>Telefone</Ordenavel>
              </th>
              <th className={arenaDataTable.th}>
                <Ordenavel coluna="email" ordem={ordem} onOrdenar={alternar}>E-mail</Ordenavel>
              </th>
              <th className={arenaDataTable.th}>
                <Ordenavel coluna="esportes" ordem={ordem} onOrdenar={alternar}>Esportes</Ordenavel>
              </th>
              <th className={arenaDataTable.th}>
                <Ordenavel coluna="turmas" ordem={ordem} onOrdenar={alternar}>Turmas</Ordenavel>
              </th>
              <th className={arenaDataTable.th}>
                <Ordenavel coluna="alunos" ordem={ordem} onOrdenar={alternar}>Alunos ativos</Ordenavel>
              </th>
              <th className={arenaDataTable.th}>
                <Ordenavel coluna="horas" ordem={ordem} onOrdenar={alternar}>Aulas/semana</Ordenavel>
              </th>
              <th className={arenaDataTable.th}>
                <Ordenavel coluna="desde" ordem={ordem} onOrdenar={alternar}>Professor desde</Ordenavel>
              </th>
              <th className={arenaDataTable.thRight}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {ordenados.length === 0 ? (
              <tr>
                <td colSpan={9} className={arenaDataTable.emptyCell}>
                  {linhas.length === 0
                    ? 'Nenhum atleta com perfil Professor nesta arena. Defina o perfil na tela do atleta.'
                    : 'Nenhum professor encontrado com esses filtros.'}
                </td>
              </tr>
            ) : (
              ordenados.map((l) => (
                <tr key={l.professor.id} className={arenaDataTable.tbodyRow}>
                  <td className={arenaDataTable.tdBold}>
                    <button
                      type="button"
                      onClick={() => onVer(l.professor)}
                      className="whitespace-nowrap text-left hover:text-arena-button hover:underline"
                    >
                      {l.professor.nome}
                    </button>
                  </td>
                  <td className={cn(arenaDataTable.td, 'whitespace-nowrap text-arena-navy-800/60')}>
                    {l.professor.telefone ?? '—'}
                  </td>
                  <td className={cn(arenaDataTable.td, 'text-arena-navy-800/60')}>{l.professor.email ?? '—'}</td>
                  <td className={arenaDataTable.td}>
                    <div className="flex flex-wrap gap-1">
                      {l.esportes.map((e) => (
                        <span
                          key={e}
                          className="inline-flex items-center whitespace-nowrap rounded-full bg-arena-navy-800/5 px-2.5 py-0.5 text-xs font-medium text-arena-navy-800"
                        >
                          {e}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className={arenaDataTable.td}>
                    <div className="flex items-center gap-2">
                      <span className={cn('w-4 text-right font-bold', l.turmas === 0 && 'text-arena-navy-800/30')}>
                        {l.turmas}
                      </span>
                      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                        <span
                          className="block h-full rounded-full bg-[#20B2AA]"
                          style={{ width: `${(l.turmas / maxTurmas) * 100}%` }}
                        />
                      </span>
                    </div>
                  </td>
                  <td className={cn(arenaDataTable.td, l.alunos === 0 && 'text-arena-navy-800/30')}>{l.alunos}</td>
                  <td className={cn(arenaDataTable.td, 'whitespace-nowrap', l.minutosSemana === 0 && 'text-arena-navy-800/30')}>
                    {l.minutosSemana === 0 ? '—' : formatHoras(l.minutosSemana)}
                  </td>
                  <td className={cn(arenaDataTable.td, 'text-arena-navy-800/60')}>
                    {l.professor.professorDesde ? formatData(l.professor.professorDesde) : 'Sugerido'}
                  </td>
                  <td className={arenaDataTable.tdRight}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Ver professor"
                          onClick={() => onVer(l.professor)}
                          className="h-8 w-8 text-teal-600/60 bg-teal-50 hover:bg-teal-100 hover:text-teal-600"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Ver professor e turmas</p>
                      </TooltipContent>
                    </Tooltip>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {ordenados.length > 0 && (
        <div className="border-t border-slate-100 pt-4">
          <p className="text-xs text-arena-navy-800/40">
            Exibindo {ordenados.length} de {linhas.length}
          </p>
        </div>
      )}
    </Card>
  )
}

function BotaoOrdem({
  ativo,
  onClick,
  icone,
  children,
}: {
  ativo: boolean
  onClick: () => void
  icone: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors',
        ativo
          ? 'border-[#20B2AA] bg-[#20B2AA]/10 text-arena-navy-800'
          : 'border-slate-200 text-arena-navy-800/60 hover:border-slate-300 hover:bg-slate-50',
      )}
    >
      {icone}
      {children}
    </button>
  )
}
