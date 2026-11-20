"use client"

import { Image as ImageIcon } from "lucide-react"
import Image from "next/image"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

interface ImageUploadProps {
    value?: string
    file: File | null
    onChange: (file: File) => void
    disabled?: boolean
    className?: string
    label: string
}

export function ImageUpload({ value, file, onChange, disabled, className, label }: ImageUploadProps) {
    const [local, setLocal] = useState<{ file: File; url: string } | null>(null)
    useEffect(() => {
        if (!file) return
        const reader = new FileReader()
        reader.onload = () => {
            if (typeof reader.result === "string") setLocal({ file, url: reader.result })
        }
        reader.readAsDataURL(file)
        return () => reader.abort()
    }, [file])
    const preview = file && local?.file === file ? local.url : value

    return (
        <label
            className={cn(
                "relative flex h-[240px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-gray-200 bg-arena-soft p-4 transition-colors hover:bg-gray-50 focus-within:ring-2 focus-within:ring-arena-button",
                disabled && "cursor-not-allowed opacity-60", className
            )}
            onDragOver={event => event.preventDefault()}
            onDrop={event => {
                event.preventDefault()
                const dropped = event.dataTransfer.files[0]
                if (!disabled && dropped) onChange(dropped)
            }}
        >
            <input type="file" className="sr-only" accept="image/*" aria-label={label} disabled={disabled} onChange={event => {
                const selected = event.target.files?.[0]
                if (selected) onChange(selected)
                event.target.value = ""
            }} />
            {preview ? (
                <>
                    <Image src={preview} alt={label} fill className="object-cover" />
                    {!disabled && <span className="absolute inset-0 flex items-center justify-center bg-black/40 font-medium text-white opacity-0 hover:opacity-100">Trocar imagem</span>}
                </>
            ) : (
                <span className="space-y-2 text-center">
                    <span className="inline-block rounded-full bg-white p-3 shadow-sm"><ImageIcon aria-hidden="true" className="size-6 text-arena-navy-800/60" /></span>
                    <span className="block px-4 text-xs text-arena-navy-800/70">Arraste ou clique para inserir a imagem.</span>
                </span>
            )}
        </label>
    )
}
