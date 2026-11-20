"use client"

import { Flag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardPage, DashboardPageHeader } from "@/components/dashboard/DashboardPageShell"

export default function ModerationError({ reset }: { reset: () => void }) {
  return (
    <DashboardPage>
      <DashboardPageHeader title="Denúncias" icon={Flag} />
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
        <p role="alert">
          Não foi possível carregar as denúncias. Verifique sua conexão e seu acesso administrativo.
        </p>
        <Button variant="outline" onClick={reset}>
          Tentar novamente
        </Button>
      </div>
    </DashboardPage>
  )
}
