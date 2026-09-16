import { requireAuthenticatedDbUser, assertArenaAdminAccess } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { SupabaseArenaRepository } from '@/modules/arenas/repositories/SupabaseArenaRepository'
import { ArenaForm } from '@/modules/arenas/components/ArenaForm'
import { ArenaBookingOperationsPanel } from '@/modules/arenas/components/ArenaBookingOperationsPanel'
import { getArenaPixSplitSettingsAction } from '@/modules/arenas/actions/arenaActions'
import { getArenaCancellationPolicySettingsAction } from '@/modules/arenas/actions/cancellationPolicyActions'
import { ArenaFinancialAccountCard } from '@/modules/finance/components/ArenaFinancialAccountCard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { redirect } from 'next/navigation'

function textField(value: unknown): string {
    return typeof value === 'string' ? value : ''
}

function addressStreet(value: unknown): string {
    if (typeof value === 'string') return value
    if (!value || typeof value !== 'object' || Array.isArray(value)) return ''
    return textField((value as Record<string, unknown>).street)
}

export default async function EditArenaPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>
    searchParams: Promise<{ tab?: string | string[] }>
}) {
    const { id } = await params
    const { tab } = await searchParams
    const requestedTab = Array.isArray(tab) ? tab[0] : tab
    const initialTab = requestedTab === 'receiving' ? 'receiving' : 'arena'

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
            <Tabs defaultValue={initialTab} className="gap-0">
                <TabsList
                    variant="line"
                    aria-label="Seções de edição da Arena"
                    className="h-auto w-full justify-start gap-0 rounded-none border-b border-sky-200 p-0"
                >
                    <TabsTrigger
                        value="arena"
                        className="h-12 flex-none rounded-none px-4 font-bold text-slate-500 after:bottom-0 after:bg-arena-navy-800 data-[state=active]:text-sky-700 sm:px-5"
                    >
                        Dados da arena
                    </TabsTrigger>
                    <TabsTrigger
                        value="receiving"
                        className="h-12 flex-none rounded-none px-4 font-bold text-slate-500 after:bottom-0 after:bg-arena-navy-800 data-[state=active]:text-arena-navy-800 sm:px-5"
                    >
                        Dados de recebimento
                    </TabsTrigger>
                </TabsList>

                <TabsContent
                    value="arena"
                    forceMount
                    className="mt-7 data-[state=inactive]:hidden"
                >
                    <ArenaForm
                        ownerId={dbUserId}
                        initialData={arena}
                    />
                </TabsContent>

                <TabsContent
                    value="receiving"
                    forceMount
                    className="mt-7 space-y-6 data-[state=inactive]:hidden"
                >
                    <ArenaFinancialAccountCard arenaId={id} />
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
                </TabsContent>
            </Tabs>
        </div>
    )
}
