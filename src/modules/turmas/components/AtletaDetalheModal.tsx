'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { StandardModal } from '@/components/ui/standard-modal'
import { DashboardTabs } from '@/components/dashboard/DashboardTabs'
import { arenaDataTable } from '@/lib/arena-data-table'
import { cn } from '@/lib/utils'
import {
  blocosDaTurma,
  chaveBloco,
  formatData,
  formatHoras,
  hojeISO,
  iniciais,
  nivelNaTurma,
  nomeAtleta,
  nomesEspacos,
  ordenarBlocos,
  permanencia,
  resumoBlocos,
  resumosDeAtletas,
  type Periodo,
} from '../lib'
import type { Atleta, Turma, TurmasCatalogo } from '../types'
import { Ordenavel, useOrdenacao } from './Ordenavel'

interface Props {
  atleta: Atleta
  turmas: Turma[]
  catalogo: TurmasCatalogo
  onFechar: () => void
  onAbrirTurma: (turma: Turma) => void
}

type Aba = 'atuais' | 'historico'
type ColunaAtuais = 'codigo' | 'esporte' | 'nivel' | 'professor' | 'horario' | 'entrada'
type ColunaHistorico = 'codigo' | 'esporte' | 'professor' | 'entrada' | 'saida' | 'tempo' | 'motivo'

interface Linha extends Periodo {
  esporte: string
  professor: string
  horario: string
  espacos: string
  ordemHorario: number
  nivel: string | null
  niveisTurma: string[]
  fora: boolean
}

export function AtletaDetalheModal({ atleta, turmas, catalogo, onFechar, onAbrirTurma }: Props) {
  const resumo = resumosDeAtletas(turmas, catalogo).find((r) => r.atleta.id === atleta.id)
  const [aba, setAba] = useState<Aba>(resumo?.situacao === 'ex-aluno' ? 'historico' : 'atuais')
  const hoje = hojeISO()

  const linha = (p: Periodo): Linha => {
    const blocos = blocosDaTurma(p.turma)
    return {
      ...p,
      esporte: catalogo.esportes.find((e) => e.id === p.turma.esporteId)?.nome ?? '—',
      professor: nomeAtleta(catalogo, p.turma.professorId),
      horario: resumoBlocos(blocos),
      espacos: nomesEspacos(blocos, catalogo),
      ordemHorario: blocos.length ? chaveBloco(ordenarBlocos(blocos)[0]) : Number.MAX_SAFE_INTEGER,
      ...nivelNaTurma(atleta, p.turma, catalogo),
    }
  }
  const atuais = (resumo?.ativos ?? []).map(linha)
  const historico = (resumo?.periodos ?? []).map(linha)

  const ordemAtuais = useOrdenacao<Linha, ColunaAtuais>(
    atuais,
    { coluna: 'horario', direcao: 'asc' },
    {
      codigo: (l) => l.turma.codigo,
      esporte: (l) => l.esporte,
      nivel: (l) => l.nivel ?? '',
      professor: (l) => l.professor,
      horario: (l) => l.ordemHorario,
      entrada: (l) => l.matricula.entrada,
    },
  )
  const ordemHistorico = useOrdenacao<Linha, ColunaHistorico>(
    historico,
    { coluna: 'entrada', direcao: 'desc' },
    {
      codigo: (l) => l.turma.codigo,
      esporte: (l) => l.esporte,
      professor: (l) => l.professor,
      entrada: (l) => l.matricula.entrada,
      saida: (l) => l.matricula.saida ?? '9999-12-31',
      tempo: (l) => Date.parse(l.matricula.saida ?? hoje) - Date.parse(l.matricula.entrada),
      motivo: (l) => l.matricula.motivoSaida ?? '',
    },
  )

  // Esportes do perfil + esportes de turmas em que o atleta não tem nível cadastrado.
  const esportesDoPerfil = resumo?.esportes ?? []
  const semNivelNoPerfil = [
    ...new Set(
      (resumo?.periodos ?? [])
        .map((p) => p.turma.esporteId)
        .filter((id) => !esportesDoPerfil.some((e) => e.esporteId === id)),
    ),
  ]

  return (
    <StandardModal open onOpenChange={(aberto) => !aberto && onFechar()} title="Atleta" size="wide">
      <div className="space-y-7 pr-1">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-arena-navy-800 text-lg font-bold text-white">
            {iniciais(atleta.nome)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xl font-bold text-arena-navy-800">{atleta.nome}</p>
            <p className="flex flex-wrap items-center gap-2 text-sm text-arena-navy-800/50">
              {resumo && <>Aluno desde {formatData(resumo.alunoDesde)}</>}
              {resumo && (
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                    resumo.situacao === 'em-turma' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600',
                  )}
                >
                  {resumo.situacao === 'em-turma' ? 'Em turma' : 'Ex-aluno'}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <Numero rotulo="Turmas atuais" valor={String(atuais.length)} />
            <Numero rotulo="Aulas/semana" valor={resumo?.minutosSemana ? formatHoras(resumo.minutosSemana) : '—'} />
            <Numero rotulo="Passagens" valor={String(historico.length)} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 rounded-lg border border-arena-navy-800/10 bg-arena-navy-800/[0.02] p-4 text-sm sm:grid-cols-3">
          <Dado rotulo="CPF" valor={atleta.cpf ?? '—'} />
          <Dado rotulo="Telefone" valor={atleta.telefone ?? '—'} />
          <Dado rotulo="E-mail" valor={atleta.email ?? '—'} />
        </div>

        <section>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-[#007793]">
            Esportes e níveis (perfil do atleta)
          </h4>
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
            {esportesDoPerfil.map((e) => {
              const turmasDoEsporte = atuais.filter((l) => l.turma.esporteId === e.esporteId)
              return (
                <li key={e.esporteId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                  <span>
                    <span className="font-semibold text-arena-navy-800">{e.nome}</span>
                    <span className="ml-2 rounded-md bg-teal-50 px-1.5 py-0.5 text-[11px] font-bold text-teal-700">
                      Nível {e.nivel}
                    </span>
                  </span>
                  {turmasDoEsporte.length > 0 ? (
                    <span className="flex flex-wrap justify-end gap-1">
                      {turmasDoEsporte.map((l) => (
                        <span
                          key={l.matricula.id}
                          className={cn(
                            'rounded px-1.5 py-0.5 text-[11px] font-semibold',
                            l.fora ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-arena-navy-800/70',
                          )}
                        >
                          {l.turma.codigo} · níveis {l.niveisTurma.join(', ')}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="text-xs text-arena-navy-800/40">sem turma atual deste esporte</span>
                  )}
                </li>
              )
            })}
            {semNivelNoPerfil.map((id) => (
              <li key={id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <span className="font-semibold text-arena-navy-800">
                  {catalogo.esportes.find((e) => e.id === id)?.nome}
                </span>
                <span className="flex items-center gap-1 text-xs font-medium text-amber-700">
                  <AlertTriangle className="h-3 w-3" />
                  sem nível no perfil do atleta
                </span>
              </li>
            ))}
            {esportesDoPerfil.length === 0 && semNivelNoPerfil.length === 0 && (
              <li className="px-4 py-2.5 text-sm text-arena-navy-800/40">Nenhum esporte no perfil.</li>
            )}
          </ul>
        </section>

        <div>
          <DashboardTabs
            value={aba}
            onChange={setAba}
            tabs={[
              { label: `Turmas atuais (${atuais.length})`, value: 'atuais' },
              { label: `Histórico (${historico.length})`, value: 'historico' },
            ]}
          />

          <div className="mt-2 overflow-x-auto">
            {aba === 'atuais' ? (
              <table className={arenaDataTable.table}>
                <thead>
                  <tr className={arenaDataTable.theadRow}>
                    <th className={arenaDataTable.th}>
                      <Ordenavel coluna="codigo" ordem={ordemAtuais.ordem} onOrdenar={ordemAtuais.alternar}>Turma</Ordenavel>
                    </th>
                    <th className={arenaDataTable.th}>
                      <Ordenavel coluna="esporte" ordem={ordemAtuais.ordem} onOrdenar={ordemAtuais.alternar}>Esporte</Ordenavel>
                    </th>
                    <th className={arenaDataTable.th}>
                      <Ordenavel coluna="nivel" ordem={ordemAtuais.ordem} onOrdenar={ordemAtuais.alternar}>Nível (atleta × turma)</Ordenavel>
                    </th>
                    <th className={arenaDataTable.th}>
                      <Ordenavel coluna="professor" ordem={ordemAtuais.ordem} onOrdenar={ordemAtuais.alternar}>Professor</Ordenavel>
                    </th>
                    <th className={arenaDataTable.th}>
                      <Ordenavel coluna="horario" ordem={ordemAtuais.ordem} onOrdenar={ordemAtuais.alternar}>Horários</Ordenavel>
                    </th>
                    <th className={arenaDataTable.th}>
                      <Ordenavel coluna="entrada" ordem={ordemAtuais.ordem} onOrdenar={ordemAtuais.alternar}>Entrou em</Ordenavel>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ordemAtuais.ordenados.length === 0 ? (
                    <tr>
                      <td colSpan={6} className={arenaDataTable.emptyCell}>
                        O atleta não está em nenhuma turma no momento.
                      </td>
                    </tr>
                  ) : (
                    ordemAtuais.ordenados.map((l) => (
                      <tr key={l.matricula.id} className={arenaDataTable.tbodyRow}>
                        <td className={arenaDataTable.tdBold}>
                          <CodigoTurma turma={l.turma} onClick={() => onAbrirTurma(l.turma)} />
                        </td>
                        <td className={cn(arenaDataTable.td, 'whitespace-nowrap')}>{l.esporte}</td>
                        <td className={arenaDataTable.td}>
                          <span
                            title={l.fora ? 'Nível do atleta fora dos níveis da turma' : undefined}
                            className={cn(
                              'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold',
                              l.fora ? 'bg-amber-50 text-amber-700' : 'bg-teal-50 text-teal-700',
                            )}
                          >
                            {l.fora && <AlertTriangle className="h-3 w-3" />}
                            {l.nivel ?? 'sem nível'}
                          </span>
                          <span className="ml-1.5 whitespace-nowrap text-xs font-normal text-arena-navy-800/50">
                            turma: {l.niveisTurma.join(', ') || '—'}
                          </span>
                        </td>
                        <td className={cn(arenaDataTable.td, 'whitespace-nowrap')}>{l.professor}</td>
                        <td className={arenaDataTable.td}>
                          <p className="whitespace-nowrap">{l.horario}</p>
                          <p className="text-xs font-normal text-arena-navy-800/50">{l.espacos}</p>
                        </td>
                        <td className={cn(arenaDataTable.td, 'text-arena-navy-800/60')}>
                          <span className="block whitespace-nowrap">{formatData(l.matricula.entrada)}</span>
                          <span className="block whitespace-nowrap text-xs">
                            {permanencia(l.matricula.entrada, null) === 'hoje'
                              ? 'desde hoje'
                              : `há ${permanencia(l.matricula.entrada, null)}`}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <table className={arenaDataTable.table}>
                <thead>
                  <tr className={arenaDataTable.theadRow}>
                    <th className={arenaDataTable.th}>
                      <Ordenavel coluna="codigo" ordem={ordemHistorico.ordem} onOrdenar={ordemHistorico.alternar}>Turma</Ordenavel>
                    </th>
                    <th className={arenaDataTable.th}>
                      <Ordenavel coluna="esporte" ordem={ordemHistorico.ordem} onOrdenar={ordemHistorico.alternar}>Esporte</Ordenavel>
                    </th>
                    <th className={arenaDataTable.th}>
                      <Ordenavel coluna="professor" ordem={ordemHistorico.ordem} onOrdenar={ordemHistorico.alternar}>Professor</Ordenavel>
                    </th>
                    <th className={arenaDataTable.th}>
                      <Ordenavel coluna="entrada" ordem={ordemHistorico.ordem} onOrdenar={ordemHistorico.alternar}>Entrou em</Ordenavel>
                    </th>
                    <th className={arenaDataTable.th}>
                      <Ordenavel coluna="saida" ordem={ordemHistorico.ordem} onOrdenar={ordemHistorico.alternar}>Saiu em</Ordenavel>
                    </th>
                    <th className={arenaDataTable.th}>
                      <Ordenavel coluna="tempo" ordem={ordemHistorico.ordem} onOrdenar={ordemHistorico.alternar}>Permanência</Ordenavel>
                    </th>
                    <th className={arenaDataTable.th}>
                      <Ordenavel coluna="motivo" ordem={ordemHistorico.ordem} onOrdenar={ordemHistorico.alternar}>Motivo da saída</Ordenavel>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ordemHistorico.ordenados.map((l) => (
                    <tr key={l.matricula.id} className={arenaDataTable.tbodyRow}>
                      <td className={arenaDataTable.tdBold}>
                        <CodigoTurma turma={l.turma} onClick={() => onAbrirTurma(l.turma)} />
                        {l.turma.status === 'encerrada' && (
                          <span className="mt-1 block w-fit whitespace-nowrap rounded-full bg-slate-200/70 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                            Turma encerrada
                          </span>
                        )}
                      </td>
                      <td className={cn(arenaDataTable.td, 'whitespace-nowrap')}>{l.esporte}</td>
                      <td className={cn(arenaDataTable.td, 'whitespace-nowrap')}>{l.professor}</td>
                      <td className={cn(arenaDataTable.td, 'text-arena-navy-800/60')}>{formatData(l.matricula.entrada)}</td>
                      <td className={arenaDataTable.td}>
                        {l.matricula.saida ? (
                          <span className="text-arena-navy-800/60">{formatData(l.matricula.saida)}</span>
                        ) : (
                          <span className="whitespace-nowrap rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                            Na turma
                          </span>
                        )}
                      </td>
                      <td className={cn(arenaDataTable.td, 'text-arena-navy-800/60')}>
                        {permanencia(l.matricula.entrada, l.matricula.saida)}
                      </td>
                      <td className={cn(arenaDataTable.td, 'text-arena-navy-800/60')}>
                        {l.matricula.motivoSaida ?? (l.matricula.saida ? 'Não informado' : '—')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </StandardModal>
  )
}

function CodigoTurma({ turma, onClick }: { turma: Turma; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'font-mono text-[13px] hover:text-arena-button hover:underline',
        turma.status === 'encerrada' && 'text-arena-navy-800/45',
      )}
    >
      {turma.codigo}
    </button>
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
