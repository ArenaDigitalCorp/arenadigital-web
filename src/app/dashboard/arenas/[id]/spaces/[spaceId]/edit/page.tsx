import { assertArenaBackofficeAccess, assertCourtAccess } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { CourtForm } from '@/modules/courts/components/CourtForm'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function EditSpacePage({ params }: { params: Promise<{ id: string; spaceId: string }> }) {
    const { id, spaceId } = await params

    try {
        await assertArenaBackofficeAccess(id)
        await assertCourtAccess(spaceId, id)
    } catch {
        redirect(`/dashboard/arenas/${id}`)
    }

    const { data, error } = await getSupabaseAdmin()
        .from('courts')
        .select(`*, sports:court_sports(sport:sports(*))`)
        .eq('id', spaceId)
        .eq('arena_id', id)
        .single()

    if (error || !data) redirect(`/dashboard/arenas/${id}`)

    const court = { ...data, sports: (data.sports as any[]).map(s => s.sport) }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <Button variant="ghost" asChild className="h-auto w-fit justify-start gap-1.5 rounded-md px-0 py-0 text-sm font-medium text-arena-navy-800/70 hover:bg-transparent hover:text-arena-navy-800">
                    <Link href={`/dashboard/arenas/${id}`} className="inline-flex items-center gap-1.5">
                        <ArrowLeft className="size-4 shrink-0 text-arena-navy-800" aria-hidden />
                        Voltar
                    </Link>
                </Button>
                <h1 className="text-3xl font-black text-arena-navy-800 tracking-tight">{court.name}</h1>
            </div>

            <Card className="p-8 border-none shadow-lg rounded-xl bg-white">
                <CourtForm initialData={court} arenaId={id} />
            </Card>
        </div>
    )
}
