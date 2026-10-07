import { listSportCatalog } from '@/modules/sport-catalog/actions'
import { SportCatalog } from '@/modules/sport-catalog/SportCatalog'
import type { CatalogSport } from '@/modules/sport-catalog/schema'
export default async function CatalogPage() {
  let sports: CatalogSport[] = []
  let error: string | undefined
  try { sports = await listSportCatalog() }
  catch { error = 'Não foi possível carregar o catálogo. Tente novamente.' }
  return <SportCatalog initialSports={sports} initialError={error} />
}
