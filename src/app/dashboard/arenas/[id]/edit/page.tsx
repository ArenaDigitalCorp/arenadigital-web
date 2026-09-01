import { requireAuthenticatedDbUser, assertArenaAdminAccess } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { SupabaseArenaRepository } from '@/modules/arenas/repositories/SupabaseArenaRepository'
import { ArenaForm } from '@/modules/arenas/components/ArenaForm'
import { ArenaPixSplitSettingsCard } from '@/modules/arenas/components/ArenaPixSplitSettingsCard'
import { ArenaCancellationPolicyCard } from '@/modules/arenas/components/ArenaCancellationPolicyCard'
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

    const onlineBookingMissing = [
        ...(!paymentSettings.data.enabled || paymentSettings.data.credentialRecoveryRequired
            ? ['a conta de recebimento aprovada e ativa']
            : []),
        ...(!cancellationPolicySettings.data.currentPolicy
            ? ['uma política de cancelamento publicada']
            : []),
    ]
    const onlineBookingReady = onlineBookingMissing.length === 0

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Editar Arena</h2>
                <p className="text-muted-foreground">Atualize as informações da sua arena.</p>
            </div>
            <ArenaForm
                ownerId={dbUserId}
                initialData={arena}
                onlineBookingReady={onlineBookingReady}
                onlineBookingMissing={onlineBookingMissing}
            />
            <ArenaCancellationPolicyCard
                arenaId={id}
                initialSettings={cancellationPolicySettings.data}
            />
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white px-5 pb-6 shadow-sm sm:px-6">
                <ArenaPixSplitSettingsCard
                    accessMode="arena"
                    arenaId={id}
                    arenaName={arena.name}
                    initialSettings={paymentSettings.data}
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
            </section>
        </div>
    )
}
