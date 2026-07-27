/** Aba da tela da arena (cards, tabela de cadastros e operação do dia). */
export type ArenaDashboardTab = 'espacos' | 'cadastro' | 'operacao'

const NON_DEFAULT_TABS: ArenaDashboardTab[] = ['cadastro', 'operacao']

function parseTab(value: string | undefined): ArenaDashboardTab {
    return NON_DEFAULT_TABS.includes(value as ArenaDashboardTab)
        ? (value as ArenaDashboardTab)
        : 'espacos'
}

export function parseArenaDashboardTab(tab: string | undefined): ArenaDashboardTab {
    return parseTab(tab)
}

export function parseReturnTabParam(value: string | undefined): ArenaDashboardTab {
    return parseTab(value)
}

/** Rota da arena com a aba correta na query (`espacos` é o padrão, sem query). */
export function arenaDashboardPath(arenaId: string, tab: ArenaDashboardTab): string {
    return tab === 'espacos'
        ? `/dashboard/arenas/${arenaId}`
        : `/dashboard/arenas/${arenaId}?tab=${tab}`
}

export function spaceEditPath(arenaId: string, spaceId: string, returnTab: ArenaDashboardTab): string {
    return `/dashboard/arenas/${arenaId}/spaces/${spaceId}/edit?returnTab=${returnTab}`
}

export function spaceNewPath(arenaId: string): string {
    return `/dashboard/arenas/${arenaId}/spaces/new`
}
