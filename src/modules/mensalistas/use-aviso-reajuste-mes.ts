'use client'

import { useEffect, useRef, useState } from 'react'
import { getReajusteMesPreviewAction } from '@/modules/mensalistas/actions/mensalistaActions'
import { temPendenciaMensal } from './pendencias-mes'
import type { ReajusteMesLinha } from './types/mensalista.types'

/** A preparação automática só pede intervenção nas exceções. */
export function useAvisoReajusteMes(arenaId: string, competencia: string) {
  const chave = `${arenaId}:${competencia}`
  const [consulta, setConsulta] = useState<{
    chave: string
    recarga: number
    linhas: ReajusteMesLinha[]
    erro: boolean
  } | null>(null)
  const [aberto, setAberto] = useState<string | null>(null)
  const [recarga, setRecarga] = useState(0)
  const [contexto, setContexto] = useState(chave)
  // Uma abertura automática por arena/mês durante esta visita à gestão.
  // Fechar ou atualizar os valores não interrompe novamente o gestor.
  const apresentados = useRef(new Set<string>())

  if (contexto !== chave) {
    setContexto(chave)
    setAberto(null)
  }

  useEffect(() => {
    let ativo = true
    async function consultar() {
      try {
        const res = await getReajusteMesPreviewAction(arenaId, competencia)
        if (!ativo) return
        if (!res.success || !res.data) {
          setConsulta({ chave, recarga, linhas: [], erro: true })
          return
        }
        const linhas = res.data.linhas.filter(temPendenciaMensal)
        const total = linhas.length
        setConsulta({ chave, recarga, linhas, erro: false })
        if (total > 0 && !apresentados.current.has(chave)) {
          apresentados.current.add(chave)
          setAberto(chave)
        }
      } catch {
        if (ativo) setConsulta({ chave, recarga, linhas: [], erro: true })
      }
    }
    void consultar()
    return () => { ativo = false }
  }, [arenaId, competencia, chave, recarga])

  function abrir() {
    apresentados.current.add(chave)
    setAberto(chave)
  }

  const atual = consulta?.chave === chave && consulta.recarga === recarga ? consulta : null
  return {
    total: atual?.linhas.length ?? 0,
    linhas: atual?.linhas ?? [],
    carregando: atual === null,
    erro: atual?.erro ?? false,
    aberto: aberto === chave,
    abrir,
    fechar: () => setAberto(null),
    atualizar: () => setRecarga((n) => n + 1),
  }
}
