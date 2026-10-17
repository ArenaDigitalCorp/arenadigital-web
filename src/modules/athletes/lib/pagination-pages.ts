export function paginationPages(page: number, totalPages: number): (number | 'ellipsis')[] {
  const visible = [...new Set([1, page - 1, page, page + 1, totalPages])]
    .filter(value => value >= 1 && value <= totalPages).sort((a, b) => a - b)
  const result: (number | 'ellipsis')[] = []
  for (const value of visible) {
    const previous = result.at(-1)
    if (typeof previous === 'number' && value > previous + 1) result.push('ellipsis')
    result.push(value)
  }
  return result
}
