'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Info, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { StandardModal } from '@/components/ui/standard-modal'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  encerramentoDaRecorrencia,
  formatData,
  formatMes,
  hojeISO,
  matriculasAtivas,
  mesesDeEncerramento,
  nomesEspacos,
  proximaAula,
  resumoBlocos,
} from '../lib'
import { encerrarTurmaAction } from '../actions'
import type { Turma, TurmasCatalogo } from '../types'

interface Props {
  arenaId: string
  turma: Turma
  turmas: Turma[]
  catalogo: TurmasCatalogo
  onCancelar: () => void
  /** Chamado depois que o banco encerrou; recebe a mensagem de sucesso. */
  onEncerrada: (mensagem: string) => void
}

export function EncerrarTurmaDialog({ arenaId, turma, turmas, catalogo, onCancelar, onEncerrada }: Props) {
  const ativos = matriculasAtivas(turma)
  // A saída de cada aluno não pode vir antes da entrada dele.
  const minimo = ativos.reduce((maior, m) => (m.entrada > maior ? m.entrada : maior), turma.criadaEm)
  const { recorrencia, bloqueio } = encerramentoDaRecorrencia(turma, turmas, catalogo)

  const [data, setData] = useState(() => {
    const hoje = hojeISO()
    return hoje < minimo ? minimo : hoje
  })
  const [motivo, setMotivo] = useState('')
  // Recorrência criada só para esta turma: o natural é encerrar junto.
  const [encerrarRecorrencia, setEncerrarRecorrencia] = useState(turma.recorrencia.criadaPelaTurma && !bloqueio)
  const [mes, setMes] = useState('')
  // "A partir de hoje" (regra do Cancelar plano) ou "a partir de um mês" (Registrar encerramento).
  const [modo, setModo] = useState<'agora' | 'mes'>('agora')
  const [agora] = useState(() => new Date())
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const dataInvalida = !data || data < minimo
  const meses = mesesDeEncerramento(dataInvalida ? minimo : data)
  const mesEfetivo = meses.includes(mes) ? mes : meses[0]
  const levarRecorrencia = encerrarRecorrencia && !bloqueio
  // Cancelar as próximas aulas só faz sentido se a turma também acaba até hoje.
  const agoraDisponivel = !dataInvalida && data <= hojeISO()
  const modoEfetivo = modo === 'agora' && agoraDisponivel ? 'agora' : 'mes'
  const proxima = recorrencia ? proximaAula(recorrencia.blocos, agora) : null

  const confirmar = async () => {
    if (dataInvalida || salvando) return
    setSalvando(true)
    setErro(null)
    try {
      const res = await encerrarTurmaAction({
        arenaId,
        turmaId: turma.id,
        data,
        motivo,
        recorrencia: !levarRecorrencia
          ? null
          : modoEfetivo === 'agora'
            ? { modo: 'agora' }
            : { modo: 'mes', aPartirDe: mesEfetivo },
      })
      if (!res.success) {
        setErro(res.error)
        toast.error(res.error)
        return
      }
      const { recorrenciaCanceladaAgora, reservasCanceladas, recorrenciaAPartirDe } = res.data
      onEncerrada(
        recorrenciaCanceladaAgora
          ? `Turma ${turma.codigo} encerrada e recorrência cancelada a partir de hoje (${reservasCanceladas} ${
              reservasCanceladas === 1 ? 'aula liberada' : 'aulas liberadas'
            }).`
          : recorrenciaAPartirDe
            ? `Turma ${turma.codigo} encerrada; a recorrência encerra a partir de ${formatMes(recorrenciaAPartirDe)}.`
            : `Turma ${turma.codigo} encerrada. O histórico foi preservado.`,
      )
    } finally {
      setSalvando(false)
    }
  }

  return (
    <StandardModal
      open
      onOpenChange={(aberto) => !aberto && onCancelar()}
      title={`Encerrar turma ${turma.codigo}?`}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-3">
          {erro && (
            <p role="alert" className="mr-auto max-w-xs text-xs font-semibold text-red-600">
              {erro}
            </p>
          )}
          <Button type="button" variant="outline" onClick={onCancelar} disabled={salvando} className="h-11 px-5">
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={dataInvalida || salvando}
            onClick={() => void confirmar()}
            className="h-11 bg-red-600 px-5 font-semibold text-white hover:bg-red-700"
          >
            {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {levarRecorrencia ? 'Encerrar turma e recorrência' : 'Encerrar turma'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5 text-sm text-arena-navy-800/70">
        <p>
          A turma sai da lista e o código <strong className="font-mono text-arena-navy-800">{turma.codigo}</strong>{' '}
          não é reaproveitado. O histórico de alunos fica preservado e pode ser consultado no filtro{' '}
          <strong className="font-semibold text-arena-navy-800">Encerradas</strong>.
        </p>
        {ativos.length > 0 && (
          <p>
            {ativos.length === 1
              ? 'O aluno ativo recebe saída nesta data'
              : `Os ${ativos.length} alunos ativos recebem saída nesta data`}
            , com o motivo &quot;Turma encerrada&quot;.
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[180px_1fr]">
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-arena-navy-800">Data de encerramento</Label>
            <Input
              type="date"
              value={data}
              min={minimo}
              onChange={(e) => setData(e.target.value)}
              aria-invalid={dataInvalida}
              className="h-11 rounded-lg border-arena-navy-800/15"
            />
            {dataInvalida && (
              <p className="text-xs font-medium text-red-600">A partir de {formatData(minimo)}.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-arena-navy-800">Motivo (opcional)</Label>
            <Input
              value={motivo}
              maxLength={120}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: poucos alunos inscritos"
              className="h-11 rounded-lg border-arena-navy-800/15"
            />
          </div>
        </div>

        {recorrencia && (
          <div
            className={cn(
              'rounded-lg border p-4',
              encerrarRecorrencia && !bloqueio ? 'border-red-200 bg-red-50/50' : 'border-slate-200 bg-slate-50/60',
            )}
          >
            <label className={cn('flex items-start gap-3', bloqueio ? 'cursor-not-allowed' : 'cursor-pointer')}>
              <Checkbox
                className="mt-0.5"
                disabled={Boolean(bloqueio)}
                checked={encerrarRecorrencia && !bloqueio}
                onCheckedChange={(v) => setEncerrarRecorrencia(v === true)}
                aria-label="Encerrar também a recorrência"
              />
              <span className="leading-snug">
                <span className="block font-semibold text-arena-navy-800">
                  Encerrar também a recorrência de {recorrencia.responsavelNome}
                </span>
                <span className="block text-xs text-arena-navy-800/60">
                  {resumoBlocos(recorrencia.blocos)} · {nomesEspacos(recorrencia.blocos, catalogo)}
                  {turma.recorrencia.criadaPelaTurma && ' · criada por esta turma'}
                </span>
              </span>
            </label>

            {bloqueio ? (
              <p className="mt-2 pl-7 text-xs text-arena-navy-800/60">
                Indisponível: {bloqueio} A recorrência continua ativa.
              </p>
            ) : encerrarRecorrencia ? (
              <div className="mt-3 space-y-2 pl-7" role="radiogroup" aria-label="Quando a recorrência acaba">
                <OpcaoEncerramento
                  ativo={modoEfetivo === 'agora'}
                  desabilitado={!agoraDisponivel}
                  onSelecionar={() => setModo('agora')}
                  titulo="A partir de hoje"
                  descricao={
                    !agoraDisponivel
                      ? 'Disponível quando a turma encerra até hoje.'
                      : proxima
                        ? `Próxima aula prevista: ${format(proxima, "EEE, dd/MM 'às' HH:mm", { locale: ptBR })}. Ela e as seguintes são liberadas.`
                        : 'Não há aula prevista nos próximos dias.'
                  }
                />
                <OpcaoEncerramento
                  ativo={modoEfetivo === 'mes'}
                  onSelecionar={() => setModo('mes')}
                  titulo="A partir de um mês"
                  descricao="As aulas seguem até o fim do mês anterior ao escolhido."
                >
                  {modoEfetivo === 'mes' && (
                    <Select value={mesEfetivo} onValueChange={setMes}>
                      <SelectTrigger
                        className="mt-2 h-9 w-52 rounded-md border-arena-navy-800/15 bg-white text-sm"
                        aria-label="Mês de encerramento da recorrência"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {meses.map((m) => (
                          <SelectItem key={m} value={m}>
                            {formatMes(m)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </OpcaoEncerramento>
                <p className="text-xs text-arena-navy-800/60">
                  {modoEfetivo === 'agora'
                    ? 'Mesma regra do "Cancelar plano" de Mensalistas: a recorrência é cancelada agora e as próximas aulas, inclusive as já confirmadas deste mês, voltam para revenda. Valores já recebidos não são estornados automaticamente; se precisar, lance crédito em Mensalistas.'
                    : 'Mesma regra de Mensalistas: as reservas ainda não confirmadas a partir desse mês são canceladas, liberando o horário para revenda. Até lá, a recorrência e a cobrança continuam.'}
                </p>
              </div>
            ) : (
              <p className="mt-2 flex items-start gap-1.5 pl-7 text-xs text-arena-navy-800/60">
                <Info className="mt-px h-3 w-3 flex-none" />
                A recorrência continua ativa, reservando o espaço e sendo cobrada.
              </p>
            )}
          </div>
        )}
      </div>
    </StandardModal>
  )
}

function OpcaoEncerramento({
  ativo,
  desabilitado = false,
  onSelecionar,
  titulo,
  descricao,
  children,
}: {
  ativo: boolean
  desabilitado?: boolean
  onSelecionar: () => void
  titulo: string
  descricao: string
  children?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2.5 transition-colors',
        ativo ? 'border-red-300 bg-white' : 'border-slate-200 bg-white/60',
        desabilitado && 'opacity-60',
      )}
    >
      <button
        type="button"
        role="radio"
        aria-checked={ativo}
        disabled={desabilitado}
        onClick={onSelecionar}
        className="flex w-full items-start gap-2.5 text-left disabled:cursor-not-allowed"
      >
        <span
          className={cn(
            'mt-0.5 flex h-[15px] w-[15px] flex-none items-center justify-center rounded-full border-2',
            ativo ? 'border-red-600' : 'border-gray-300',
          )}
        >
          {ativo && <span className="h-[5px] w-[5px] rounded-full bg-red-600" />}
        </span>
        <span className="leading-tight">
          <span className={cn('block text-[13px] font-bold', ativo ? 'text-red-700' : 'text-arena-navy-800')}>
            {titulo}
          </span>
          <span className="mt-0.5 block text-[11px] text-arena-navy-800/55">{descricao}</span>
        </span>
      </button>
      {children && <div className="pl-[25px]">{children}</div>}
    </div>
  )
}
