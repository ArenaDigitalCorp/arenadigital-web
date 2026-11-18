import { assertArenaResourceAccess } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { SupabaseArenaRepository } from '@/modules/arenas/repositories/SupabaseArenaRepository'
import { ArenaForm } from '@/modules/arenas/components/ArenaForm'
import { ArenaBookingOperationsPanel } from '@/modules/arenas/components/ArenaBookingOperationsPanel'
import { getArenaPixSplitSettingsAction } from '@/modules/arenas/actions/arenaActions'
import { getArenaCancellationPolicySettingsAction } from '@/modules/arenas/actions/cancellationPolicyActions'
import { getArenaReceivingSetupAction } from '@/modules/arenas/actions/receivingSetupActions'
import { ArenaFinancialAccountCard } from '@/modules/finance/components/ArenaFinancialAccountCard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
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
    let access
    try {
        access = await assertArenaResourceAccess(id, 'settings.arena', 'settings.receiving')
    } catch {
        redirect('/dashboard')
    }

    const canEditArena = access.resources.includes('settings.arena')
    const canManageReceiving = (access.isOwner || access.role === 'Gestor') && access.resources.includes('settings.receiving')
    if (!canEditArena && !canManageReceiving) redirect('/dashboard')
    const initialTab = canManageReceiving && (requestedTab === 'receiving' || !canEditArena) ? 'receiving' : 'arena'
    const supabase = getSupabaseAdmin()
    const [registration, receiving] = await Promise.all([
        canEditArena ? new SupabaseArenaRepository(supabase).findRegistrationById(id) : null,
        canManageReceiving ? Promise.all([
            supabase.from('arenas').select('name,legal_name,email,phone,cpf_cnpj,address,number,complement,neighborhood,zip_code,app_booking_mode,accepts_app_booking_requests').eq('id', id).single(),
            getArenaPixSplitSettingsAction(id),
            getArenaCancellationPolicySettingsAction(id),
            getArenaReceivingSetupAction(id),
        ]) : null,
    ])
    if (canEditArena && !registration) redirect('/dashboard/settings/arenas')
    if (receiving && (receiving[0].error || !receiving[0].data)) throw new Error('Não foi possível consultar o cadastro de recebimento.')
    const arena = receiving?.[0].data
    const paymentSettings = receiving?.[1]
    const cancellationPolicySettings = receiving?.[2]
    const receivingSetup = receiving?.[3]

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Editar Arena</h2>
                <p className="text-muted-foreground">Atualize as informações da sua arena.</p>
            </div>
            <Tabs key={initialTab} defaultValue={initialTab} className="gap-0">
                <TabsList
                    variant="line"
                    aria-label="Seções de edição da Arena"
                    className="h-auto w-full justify-start gap-0 rounded-none border-b border-sky-200 p-0"
                >
                    {canEditArena && <TabsTrigger
                        value="arena"
                        className="h-12 flex-none rounded-none px-4 font-bold text-slate-500 after:bottom-0 after:bg-arena-navy-800 data-[state=active]:text-sky-700 sm:px-5"
                    >
                        Dados da arena
                    </TabsTrigger>}
                    {canManageReceiving && <TabsTrigger
                        value="receiving"
                        className="h-12 flex-none rounded-none px-4 font-bold text-slate-500 after:bottom-0 after:bg-arena-navy-800 data-[state=active]:text-arena-navy-800 sm:px-5"
                    >
                        Dados de recebimento
                    </TabsTrigger>}
                </TabsList>

                {registration && <TabsContent
                    value="arena"
                    forceMount
                    className="mt-7 data-[state=inactive]:hidden"
                >
                    <ArenaForm
                        ownerId={access.dbUserId}
                        initialData={registration}
                    />
                </TabsContent>}

                {arena && paymentSettings && cancellationPolicySettings && receivingSetup && <TabsContent
                    value="receiving"
                    forceMount
                    className="mt-7 space-y-6 data-[state=inactive]:hidden"
                >
                    <ArenaFinancialAccountCard arenaId={id} receivingContext />
                    {(!paymentSettings.success || !cancellationPolicySettings.success) ? (
                        <section role="alert" className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
                            <p className="font-semibold">Não foi possível carregar a configuração de reservas.</p>
                            {!paymentSettings.success && <p>A conta de recebimento está temporariamente indisponível para consulta.</p>}
                            {!cancellationPolicySettings.success && <p>A política de cancelamento está temporariamente indisponível para consulta.</p>}
                            <p>Carregue os dados novamente antes de revisar ou alterar as configurações.</p>
                            <Button asChild variant="outline">
                                <a href={`/dashboard/arenas/${id}/edit?tab=receiving`}>Carregar novamente</a>
                            </Button>
                        </section>
                    ) : <ArenaBookingOperationsPanel
                        key={id}
                        arenaId={id}
                        arenaName={arena.name}
                        initialSetup={receivingSetup.success ? receivingSetup.data : null}
                        initialSetupError={receivingSetup.success ? undefined : receivingSetup.error}
                        initialMode={arena.app_booking_mode}
                        legacyAcceptsRequests={arena.accepts_app_booking_requests}
                        paymentSettings={paymentSettings.data}
                        cancellationPolicySettings={cancellationPolicySettings.data}
                        registration={{
                            legalName: arena.legal_name,
                            email: arena.email ?? '',
                            phone: arena.phone ?? '',
                            document: arena.cpf_cnpj ?? '',
                            address: addressStreet(arena.address),
                            addressNumber: arena.number ?? '',
                            complement: arena.complement ?? '',
                            province: arena.neighborhood ?? '',
                            postalCode: arena.zip_code ?? '',
                        }}
                    />}
                </TabsContent>}
            </Tabs>
        </div>
    )
}
