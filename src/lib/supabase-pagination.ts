export const SUPABASE_REPORT_PAGE_SIZE = 1000

export interface SupabasePageError {
  message: string
  code?: string
}

export interface SupabasePageResult<T> {
  data: T[] | null
  error: SupabasePageError | null
}

export interface SupabaseRangeQuery<T> {
  range(from: number, to: number): PromiseLike<SupabasePageResult<T>>
}

/**
 * Exhausts a PostgREST query in deterministic 1,000-row windows.
 *
 * Supabase projects commonly cap one response at 1,000 rows. Report actions
 * aggregate complete datasets, so silently accepting the first response would
 * undercount totals while the client-side visual pagination appeared normal.
 */
export async function fetchAllSupabaseRows<T>(
  query: SupabaseRangeQuery<T>,
  pageSize = SUPABASE_REPORT_PAGE_SIZE
): Promise<SupabasePageResult<T>> {
  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    throw new Error('Supabase page size must be a positive integer')
  }

  const rows: T[] = []
  let from = 0

  while (true) {
    const { data, error } = await query.range(from, from + pageSize - 1)
    if (error) return { data: null, error }

    const page = data ?? []
    rows.push(...page)

    if (page.length < pageSize) return { data: rows, error: null }
    from += pageSize
  }
}
