'use client'

import { useSyncExternalStore } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const subscribe = () => () => {}
const browserSnapshot = () => true
const serverSnapshot = () => false

/** Preserve the user's local timezone. Server and hydration show the same
 * placeholder; only the browser formats instants, as in the original list. */
export function LoyaltyLocalDate({ value, time = false }: { value: string; time?: boolean }) {
  const inBrowser = useSyncExternalStore(subscribe, browserSnapshot, serverSnapshot)
  return <time dateTime={value}>{inBrowser
    ? format(new Date(value), time ? 'HH:mm' : 'dd/MM/yyyy', { locale: ptBR })
    : '—'}</time>
}
