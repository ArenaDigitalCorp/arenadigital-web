import type { AthletePage, AthletePageQuery, AthletePageItem } from '../types/list-page.types'

type TutorialAthlete = { id: string; name: string; sport: string; cpf: string | null; telefone: string | null; email: string | null }

/** Tutorial data stays local; the real listing always uses the server query. */
export function tutorialAthletePage(athletes: TutorialAthlete[], query: AthletePageQuery): AthletePage {
  const normalize = (value: string) => value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const matching: AthletePageItem[] = athletes
    .filter(athlete => normalize(athlete.name).includes(normalize(query.search.trim())))
    .map(athlete => ({ ...athlete, cpf: athlete.cpf ?? '---', telefone: athlete.telefone ?? '---', email: athlete.email ?? '---', perfil: 'padrao' }))
  const filtered = query.profile === 'todos' || query.profile === 'padrao' ? matching : []
  filtered.sort((a, b) => {
    const compare = a[query.sort.column].localeCompare(b[query.sort.column], 'pt-BR', { sensitivity: 'base' })
    return (query.sort.direction === 'asc' ? compare : -compare) || a.id.localeCompare(b.id)
  })
  const page = Math.min(query.page, Math.max(1, Math.ceil(filtered.length / query.pageSize)))
  return {
    items: filtered.slice((page - 1) * query.pageSize, page * query.pageSize),
    page, pageSize: query.pageSize, total: filtered.length,
    counts: { todos: matching.length, padrao: matching.length, mensalista: 0, professor: 0 },
  }
}
