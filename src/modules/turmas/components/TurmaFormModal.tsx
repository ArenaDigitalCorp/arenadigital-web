'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Info, Loader2, Lock, Plus, Search, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { StandardModal } from '@/components/ui/standard-modal'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { formatCurrency } from '@/lib/format'
import { cn, normalizeString } from '@/lib/utils'
import {
  fimDoMes,
  fracaoPrimeiroMes,
  intervaloDeCotacao,
  mesReferencia,
  resumirPlano,
} from '@/modules/bookings/lib/mensalista-blocos'
import {
  quoteMonthlyBlocksAction,
  type MonthlyBlockQuoteInput,
} from '@/modules/courts/actions/priceTableActions'
import { criarTurmaAction, editarTurmaAction } from '../actions'
import type { HorariosTurmaInput } from '../schemas'
import {
  DIA_LONGO,
  DIAS_ORDEM,
  faixasSobrepoem,
  hojeISO,
  matriculasAtivas,
  nomesEspacos,
  ordenarBlocos,
  paraBlocoMensalista,
  primeiraFaixaLivre,
  proximoCodigo,
  recorrenciaDisponivel,
  resumoBlocos,
  turmasAtivas,
} from '../lib'
import type { BlocoHorario, DiaSemana, RecorrenciaExistente, Turma, TurmasCatalogo } from '../types'

interface Props {
  arenaId: string
  turma: Turma | null
  turmas: Turma[]
  catalogo: TurmasCatalogo
  onCancelar: () => void
  /** Chamado depois que o banco gravou; recebe a mensagem de sucesso. */
  onSalvo: (mensagem: string) => void
}

type Modo = 'existente' | 'nova'
type Campo = 'professor' | 'esporte' | 'niveis' | 'criadaEm' | 'vagas' | 'recorrencia'
type Faixa = { inicio: string; fim: string }

const labelCls = 'text-sm font-semibold text-arena-navy-800'
const controlCls = 'h-11 rounded-lg border-arena-navy-800/15'

const horaCheia = (h: number) => `${String(h).padStart(2, '0')}:00`
const HORAS_INICIO = Array.from({ length: 17 }, (_, i) => horaCheia(i + 6))
const HORAS_FIM = Array.from({ length: 17 }, (_, i) => horaCheia(i + 7))

function blocoVazio(): BlocoHorario {
  return { id: crypto.randomUUID(), espacoId: '', diaSemana: 1, inicio: '19:00', fim: '20:00' }
}

export function TurmaFormModal({ arenaId, turma, turmas, catalogo, onCancelar, onSalvo }: Props) {
  const editando = turma !== null

  const [professorId, setProfessorId] = useState(turma?.professorId ?? '')
  const [esporteId, setEsporteId] = useState(turma?.esporteId ?? '')
  const [nivelIds, setNivelIds] = useState<string[]>(turma?.nivelIds ?? [])
  const [criadaEm, setCriadaEm] = useState(() => turma?.criadaEm ?? hojeISO())
  const [vagas, setVagas] = useState(turma?.vagas ? String(turma.vagas) : '')
  const [modo, setModo] = useState<Modo>('existente')
  const [recorrenciaId, setRecorrenciaId] = useState(turma?.recorrencia.recorrenciaId ?? '')
  const [trechos, setTrechos] = useState<Record<string, Faixa>>(() =>
    Object.fromEntries((turma?.recorrencia.trechos ?? []).map((t) => [t.blocoId, { inicio: t.inicio, fim: t.fim }])),
  )
  const [novosBlocos, setNovosBlocos] = useState<BlocoHorario[]>(() => [blocoVazio()])
  const [dataInicio, setDataInicio] = useState(hojeISO)
  // Instante real (com hora), como no cadastro de mensalista: desconta a aula de hoje se o horário já passou.
  const [agora] = useState(() => new Date())
  // Nulo = acompanha a tabela; preenchido = desconto ou acréscimo negociado.
  const [valorMensalManual, setValorMensalManual] = useState<string | null>(null)
  const [alunosIniciais, setAlunosIniciais] = useState<string[]>([])
  const [buscaAluno, setBuscaAluno] = useState('')
  const [tentouSalvar, setTentouSalvar] = useState(false)
  const [confirmandoSobreposicao, setConfirmandoSobreposicao] = useState(false)
  // Id da turma nova gerado uma vez: reenviar (clique duplo, nova tentativa) não duplica.
  const [novoTurmaId] = useState(() => crypto.randomUUID())
  const [salvando, setSalvando] = useState(false)
  const [erroServidor, setErroServidor] = useState<string | null>(null)
  // Turmas sobrepostas que o banco apontou (a tela pode não ter visto todas).
  const [sobrepostasServidor, setSobrepostasServidor] = useState<string[]>([])
  const [cotacao, setCotacao] = useState<{ chave: string; valores: number[]; erro: string | null } | null>(null)

  const esporte = catalogo.esportes.find((e) => e.id === esporteId)
  const professor = catalogo.professores.find((p) => p.id === professorId)
  const recorrencia = catalogo.recorrencias.find((r) => r.id === recorrenciaId)
  const outrasAtivas = turmasAtivas(turmas.filter((t) => t.id !== turma?.id))
  const codigo = turma?.codigo ?? (esporte ? (proximoCodigo(esporte, turmas) ?? 'Gerado ao salvar') : '')

  // Trechos já usados por outras turmas ativas, por bloco.
  const usoDosBlocos = new Map<string, (Faixa & { codigo: string })[]>()
  for (const t of outrasAtivas) {
    for (const tr of t.recorrencia.trechos) {
      usoDosBlocos.set(tr.blocoId, [...(usoDosBlocos.get(tr.blocoId) ?? []), { codigo: t.codigo, inicio: tr.inicio, fim: tr.fim }])
    }
  }

  const escolherEsporte = (id: string) => {
    setEsporteId(id)
    setNivelIds([])
  }

  const escolherRecorrencia = (id: string) => {
    setConfirmandoSobreposicao(false)
    setSobrepostasServidor([])
    setRecorrenciaId(id)
    const blocos = catalogo.recorrencias.find((r) => r.id === id)?.blocos ?? []
    const iniciais: Record<string, Faixa> = {}
    for (const b of blocos) {
      const livre = primeiraFaixaLivre(b, usoDosBlocos.get(b.id) ?? [])
      if (livre) iniciais[b.id] = livre
    }
    setTrechos(iniciais)
  }

  const marcarBloco = (bloco: BlocoHorario, marcado: boolean) => {
    setConfirmandoSobreposicao(false)
    setSobrepostasServidor([])
    setTrechos((atual) => {
      const proximo = { ...atual }
      if (marcado) proximo[bloco.id] = primeiraFaixaLivre(bloco, usoDosBlocos.get(bloco.id) ?? []) ?? { inicio: bloco.inicio, fim: bloco.fim }
      else delete proximo[bloco.id]
      return proximo
    })
  }

  const alterarTrecho = (blocoId: string, mudanca: Partial<Faixa>) => {
    setConfirmandoSobreposicao(false)
    setSobrepostasServidor([])
    setTrechos((atual) => ({ ...atual, [blocoId]: { ...atual[blocoId], ...mudanca } }))
  }

  const alterarBloco = (id: string, mudanca: Partial<BlocoHorario>) =>
    setNovosBlocos((atual) => atual.map((b) => (b.id === id ? { ...b, ...mudanca } : b)))

  const alternarNivel = (id: string) =>
    setNivelIds((atual) => (atual.includes(id) ? atual.filter((n) => n !== id) : [...atual, id]))

  // Novo horário: conflito com qualquer recorrência da arena bloqueia, como em Mensalistas.
  const conflitos = new Map<string, string>()
  if (modo === 'nova') {
    for (const b of novosBlocos) {
      if (!b.espacoId || b.fim <= b.inicio) continue
      const dono = catalogo.recorrencias.find(
        (r) =>
          // Recorrência que acaba antes do início da nova não ocupa mais o espaço.
          !(r.encerraAPartirDe && dataInicio >= r.encerraAPartirDe) &&
          r.blocos.some((o) => o.espacoId === b.espacoId && o.diaSemana === b.diaSemana && faixasSobrepoem(b, o)),
      )
      if (dono) conflitos.set(b.id, dono.responsavelNome)
    }
  }

  // Mensalidade da recorrência nova: o valor de cada aula vem do servidor
  // (resolve_court_price, pela tabela Professor do espaço) e a regra de
  // mensalidade/pró-rata é a do cadastro de mensalista (resumirPlano + fracaoPrimeiroMes).
  const hoje = hojeISO()
  const blocosValidos = modo === 'nova' ? novosBlocos.filter((b) => b.espacoId && b.fim > b.inicio) : []
  const blocosMensalista = blocosValidos.map(paraBlocoMensalista)
  const inicioVigencia = dataInicio && dataInicio >= hoje ? parseISO(dataInicio) : null

  const pedidoCotacao = useMemo(() => {
    if (modo !== 'nova' || !dataInicio || dataInicio < hoje) return null
    const validos = novosBlocos.filter((b) => b.espacoId && b.fim > b.inicio)
    if (validos.length === 0) return null
    const inicio = parseISO(dataInicio)
    const itens: MonthlyBlockQuoteInput[] = validos.map((b) => ({
      courtId: b.espacoId,
      priceTableId: catalogo.espacos.find((e) => e.id === b.espacoId)?.tabelaTurma?.id ?? null,
      ...intervaloDeCotacao(paraBlocoMensalista(b), inicio),
    }))
    return { chave: JSON.stringify(itens), itens }
  }, [modo, novosBlocos, dataInicio, hoje, catalogo.espacos])

  useEffect(() => {
    if (!pedidoCotacao) return
    let cancelado = false
    const timer = setTimeout(() => {
      void quoteMonthlyBlocksAction(arenaId, pedidoCotacao.itens).then((res) => {
        if (cancelado) return
        setCotacao({
          chave: pedidoCotacao.chave,
          valores: res.success ? res.values : [],
          erro: res.success ? null : (res.error ?? 'Não foi possível calcular o valor.'),
        })
      })
    }, 250)
    return () => {
      cancelado = true
      clearTimeout(timer)
    }
  }, [arenaId, pedidoCotacao])

  const cotacaoAtual =
    pedidoCotacao && cotacao?.chave === pedidoCotacao.chave && cotacao.valores.length === blocosValidos.length
      ? cotacao
      : null
  const cotando = Boolean(pedidoCotacao) && cotacao?.chave !== pedidoCotacao?.chave
  const erroCotacao = pedidoCotacao && cotacao?.chave === pedidoCotacao.chave ? cotacao.erro : null
  const resumo =
    inicioVigencia && cotacaoAtual && blocosMensalista.length > 0
      ? resumirPlano(blocosMensalista, cotacaoAtual.valores, inicioVigencia, agora)
      : null
  const valorMensalTexto = valorMensalManual ?? (resumo ? resumo.valorMesCheio.toFixed(2) : '')
  const valorMensal = Number(valorMensalTexto) || 0
  const primeiraMensalidade =
    resumo && inicioVigencia
      ? Math.round(valorMensal * fracaoPrimeiroMes(blocosMensalista, inicioVigencia, agora) * 100) / 100
      : 0
  const primeiroMesDiverge =
    resumo !== null &&
    resumo.ocorrenciasPrimeiroMes > 0 &&
    Math.round(primeiraMensalidade * 100) !== Math.round(valorMensal * 100)

  const blocosRecorrencia = recorrencia ? ordenarBlocos(recorrencia.blocos) : []
  const trechosSelecionados = blocosRecorrencia.filter((b) => trechos[b.id])
  const trechoForaDoBloco = (b: BlocoHorario) => {
    const t = trechos[b.id]
    return !t || t.fim <= t.inicio || t.inicio < b.inicio || t.fim > b.fim
  }
  const sobreposicoes = (b: BlocoHorario) => {
    const t = trechos[b.id]
    return t ? (usoDosBlocos.get(b.id) ?? []).filter((u) => faixasSobrepoem(t, u)) : []
  }
  const turmasSobrepostas =
    modo === 'existente' ? [...new Set(trechosSelecionados.flatMap((b) => sobreposicoes(b).map((u) => u.codigo)))] : []
  const listaSobreposta = [...new Set([...turmasSobrepostas, ...sobrepostasServidor])]

  const ocupacao = turma ? matriculasAtivas(turma).length : alunosIniciais.length
  const vagasNumero = vagas.trim() === '' ? null : Number(vagas)
  const lotado = vagasNumero !== null && Number.isInteger(vagasNumero) && alunosIniciais.length >= vagasNumero

  const erros: Partial<Record<Campo, string>> = {}
  if (!professorId) erros.professor = 'Escolha o professor responsável.'
  if (!esporteId) erros.esporte = 'Escolha o esporte da turma.'
  else if (esporte && esporte.niveis.length > 0 && nivelIds.length === 0)
    erros.niveis = 'Selecione pelo menos um nível.'
  if (!criadaEm) erros.criadaEm = 'Informe a data de criação.'
  if (vagasNumero !== null) {
    if (!Number.isInteger(vagasNumero) || vagasNumero < 1) erros.vagas = 'Use um número inteiro a partir de 1.'
    else if (vagasNumero < ocupacao)
      erros.vagas = `A turma já tem ${ocupacao} aluno${ocupacao === 1 ? '' : 's'}; o limite não pode ser menor.`
  }
  if (modo === 'existente') {
    if (!recorrenciaId) erros.recorrencia = 'Escolha a recorrência que a turma vai usar.'
    else if (trechosSelecionados.length === 0) erros.recorrencia = 'Marque pelo menos um horário da recorrência.'
    else if (trechosSelecionados.some(trechoForaDoBloco))
      erros.recorrencia = 'Cada horário precisa ficar dentro do bloco reservado, com o fim depois do início.'
  } else if (novosBlocos.length === 0) erros.recorrencia = 'Adicione pelo menos um horário.'
  else if (novosBlocos.some((b) => !b.espacoId)) erros.recorrencia = 'Escolha o espaço de cada horário.'
  else if (novosBlocos.some((b) => b.fim <= b.inicio))
    erros.recorrencia = 'O horário final precisa ser depois do inicial.'
  else if (conflitos.size > 0) erros.recorrencia = 'Há horário em conflito com outra reserva recorrente.'
  else if (!dataInicio) erros.recorrencia = 'Informe a data de início da recorrência.'
  else if (dataInicio < hoje) erros.recorrencia = 'A recorrência não pode começar no passado.'
  else if (cotando) erros.recorrencia = 'Aguarde o cálculo do valor da recorrência.'
  else if (valorMensal <= 0) erros.recorrencia = 'Informe o valor mensal da recorrência.'

  const erro = (campo: Campo) => (tentouSalvar || campo === 'vagas' ? erros[campo] : undefined)

  const salvar = async (mesmoComSobreposicao = false) => {
    setTentouSalvar(true)
    setErroServidor(null)
    if (Object.keys(erros).length > 0 || !esporte || salvando) return
    if (turmasSobrepostas.length > 0 && !mesmoComSobreposicao) {
      setConfirmandoSobreposicao(true)
      return
    }

    const horarios: HorariosTurmaInput =
      modo === 'nova'
        ? {
            tipo: 'nova',
            blocos: ordenarBlocos(blocosValidos).map((b) => ({
              espacoId: b.espacoId,
              diaSemana: b.diaSemana,
              inicio: b.inicio,
              fim: b.fim,
            })),
            dataInicio,
            valorMensal,
          }
        : {
            tipo: 'existente',
            planoId: recorrenciaId,
            trechos: trechosSelecionados.map((b) => ({ blocoId: b.id, ...trechos[b.id] })),
          }

    const comum = {
      arenaId,
      professorId,
      nivelIds: esporte.niveis.filter((n) => nivelIds.includes(n.id)).map((n) => n.id),
      dataCriacao: criadaEm,
      vagas: vagasNumero,
      horarios,
      confirmarSobreposicao: mesmoComSobreposicao,
    }

    setSalvando(true)
    try {
      const res = turma
        ? await editarTurmaAction({ ...comum, turmaId: turma.id })
        : await criarTurmaAction({ ...comum, turmaId: novoTurmaId, esporteId, alunos: alunosIniciais })

      if (res.success) {
        const nova = modo === 'nova' && res.data.recorrenciaCriada ? ' e recorrência do professor criada' : ''
        onSalvo(turma ? `Turma ${res.data.codigo} atualizada${nova}.` : `Turma ${res.data.codigo} criada${nova}.`)
        return
      }
      if (res.sobreposicao) {
        setSobrepostasServidor(res.sobreposicao)
        setConfirmandoSobreposicao(true)
        return
      }
      setErroServidor(res.error)
      toast.error(res.error)
    } finally {
      setSalvando(false)
    }
  }

  // Recorrência com encerramento marcado não recebe turma nova (a atual continua aparecendo).
  const selecionaveis = catalogo.recorrencias.filter(
    (r) => recorrenciaDisponivel(r) || r.id === turma?.recorrencia.recorrenciaId,
  )
  const doProfessor = selecionaveis.filter((r) => r.responsavelId === professorId)
  const outrasRecorrencias = selecionaveis.filter((r) => r.responsavelId !== professorId)
  const rotuloRecorrencia = (r: RecorrenciaExistente) =>
    `${r.responsavelNome} · ${resumoBlocos(r.blocos)} · ${nomesEspacos(r.blocos, catalogo)}`

  const q = normalizeString(buscaAluno.trim())
  const sugestoesAlunos =
    q && !lotado
      ? catalogo.atletas
          .filter((a) => a.membro && !alunosIniciais.includes(a.id) && normalizeString(a.nome).includes(q))
          .slice(0, 6)
      : []
  const nomesNiveisTurma = (esporte?.niveis ?? []).filter((n) => nivelIds.includes(n.id)).map((n) => n.nome)
  const nivelForaDaTurma = (atletaId: string) => {
    const nivel = esporteId ? catalogo.atletas.find((a) => a.id === atletaId)?.niveis[esporteId] : undefined
    return { nivel, fora: Boolean(nivel && nomesNiveisTurma.length > 0 && !nomesNiveisTurma.includes(nivel)) }
  }

  return (
    <StandardModal
      open
      onOpenChange={(aberto) => !aberto && onCancelar()}
      title={turma ? `Editar turma ${turma.codigo}` : 'Nova turma'}
      size="wide"
      footer={
        confirmandoSobreposicao && listaSobreposta.length > 0 ? (
          <div role="alertdialog" aria-label="Confirmar sobreposição de horário" className="rounded-xl border-2 border-red-400 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-red-600 text-white">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div className="space-y-1">
                <p className="text-[15px] font-bold text-red-800">
                  Esta turma vai ocupar o mesmo horário de {listaSobreposta.join(', ')}
                </p>
                <p className="text-sm text-red-700">
                  As turmas vão disputar o mesmo espaço ao mesmo tempo. O recomendado é voltar e ajustar o trecho para
                  um horário livre. Salve assim só se as turmas realmente vão dividir a quadra.
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={salvando}
                onClick={() => void salvar(true)}
                className="h-11 border-red-300 bg-white px-5 font-semibold text-red-700 hover:bg-red-100 hover:text-red-800"
              >
                {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar mesmo assim
              </Button>
              <Button
                type="button"
                autoFocus
                disabled={salvando}
                onClick={() => setConfirmandoSobreposicao(false)}
                className="h-11 bg-arena-button px-6 font-semibold text-white hover:bg-arena-button-hover"
              >
                Voltar e ajustar horário
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p
              role={erroServidor ? 'alert' : undefined}
              className={cn(
                'max-w-md text-xs',
                erroServidor || listaSobreposta.length > 0 ? 'font-semibold text-red-600' : 'text-arena-navy-800/50',
              )}
            >
              {erroServidor ??
                (tentouSalvar && Object.keys(erros).length > 0
                  ? 'Confira os campos destacados.'
                  : listaSobreposta.length > 0
                    ? `Atenção: horário sobreposto com ${listaSobreposta.join(', ')}.`
                    : '')}
            </p>
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={onCancelar} disabled={salvando} className="h-11 px-5">
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={salvando}
                onClick={() => void salvar()}
                className="h-11 bg-arena-button px-6 font-semibold text-white hover:bg-arena-button-hover"
              >
                {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editando ? 'Salvar alterações' : 'Criar turma'}
              </Button>
            </div>
          </div>
        )
      }
    >
      <div className="space-y-8 pr-1">
        <Secao titulo="Identificação">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Campo
              label="Código da turma"
              ajuda={editando ? 'Definido na criação. Não pode ser alterado.' : 'Gerado pelo sistema. Não pode ser alterado.'}
            >
              <div
                aria-label="Código da turma"
                className="flex h-11 items-center justify-between gap-2 rounded-lg border border-arena-navy-800/10 bg-arena-navy-800/[0.04] px-3"
              >
                {codigo ? (
                  <span className="font-mono text-sm font-bold tracking-tight text-arena-navy-800">{codigo}</span>
                ) : (
                  <span className="text-xs text-arena-navy-800/40">Escolha o esporte</span>
                )}
                <Lock className="h-3.5 w-3.5 flex-none text-arena-navy-800/30" />
              </div>
            </Campo>

            <Campo label="Professor responsável" erro={erro('professor')} ajuda="Atletas com perfil Professor.">
              <Select value={professorId} onValueChange={setProfessorId}>
                <SelectTrigger className={controlCls} aria-invalid={Boolean(erro('professor'))}>
                  <SelectValue placeholder="Selecione o professor" />
                </SelectTrigger>
                <SelectContent>
                  {catalogo.professores.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                  {turma && !catalogo.professores.some((p) => p.id === turma.professorId) && (
                    <SelectItem value={turma.professorId}>
                      {catalogo.atletas.find((a) => a.id === turma.professorId)?.nome ?? 'Professor atual'} (sem perfil
                      Professor)
                    </SelectItem>
                  )}
                  {catalogo.professores.length === 0 && (
                    <p className="px-2 py-1.5 text-xs text-arena-navy-800/50">
                      Nenhum atleta com perfil Professor. Defina o perfil na tela do atleta.
                    </p>
                  )}
                </SelectContent>
              </Select>
            </Campo>

            <Campo label="Data de criação" erro={erro('criadaEm')}>
              <Input
                type="date"
                value={criadaEm}
                onChange={(e) => setCriadaEm(e.target.value)}
                aria-invalid={Boolean(erro('criadaEm'))}
                className={controlCls}
              />
            </Campo>

            <Campo label="Limite de vagas" erro={erro('vagas')} ajuda="Opcional. Em branco, a turma fica aberta.">
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                value={vagas}
                onChange={(e) => setVagas(e.target.value)}
                placeholder="Sem limite"
                aria-invalid={Boolean(erro('vagas'))}
                className={controlCls}
              />
            </Campo>
          </div>
        </Secao>

        <Secao titulo="Esporte e níveis">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Campo
              label="Esporte"
              erro={erro('esporte')}
              ajuda={editando ? 'Não muda depois de criada: a sigla faz parte do código.' : undefined}
            >
              <Select value={esporteId} onValueChange={escolherEsporte} disabled={editando}>
                <SelectTrigger className={controlCls} aria-invalid={Boolean(erro('esporte'))}>
                  <SelectValue placeholder="Selecione o esporte" />
                </SelectTrigger>
                <SelectContent>
                  {catalogo.esportes
                    .filter((e) => e.ativo || e.id === esporteId)
                    .map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nome}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Campo>

            <div className="md:col-span-2">
              <Campo
                label="Níveis de habilidade da turma"
                erro={erro('niveis')}
                ajuda={esporte ? 'Marque um ou mais níveis.' : 'Escolha o esporte para ver os níveis.'}
              >
                <div className="flex min-h-11 flex-wrap items-center gap-2">
                  {(esporte?.niveis ?? []).filter((n) => n.ativo || nivelIds.includes(n.id)).map((n) => {
                    const ativo = nivelIds.includes(n.id)
                    return (
                      <button
                        key={n.id}
                        type="button"
                        aria-pressed={ativo}
                        onClick={() => alternarNivel(n.id)}
                        className={cn(
                          'rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors',
                          ativo
                            ? 'border-arena-button bg-arena-button/[0.06] text-arena-button'
                            : 'border-gray-200 text-arena-navy-800/70 hover:border-gray-300 hover:bg-gray-50',
                        )}
                      >
                        {n.nome}
                        {!n.ativo && <span className="ml-1 text-[10px] font-normal opacity-60">(desativado)</span>}
                      </button>
                    )
                  })}
                  {!esporte && <span className="text-sm text-arena-navy-800/30">—</span>}
                </div>
              </Campo>
            </div>
          </div>
        </Secao>

        <Secao titulo="Horários da turma (recorrência)">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <OpcaoModo
              ativo={modo === 'existente'}
              onClick={() => setModo('existente')}
              titulo="Usar recorrência existente"
              descricao="Usar um horário já reservado, inteiro ou só uma parte dele."
            />
            <OpcaoModo
              ativo={modo === 'nova'}
              onClick={() => setModo('nova')}
              titulo="Criar novo horário recorrente"
              descricao="Reserva o espaço em nome do professor."
            />
          </div>

          {modo === 'existente' ? (
            <div className="mt-4 space-y-3">
              <Select value={recorrenciaId} onValueChange={escolherRecorrencia}>
                <SelectTrigger className={controlCls} aria-invalid={Boolean(erro('recorrencia'))} aria-label="Recorrência">
                  <SelectValue placeholder="Selecione a recorrência" />
                </SelectTrigger>
                <SelectContent>
                  {doProfessor.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Do professor selecionado</SelectLabel>
                      {doProfessor.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {rotuloRecorrencia(r)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  <SelectGroup>
                    <SelectLabel>{doProfessor.length > 0 ? 'Outras recorrências da arena' : 'Recorrências da arena'}</SelectLabel>
                    {outrasRecorrencias.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {rotuloRecorrencia(r)}
                        {r.perfil === 'mensalista' ? ' (mensalista)' : ''}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              {recorrencia && (
                <div className="rounded-lg border border-arena-navy-800/10 bg-arena-navy-800/[0.02] p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-arena-navy-800/50">
                    Horários que a turma vai usar · ajuste o trecho para usar só parte do bloco
                  </p>
                  <div className="space-y-3">
                    {blocosRecorrencia.map((b) => {
                      const trecho = trechos[b.id]
                      const usos = usoDosBlocos.get(b.id) ?? []
                      const sobrepostos = sobreposicoes(b)
                      return (
                        <div key={b.id} className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                            <label className="flex min-w-56 cursor-pointer items-center gap-3 text-sm">
                              <Checkbox checked={Boolean(trecho)} onCheckedChange={(m) => marcarBloco(b, m === true)} />
                              <span>
                                <span className="font-semibold text-arena-navy-800">
                                  {DIA_LONGO[b.diaSemana]} {b.inicio}–{b.fim}
                                </span>
                                <span className="text-arena-navy-800/60">
                                  {' '}· {catalogo.espacos.find((e) => e.id === b.espacoId)?.nome}
                                </span>
                              </span>
                            </label>
                            {trecho && (
                              <div className="flex items-center gap-1.5 text-xs text-arena-navy-800/60">
                                turma das
                                <Input
                                  type="time"
                                  aria-label={`Início do trecho de ${DIA_LONGO[b.diaSemana]}`}
                                  value={trecho.inicio}
                                  min={b.inicio}
                                  max={b.fim}
                                  step={1800}
                                  onChange={(e) => alterarTrecho(b.id, { inicio: e.target.value })}
                                  className={cn('h-9 w-28 rounded-md border-arena-navy-800/15 text-sm', trechoForaDoBloco(b) && 'border-red-400')}
                                />
                                às
                                <Input
                                  type="time"
                                  aria-label={`Fim do trecho de ${DIA_LONGO[b.diaSemana]}`}
                                  value={trecho.fim}
                                  min={b.inicio}
                                  max={b.fim}
                                  step={1800}
                                  onChange={(e) => alterarTrecho(b.id, { fim: e.target.value })}
                                  className={cn('h-9 w-28 rounded-md border-arena-navy-800/15 text-sm', trechoForaDoBloco(b) && 'border-red-400')}
                                />
                              </div>
                            )}
                          </div>
                          {usos.length > 0 && (
                            <p className="pl-7 text-[11px] text-arena-navy-800/50">
                              Já usado por {usos.map((u) => `${u.codigo} (${u.inicio}–${u.fim})`).join(', ')}
                            </p>
                          )}
                          {sobrepostos.length > 0 && (
                            <div
                              role="alert"
                              className="ml-7 flex items-start gap-2.5 rounded-lg border-2 border-red-300 bg-red-50 px-3 py-2.5 text-red-800"
                            >
                              <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-red-600" />
                              <div className="text-xs leading-snug">
                                <p className="text-[13px] font-bold">Horário já ocupado por outra turma</p>
                                <p>
                                  {sobrepostos.map((u) => `${u.codigo} (${u.inicio}–${u.fim})`).join(', ')} usa este
                                  espaço no mesmo horário. Ajuste o trecho para um horário livre.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {professor && recorrencia.responsavelId !== professor.id && (
                    <p className="mt-3 flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      <AlertTriangle className="mt-px h-3.5 w-3.5 flex-none" />
                      Esta recorrência está em nome de {recorrencia.responsavelNome}
                      {recorrencia.perfil === 'mensalista' ? ' (mensalista)' : ''}, não do professor da turma.
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {novosBlocos.map((b) => {
                const espaco = catalogo.espacos.find((e) => e.id === b.espacoId)
                const indiceValido = blocosValidos.findIndex((v) => v.id === b.id)
                const valorAula = cotacaoAtual && indiceValido >= 0 ? cotacaoAtual.valores[indiceValido] : null
                return (
                  <div key={b.id}>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1.4fr_1fr_110px_110px_44px]">
                      <Select value={b.espacoId} onValueChange={(v) => alterarBloco(b.id, { espacoId: v })}>
                        <SelectTrigger className={cn(controlCls, 'col-span-2 sm:col-span-1')} aria-label="Espaço">
                          <SelectValue placeholder="Espaço" />
                        </SelectTrigger>
                        <SelectContent>
                          {catalogo.espacos
                            .filter((e) => e.ativo)
                            .map((e) => (
                              <SelectItem key={e.id} value={e.id}>
                                {e.nome}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={String(b.diaSemana)}
                        onValueChange={(v) => alterarBloco(b.id, { diaSemana: Number(v) as DiaSemana })}
                      >
                        <SelectTrigger className={cn(controlCls, 'col-span-2 sm:col-span-1')} aria-label="Dia da semana">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DIAS_ORDEM.map((d) => (
                            <SelectItem key={d} value={String(d)}>
                              {DIA_LONGO[d]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {/* Hora cheia, como a grade de Mensalistas e o RPC de recorrência por blocos. */}
                      <Select
                        value={b.inicio}
                        onValueChange={(v) => {
                          // Trocar o início mantém a duração do horário.
                          const duracao = Math.max(1, Number(b.fim.slice(0, 2)) - Number(b.inicio.slice(0, 2)))
                          alterarBloco(b.id, { inicio: v, fim: horaCheia(Math.min(23, Number(v.slice(0, 2)) + duracao)) })
                        }}
                      >
                        <SelectTrigger className={controlCls} aria-label="Início">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {HORAS_INICIO.map((h) => (
                            <SelectItem key={h} value={h}>
                              {h}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={b.fim} onValueChange={(v) => alterarBloco(b.id, { fim: v })}>
                        <SelectTrigger className={controlCls} aria-label="Fim">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {HORAS_FIM.filter((h) => h > b.inicio).map((h) => (
                            <SelectItem key={h} value={h}>
                              {h}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        aria-label="Remover horário"
                        disabled={novosBlocos.length === 1}
                        onClick={() => setNovosBlocos((atual) => atual.filter((x) => x.id !== b.id))}
                        className="h-11 w-11 p-0 text-red-500/70 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {conflitos.has(b.id) ? (
                      <p className="mt-1 text-xs font-medium text-red-600">
                        Conflito: o espaço já está reservado nesse horário por {conflitos.get(b.id)}.
                      </p>
                    ) : (
                      espaco && (
                        <p className="mt-1 text-xs text-arena-navy-800/50">
                          {valorAula !== null ? (
                            <>{formatCurrency(valorAula)} por aula · </>
                          ) : cotando ? (
                            <>Calculando valor… · </>
                          ) : null}
                          {espaco.tabelaTurma ? (
                            <span
                              className={cn(espaco.tabelaTurma.tipo === 'Padrão' && 'font-semibold text-amber-700')}
                            >
                              Tabela {espaco.tabelaTurma.tipo}
                              {espaco.tabelaTurma.tipo === 'Padrão' && ' (espaço sem tabela Professor)'}
                            </span>
                          ) : (
                            <span className="font-semibold text-amber-700">Espaço sem tabela de preço</span>
                          )}
                        </p>
                      )
                    )}
                  </div>
                )
              })}
              <div className="flex flex-wrap items-end justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setNovosBlocos((atual) => [...atual, blocoVazio()])}
                  className="h-10"
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Adicionar horário
                </Button>
                <div className="w-full space-y-1.5 sm:w-48">
                  <Label className={labelCls}>Início da recorrência</Label>
                  <Input
                    type="date"
                    value={dataInicio}
                    min={hoje}
                    onChange={(e) => setDataInicio(e.target.value)}
                    className={controlCls}
                  />
                </div>
              </div>

              <p className="flex items-start gap-2 rounded-lg border border-sky-100 bg-sky-50 px-4 py-3 text-xs text-sky-900">
                <Info className="mt-px h-3.5 w-3.5 flex-none" />
                <span>
                  Ao salvar, o professor{professor ? ` (${professor.nome})` : ''} passa a ser{' '}
                  <strong>mensalista</strong> desses horários: o sistema cria a recorrência dele, reservando o espaço a
                  partir do início escolhido, cobrada pela tabela Professor de cada espaço (ou pela Padrão). A
                  mensalidade segue as mesmas regras de Mensalistas.
                </span>
              </p>

              {conflitos.size === 0 && cotando && (
                <p className="flex items-center gap-2 text-xs text-arena-navy-800/50">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Calculando a mensalidade pela tabela de preço…
                </p>
              )}
              {conflitos.size === 0 && erroCotacao && (
                <p role="alert" className="text-xs font-medium text-red-600">
                  {erroCotacao}
                </p>
              )}
              {resumo && conflitos.size === 0 && inicioVigencia && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 rounded-2xl border border-arena-navy-800/10 bg-slate-50/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-arena-navy-800/60">
                      Subtotal pela tabela
                    </p>
                    <div className="space-y-1 text-[12.5px]">
                      <LinhaResumo rotulo="Horas por semana" valor={`${resumo.horasSemana}h`} />
                      <LinhaResumo rotulo="Valor por semana" valor={formatCurrency(resumo.valorSemana)} />
                      <LinhaResumo
                        rotulo={`Reservas em ${format(mesReferencia(inicioVigencia), 'MMMM', { locale: ptBR })}`}
                        valor={`${resumo.ocorrenciasMesCheio}x`}
                      />
                      <div className="flex items-center justify-between gap-3 border-t border-arena-navy-800/10 pt-2">
                        <span className="text-[13px] font-black text-arena-navy-800">Mensalidade</span>
                        <span className="text-xl font-black text-arena-button">{formatCurrency(resumo.valorMesCheio)}</span>
                      </div>
                      {resumo.variacaoMensal.length > 1 && (
                        <p className="text-[11px] leading-snug text-arena-navy-800/45">
                          O preço da hora é fixo, então a fatura acompanha o calendário:{' '}
                          {resumo.variacaoMensal
                            .map((v) => `${formatCurrency(v.valor)} em meses com ${v.ocorrencias} reservas`)
                            .join(' · ')}
                          .
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {resumo.ocorrenciasPrimeiroMes === 0 && (
                      <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] font-semibold text-amber-800">
                        Nenhuma aula cabe até o fim de {format(inicioVigencia, 'MMMM', { locale: ptBR })}. As reservas e a
                        cobrança começam no mês seguinte.
                      </p>
                    )}
                    {primeiroMesDiverge && (
                      <div className="space-y-0.5 rounded-2xl border-2 border-arena-button/50 bg-arena-button/5 p-4">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-arena-button">
                          1ª mensalidade · {format(inicioVigencia, 'dd/MM')}–{format(fimDoMes(inicioVigencia), 'dd/MM')}
                        </p>
                        <p className="text-2xl font-black text-arena-button">{formatCurrency(primeiraMensalidade)}</p>
                        <p className="text-[11px] font-medium text-arena-navy-800/50">
                          {resumo.ocorrenciasPrimeiroMes} reserva{resumo.ocorrenciasPrimeiroMes > 1 ? 's' : ''} neste mês ·
                          valor proporcional ao mensal cheio
                        </p>
                      </div>
                    )}
                    <Label className="text-xs font-bold uppercase tracking-wider text-arena-navy-800/40">
                      {primeiroMesDiverge
                        ? `A partir de ${format(mesReferencia(inicioVigencia), 'MMMM', { locale: ptBR })} (R$)`
                        : 'Valor mensal cobrado (R$)'}
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      aria-label="Valor mensal cobrado"
                      value={valorMensalTexto}
                      onChange={(e) => setValorMensalManual(e.target.value)}
                      className="h-11 rounded-xl border-arena-navy-800/10 font-bold text-arena-navy-800"
                    />
                    <p className="text-[11px] font-medium text-arena-navy-800/45">
                      {valorMensalManual !== null ? (
                        <>
                          Ajustado à mão — a tabela sugeria {formatCurrency(resumo.valorMesCheio)}.{' '}
                          <button
                            type="button"
                            onClick={() => setValorMensalManual(null)}
                            className="font-semibold text-arena-button hover:underline"
                          >
                            Voltar à tabela
                          </button>
                        </>
                      ) : (
                        'Preenchido pela tabela. Edite para aplicar desconto ou acréscimo.'
                      )}
                      {primeiroMesDiverge && ' Valor dos meses seguintes; meses com menos reservas são cobrados proporcionalmente.'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
          {erro('recorrencia') && <p className="mt-2 text-sm font-medium text-red-600">{erro('recorrencia')}</p>}
        </Secao>

        <Secao titulo="Alunos">
          {editando ? (
            <p className="text-sm text-arena-navy-800/60">
              As entradas e saídas de alunos ficam no botão <strong className="font-semibold">Alunos</strong> da
              lista, para manter o histórico com as datas de cada vínculo.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="relative max-w-md">
                <Input
                  value={buscaAluno}
                  onChange={(e) => setBuscaAluno(e.target.value)}
                  placeholder={lotado ? 'Limite de vagas atingido' : 'Buscar atleta da arena para vincular'}
                  disabled={lotado}
                  className={cn(controlCls, 'pr-10')}
                />
                <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                {sugestoesAlunos.length > 0 && (
                  <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                    {sugestoesAlunos.map((a) => {
                      const { nivel, fora } = nivelForaDaTurma(a.id)
                      return (
                        <li key={a.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setAlunosIniciais((atual) => [...atual, a.id])
                              setBuscaAluno('')
                            }}
                            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50"
                          >
                            <span className="font-medium text-arena-navy-800">{a.nome}</span>
                            {nivel && (
                              <span className={cn('text-xs', fora ? 'text-amber-600' : 'text-arena-navy-800/50')}>
                                Nível {nivel}
                              </span>
                            )}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
              {alunosIniciais.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {alunosIniciais.map((id) => {
                    const atleta = catalogo.atletas.find((a) => a.id === id)
                    const { nivel, fora } = nivelForaDaTurma(id)
                    return (
                      <span
                        key={id}
                        title={fora ? `Nível ${nivel} fora dos níveis da turma` : undefined}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full border py-1 pl-3 pr-1.5 text-xs font-semibold',
                          fora
                            ? 'border-amber-200 bg-amber-50 text-amber-800'
                            : 'border-arena-navy-800/10 bg-arena-navy-800/5 text-arena-navy-800',
                        )}
                      >
                        {atleta?.nome}
                        {nivel && <span className="font-normal opacity-60">· {nivel}</span>}
                        <button
                          type="button"
                          aria-label={`Remover ${atleta?.nome}`}
                          onClick={() => setAlunosIniciais((atual) => atual.filter((x) => x !== id))}
                          className="rounded-full p-0.5 hover:bg-black/10"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-arena-navy-800/40">
                  Opcional. Você também pode vincular alunos depois.
                </p>
              )}
              <p className="text-xs text-arena-navy-800/50">
                Os alunos vinculados aqui entram com a data de criação da turma.
                {vagasNumero !== null && Number.isInteger(vagasNumero) && vagasNumero > 0 && (
                  <> {alunosIniciais.length} de {vagasNumero} vagas preenchidas.</>
                )}
              </p>
            </div>
          )}
        </Secao>
      </div>
    </StandardModal>
  )
}

function LinhaResumo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="font-semibold text-arena-navy-800/50">{rotulo}</span>
      <span className="font-mono font-semibold tabular-nums text-arena-navy-800">{valor}</span>
    </div>
  )
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#007793]">{titulo}</h4>
      {children}
    </section>
  )
}

function Campo({
  label,
  erro,
  ajuda,
  children,
}: {
  label: string
  erro?: string
  ajuda?: string
  children: React.ReactNode
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label className={labelCls}>{label}</Label>
      {children}
      {erro ? (
        <p className="text-xs font-medium text-red-600">{erro}</p>
      ) : (
        ajuda && <p className="text-xs text-arena-navy-800/45">{ajuda}</p>
      )}
    </div>
  )
}

function OpcaoModo({
  ativo,
  onClick,
  titulo,
  descricao,
}: {
  ativo: boolean
  onClick: () => void
  titulo: string
  descricao: string
}) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={cn(
        'flex items-start gap-2.5 rounded-lg border px-3 py-3 text-left transition-colors',
        ativo ? 'border-arena-button bg-arena-button/[0.06]' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex h-[15px] w-[15px] flex-none items-center justify-center rounded-full border-2',
          ativo ? 'border-arena-button' : 'border-gray-300',
        )}
      >
        {ativo && <span className="h-[5px] w-[5px] rounded-full bg-arena-button" />}
      </span>
      <span className="leading-tight">
        <span className={cn('block text-[13px] font-bold', ativo ? 'text-arena-button' : 'text-gray-900')}>
          {titulo}
        </span>
        <span className="mt-0.5 block text-[11px] text-gray-400">{descricao}</span>
      </span>
    </button>
  )
}
