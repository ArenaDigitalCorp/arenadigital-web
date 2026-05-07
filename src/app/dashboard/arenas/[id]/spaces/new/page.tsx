import { assertArenaBackofficeAccess } from '@/lib/server-auth'
import { CourtForm } from '@/modules/courts/components/CourtForm'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function NewSpacePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    try {
        await assertArenaBackofficeAccess(id)
    } catch {
        redirect(`/dashboard/arenas/${id}`)
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <Button variant="ghost" asChild className="h-auto w-fit justify-start gap-1.5 rounded-md px-0 py-0 text-sm font-medium text-arena-navy-800/70 hover:bg-transparent hover:text-arena-navy-800">
                    <Link href={`/dashboard/arenas/${id}`} className="inline-flex items-center gap-1.5">
                        <ArrowLeft className="size-4 shrink-0 text-arena-navy-800" aria-hidden />
                        Voltar
                    </Link>
                </Button>
                <h1 className="text-3xl font-black text-arena-navy-800 tracking-tight">Novo espaço</h1>
            </div>

            <Card className="p-8 border-none shadow-lg rounded-xl bg-white">
                <CourtForm arenaId={id} />
            </Card>
        </div>
    )
}
