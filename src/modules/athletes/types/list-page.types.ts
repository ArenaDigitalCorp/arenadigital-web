import type { AtletaListItem } from './athlete.types'
import type { PerfilAtleta } from './perfil.types'

export const ATHLETES_PAGE_SIZES = [25, 50] as const
export type AthletePageSize = (typeof ATHLETES_PAGE_SIZES)[number]
export type AthleteProfileFilter = PerfilAtleta | 'todos'
export type AthleteSortColumn = 'name' | 'sport' | 'perfil'
export type AthleteSort = { column: AthleteSortColumn; direction: 'asc' | 'desc' }
export type AthletePageQuery = {
  page: number
  pageSize: AthletePageSize
  search: string
  profile: AthleteProfileFilter
  sort: AthleteSort
}
export type AthletePageItem = AtletaListItem & { perfil: PerfilAtleta | null }
export type AthletePage = {
  items: AthletePageItem[]
  page: number
  pageSize: number
  total: number
  counts: { todos: number } & Partial<Record<PerfilAtleta, number | null>>
  /** Omitted by the previous RPC version, which always included profiles. */
  profilesAvailable?: boolean
}
