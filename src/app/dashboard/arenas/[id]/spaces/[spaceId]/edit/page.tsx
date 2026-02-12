"use client"

import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { Card } from "@/components/ui/card"
import { CourtForm } from "@/modules/courts/components/CourtForm"
import Link from "next/link"
import { useEffect, useState } from "react"
import { CourtService } from "@/modules/courts/services/courtService"
import { toast } from "sonner"

export default function EditSpacePage() {
    const params = useParams()
    const router = useRouter()
    const id = params.id as string
    const spaceId = params.spaceId as string
    const [court, setCourt] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        async function loadCourt() {
            try {
                const data = await CourtService.getCourtById(spaceId)
                setCourt(data)
            } catch (error) {
                console.error("Failed to load court:", error)
                toast.error("Erro ao carregar os dados do espaço.")
                router.push(`/dashboard/arenas/${id}`)
            } finally {
                setIsLoading(false)
            }
        }
        loadCourt()
    }, [id, spaceId, router])

    if (isLoading) {
        return <div className="p-8 text-center text-[#002B40]">Carregando...</div>
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild className="rounded-full">
                    <Link href={`/dashboard/arenas/${id}`}>
                        <ArrowLeft className="w-6 h-6 text-[#002B40]" />
                    </Link>
                </Button>
                <div className="flex flex-col">
                    <span className="text-sm font-medium text-[#002B40]/60">Voltar</span>
                    <h1 className="text-3xl font-black text-[#002B40] tracking-tight">Editar espaço</h1>
                </div>
            </div>

            <Card className="p-8 border-none shadow-lg rounded-xl bg-white">
                <CourtForm
                    initialData={court}
                    arenaId={id}
                    onSuccess={() => router.push(`/dashboard/arenas/${id}`)}
                />
            </Card>
        </div>
    )
}
