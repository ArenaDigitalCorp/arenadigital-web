import { requireAuthenticatedDbUser, assertArenaAdminAccess } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { SupabaseArenaRepository } from '@/modules/arenas/repositories/SupabaseArenaRepository'
import { ArenaForm } from '@/modules/arenas/components/ArenaForm'
import { ArenaBookingOperationsPanel } from '@/modules/arenas/components/ArenaBookingOperationsPanel'
import { getArenaPixSplitSettingsAction } from '@/modules/arenas/actions/arenaActions'
import { getArenaCancellationPolicySettingsAction } from '@/modules/arenas/actions/cancellationPolicyActions'
import { redirect } from 'next/navigation'

function textField(value: unknown): string {
    return typeof value === 'string' ? value : ''
}

function addressStreet(value: unknown): string {
    if (typeof value === 'string') return value
    if (!value || typeof value !== 'object' || Array.isArray(value)) return ''
    return textField((value as Record<string, unknown>).street)
}

export default async function EditArenaPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    try {
        await assertArenaAdminAccess(id)
    } catch {
        redirect('/dashboard/settings/arenas')
    }

    const { dbUserId } = await requireAuthenticatedDbUser()
    const [arena, paymentSettings, cancellationPolicySettings] = await Promise.all([
        new SupabaseArenaRepository(getSupabaseAdmin()).findById(id),
        getArenaPixSplitSettingsAction(id),
        getArenaCancellationPolicySettingsAction(id),
    ])

    if (!arena) redirect('/dashboard/settings/arenas')

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Editar Arena</h2>
                <p className="text-muted-foreground">Atualize as informações da sua arena.</p>
            </div>
            <ArenaForm
                ownerId={dbUserId}
                initialData={arena}
            />
            <ArenaBookingOperationsPanel
                arenaId={id}
                arenaName={arena.name}
                initialMode={arena.app_booking_mode}
                legacyAcceptsRequests={arena.accepts_app_booking_requests}
                paymentSettings={paymentSettings.data}
                cancellationPolicySettings={cancellationPolicySettings.data}
                registration={{
                    email: arena.email ?? '',
                    phone: arena.phone ?? '',
                    document: arena.cpf_cnpj ?? '',
                    address: addressStreet(arena.address),
                    addressNumber: arena.number ?? '',
                    complement: arena.complement ?? '',
                    province: arena.neighborhood ?? '',
                    postalCode: arena.zip_code ?? '',
                }}
            />
        </div>
    )
}
