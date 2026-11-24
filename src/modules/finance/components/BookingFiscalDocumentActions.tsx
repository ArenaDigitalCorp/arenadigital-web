"use client"

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Download, LoaderCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

type DocumentFormat = 'pdf' | 'xml'

export function RefreshBookingFiscalInvoices({ children = 'Atualizar' }: { children?: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <Button variant="outline" size="sm" type="button" disabled={pending} onClick={() => startTransition(() => router.refresh())}>
      {pending ? <LoaderCircle className="motion-safe:animate-spin" /> : <RefreshCw />}
      {pending ? 'Atualizando…' : children}
    </Button>
  )
}

export function BookingFiscalDocumentActions({
  arenaId,
  invoiceId,
  formats,
}: {
  arenaId: string
  invoiceId: string
  formats: DocumentFormat[]
}) {
  const [downloading, setDownloading] = useState<DocumentFormat | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function download(format: DocumentFormat) {
    setDownloading(format)
    setError(null)

    try {
      const response = await fetch(`/api/finance/${arenaId}/notas-fiscais/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId, format }),
      })
      if (!response.ok) {
        setError(response.status === 401 || response.status === 403
          ? 'Seu acesso mudou. Entre novamente ou confirme suas permissões na arena.'
          : 'Arquivo indisponível. Atualize a lista e tente novamente.')
        return
      }

      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = `nfse-${invoiceId}.${format}`
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
    } catch {
      setError('Não foi possível baixar o arquivo. Tente novamente.')
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="space-y-2" aria-busy={downloading !== null}>
      <div className="flex flex-wrap gap-2">
        {formats.map(format => (
          <Button key={format} variant="outline" size="sm" type="button"
            disabled={downloading !== null} onClick={() => void download(format)}>
            {downloading === format ? <LoaderCircle className="motion-safe:animate-spin" /> : <Download />}
            <span className="sr-only">{downloading === format ? 'Baixando ' : 'Baixar '}</span>
            {format.toUpperCase()}
          </Button>
        ))}
      </div>
      {error && <p role="alert" className="max-w-52 text-xs leading-relaxed text-red-700">{error}</p>}
    </div>
  )
}
