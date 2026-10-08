'use client'

import { useState } from 'react'
import { AlertTriangle, Loader2, Search, UserMinus, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { StandardModal } from '@/components/ui/standard-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DashboardTabs } from '@/components/dashboard/DashboardTabs'
import { arenaDataTable } from '@/lib/arena-data-table'
import { cn, normalizeString } from '@/lib/utils'
import {
  blocosDaTurma,
  formatData,
  hojeISO,
  matriculasAtivas,
  nomeAtleta,
  nomesEspacos,
  permanencia,
  resumoBlocos,
} from '../lib'
import { desvincularAlunoAction, vincularAlunoAction } from '../actions'
import type { Atleta, Matricula, Turma, TurmasCatalogo } from '../types'
import { Ordenavel, useOrdenacao } from './Ordenavel'

interface Props {
  arenaId: string
  turma: Turma
  catalogo: TurmasCatalogo
  onFechar: () => void
  /** Chamado depois que o banco gravou uma entrada ou saída. */
  onAlterado: () => void
  onAbrirAtleta: (atleta: Atleta) => void
}

type Aba = 'ativos' | 'historico'
type ColunaAtivos = 'nome' | 'nivel' | 'entrada' | 'tempo'
type ColunaHistorico = 'nome' | 'entrada' | 'saida' | 'tempo' | 'motivo'

interface Linha {
  matricula: Matricula
  atleta: Atleta | undefined
  nome: string
  nivel: string | null
  nivelFora: boolean
}

export function TurmaAlunosModal({ arenaId, turma, catalogo, onFechar, onAlterado, onAbrirAtleta }: Props) {
  const encerrada = turma.status === 'encerrada'
  const [aba, setAba] = useState<Aba>(encerrada ? 'historico' : 'ativos')
  const [busca, setBusca] = useState('')
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null)
  const [entrada, setEntrada] = useState(hojeISO)
  const [saindo, setSaindo] = useState<{ matriculaId: string; saida: string; motivo: string } | null>(null)
  // Id do próximo período: reenviar o mesmo vínculo (clique duplo) não duplica.
  const [matriculaId, setMatriculaId] = useState(() => crypto.randomUUID())
  const [salvando, setSalvando] = useState<'vincular' | 'desvincular' | null>(null)
  // Gravado no banco e ainda não refletido pelo recarregamento da página:
  // aparece na hora; quando os dados novos chegam, o merge abaixo não duplica.
  const [entradasLocais, setEntradasLocais] = useState<Matricula[]>([])
  const [saidasLocais, setSaidasLocais] = useState<Record<string, { saida: string; motivo: string | null }>>({})
  const [erro, setErro] = useState<string | null>(null)

  const esporte = catalogo.esportes.find((e) => e.id === turma.esporteId)
  const niveisTurma = (esporte?.niveis ?? []).filter((n) => turma.nivelIds.includes(n.id)).map((n) => n.nome)
  const blocos = blocosDaTurma(turma)

  const nivelDo = (atletaId: string) => {
    const nivel = catalogo.atletas.find((a) => a.id === atletaId)?.niveis[turma.esporteId] ?? null
    return { nivel, nivelFora: Boolean(nivel && niveisTurma.length > 0 && !niveisTurma.includes(nivel)) }
  }
  const linha = (m: Matricula): Linha => {
    const atleta = catalogo.atletas.find((a) => a.id === m.atletaId)
    return { matricula: m, atleta, nome: atleta?.nome ?? '—', ...nivelDo(m.atletaId) }
  }

  const matriculas = [
    ...turma.matriculas,
    ...entradasLocais.filter((e) => !turma.matriculas.some((m) => m.id === e.id)),
  ].map((m) => {
    const local = saidasLocais[m.id]
    return local && m.saida === null ? { ...m, saida: local.saida, motivoSaida: local.motivo } : m
  })
  const ativos = matriculasAtivas({ ...turma, matriculas }).map(linha)
  const historico = matriculas.map(linha)
  const idsAtivos = new Set(ativos.map((l) => l.matricula.atletaId))
  const lotada = turma.vagas !== null && ativos.length >= turma.vagas

  const ordemAtivos = useOrdenacao<Linha, ColunaAtivos>(
    ativos,
    { coluna: 'nome', direcao: 'asc' },
    {
      nome: (l) => l.nome,
      nivel: (l) => l.nivel ?? '',
      entrada: (l) => l.matricula.entrada,
      tempo: (l) => -Date.parse(l.matricula.entrada),
    },
  )
  const hoje = hojeISO()
  const ordemHistorico = useOrdenacao<Linha, ColunaHistorico>(
    historico,
    { coluna: 'entrada', direcao: 'desc' },
    {
      nome: (l) => l.nome,
      entrada: (l) => l.matricula.entrada,
      saida: (l) => l.matricula.saida ?? '9999-12-31',
      tempo: (l) => Date.parse(l.matricula.saida ?? hoje) - Date.parse(l.matricula.entrada),
      motivo: (l) => l.matricula.motivoSaida ?? '',
    },
  )

  const q = normalizeString(busca.trim())
  const sugestoes = q && !lotada
    ? catalogo.atletas
        .filter((a) => a.membro && !idsAtivos.has(a.id) && normalizeString(a.nome).includes(q))
        .slice(0, 6)
    : []
  const selecionado = catalogo.atletas.find((a) => a.id === selecionadoId) ?? null
  const nivelSelecionado = selecionado ? nivelDo(selecionado.id) : null
  const jaEsteveNaTurma = selecionado ? matriculas.some((m) => m.atletaId === selecionado.id) : false
  const entradaAntesDaCriacao = Boolean(entrada) && entrada < turma.criadaEm

  const vincular = async () => {
    if (!selecionado || !entrada || entradaAntesDaCriacao || lotada || salvando) return
    setSalvando('vincular')
    setErro(null)
    try {
      const res = await vincularAlunoAction({
        arenaId,
        turmaId: turma.id,
        atletaId: selecionado.id,
        matriculaId,
        dataEntrada: entrada,
      })
      if (!res.success) {
        setErro(res.error)
        toast.error(res.error)
        return
      }
      toast.success(`${selecionado.nome} vinculado à turma ${turma.codigo}.`)
      setEntradasLocais((atual) => [
        ...atual,
        { id: matriculaId, atletaId: selecionado.id, entrada, saida: null, motivoSaida: null },
      ])
      setMatriculaId(crypto.randomUUID())
      setSelecionadoId(null)
      setBusca('')
      setAba('ativos')
      onAlterado()
    } finally {
      setSalvando(null)
    }
  }

  const matriculaSaindo = saindo ? matriculas.find((m) => m.id === saindo.matriculaId) : undefined
  const saidaInvalida = Boolean(saindo && matriculaSaindo && (!saindo.saida || saindo.saida < matriculaSaindo.entrada))

  const confirmarSaida = async () => {
    if (!saindo || saidaInvalida || salvando) return
    setSalvando('desvincular')
    setErro(null)
    try {
      const res = await desvincularAlunoAction({
        arenaId,
        matriculaId: saindo.matriculaId,
        dataSaida: saindo.saida,
        motivo: saindo.motivo,
      })
      if (!res.success) {
        setErro(res.error)
        toast.error(res.error)
        return
      }
      toast.success('Saída registrada. O período fica no histórico.')
      setSaidasLocais((atual) => ({
        ...atual,
        [saindo.matriculaId]: { saida: saindo.saida, motivo: saindo.motivo.trim() || null },
      }))
      setSaindo(null)
      onAlterado()
    } finally {
      setSalvando(null)
    }
  }

  return (
    <StandardModal
      open
      onOpenChange={(aberto) => !aberto && onFechar()}
      title={`Alunos da turma ${turma.codigo}`}
      size="wide"
    >
      <div className="space-y-6 pr-1">
        <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-lg border border-arena-navy-800/10 bg-arena-navy-800/[0.02] px-4 py-3 text-sm">
          <Info rotulo="Professor" valor={nomeAtleta(catalogo, turma.professorId)} />
          <Info rotulo="Esporte" valor={esporte?.nome ?? '—'} />
          <Info rotulo="Níveis" valor={niveisTurma.join(', ') || '—'} />
          <Info rotulo="Horários" valor={`${resumoBlocos(blocos)} · ${nomesEspacos(blocos, catalogo)}`} />
          <Info rotulo="Criada em" valor={formatData(turma.criadaEm)} />
          {!encerrada && (
            <Info
              rotulo="Vagas"
              valor={
                turma.vagas === null
                  ? `sem limite · ${ativos.length} aluno${ativos.length === 1 ? '' : 's'}`
                  : `${ativos.length} de ${turma.vagas}${lotada ? ' · lotada' : ` · ${turma.vagas - ativos.length} livre${turma.vagas - ativos.length === 1 ? '' : 's'}`}`
              }
            />
          )}
        </div>

        {encerrada ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-arena-navy-800/70">
            Turma <strong className="font-semibold text-arena-navy-800">encerrada em {formatData(turma.encerradaEm)}</strong>
            {turma.motivoEncerramento ? ` · ${turma.motivoEncerramento}` : ''}. Só consulta: o histórico de alunos
            fica preservado.
          </p>
        ) : (
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="mb-3 text-sm font-bold text-arena-navy-800">Vincular atleta</p>
          {lotada && (
            <p className="mb-3 flex items-center gap-1.5 rounded-md bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5 flex-none" />
              Turma lotada ({ativos.length} de {turma.vagas} vagas). Para vincular, aumente o limite em Editar turma ou
              desvincule um aluno.
            </p>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <div className="relative min-w-0 flex-1 basis-64">
              {selecionado ? (
                <div className="flex h-11 items-center justify-between rounded-lg border border-arena-button bg-arena-button/[0.04] px-3 text-sm">
                  <span className="font-semibold text-arena-navy-800">
                    {selecionado.nome}
                    {nivelSelecionado?.nivel && (
                      <span className="ml-2 font-normal text-arena-navy-800/50">Nível {nivelSelecionado.nivel}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelecionadoId(null)}
                    className="text-xs font-semibold text-arena-button hover:underline"
                  >
                    Trocar
                  </button>
                </div>
              ) : (
                <>
                  <Input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar atleta da arena"
                    disabled={lotada}
                    className="h-11 rounded-lg border-arena-navy-800/15 pr-10"
                  />
                  <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  {sugestoes.length > 0 && (
                    <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                      {sugestoes.map((a) => {
                        const { nivel, nivelFora } = nivelDo(a.id)
                        return (
                          <li key={a.id}>
                            <button
                              type="button"
                              onClick={() => setSelecionadoId(a.id)}
                              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50"
                            >
                              <span className="font-medium text-arena-navy-800">{a.nome}</span>
                              {nivel && (
                                <span className={cn('text-xs', nivelFora ? 'text-amber-600' : 'text-arena-navy-800/50')}>
                                  Nível {nivel}
                                </span>
                              )}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                  {q && sugestoes.length === 0 && (
                    <p className="absolute mt-1 text-xs text-arena-navy-800/40">
                      Nenhum atleta disponível com esse nome.
                    </p>
                  )}
                </>
              )}
            </div>
            <div className="w-full space-y-1.5 sm:w-44">
              <label className="text-xs font-semibold text-arena-navy-800/70" htmlFor="turma-entrada">
                Data de entrada
              </label>
              <Input
                id="turma-entrada"
                type="date"
                value={entrada}
                min={turma.criadaEm}
                onChange={(e) => setEntrada(e.target.value)}
                className="h-11 rounded-lg border-arena-navy-800/15"
              />
            </div>
            <Button
              type="button"
              disabled={!selecionado || !entrada || entradaAntesDaCriacao || lotada || salvando !== null}
              onClick={() => void vincular()}
              className="h-11 bg-arena-button px-5 font-semibold text-white hover:bg-arena-button-hover"
            >
              {salvando === 'vincular' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              Vincular
            </Button>
          </div>
          {entradaAntesDaCriacao && (
            <p className="mt-2 text-xs font-medium text-red-600">
              A entrada não pode ser antes da criação da turma ({formatData(turma.criadaEm)}).
            </p>
          )}
          {nivelSelecionado?.nivelFora && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              O nível {nivelSelecionado.nivel} do atleta não está entre os níveis da turma ({niveisTurma.join(', ')}).
              O vínculo é permitido.
            </p>
          )}
          {jaEsteveNaTurma && (
            <p className="mt-2 text-xs text-arena-navy-800/50">
              Este atleta já passou pela turma; a nova entrada fica registrada no histórico como outro período.
            </p>
          )}
          {erro && (
            <p role="alert" className="mt-2 text-xs font-semibold text-red-600">
              {erro}
            </p>
          )}
        </div>
        )}

        <div>
          <DashboardTabs
            value={aba}
            onChange={setAba}
            tabs={[
              { label: `Alunos ativos (${ativos.length})`, value: 'ativos' },
              { label: `Histórico (${historico.length})`, value: 'historico' },
            ]}
          />

          <div className="mt-2 overflow-x-auto">
            {aba === 'ativos' ? (
              <table className={arenaDataTable.table}>
                <thead>
                  <tr className={arenaDataTable.theadRow}>
                    <th className={arenaDataTable.th}>
                      <Ordenavel coluna="nome" ordem={ordemAtivos.ordem} onOrdenar={ordemAtivos.alternar}>Atleta</Ordenavel>
                    </th>
                    <th className={arenaDataTable.th}>
                      <Ordenavel coluna="nivel" ordem={ordemAtivos.ordem} onOrdenar={ordemAtivos.alternar}>Nível no esporte</Ordenavel>
                    </th>
                    <th className={arenaDataTable.th}>
                      <Ordenavel coluna="entrada" ordem={ordemAtivos.ordem} onOrdenar={ordemAtivos.alternar}>Entrou em</Ordenavel>
                    </th>
                    <th className={arenaDataTable.th}>
                      <Ordenavel coluna="tempo" ordem={ordemAtivos.ordem} onOrdenar={ordemAtivos.alternar}>Na turma há</Ordenavel>
                    </th>
                    <th className={arenaDataTable.thRight}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {ordemAtivos.ordenados.length === 0 ? (
                    <tr>
                      <td colSpan={5} className={arenaDataTable.emptyCell}>
                        Nenhum aluno vinculado. Use a busca acima para vincular.
                      </td>
                    </tr>
                  ) : (
                    ordemAtivos.ordenados.map((l) => {
                      const emSaida = saindo?.matriculaId === l.matricula.id
                      return (
                        <tr key={l.matricula.id} className={cn(arenaDataTable.tbodyRow, emSaida && 'bg-red-50/40')}>
                          <td className={arenaDataTable.tdBold}><NomeAtleta linha={l} onClick={onAbrirAtleta} /></td>
                          <td className={arenaDataTable.td}>
                            {l.nivel ? (
                              <span
                                title={l.nivelFora ? 'Fora dos níveis da turma' : undefined}
                                className={cn(
                                  'rounded-md px-1.5 py-0.5 text-[11px] font-semibold',
                                  l.nivelFora ? 'bg-amber-50 text-amber-700' : 'bg-teal-50 text-teal-700',
                                )}
                              >
                                {l.nivel}
                              </span>
                            ) : (
                              <span className="text-xs text-arena-navy-800/30">—</span>
                            )}
                          </td>
                          <td className={cn(arenaDataTable.td, 'text-arena-navy-800/60')}>
                            {formatData(l.matricula.entrada)}
                          </td>
                          <td className={cn(arenaDataTable.td, 'text-arena-navy-800/60')}>
                            {permanencia(l.matricula.entrada, null)}
                          </td>
                          <td className={arenaDataTable.tdRight}>
                            {emSaida && saindo ? (
                              <div className="ml-auto flex max-w-md flex-wrap items-center justify-end gap-2">
                                <Input
                                  type="date"
                                  aria-label="Data de saída"
                                  value={saindo.saida}
                                  min={l.matricula.entrada}
                                  onChange={(e) => setSaindo({ ...saindo, saida: e.target.value })}
                                  className="h-9 w-36 rounded-md border-arena-navy-800/15 text-xs"
                                />
                                <Input
                                  aria-label="Motivo da saída"
                                  placeholder="Motivo (opcional)"
                                  value={saindo.motivo}
                                  maxLength={120}
                                  onChange={(e) => setSaindo({ ...saindo, motivo: e.target.value })}
                                  className="h-9 w-44 rounded-md border-arena-navy-800/15 text-xs"
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={saidaInvalida || salvando !== null}
                                  onClick={() => void confirmarSaida()}
                                  className="h-9 bg-red-600 text-white hover:bg-red-700"
                                >
                                  {salvando === 'desvincular' && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                                  Confirmar saída
                                </Button>
                                <Button type="button" size="sm" variant="ghost" onClick={() => setSaindo(null)} className="h-9">
                                  Cancelar
                                </Button>
                              </div>
                            ) : (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setSaindo({ matriculaId: l.matricula.id, saida: hojeISO(), motivo: '' })}
                                className="h-8 text-xs font-semibold text-red-500/80 hover:bg-red-50 hover:text-red-600"
                              >
                                <UserMinus className="mr-1.5 h-3.5 w-3.5" />
                                Desvincular
                              </Button>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            ) : (
              <table className={arenaDataTable.table}>
                <thead>
                  <tr className={arenaDataTable.theadRow}>
                    <th className={arenaDataTable.th}>
                      <Ordenavel coluna="nome" ordem={ordemHistorico.ordem} onOrdenar={ordemHistorico.alternar}>Atleta</Ordenavel>
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
                  {ordemHistorico.ordenados.length === 0 ? (
                    <tr>
                      <td colSpan={5} className={arenaDataTable.emptyCell}>
                        Nenhuma movimentação de alunos ainda.
                      </td>
                    </tr>
                  ) : (
                    ordemHistorico.ordenados.map((l) => (
                      <tr key={l.matricula.id} className={arenaDataTable.tbodyRow}>
                        <td className={arenaDataTable.tdBold}><NomeAtleta linha={l} onClick={onAbrirAtleta} /></td>
                        <td className={cn(arenaDataTable.td, 'text-arena-navy-800/60')}>
                          {formatData(l.matricula.entrada)}
                        </td>
                        <td className={arenaDataTable.td}>
                          {l.matricula.saida ? (
                            <span className="text-arena-navy-800/60">{formatData(l.matricula.saida)}</span>
                          ) : (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
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
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </StandardModal>
  )
}

function NomeAtleta({ linha, onClick }: { linha: Linha; onClick: (atleta: Atleta) => void }) {
  const { atleta } = linha
  if (!atleta) return <>{linha.nome}</>
  return (
    <button
      type="button"
      onClick={() => onClick(atleta)}
      title="Ver atleta e turmas"
      className="text-left hover:text-arena-button hover:underline"
    >
      {linha.nome}
    </button>
  )
}

function Info({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <p>
      <span className="text-arena-navy-800/50">{rotulo}: </span>
      <span className="font-semibold text-arena-navy-800">{valor}</span>
    </p>
  )
}
