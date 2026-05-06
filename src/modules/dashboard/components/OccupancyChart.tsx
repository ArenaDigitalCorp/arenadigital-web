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
}

export function OccupancyChart({ data }: OccupancyChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-muted-foreground italic">
        Nenhum dado de ocupação disponível para hoje.
      </div>
    )
  }

  return (
    <div className="w-full h-[400px] pt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart 
          data={data} 
          margin={{ left: -20, right: 10, top: 40, bottom: 20 }}
        >
          <XAxis 
            dataKey="courtName" 
            type="category" 
            axisLine={false}
            tickLine={false}
            className="text-[9px] font-bold uppercase text-arena-navy-800/60"
            tick={{ fill: ARENA_BRAND_HEX.navy800, opacity: 0.6 }}
            interval={0}
          />
          <YAxis 
            type="number" 
            domain={[0, 100]} 
            hide
          />
          <Tooltip 
            cursor={{ fill: 'transparent' }}
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
            dataKey="percentage" 
            radius={[10, 10, 10, 10]} 
            barSize={40}
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
              position="top"
              className="text-[11px] font-extrabold text-arena-navy-800"
              fill={ARENA_BRAND_HEX.navy800}
              offset={10}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
