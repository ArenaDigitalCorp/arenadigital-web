"use client"

import { Input } from "@/components/ui/input"
import { Image as ImageIcon } from "lucide-react"
import Image from "next/image"
import { useRef, useState, useEffect } from "react"
import { cn } from "@/lib/utils"

interface ImageUploadProps {
    value?: string
    onChange: (file: File) => void
    disabled?: boolean
    className?: string
}

export function ImageUpload({ value, onChange, disabled, className }: ImageUploadProps) {
    const [preview, setPreview] = useState<string | null>(value || null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (value) {
            setPreview(value)
        }
    }, [value])

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            onChange(file)
            const reader = new FileReader()
            reader.onloadend = () => {
                setPreview(reader.result as string)
            }
            reader.readAsDataURL(file)
        }
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        if (disabled) return
        const file = e.dataTransfer.files?.[0]
        if (file) {
            onChange(file)
            const reader = new FileReader()
            reader.onloadend = () => {
                setPreview(reader.result as string)
            }
            reader.readAsDataURL(file)
        }
    }

    return (
        <div
            className={cn(
                "border-2 border-dashed border-gray-200 rounded-lg p-4 h-[240px] flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors relative overflow-hidden bg-[#F8FAFC]",
                disabled && "opacity-50 cursor-not-allowed",
                className
            )}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => !disabled && fileInputRef.current?.click()}
        >
            <Input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleImageSelect}
                disabled={disabled}
            />

            {preview ? (
                <>
                    <Image
                        src={preview}
                        alt="Preview"
                        fill
                        className="object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <p className="text-white font-medium">Trocar imagem</p>
                    </div>
                </>
            ) : (
                <div className="text-center space-y-2">
                    <div className="bg-white p-3 rounded-full shadow-sm inline-block">
                        <ImageIcon className="w-6 h-6 text-[#002B40]/40" />
                    </div>
                    <p className="text-xs text-[#002B40]/40 px-4">
                        Arraste ou clique aqui para inserir a foto.
                    </p>
                </div>
            )}
        </div>
    )
}
