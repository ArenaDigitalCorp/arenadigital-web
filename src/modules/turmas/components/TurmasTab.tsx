'use client'

import { useState } from 'react'
import { Archive, Pencil, Search, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { arenaDataTable } from '@/lib/arena-data-table'
import { cn, normalizeString } from '@/lib/utils'
import {
  blocosDaTurma,
  chaveBloco,
  formatData,
  matriculasAtivas,
  nomeAtleta,
  nomesEspacos,
  ordenarBlocos,
  resumoBlocos,
  turmasAtivas,
  usaTrechoParcial,
} from '../lib'
import type { Turma, TurmasCatalogo } from '../types'
import { Ordenavel, useOrdenacao } from './Ordenavel'

interface Props {
  turmas: Turma[]
  catalogo: TurmasCatalogo
  onEditar: (turma: Turma) => void
  onAlunos: (turma: Turma) => void
  onEncerrar: (turma: Turma) => void
}

type Coluna = 'codigo' | 'professor' | 'esporte' | 'niveis' | 'horario' | 'alunos' | 'criadaEm'

interface Linha {
  turma: Turma
  encerrada: boolean
  professor: string
  esporte: string
  niveis: string[]
  horario: string
  detalheHorario: string
  ordemHorario: number
  alunos: number
}

const TODOS = 'todos'

export function TurmasTab({ turmas, catalogo, onEditar, onAlunos, onEncerrar }: Props) {
  const [busca, setBusca] = useState('')
  const [esporteId, setEsporteId] = useState(TODOS)
  const [professorId, setProfessorId] = useState(TODOS)
  const [mostrarEncerradas, setMostrarEncerradas] = useState(false)

  const ativas = turmasAtivas(turmas)
  const totalEncerradas = turmas.length - ativas.length

  const linhas: Linha[] = (mostrarEncerradas ? turmas : ativas).map((turma) => {
    const esporte = catalogo.esportes.find((e) => e.id === turma.esporteId)
    const blocos = blocosDaTurma(turma)
    const origem = turma.recorrencia.criadaPelaTurma ? 'Recorrência criada pela turma' : 'Recorrência vinculada'
    return {
      turma,
      encerrada: turma.status === 'encerrada',
      professor: nomeAtleta(catalogo, turma.professorId),
      esporte: esporte?.nome ?? '—',
      niveis: (esporte?.niveis ?? []).filter((n) => turma.nivelIds.includes(n.id)).map((n) => n.nome),
      horario: resumoBlocos(blocos),
      detalheHorario: [nomesEspacos(blocos, catalogo), origem, usaTrechoParcial(turma) && 'parte do bloco']
        .filter(Boolean)
        .join(' · '),
      ordemHorario: blocos.length ? chaveBloco(ordenarBlocos(blocos)[0]) : Number.MAX_SAFE_INTEGER,
      alunos: matriculasAtivas(turma).length,
    }
  })

  const q = normalizeString(busca.trim())
  const filtradas = linhas.filter(
    (l) =>
      (esporteId === TODOS || l.turma.esporteId === esporteId) &&
      (professorId === TODOS || l.turma.professorId === professorId) &&
      (!q || normalizeString(`${l.turma.codigo} ${l.professor}`).includes(q)),
  )

  const { ordem, alternar, ordenados } = useOrdenacao<Linha, Coluna>(
    filtradas,
    { coluna: 'codigo', direcao: 'asc' },
    {
      codigo: (l) => l.turma.codigo,
      professor: (l) => l.professor,
      esporte: (l) => l.esporte,
      niveis: (l) => l.niveis.join(', '),
      horario: (l) => l.ordemHorario,
      alunos: (l) => l.alunos,
      criadaEm: (l) => l.turma.criadaEm,
    },
  )

  const totalAlunos = ativas.reduce((soma, t) => soma + matriculasAtivas(t).length, 0)
  const filtroAtivo = Boolean(q) || esporteId !== TODOS || professorId !== TODOS

  return (
    <Card className="rounded-lg border border-slate-100 bg-white px-6 py-6 shadow-sm">
      <div className="mb-8 flex flex-col items-start gap-3">
        <div className="flex w-full flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-heading text-xl font-bold text-arena-navy-800">Turmas cadastradas</h3>
          <p className="text-xs font-medium text-arena-navy-800/50">
            {ativas.length} turma{ativas.length === 1 ? '' : 's'} ativa{ativas.length === 1 ? '' : 's'} · {totalAlunos}{' '}
            aluno{totalAlunos === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-3">
          <div className="relative w-full max-w-sm">
            <Input
              placeholder="Buscar por código ou professor"
              className="h-10 w-full rounded-md border-slate-300 pl-3 pr-10 text-sm text-arena-navy-800 shadow-none placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-[#20B2AA]"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
          <Select value={esporteId} onValueChange={setEsporteId}>
            <SelectTrigger className="h-10 w-full border-slate-300 sm:w-48" aria-label="Filtrar por esporte">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos os esportes</SelectItem>
              {catalogo.esportes.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={professorId} onValueChange={setProfessorId}>
            <SelectTrigger className="h-10 w-full border-slate-300 sm:w-56" aria-label="Filtrar por professor">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos os professores</SelectItem>
              {catalogo.professores.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filtroAtivo && (
            <button
              type="button"
              onClick={() => {
                setBusca('')
                setEsporteId(TODOS)
                setProfessorId(TODOS)
              }}
              className="text-xs font-semibold text-arena-button hover:underline"
            >
              Limpar filtros
            </button>
          )}
          {totalEncerradas > 0 && (
            <button
              type="button"
              aria-pressed={mostrarEncerradas}
              onClick={() => setMostrarEncerradas((v) => !v)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors sm:ml-auto',
                mostrarEncerradas
                  ? 'border-arena-navy-800 bg-arena-navy-800 text-white'
                  : 'border-slate-200 text-arena-navy-800/50 hover:border-slate-300 hover:bg-slate-50',
              )}
            >
              {mostrarEncerradas ? 'Ocultar encerradas' : 'Mostrar encerradas'}
              <span className={cn('ml-1.5', mostrarEncerradas ? 'text-white/60' : 'text-arena-navy-800/35')}>
                {totalEncerradas}
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className={arenaDataTable.table}>
          <thead>
            <tr className={arenaDataTable.theadRow}>
              <th className={arenaDataTable.th}>
                <Ordenavel coluna="codigo" ordem={ordem} onOrdenar={alternar}>Código</Ordenavel>
              </th>
              <th className={arenaDataTable.th}>
                <Ordenavel coluna="professor" ordem={ordem} onOrdenar={alternar}>Professor</Ordenavel>
              </th>
              <th className={arenaDataTable.th}>
                <Ordenavel coluna="esporte" ordem={ordem} onOrdenar={alternar}>Esporte</Ordenavel>
              </th>
              <th className={arenaDataTable.th}>
                <Ordenavel coluna="niveis" ordem={ordem} onOrdenar={alternar}>Níveis</Ordenavel>
              </th>
              <th className={arenaDataTable.th}>
                <Ordenavel coluna="horario" ordem={ordem} onOrdenar={alternar}>Horários</Ordenavel>
              </th>
              <th className={arenaDataTable.th}>
                <Ordenavel coluna="alunos" ordem={ordem} onOrdenar={alternar}>Alunos / vagas</Ordenavel>
              </th>
              <th className={arenaDataTable.th}>
                <Ordenavel coluna="criadaEm" ordem={ordem} onOrdenar={alternar}>Criada em</Ordenavel>
              </th>
              <th className={arenaDataTable.thRight}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {ordenados.length === 0 ? (
              <tr>
                <td colSpan={8} className={arenaDataTable.emptyCell}>
                  {ativas.length === 0 && !mostrarEncerradas
                    ? 'Nenhuma turma ativa. Clique em "Nova turma" para começar.'
                    : 'Nenhuma turma encontrada com esses filtros.'}
                </td>
              </tr>
            ) : (
              ordenados.map((l) => (
                <tr key={l.turma.id} className={cn(arenaDataTable.tbodyRow, l.encerrada && 'bg-slate-50/70')}>
                  <td className={arenaDataTable.tdBold}>
                    <button
                      type="button"
                      onClick={() => onAlunos(l.turma)}
                      className={cn(
                        'font-mono text-[13px] tracking-tight hover:text-arena-button hover:underline',
                        l.encerrada && 'text-arena-navy-800/45',
                      )}
                    >
                      {l.turma.codigo}
                    </button>
                    {l.encerrada && (
                      <span className="mt-1 block w-fit whitespace-nowrap rounded-full bg-slate-200/70 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                        Encerrada em {formatData(l.turma.encerradaEm)}
                      </span>
                    )}
                  </td>
                  <td className={cn(arenaDataTable.td, 'whitespace-nowrap', l.encerrada && 'text-arena-navy-800/45')}>
                    {l.professor}
                  </td>
                  <td className={arenaDataTable.td}>
                    <span className="inline-flex items-center whitespace-nowrap rounded-full bg-arena-navy-800/5 px-2.5 py-0.5 text-xs font-medium text-arena-navy-800">
                      {l.esporte}
                    </span>
                  </td>
                  <td className={arenaDataTable.td}>
                    <div className="flex flex-wrap gap-1">
                      {l.niveis.map((n) => (
                        <span
                          key={n}
                          className="rounded-md bg-teal-50 px-1.5 py-0.5 text-[11px] font-semibold text-teal-700"
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className={cn(arenaDataTable.td, l.encerrada && 'text-arena-navy-800/45')}>
                    <div className="leading-tight">
                      <p className="whitespace-nowrap">{l.horario}</p>
                      <p className="mt-0.5 text-xs font-normal text-arena-navy-800/50">{l.detalheHorario}</p>
                    </div>
                  </td>
                  <td className={arenaDataTable.td}>
                    {l.encerrada ? (
                      <span className="text-xs text-arena-navy-800/35">—</span>
                    ) : (
                      <AlunosVagas alunos={l.alunos} vagas={l.turma.vagas} onClick={() => onAlunos(l.turma)} />
                    )}
                  </td>
                  <td className={cn(arenaDataTable.td, 'text-arena-navy-800/60')}>{formatData(l.turma.criadaEm)}</td>
                  <td className={arenaDataTable.tdRight}>
                    <div className="flex items-center justify-end gap-2">
                      <Acao
                        rotulo={l.encerrada ? 'Histórico de alunos' : 'Alunos da turma'}
                        onClick={() => onAlunos(l.turma)}
                        className="text-teal-600/60 bg-teal-50 hover:bg-teal-100 hover:text-teal-600"
                      >
                        <Users className="h-4 w-4" />
                      </Acao>
                      {!l.encerrada && (
                        <>
                          <Acao
                            rotulo="Editar turma"
                            onClick={() => onEditar(l.turma)}
                            className="text-arena-navy-800/50 bg-arena-navy-800/5 hover:bg-arena-navy-800/10 hover:text-arena-navy-800"
                          >
                            <Pencil className="h-4 w-4" />
                          </Acao>
                          <Acao
                            rotulo="Encerrar turma"
                            onClick={() => onEncerrar(l.turma)}
                            className="text-red-500/60 bg-red-50 hover:bg-red-100 hover:text-red-600"
                          >
                            <Archive className="h-4 w-4" />
                          </Acao>
                        </>
                      )}
                    </div>
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

function AlunosVagas({ alunos, vagas, onClick }: { alunos: number; vagas: number | null; onClick: () => void }) {
  const lotada = vagas !== null && alunos >= vagas
  return (
    <button
      type="button"
      onClick={onClick}
      title={vagas === null ? 'Sem limite de vagas' : `${Math.max(0, vagas - alunos)} vaga(s) livre(s)`}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold transition-colors',
        lotada
          ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
          : alunos > 0
            ? 'bg-arena-navy-800/5 text-arena-navy-800 hover:bg-arena-navy-800/10'
            : 'bg-slate-50 text-arena-navy-800/40 hover:bg-slate-100',
      )}
    >
      <Users className="h-3.5 w-3.5" />
      {alunos}
      {vagas !== null && <span className="font-medium opacity-60">/ {vagas}</span>}
      {lotada && <span className="ml-0.5 text-[10px] uppercase tracking-wide">Lotada</span>}
    </button>
  )
}

function Acao({
  rotulo,
  onClick,
  className,
  children,
}: {
  rotulo: string
  onClick: () => void
  className: string
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label={rotulo} onClick={onClick} className={cn('h-8 w-8', className)}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{rotulo}</p>
      </TooltipContent>
    </Tooltip>
  )
}
