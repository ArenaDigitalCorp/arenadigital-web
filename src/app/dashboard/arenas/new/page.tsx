import { requireAuthenticatedDbUser } from '@/lib/server-auth'
import { ArenaForm } from '@/modules/arenas/components/ArenaForm'

export default async function NewArenaPage() {
    const { dbUserId } = await requireAuthenticatedDbUser()

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Nova Arena</h2>
                <p className="text-muted-foreground">Preencha os dados abaixo para cadastrar sua nova arena.</p>
            </div>
            <ArenaForm ownerId={dbUserId} />
        </div>
    )
}
