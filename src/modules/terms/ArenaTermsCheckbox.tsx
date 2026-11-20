"use client"

import Link from "next/link"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { ARENA_TERMS_CHECKBOX_LABEL, ARENA_TERMS_URL } from "./arena-terms"

type Props = {
  id: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  appearance?: "dark" | "light"
}

export function ArenaTermsCheckbox({ id, checked, onCheckedChange, appearance = "light" }: Props) {
  return (
    <div className={cn("space-y-2 text-sm", appearance === "dark" ? "text-white" : "text-foreground")}>
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          required
          checked={checked}
          onChange={event => onCheckedChange(event.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-arena-button"
        />
        <Label htmlFor={id} className="cursor-pointer text-sm leading-5">
          {ARENA_TERMS_CHECKBOX_LABEL}
        </Label>
      </div>
      <Link
        href={ARENA_TERMS_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="ml-7 inline-block underline underline-offset-4"
      >
        Ler os Termos de Uso
      </Link>
    </div>
  )
}
