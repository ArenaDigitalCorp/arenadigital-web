import { assertArenaAccess } from '@/lib/server-auth'
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
        await assertArenaAccess(id)
    } catch {
        redirect(`/dashboard/arenas/${id}`)
    }

    const { data, error } = await getSupabaseAdmin()
        .from('courts')
        .select(`*, sports:court_sports(sport:sports(*))`)
        .eq('id', spaceId)
        .single()

    if (error || !data) redirect(`/dashboard/arenas/${id}`)

    const court = { ...data, sports: (data.sports as any[]).map(s => s.sport) }

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
                <CourtForm initialData={court} arenaId={id} />
            </Card>
        </div>
    )
}
