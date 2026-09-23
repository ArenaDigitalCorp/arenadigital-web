"use client"

import { ARENA_BRAND_HEX } from "@/constants/arena-brand-hex"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell, LabelList } from "recharts"

interface OccupancyData {
  courtName: string
  percentage: number
  booked: number
  total: number
}

interface OccupancyChartProps {
  data: OccupancyData[]
  emptyMessage?: string
}

const ROW_HEIGHT = 44
const MIN_HEIGHT = 220
const MAX_VISIBLE_HEIGHT = 420
const NAME_MAX_CHARS = 14
const NAME_COLUMN_WIDTH = 130
// O Recharts descarta o retângulo inteiro (inclusive o fundo/track) quando o valor
// mapeado no eixo é exatamente 0, então usamos um valor mínimo quase invisível só
// para forçar a barra de capacidade a sempre aparecer.
const MIN_VISIBLE_VALUE = 0.5

function truncateName(name: string) {
  if (name.length <= NAME_MAX_CHARS) return name
  return `${name.slice(0, NAME_MAX_CHARS - 1)}…`
}

interface CourtNameTickProps {
  x: string | number
  y: string | number
  payload: { value: string }
}

function CourtNameTick({ x, y, payload }: CourtNameTickProps) {
  const fullName = payload.value
  return (
    <g transform={`translate(${x},${y})`}>
      <title>{fullName}</title>
      <text
        dy={4}
        textAnchor="end"
        className="text-[11px] font-bold uppercase text-arena-navy-800/70"
        fill={ARENA_BRAND_HEX.navy800}
        opacity={0.7}
      >
        {truncateName(fullName)}
      </text>
    </g>
  )
}

export function OccupancyChart({ data, emptyMessage }: OccupancyChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-[220px] flex items-center justify-center text-muted-foreground italic">
        {emptyMessage ?? "Nenhum dado de ocupação disponível para o período selecionado."}
      </div>
    )
  }

  const chartHeight = Math.min(Math.max(MIN_HEIGHT, data.length * ROW_HEIGHT + 20), MAX_VISIBLE_HEIGHT)
  const needsScroll = data.length * ROW_HEIGHT + 20 > MAX_VISIBLE_HEIGHT

  return (
    <div
      className="w-full pt-4"
      style={{ height: chartHeight, overflowY: needsScroll ? "auto" : "visible" }}
    >
      <div style={{ width: "100%", height: needsScroll ? data.length * ROW_HEIGHT + 20 : "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ left: 0, right: 40, top: 8, bottom: 8 }}
          >
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis
              dataKey="courtName"
              type="category"
              axisLine={false}
              tickLine={false}
              width={NAME_COLUMN_WIDTH}
              interval={0}
              tick={CourtNameTick}
            />
            <Tooltip
              cursor={{ fill: "#f8fafc" }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const entry = payload[0].payload as OccupancyData;
                  return (
                    <div className="bg-white p-3 shadow-2xl border border-teal-100 rounded-2xl text-sm animate-in fade-in zoom-in duration-200">
                      <p className="font-extrabold text-arena-navy-800 mb-2">{entry.courtName}</p>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-muted-foreground">Ocupação:</span>
                          <span className="font-bold text-teal-600">{entry.percentage}%</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-muted-foreground">Reservas:</span>
                          <span className="font-bold text-arena-navy-800">{entry.booked} / {entry.total}</span>
                        </div>
                      </div>
                    </div>
                  )
                }
                return null
              }}
            />
            <Bar
              dataKey={(entry: OccupancyData) => Math.max(entry.percentage, MIN_VISIBLE_VALUE)}
              radius={[10, 10, 10, 10]}
              barSize={20}
              background={{ fill: '#f1f5f9', radius: 10 }}
              animationDuration={1500}
              animationEasing="ease-out"
            >
              {data.map((entry, index) => {
                let color = '#20B2AA';
                if (entry.percentage > 80) color = ARENA_BRAND_HEX.button;
                else if (entry.percentage > 50) color = '#FFD043';

                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={color}
                  />
                )
              })}
              <LabelList
                dataKey={(entry: any) => `${entry.booked}/${entry.total}`}
                position="right"
                className="text-[11px] font-extrabold text-arena-navy-800"
                fill={ARENA_BRAND_HEX.navy800}
                offset={10}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
