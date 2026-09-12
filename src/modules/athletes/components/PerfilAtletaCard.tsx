'use client'

import { useEffect, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  getPerfilAtletaAction,
  setPerfilAtletaAction,
} from '@/modules/athletes/actions/perfilActions'
import {
  PERFIL_DESCRICAO,
  PERFIL_LABEL,
  PERFIL_MOTIVO,
  PERFIS_ATLETA,
  type PerfilAtleta,
  type PerfilAtletaEstado,
} from '@/modules/athletes/types/perfil.types'

interface Props {
  arenaId: string
  atletaId: string
}

/** A consequência prática de cada perfil, curta o bastante para caber na opção. */
const TABELA: Record<PerfilAtleta, string> = {
  padrao: 'Tabela Padrão',
  mensalista: 'Tabela Mensalista',
  professor: 'Tabela Professor',
}

/**
 * O sistema sugere o perfil a partir da situação do atleta; o gestor decide.
 * Três opções curtas e mutuamente exclusivas — cabem lado a lado, no mesmo
 * ritmo visual dos cards de métrica acima.
 */
export function PerfilAtletaCard({ arenaId, atletaId }: Props) {
  const [estado, setEstado] = useState<PerfilAtletaEstado | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState<PerfilAtleta | 'sugerido' | null>(null)

  useEffect(() => {
    let cancelado = false
    void getPerfilAtletaAction(arenaId, atletaId).then((res) => {
      if (cancelado) return
      setCarregando(false)
      if (!res.success || !res.data) {
        toast.error(res.error ?? 'Não foi possível carregar o perfil.')
        return
      }
      setEstado(res.data)
    })
    return () => {
      cancelado = true
    }
  }, [arenaId, atletaId])

  const salvar = async (perfil: PerfilAtleta | null) => {
    setSalvando(perfil ?? 'sugerido')
    try {
      const res = await setPerfilAtletaAction({ arenaId, atletaId, perfil })
      if (!res.success || !res.data) throw new Error(res.error)
      setEstado(res.data)
      toast.success(
        perfil === null
          ? `Perfil de volta ao sugerido: ${PERFIL_LABEL[res.data.perfilEfetivo]}.`
          : `Perfil definido como ${PERFIL_LABEL[perfil]}.`
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao definir o perfil.')
    } finally {
      setSalvando(null)
    }
  }

  if (carregando) {
    return (
      <div className="mb-8 flex h-[104px] items-center gap-2 rounded-xl border border-gray-100 bg-white p-5 text-sm text-gray-400 shadow-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando perfil…
      </div>
    )
  }

  if (!estado) return null

  const ocupado = salvando !== null

  return (
    <div className="mb-8 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center gap-x-2.5 gap-y-1">
        {/* Mesma tipografia dos títulos de seção da página (SectionCard). */}
        <h3 className="font-heading text-xl font-bold text-[#5F636E]">Perfil na arena</h3>
        {/* Um atleta pode acumular papéis: professor também é mensalista. */}
        {estado.papeisDetectados.map((papel) => (
          <span
            key={papel}
            title={`Detectado: ${PERFIL_MOTIVO[papel]}`}
            className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-500"
          >
            {PERFIL_LABEL[papel]}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {PERFIS_ATLETA.map((perfil) => {
          const ativo = estado.perfilEfetivo === perfil
          const sugerido = estado.perfilSugerido === perfil
          return (
            <button
              key={perfil}
              type="button"
              disabled={ocupado}
              aria-pressed={ativo}
              title={PERFIL_DESCRICAO[perfil]}
              onClick={() => void salvar(perfil)}
              className={cn(
                'flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors disabled:opacity-60',
                ativo
                  ? 'border-arena-button bg-arena-button/[0.06]'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              )}
            >
              <span
                className={cn(
                  'flex h-[15px] w-[15px] flex-none items-center justify-center rounded-full border-2',
                  ativo ? 'border-arena-button' : 'border-gray-300'
                )}
              >
                {ativo && <span className="h-[5px] w-[5px] rounded-full bg-arena-button" />}
              </span>

              <span className="min-w-0 flex-1 leading-tight">
                <span className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      'truncate text-[13px] font-bold',
                      ativo ? 'text-arena-button' : 'text-gray-900'
                    )}
                  >
                    {PERFIL_LABEL[perfil]}
                  </span>
                  {sugerido && (
                    <span className="flex-none rounded bg-emerald-50 px-1.5 text-[9px] font-bold uppercase tracking-wide text-emerald-600">
                      sugerido
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-gray-400">
                  {TABELA[perfil]}
                </span>
              </span>

              {salvando === perfil && (
                <Loader2 className="h-3.5 w-3.5 flex-none animate-spin text-arena-button" />
              )}
            </button>
          )
        })}
      </div>

      <p className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] leading-snug text-gray-400">
        {estado.definidoManualmente ? (
          <>
            <span>
              Definido manualmente. O sugerido seria{' '}
              <strong className="font-semibold text-gray-600">
                {PERFIL_LABEL[estado.perfilSugerido]}
              </strong>
              , porque {PERFIL_MOTIVO[estado.perfilSugerido]}.
            </span>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => void salvar(null)}
              className="inline-flex items-center gap-1 font-semibold text-arena-button hover:underline disabled:opacity-60"
            >
              {salvando === 'sugerido' ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
              Voltar ao sugerido
            </button>
          </>
        ) : (
          <span>
            Sugerido pelo sistema, porque {PERFIL_MOTIVO[estado.perfilSugerido]}.
            Escolher outro fixa a decisão.
          </span>
        )}
      </p>
    </div>
  )
}
