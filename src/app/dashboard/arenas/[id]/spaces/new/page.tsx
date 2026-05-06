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
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild className="rounded-full">
                    <Link href={`/dashboard/arenas/${id}`}>
                        <ArrowLeft className="w-6 h-6 text-arena-navy-800" />
                    </Link>
                </Button>
                <div className="flex flex-col">
                    <span className="text-sm font-medium text-arena-navy-800/60">Voltar</span>
                    <h1 className="text-3xl font-black text-arena-navy-800 tracking-tight">Novo espaço</h1>
                </div>
            </div>

            <Card className="p-8 border-none shadow-lg rounded-xl bg-white">
                <CourtForm arenaId={id} />
            </Card>
        </div>
    )
}
