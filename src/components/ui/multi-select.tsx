"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface MultiSelectProps {
    options: { label: string; value: string }[]
    value: string[]
    onChange: (value: string[]) => void
    placeholder?: string
    className?: string
}

export function MultiSelect({
    options,
    value,
    onChange,
    placeholder = "Selecione...",
    className,
}: MultiSelectProps) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    className={cn("w-full justify-between", className)}
                >
                    {value.length > 0
                        ? `${value.length} selecionado(s)`
                        : placeholder}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-full min-w-[var(--radix-dropdown-menu-trigger-width)]">
                {options.map((option) => (
                    <DropdownMenuCheckboxItem
                        key={option.value}
                        checked={value.includes(option.value)}
                        onCheckedChange={(checked) => {
                            const next = checked
                                ? [...value, option.value]
                                : value.filter((item) => item !== option.value)
                            onChange(next)
                        }}
                    >
                        {option.label}
                    </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
