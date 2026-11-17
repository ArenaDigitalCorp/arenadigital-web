const PREFIX = '[arena-gamematch:v1]'

/** App-created games keep their metadata in notes; only the readable copy belongs in the UI. */
export function gamePublicationCopy(notes: string | null | undefined) {
  if (!notes?.startsWith(PREFIX)) return { title: '', description: notes?.trim() ?? '' }
  const newline = notes.indexOf('\n')
  const fallback = newline < 0 ? '' : notes.slice(newline + 1).trim()
  try {
    const metadata = JSON.parse(notes.slice(PREFIX.length, newline < 0 ? undefined : newline))
    return {
      title: typeof metadata?.title === 'string' ? metadata.title.trim() : '',
      description: typeof metadata?.description === 'string' ? metadata.description.trim() || fallback : fallback,
    }
  } catch {
    return { title: '', description: fallback }
  }
}

export function updateGamePublicationDescription(notes: string | null | undefined, description: string) {
  const next = description.trim()
  if (next === gamePublicationCopy(notes).description) return notes ?? null
  if (!notes?.startsWith(PREFIX)) return next || null
  const newline = notes.indexOf('\n')
  try {
    const metadata = JSON.parse(notes.slice(PREFIX.length, newline < 0 ? undefined : newline))
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw new Error()
    return `${PREFIX}${JSON.stringify({ ...metadata, description: next || null })}${next ? `\n${next}` : ''}`
  } catch {
    throw new Error('Não foi possível atualizar a descrição deste jogo. Atualize a página e tente novamente.')
  }
}
