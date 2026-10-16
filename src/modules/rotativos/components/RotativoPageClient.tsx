"use client"

import { useState, type ReactNode } from "react"
import { DashboardTabs } from "@/components/dashboard/DashboardTabs"
import { CadastradosTab } from "@/modules/rotativos/components/CadastradosTab"
import type {
  CourtOption,
  Rotativo,
} from "@/modules/rotativos/types/rotativo.types"
import type { Sport } from "@/modules/arenas/types/arena.types"

type TabValue = "cadastrados" | "creditos"

interface Props {
  arenaId: string
  sports: Sport[]
  courts: CourtOption[]
  initialRotativos: Rotativo[]
  initialRotativosTotal: number
  creditContent: ReactNode
}

export function RotativoPageClient({
  arenaId,
  sports,
  courts,
  initialRotativos,
  initialRotativosTotal,
  creditContent,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabValue>("cadastrados")

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Rotativo</h1>
        <p className="text-sm text-gray-500 mt-1">
          Organize sessões de jogo aberto e gerencie os participantes
        </p>
      </div>

      <DashboardTabs
        tabs={[
          { label: "Cadastrados", value: "cadastrados" },
          { label: "Gestão de créditos", value: "creditos" },
        ]}
        value={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === "cadastrados" ? (
        <CadastradosTab
          arenaId={arenaId}
          sports={sports}
          courts={courts}
          initialRows={initialRotativos}
          initialTotal={initialRotativosTotal}
        />
      ) : (
        creditContent
      )}
    </div>
  )
}
