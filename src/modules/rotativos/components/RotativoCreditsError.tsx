'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function RotativoCreditsError() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <div role="alert" className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
      <p>Não foi possível carregar os créditos. Tente novamente.</p>
      <Button variant="outline" disabled={pending} onClick={() => startTransition(() => router.refresh())}>
        {pending ? 'Carregando…' : 'Tentar novamente'}
      </Button>
    </div>
  )
}
