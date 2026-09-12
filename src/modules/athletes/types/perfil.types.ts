/**
 * Perfil do atleta dentro de uma arena.
 *
 * Vive fora de `actions/perfilActions.ts` porque um arquivo `'use server'` só
 * pode exportar funções async — exportar constantes de lá derruba o módulo
 * inteiro em runtime, e com ele a página que o importa.
 */
export const PERFIS_ATLETA = ['padrao', 'mensalista', 'professor'] as const
export type PerfilAtleta = (typeof PERFIS_ATLETA)[number]

export const PERFIL_LABEL: Record<PerfilAtleta, string> = {
  padrao: 'Cliente padrão',
  mensalista: 'Mensalista',
  professor: 'Professor',
}

export const PERFIL_DESCRICAO: Record<PerfilAtleta, string> = {
  padrao: 'Reservas avulsas e participação em jogos. Usa a tabela Padrão do espaço.',
  mensalista: 'Responsável por uma recorrência mensal. Usa a tabela Mensalista do espaço.',
  professor: 'Aluga horários para dar aula. Usa a tabela Professor do espaço.',
}

/** Por que o sistema sugeriu cada perfil — o gestor precisa saber. */
export const PERFIL_MOTIVO: Record<PerfilAtleta, string> = {
  professor: 'tem recorrência ativa cotada pela tabela Professor',
  mensalista: 'é responsável por uma recorrência mensal ativa',
  padrao: 'não tem recorrência ativa nesta arena',
}

export interface PerfilAtletaEstado {
  /** Papéis que a situação atual sugere, em ordem de precedência. */
  papeisDetectados: PerfilAtleta[]
  perfilSugerido: PerfilAtleta
  /** O que o gestor definiu à mão, se definiu. */
  perfilDefinido: PerfilAtleta | null
  /** O que vale: o definido, senão o sugerido. */
  perfilEfetivo: PerfilAtleta
  definidoManualmente: boolean
  definidoEm: string | null
}

/** Cor do selo de perfil na listagem — um tom por papel, todos discretos. */
export const PERFIL_BADGE: Record<PerfilAtleta, string> = {
  padrao: 'bg-slate-100 text-slate-600',
  mensalista: 'bg-orange-50 text-orange-600',
  professor: 'bg-teal-50 text-teal-700',
}
