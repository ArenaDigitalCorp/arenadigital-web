'use client'

import { useState } from 'react'
import { AlertTriangle, Eye, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { arenaDataTable } from '@/lib/arena-data-table'
import { cn, normalizeString } from '@/lib/utils'
import { formatData, formatHoras, resumosDeAtletas, type ResumoAtleta } from '../lib'
import type { Atleta, Turma, TurmasCatalogo } from '../types'
import { Ordenavel, useOrdenacao } from './Ordenavel'

interface Props {
  turmas: Turma[]
  catalogo: TurmasCatalogo
  onVer: (atleta: Atleta) => void
  onAbrirTurma: (turma: Turma) => void
}

type Coluna = 'nome' | 'esportes' | 'turmas' | 'professores' | 'aulas' | 'desde' | 'ultima' | 'situacao'
type Situacao = 'todos' | 'em-turma' | 'ex-aluno'

const SITUACOES: { valor: Situacao; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'em-turma', rotulo: 'Em turma' },
  { valor: 'ex-aluno', rotulo: 'Ex-alunos' },
]

const TODOS = 'todos'

export function AtletasTab({ turmas, catalogo, onVer, onAbrirTurma }: Props) {
  const [busca, setBusca] = useState('')
  const [situacao, setSituacao] = useState<Situacao>('todos')
  const [esporteId, setEsporteId] = useState(TODOS)
  const [professorId, setProfessorId] = useState(TODOS)
  const [soNivelFora, setSoNivelFora] = useState(false)

  const linhas = resumosDeAtletas(turmas, catalogo)
  const contagem: Record<Situacao, number> = {
    todos: linhas.length,
    'em-turma': linhas.filter((l) => l.situacao === 'em-turma').length,
    'ex-aluno': linhas.filter((l) => l.situacao === 'ex-aluno').length,
  }
  const totalNivelFora = linhas.filter((l) => l.nivelForaEm.length > 0).length

  const q = normalizeString(busca.trim())
  const filtradas = linhas.filter(
    (l) =>
      (situacao === 'todos' || l.situacao === situacao) &&
      (esporteId === TODOS || l.periodos.some((p) => p.turma.esporteId === esporteId)) &&
      (professorId === TODOS || l.ativos.some((p) => p.turma.professorId === professorId)) &&
      (!soNivelFora || l.nivelForaEm.length > 0) &&
      (!q || normalizeString(`${l.atleta.nome} ${l.atleta.email}`).includes(q)),
  )

  const { ordem, alternar, ordenados } = useOrdenacao<ResumoAtleta, Coluna>(
    filtradas,
    { coluna: 'nome', direcao: 'asc' },
    {
      nome: (l) => l.atleta.nome,
      esportes: (l) => l.esportes.map((e) => e.nome).join(', '),
      turmas: (l) => l.ativos.length,
      professores: (l) => l.professores.join(', '),
      aulas: (l) => l.minutosSemana,
      desde: (l) => l.alunoDesde,
      ultima: (l) => l.ultimaMovimentacao.data,
      situacao: (l) => (l.situacao === 'em-turma' ? 0 : 1),
    },
  )

  const filtroAtivo = Boolean(q) || esporteId !== TODOS || professorId !== TODOS || soNivelFora || situacao !== 'todos'

  return (
    <Card className="rounded-lg border border-slate-100 bg-white px-6 py-6 shadow-sm">
      <div className="mb-8 flex flex-col items-start gap-3">
        <div className="flex w-full flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-heading text-xl font-bold text-arena-navy-800">Atletas em turmas</h3>
          <p className="text-xs font-medium text-arena-navy-800/50">
            Quem faz ou já fez parte de alguma turma da arena
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-3">
          <div className="relative w-full max-w-sm">
            <Input
              placeholder="Buscar por atleta"
              className="h-10 w-full rounded-md border-slate-300 pl-3 pr-10 text-sm text-arena-navy-800 shadow-none placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-[#20B2AA]"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
          <Select value={esporteId} onValueChange={setEsporteId}>
            <SelectTrigger className="h-10 w-full border-slate-300 sm:w-48" aria-label="Filtrar por esporte da turma">
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
            <SelectTrigger className="h-10 w-full border-slate-300 sm:w-56" aria-label="Filtrar por professor atual">
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
                setSituacao('todos')
                setEsporteId(TODOS)
                setProfessorId(TODOS)
                setSoNivelFora(false)
              }}
              className="text-xs font-semibold text-arena-button hover:underline"
            >
              Limpar filtros
            </button>
          )}
        </div>
        <div className="flex w-full flex-wrap items-center gap-1.5">
          {SITUACOES.map(({ valor, rotulo }) => {
            const ativo = situacao === valor
            return (
              <button
                key={valor}
                type="button"
                aria-pressed={ativo}
                onClick={() => setSituacao(valor)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                  ativo
                    ? 'border-arena-navy-800 bg-arena-navy-800 text-white'
                    : 'border-slate-200 text-arena-navy-800/60 hover:border-slate-300 hover:bg-slate-50',
                )}
              >
                {rotulo}
                <span className={cn('ml-1.5', ativo ? 'text-white/60' : 'text-arena-navy-800/35')}>{contagem[valor]}</span>
              </button>
            )
          })}
          {totalNivelFora > 0 && (
            <button
              type="button"
              aria-pressed={soNivelFora}
              onClick={() => setSoNivelFora((v) => !v)}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                soNivelFora
                  ? 'border-amber-500 bg-amber-500 text-white'
                  : 'border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300',
              )}
            >
              <AlertTriangle className="h-3 w-3" />
              Nível fora da turma
              <span className={cn('ml-0.5', soNivelFora ? 'text-white/70' : 'text-amber-700/60')}>{totalNivelFora}</span>
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className={arenaDataTable.table}>
          <thead>
            <tr className={arenaDataTable.theadRow}>
              <th className={arenaDataTable.th}>
                <Ordenavel coluna="nome" ordem={ordem} onOrdenar={alternar}>Atleta</Ordenavel>
              </th>
              <th className={arenaDataTable.th}>
                <Ordenavel coluna="esportes" ordem={ordem} onOrdenar={alternar}>Esportes e níveis</Ordenavel>
              </th>
              <th className={arenaDataTable.th}>
                <Ordenavel coluna="turmas" ordem={ordem} onOrdenar={alternar}>Turmas atuais</Ordenavel>
              </th>
              <th className={arenaDataTable.th}>
                <Ordenavel coluna="professores" ordem={ordem} onOrdenar={alternar}>Professores</Ordenavel>
              </th>
              <th className={arenaDataTable.th}>
                <Ordenavel coluna="aulas" ordem={ordem} onOrdenar={alternar}>Aulas/semana</Ordenavel>
              </th>
              <th className={arenaDataTable.th}>
                <Ordenavel coluna="desde" ordem={ordem} onOrdenar={alternar}>Aluno desde</Ordenavel>
              </th>
              <th className={arenaDataTable.th}>
                <Ordenavel coluna="ultima" ordem={ordem} onOrdenar={alternar}>Última movimentação</Ordenavel>
              </th>
              <th className={arenaDataTable.th}>
                <Ordenavel coluna="situacao" ordem={ordem} onOrdenar={alternar}>Situação</Ordenavel>
              </th>
              <th className={arenaDataTable.thRight}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {ordenados.length === 0 ? (
              <tr>
                <td colSpan={9} className={arenaDataTable.emptyCell}>
                  {linhas.length === 0
                    ? 'Nenhum atleta passou por turmas ainda. Vincule alunos pela aba Turmas.'
                    : 'Nenhum atleta encontrado com esses filtros.'}
                </td>
              </tr>
            ) : (
              ordenados.map((l) => (
                <tr key={l.atleta.id} className={arenaDataTable.tbodyRow}>
                  <td className={arenaDataTable.tdBold}>
                    <button
                      type="button"
                      onClick={() => onVer(l.atleta)}
                      className="whitespace-nowrap text-left hover:text-arena-button hover:underline"
                    >
                      {l.atleta.nome}
                    </button>
                    <span className="block whitespace-nowrap text-xs font-normal text-arena-navy-800/50">
                      {l.atleta.telefone}
                    </span>
                  </td>
                  <td className={arenaDataTable.td}>
                    <div className="flex flex-wrap gap-1">
                      {l.esportes.map((e) => (
                        <span
                          key={e.esporteId}
                          className="inline-flex items-center whitespace-nowrap rounded-full bg-arena-navy-800/5 px-2.5 py-0.5 text-xs font-medium text-arena-navy-800"
                        >
                          {e.nome}
                          <span className="ml-1 font-bold text-teal-700">· {e.nivel}</span>
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className={arenaDataTable.td}>
                    {l.ativos.length === 0 ? (
                      <span className="text-xs text-arena-navy-800/30">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {l.ativos.map((p) => {
                          const fora = l.nivelForaEm.includes(p.turma.codigo)
                          return (
                            <button
                              key={p.matricula.id}
                              type="button"
                              title={fora ? 'Nível do atleta fora dos níveis desta turma' : 'Abrir alunos da turma'}
                              onClick={() => onAbrirTurma(p.turma)}
                              className={cn(
                                'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-bold transition-colors',
                                fora
                                  ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                  : 'bg-teal-50 text-teal-700 hover:bg-teal-100',
                              )}
                            >
                              {fora && <AlertTriangle className="h-3 w-3" />}
                              {p.turma.codigo}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </td>
                  <td className={cn(arenaDataTable.td, 'text-arena-navy-800/70')}>
                    {l.professores.length ? (
                      l.professores.map((nome) => (
                        <span key={nome} className="block whitespace-nowrap">
                          {nome}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-arena-navy-800/30">—</span>
                    )}
                  </td>
                  <td className={cn(arenaDataTable.td, 'whitespace-nowrap', l.minutosSemana === 0 && 'text-arena-navy-800/30')}>
                    {l.minutosSemana === 0 ? '—' : formatHoras(l.minutosSemana)}
                  </td>
                  <td className={cn(arenaDataTable.td, 'text-arena-navy-800/60')}>{formatData(l.alunoDesde)}</td>
                  <td className={arenaDataTable.td}>
                    <span className="block whitespace-nowrap text-arena-navy-800/60">
                      {formatData(l.ultimaMovimentacao.data)}
                    </span>
                    <span
                      className={cn(
                        'block whitespace-nowrap text-xs font-normal',
                        l.ultimaMovimentacao.tipo === 'entrada' ? 'text-emerald-700' : 'text-arena-navy-800/50',
                      )}
                    >
                      {l.ultimaMovimentacao.tipo === 'entrada' ? 'Entrou em' : 'Saiu de'} {l.ultimaMovimentacao.codigo}
                    </span>
                  </td>
                  <td className={arenaDataTable.td}>
                    <span
                      className={cn(
                        'whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold',
                        l.situacao === 'em-turma' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600',
                      )}
                    >
                      {l.situacao === 'em-turma' ? 'Em turma' : 'Ex-aluno'}
                    </span>
                  </td>
                  <td className={arenaDataTable.tdRight}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Ver atleta"
                          onClick={() => onVer(l.atleta)}
                          className="h-8 w-8 text-teal-600/60 bg-teal-50 hover:bg-teal-100 hover:text-teal-600"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Ver atleta e turmas</p>
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
