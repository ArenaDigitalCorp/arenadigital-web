type PreviousEdit = { value: string; start: number; end: number; key: string }
const meaningful = (value: string) => (value.match(/[A-Za-z0-9]/g) ?? []).length

/** Pure editing algorithm also covers deleting a mask separator with Backspace/Delete. */
export function maskEdit(rawValue: string, rawCaret: number, mask: (value: string) => string, previous: PreviousEdit | null = null) {
  let raw = rawValue
  let caret = rawCaret
  if (previous && previous.start === previous.end && previous.value.length === raw.length + 1) {
    const removedIndex = previous.key === 'Backspace' ? previous.start - 1 : previous.key === 'Delete' ? previous.start : -1
    if (removedIndex >= 0 && /[().\s/\-]/.test(previous.value[removedIndex])) {
      if (previous.key === 'Backspace') {
        let index = caret - 1
        while (index >= 0 && !/[A-Za-z0-9]/.test(raw[index])) index--
        if (index >= 0) { raw = raw.slice(0, index) + raw.slice(index + 1); caret = index }
      } else {
        let index = caret
        while (index < raw.length && !/[A-Za-z0-9]/.test(raw[index])) index++
        raw = raw.slice(0, index) + raw.slice(index + 1)
      }
    }
  }
  const value = mask(raw)
  if (value === raw) return { value, caret: Math.min(caret, value.length) }
  const count = meaningful(raw.slice(0, caret))
  let position = 0
  while (position < value.length && meaningful(value.slice(0, position)) < count) position++
  return { value, caret: position }
}
