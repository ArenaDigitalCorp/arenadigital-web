"use client"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Copy } from "lucide-react"
import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"

export interface CustomPrice {
    start: string
    end: string
    price: number
}

export interface DayConfig {
    day: string
    enabled: boolean
    startTime: string
    endTime: string
    price: number
    customPrices: CustomPrice[]
    slotShiftTime?: string | null
}

interface DayScheduleConfigProps {
    day: string
    config: DayConfig
    onChange: (config: DayConfig) => void
    onReplicate?: () => void
}

export function DayScheduleConfig({ day, config, onChange, onReplicate }: DayScheduleConfigProps) {
    const handleToggle = (checked: boolean) => {
        onChange({ ...config, enabled: checked })
    }

    const handleChange = (field: keyof DayConfig, value: any) => {
        onChange({ ...config, [field]: value })
    }

    const addCustomPrice = () => {
        const newCustom: CustomPrice = { start: "08:00", end: "09:00", price: config.price || 0 }
        onChange({ ...config, customPrices: [...config.customPrices, newCustom] })
    }

    const removeCustomPrice = (index: number) => {
        const newCustom = [...config.customPrices]
        newCustom.splice(index, 1)
        onChange({ ...config, customPrices: newCustom })
    }

    const updateCustomPrice = (index: number, field: keyof CustomPrice, value: any) => {
        const newCustom = [...config.customPrices]
        newCustom[index] = { ...newCustom[index], [field]: value }
        onChange({ ...config, customPrices: newCustom })
    }

    return (
        <div className={`border rounded-lg p-4 transition-colors ${config.enabled ? 'bg-white border-orange-200' : 'bg-gray-50 border-gray-100'}`}>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                    <Checkbox
                        id={`enable-${day}`}
                        checked={config.enabled}
                        onCheckedChange={handleToggle}
                        className="data-[state=checked]:bg-[#FF6B00] data-[state=checked]:border-[#FF6B00]"
                    />
                    <Label htmlFor={`enable-${day}`} className="font-semibold text-lg cursor-pointer select-none">
                        {day}
                    </Label>
                </div>
                <div className="flex items-center gap-2">
                    {config.enabled && onReplicate && (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={onReplicate}
                            className="h-7 text-xs border-orange-200 text-orange-700 hover:bg-orange-50"
                            title="Replicar para todos os dias"
                        >
                            <Copy className="h-3 w-3 mr-1" />
                            Replicar
                        </Button>
                    )}
                    {config.enabled && (
                        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                            Ativo
                        </Badge>
                    )}
                </div>
            </div>

            {config.enabled && (
                <div className="space-y-4 pl-6 border-l-2 border-orange-100/50">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Início</Label>
                            <Input
                                type="time"
                                value={config.startTime}
                                onChange={(e) => handleChange("startTime", e.target.value)}
                                className="h-9"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Fim</Label>
                            <Input
                                type="time"
                                value={config.endTime}
                                onChange={(e) => handleChange("endTime", e.target.value)}
                                className="h-9"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Valor Hora (Padrão)</Label>
                            <div className="relative">
                                <span className="absolute left-2.5 top-2 text-muted-foreground text-xs">R$</span>
                                <Input
                                    type="number"
                                    value={config.price || 0}
                                    onChange={(e) => {
                                        const val = parseFloat(e.target.value)
                                        handleChange("price", isNaN(val) ? 0 : val)
                                    }}
                                    className="pl-7 h-9"
                                    step="0.01"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 pt-1">
                        <Checkbox
                            id={`shift-${day}`}
                            checked={!!config.slotShiftTime}
                            onCheckedChange={(checked) =>
                                handleChange("slotShiftTime", checked ? "17:00" : null)
                            }
                            className="data-[state=checked]:bg-[#FF6B00] data-[state=checked]:border-[#FF6B00]"
                        />
                        <Label htmlFor={`shift-${day}`} className="text-xs text-muted-foreground cursor-pointer select-none">
                            Virada de horário — slots passam a ser :30 a partir de
                        </Label>
                        {config.slotShiftTime && (
                            <Input
                                type="time"
                                value={config.slotShiftTime}
                                onChange={(e) => handleChange("slotShiftTime", e.target.value)}
                                className="h-8 w-24 text-xs"
                            />
                        )}
                    </div>

                    <div className="pt-2">
                        <div className="flex items-center justify-between mb-2">
                            <Label className="text-sm font-medium text-gray-700">Preços diferenciados por horário</Label>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={addCustomPrice}
                                className="h-7 text-xs text-[#FF6B00] hover:text-[#E66000] hover:bg-orange-50"
                            >
                                <Plus className="h-3 w-3 mr-1" />
                                Adicionar
                            </Button>
                        </div>

                        <div className="space-y-2">
                            {config.customPrices.map((cp, index) => (
                                <div key={index} className="flex items-center gap-2 bg-orange-50/50 p-2 rounded-md">
                                    <Input
                                        type="time"
                                        value={cp.start}
                                        onChange={(e) => updateCustomPrice(index, "start", e.target.value)}
                                        className="h-8 w-24 text-xs bg-white"
                                        placeholder="Início"
                                    />
                                    <span className="text-xs text-muted-foreground">até</span>
                                    <Input
                                        type="time"
                                        value={cp.end}
                                        onChange={(e) => updateCustomPrice(index, "end", e.target.value)}
                                        className="h-8 w-24 text-xs bg-white"
                                        placeholder="Fim"
                                    />
                                    <div className="relative w-24">
                                        <span className="absolute left-2 top-2 text-muted-foreground text-xs">R$</span>
                                        <Input
                                            type="number"
                                            value={cp.price || 0}
                                            onChange={(e) => {
                                                const val = parseFloat(e.target.value)
                                                updateCustomPrice(index, "price", isNaN(val) ? 0 : val)
                                            }}
                                            className="h-8 pl-6 text-xs bg-white"
                                            placeholder="Valor"
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeCustomPrice(index)}
                                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>
                            ))}
                            {config.customPrices.length === 0 && (
                                <p className="text-xs text-muted-foreground italic">
                                    Nenhum preço diferenciado configurado.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
