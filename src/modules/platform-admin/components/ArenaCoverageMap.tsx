"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircle, MapPinned } from "lucide-react"
import type { PlatformArena, PlatformCommercialStatus } from "@/modules/platform-admin/types/platform-admin.types"

const STATUS_COLOR: Record<PlatformCommercialStatus, string> = {
  cliente_ativo: "#10b981",
  inadimplente: "#ff315d",
  prospect: "#ff9d13",
  catalogo_publico: "#16a9e6",
  demonstracao: "#8b5cf6",
  desativada: "#94a3b8",
}

const DEFAULT_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png"

export function ArenaCoverageMap({ arenas }: { arenas: PlatformArena[] }) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let active = true
    let removeMap: (() => void) | undefined

    void import("leaflet").then((leaflet) => {
      if (!active) return

      const map = leaflet.map(container, {
        center: [-14.235, -51.9253],
        zoom: 4,
        minZoom: 3,
        zoomControl: true,
        scrollWheelZoom: true,
        maxBounds: [[-40, -82], [12, -24]],
        maxBoundsViscosity: 0.65,
      })

      leaflet.tileLayer(process.env.NEXT_PUBLIC_MAP_TILE_URL || DEFAULT_TILE_URL, {
        maxZoom: 19,
        attribution: "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors",
      }).addTo(map)

      const bounds = leaflet.latLngBounds([])
      for (const arena of arenas) {
        if (arena.latitude === null || arena.longitude === null) continue
        const coordinate = leaflet.latLng(arena.latitude, arena.longitude)
        bounds.extend(coordinate)

        const marker = leaflet.circleMarker(coordinate, {
          radius: 8,
          color: "#ffffff",
          weight: 3,
          fillColor: STATUS_COLOR[arena.commercialStatus],
          fillOpacity: 1,
          opacity: 1,
          bubblingMouseEvents: false,
          className: "arena-coverage-marker",
        }).addTo(map)

        const tooltip = document.createElement("div")
        const title = document.createElement("strong")
        const location = document.createElement("span")
        title.textContent = arena.name
        location.textContent = [arena.cityName, arena.stateCode].filter(Boolean).join(" · ") || "Localização cadastrada"
        tooltip.append(title, location)
        marker.bindTooltip(tooltip, {
          className: "arena-coverage-tooltip",
          direction: "top",
          offset: [0, -8],
        })
        marker.on("click", () => router.push(`/admin/arenas/${arena.id}`))
      }

      if (bounds.isValid()) {
        const onlyOneArena = bounds.getNorthEast().equals(bounds.getSouthWest())
        if (onlyOneArena) map.setView(bounds.getCenter(), 13)
        else map.fitBounds(bounds, { padding: [52, 52], maxZoom: 13 })
      }

      window.setTimeout(() => map.invalidateSize(), 0)
      setLoading(false)
      removeMap = () => map.remove()
    }).catch(() => {
      if (!active) return
      setError("Não foi possível carregar o mapa agora.")
      setLoading(false)
    })

    return () => {
      active = false
      removeMap?.()
    }
  }, [arenas, router])

  return (
    <div className="arena-coverage-map relative h-full min-h-[520px] overflow-hidden bg-slate-100">
      <div ref={containerRef} className="absolute inset-0" aria-label="Mapa geográfico das arenas filtradas" />
      {loading && (
        <div className="absolute inset-0 z-[500] grid place-items-center bg-slate-950/88 text-white backdrop-blur-sm">
          <div className="text-center">
            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-orange-400" />
            <p className="mt-3 text-xs font-bold">Carregando mapa geográfico</p>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 z-[500] grid place-items-center bg-slate-950 p-8 text-center text-white">
          <div>
            <MapPinned className="mx-auto h-7 w-7 text-rose-400" />
            <p className="mt-3 text-sm font-black">Mapa indisponível</p>
            <p className="mt-1 text-xs text-slate-400">{error}</p>
          </div>
        </div>
      )}
      {!loading && !error && arenas.length === 0 && (
        <div className="pointer-events-none absolute left-1/2 top-5 z-[400] -translate-x-1/2 rounded-full border border-slate-200 bg-white/95 px-4 py-2 text-xs font-bold text-slate-700 shadow-lg backdrop-blur">
          Nenhuma arena neste filtro
        </div>
      )}
    </div>
  )
}
