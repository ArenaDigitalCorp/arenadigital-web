'use client'

import { Users } from 'lucide-react'
import { StandardModal } from '@/components/ui/standard-modal'
import { arenaDataTable } from '@/lib/arena-data-table'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  blocosDaTurma,
  chaveBloco,
  formatData,
  formatHoras,
  formatMes,
  iniciais,
  matriculasAtivas,
  nomesEspacos,
  ordenarBlocos,
  resumoBlocos,
  resumoProfessor,
  turmasAtivas,
} from '../lib'
import type { Professor, Turma, TurmasCatalogo } from '../types'
import { Ordenavel, useOrdenacao } from './Ordenavel'

interface Props {
  professor: Professor
  turmas: Turma[]
  catalogo: TurmasCatalogo
  onFechar: () => void
  onAbrirTurma: (turma: Turma) => void
}

type Coluna = 'codigo' | 'esporte' | 'niveis' | 'horario' | 'alunos' | 'criadaEm'

export function ProfessorDetalheModal({ professor, turmas, catalogo, onFechar, onAbrirTurma }: Props) {
  const resumo = resumoProfessor(professor, turmas, catalogo)
  const recorrencias = catalogo.recorrencias.filter((r) => r.responsavelId === professor.id)

  const linhas = turmasAtivas(turmas)
    .filter((t) => t.professorId === professor.id)
    .map((turma) => {
      const esporte = catalogo.esportes.find((e) => e.id === turma.esporteId)
      const blocos = blocosDaTurma(turma)
      return {
        turma,
        esporte: esporte?.nome ?? '—',
        niveis: (esporte?.niveis ?? []).filter((n) => turma.nivelIds.includes(n.id)).map((n) => n.nome).join(', '),
        horario: resumoBlocos(blocos),
        espacos: nomesEspacos(blocos, catalogo),
        ordemHorario: blocos.length ? chaveBloco(ordenarBlocos(blocos)[0]) : Number.MAX_SAFE_INTEGER,
        alunos: matriculasAtivas(turma).length,
      }
    })

  const { ordem, alternar, ordenados } = useOrdenacao<(typeof linhas)[number], Coluna>(
    linhas,
    { coluna: 'horario', direcao: 'asc' },
    {
      codigo: (l) => l.turma.codigo,
      esporte: (l) => l.esporte,
      niveis: (l) => l.niveis,
      horario: (l) => l.ordemHorario,
      alunos: (l) => l.alunos,
      criadaEm: (l) => l.turma.criadaEm,
    },
  )

  const turmasPorBloco = new Map<string, string[]>()
  for (const t of turmasAtivas(turmas)) {
    for (const tr of t.recorrencia.trechos) {
      turmasPorBloco.set(tr.blocoId, [...(turmasPorBloco.get(tr.blocoId) ?? []), `${t.codigo} ${tr.inicio}–${tr.fim}`])
    }
  }

  return (
    <StandardModal open onOpenChange={(aberto) => !aberto && onFechar()} title="Professor" size="wide">
      <div className="space-y-7 pr-1">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-arena-navy-800 text-lg font-bold text-white">
            {iniciais(professor.nome)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xl font-bold text-arena-navy-800">{professor.nome}</p>
            <p className="text-sm text-arena-navy-800/50">
              {professor.professorDesde
                ? `Professor desde ${formatData(professor.professorDesde)}`
                : 'Perfil Professor sugerido pelo sistema'}
            </p>
          </div>
          <div className="flex gap-2">
            <Numero rotulo="Turmas" valor={String(resumo.turmas)} />
            <Numero rotulo="Alunos ativos" valor={String(resumo.alunos)} />
            <Numero rotulo="Aulas/semana" valor={resumo.minutosSemana ? formatHoras(resumo.minutosSemana) : '—'} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 rounded-lg border border-arena-navy-800/10 bg-arena-navy-800/[0.02] p-4 text-sm sm:grid-cols-3">
          <Dado rotulo="CPF" valor={professor.cpf ?? '—'} />
          <Dado rotulo="Telefone" valor={professor.telefone ?? '—'} />
          <Dado rotulo="E-mail" valor={professor.email ?? '—'} />
          <div className="sm:col-span-3">
            <p className="font-semibold text-arena-navy-800">Esportes e níveis (perfil do atleta)</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {Object.entries(professor.niveis).map(([esporteId, nivel]) => (
                <span
                  key={esporteId}
                  className="inline-flex items-center rounded-full bg-arena-navy-800/5 px-2.5 py-0.5 text-xs font-medium text-arena-navy-800"
                >
                  {catalogo.esportes.find((e) => e.id === esporteId)?.nome} · {nivel}
                </span>
              ))}
            </div>
          </div>
        </div>

        <section>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-[#007793]">
            Horários recorrentes em nome do professor
          </h4>
          {recorrencias.length === 0 ? (
            <p className="text-sm text-arena-navy-800/40">Nenhuma recorrência ativa em nome deste professor.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
              {recorrencias.flatMap((r) =>
                ordenarBlocos(r.blocos).map((b) => {
                  const usadas = turmasPorBloco.get(b.id)
                  return (
                    <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                      <span>
                        <span className="font-semibold text-arena-navy-800">{resumoBlocos([b])}</span>
                        <span className="text-arena-navy-800/50"> · {nomesEspacos([b], catalogo)}</span>
                        {r.valorMensal !== null && (
                          <span className="ml-2 text-xs font-semibold text-arena-navy-800/60">
                            {formatCurrency(r.valorMensal)}/mês
                          </span>
                        )}
                        {r.encerraAPartirDe && (
                          <span className="ml-2 rounded bg-orange-100 px-1.5 py-0.5 text-[11px] font-semibold text-orange-700">
                            encerra a partir de {formatMes(r.encerraAPartirDe)}
                          </span>
                        )}
                      </span>
                      {usadas ? (
                        <span className="flex flex-wrap justify-end gap-1">
                          {usadas.map((u) => (
                            <span key={u} className="rounded bg-teal-50 px-1.5 py-0.5 text-[11px] font-semibold text-teal-700">
                              {u}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">
                          sem turma
                        </span>
                      )}
                    </li>
                  )
                }),
              )}
            </ul>
          )}
        </section>

        <section>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#007793]">Turmas sob responsabilidade</h4>
            {resumo.turmasEncerradas > 0 && (
              <span className="text-xs text-arena-navy-800/40">
                + {resumo.turmasEncerradas} encerrada{resumo.turmasEncerradas === 1 ? '' : 's'} (no filtro Encerradas da aba
                Turmas)
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className={arenaDataTable.table}>
              <thead>
                <tr className={arenaDataTable.theadRow}>
                  <th className={arenaDataTable.th}>
                    <Ordenavel coluna="codigo" ordem={ordem} onOrdenar={alternar}>Código</Ordenavel>
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
                    <Ordenavel coluna="alunos" ordem={ordem} onOrdenar={alternar}>Alunos</Ordenavel>
                  </th>
                  <th className={arenaDataTable.th}>
                    <Ordenavel coluna="criadaEm" ordem={ordem} onOrdenar={alternar}>Criada em</Ordenavel>
                  </th>
                </tr>
              </thead>
              <tbody>
                {ordenados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={arenaDataTable.emptyCell}>
                      Este professor ainda não é responsável por nenhuma turma.
                    </td>
                  </tr>
                ) : (
                  ordenados.map((l) => (
                    <tr key={l.turma.id} className={arenaDataTable.tbodyRow}>
                      <td className={arenaDataTable.tdBold}>
                        <button
                          type="button"
                          onClick={() => onAbrirTurma(l.turma)}
                          className="font-mono text-[13px] hover:text-arena-button hover:underline"
                        >
                          {l.turma.codigo}
                        </button>
                      </td>
                      <td className={arenaDataTable.td}>{l.esporte}</td>
                      <td className={arenaDataTable.td}>{l.niveis}</td>
                      <td className={arenaDataTable.td}>
                        <p className="whitespace-nowrap">{l.horario}</p>
                        <p className="text-xs font-normal text-arena-navy-800/50">{l.espacos}</p>
                      </td>
                      <td className={arenaDataTable.td}>
                        <span className={cn('inline-flex items-center gap-1.5 font-bold', l.alunos === 0 && 'text-arena-navy-800/30')}>
                          <Users className="h-3.5 w-3.5" />
                          {l.alunos}
                        </span>
                      </td>
                      <td className={cn(arenaDataTable.td, 'text-arena-navy-800/60')}>{formatData(l.turma.criadaEm)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </StandardModal>
  )
}

function Numero({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="min-w-[88px] rounded-lg border border-slate-100 bg-white px-3 py-2 text-center shadow-sm">
      <p className="text-lg font-black text-arena-navy-800">{valor}</p>
      <p className="text-[10px] font-bold uppercase tracking-wider text-arena-navy-800/40">{rotulo}</p>
    </div>
  )
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <p className="font-semibold text-arena-navy-800">{rotulo}</p>
      <p className="text-arena-navy-800/65">{valor}</p>
    </div>
  )
}
