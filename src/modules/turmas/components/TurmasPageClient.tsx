'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/tooltip'
import { DashboardTabs } from '@/components/dashboard/DashboardTabs'
import { resumosDeAtletas, turmasAtivas } from '../lib'
import type { Turma, TurmasPageData } from '../types'
import { TurmasTab } from './TurmasTab'
import { ProfessoresTab } from './ProfessoresTab'
import { AtletasTab } from './AtletasTab'
import { TurmaFormModal } from './TurmaFormModal'
import { TurmaAlunosModal } from './TurmaAlunosModal'
import { ProfessorDetalheModal } from './ProfessorDetalheModal'
import { AtletaDetalheModal } from './AtletaDetalheModal'
import { EncerrarTurmaDialog } from './EncerrarTurmaDialog'

type Aba = 'turmas' | 'professores' | 'atletas'

/** O formulário remonta a cada abertura (via `key`) para nascer limpo. */
type Formulario = { aberto: false } | { aberto: true; turmaId: string | null; chave: number }

interface Props {
  arenaId: string
  dados: TurmasPageData
}

export function TurmasPageClient({ arenaId, dados }: Props) {
  const router = useRouter()
  const [atualizando, startTransition] = useTransition()
  const { catalogo, turmas } = dados

  const [aba, setAba] = useState<Aba>('turmas')
  const [formulario, setFormulario] = useState<Formulario>({ aberto: false })
  const [alunosTurmaId, setAlunosTurmaId] = useState<string | null>(null)
  const [encerrarTurmaId, setEncerrarTurmaId] = useState<string | null>(null)
  const [professorAbertoId, setProfessorAbertoId] = useState<string | null>(null)
  const [atletaAbertoId, setAtletaAbertoId] = useState<string | null>(null)

  const turmaAlunos = turmas.find((t) => t.id === alunosTurmaId) ?? null
  const turmaEncerrar = turmas.find((t) => t.id === encerrarTurmaId) ?? null
  const turmaFormulario = formulario.aberto ? (turmas.find((t) => t.id === formulario.turmaId) ?? null) : null
  const professorAberto = catalogo.professores.find((p) => p.id === professorAbertoId) ?? null
  const atletaAberto = catalogo.atletas.find((a) => a.id === atletaAbertoId) ?? null

  /** Os dados vêm do servidor: depois de gravar, a página é recarregada. */
  const recarregar = () => startTransition(() => router.refresh())

  const abrirFormulario = (turma: Turma | null) =>
    setFormulario({ aberto: true, turmaId: turma?.id ?? null, chave: Date.now() })

  // Um modal por vez: navegar entre turma e atleta troca o que está aberto.
  const abrirTurma = (t: Turma) => {
    setProfessorAbertoId(null)
    setAtletaAbertoId(null)
    setAlunosTurmaId(t.id)
  }
  const abrirAtleta = (atletaId: string) => {
    setAlunosTurmaId(null)
    setAtletaAbertoId(atletaId)
  }

  return (
    <TooltipProvider>
      <div className="space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-arena-navy-800">Turmas</h1>
            <p className="text-muted-foreground">
              Organize turmas, horários, professores e alunos da arena.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {atualizando && (
              <span className="flex items-center gap-1.5 text-xs text-arena-navy-800/50">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Atualizando…
              </span>
            )}
            {aba === 'turmas' && (
              <Button
                onClick={() => abrirFormulario(null)}
                className="bg-arena-button hover:bg-arena-button-hover text-white font-semibold shadow-sm"
              >
                <Plus className="mr-2 h-4 w-4" />
                Nova turma
              </Button>
            )}
          </div>
        </div>

        <DashboardTabs
          value={aba}
          onChange={setAba}
          tabs={[
            { label: `Turmas (${turmasAtivas(turmas).length})`, value: 'turmas' },
            { label: `Professores (${catalogo.professores.length})`, value: 'professores' },
            { label: `Atletas (${resumosDeAtletas(turmas, catalogo).length})`, value: 'atletas' },
          ]}
        />

        {aba === 'turmas' && (
          <TurmasTab
            turmas={turmas}
            catalogo={catalogo}
            onEditar={abrirFormulario}
            onAlunos={abrirTurma}
            onEncerrar={(t) => setEncerrarTurmaId(t.id)}
          />
        )}
        {aba === 'professores' && (
          <ProfessoresTab turmas={turmas} catalogo={catalogo} onVer={(p) => setProfessorAbertoId(p.id)} />
        )}
        {aba === 'atletas' && (
          <AtletasTab
            turmas={turmas}
            catalogo={catalogo}
            onVer={(a) => abrirAtleta(a.id)}
            onAbrirTurma={abrirTurma}
          />
        )}
      </div>

      {formulario.aberto && (
        <TurmaFormModal
          key={formulario.chave}
          arenaId={arenaId}
          turma={turmaFormulario}
          turmas={turmas}
          catalogo={catalogo}
          onCancelar={() => setFormulario({ aberto: false })}
          onSalvo={(mensagem) => {
            setFormulario({ aberto: false })
            toast.success(mensagem)
            recarregar()
          }}
        />
      )}

      {turmaAlunos && (
        <TurmaAlunosModal
          arenaId={arenaId}
          turma={turmaAlunos}
          catalogo={catalogo}
          onFechar={() => setAlunosTurmaId(null)}
          onAlterado={recarregar}
          onAbrirAtleta={(a) => abrirAtleta(a.id)}
        />
      )}

      {turmaEncerrar && (
        <EncerrarTurmaDialog
          arenaId={arenaId}
          turma={turmaEncerrar}
          turmas={turmas}
          catalogo={catalogo}
          onCancelar={() => setEncerrarTurmaId(null)}
          onEncerrada={(mensagem) => {
            setEncerrarTurmaId(null)
            toast.success(mensagem)
            recarregar()
          }}
        />
      )}

      {professorAberto && (
        <ProfessorDetalheModal
          professor={professorAberto}
          turmas={turmas}
          catalogo={catalogo}
          onFechar={() => setProfessorAbertoId(null)}
          onAbrirTurma={abrirTurma}
        />
      )}

      {atletaAberto && (
        <AtletaDetalheModal
          atleta={atletaAberto}
          turmas={turmas}
          catalogo={catalogo}
          onFechar={() => setAtletaAbertoId(null)}
          onAbrirTurma={abrirTurma}
        />
      )}
    </TooltipProvider>
  )
}
