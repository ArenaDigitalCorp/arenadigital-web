'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2, PowerOff, Trash2 } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
    deleteCourtAction,
    getCourtDeletionImpactAction,
    setCourtActiveAction,
    type CourtDeletionImpact,
} from '@/modules/courts/actions/courtActions'

interface Props {
    open: boolean
    onClose: () => void
    arenaId: string
    court: { id: string; name: string; status?: string | null } | null
    /** Espaço excluído de vez — o pai tira da lista. */
    onDeleted: (courtId: string) => void
    /** Espaço desativado ou reativado — o pai atualiza a linha. */
    onStatusChanged: (court: unknown) => void
}

/**
 * Excluir e desativar são coisas diferentes, e a tela precisa deixar isso claro
 * antes de o gestor decidir: desativar tira de operação e é reversível; excluir
 * é permanente e só existe para espaço que nunca foi usado.
 */
export function ExcluirEspacoDialog({
    open,
    onClose,
    arenaId,
    court,
    onDeleted,
    onStatusChanged,
}: Props) {
    const [impacto, setImpacto] = useState<CourtDeletionImpact | null>(null)
    const [carregando, setCarregando] = useState(false)
    const [acao, setAcao] = useState<'excluir' | 'desativar' | null>(null)

    const inativo = court?.status === 'inativo'

    useEffect(() => {
        if (!open || !court) return
        setImpacto(null)
        setCarregando(true)

        let cancelado = false
        void getCourtDeletionImpactAction(arenaId, court.id).then((res) => {
            if (cancelado) return
            setCarregando(false)
            if (!res.success || !res.data) {
                toast.error(res.error ?? 'Não foi possível verificar o espaço.')
                return
            }
            setImpacto(res.data)
        })
        return () => {
            cancelado = true
        }
    }, [open, court, arenaId])

    const handleDesativar = async () => {
        if (!court) return
        setAcao('desativar')
        try {
            const res = await setCourtActiveAction(arenaId, court.id, inativo)
            if (!res.success || !res.data) throw new Error(res.error)
            onStatusChanged(res.data)
            toast.success(
                inativo
                    ? `"${court.name}" foi reativado e volta a aceitar reservas.`
                    : `"${court.name}" foi desativado. O histórico continua intacto.`
            )
            onClose()
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Erro ao alterar o status do espaço.')
        } finally {
            setAcao(null)
        }
    }

    const handleExcluir = async () => {
        if (!court) return
        setAcao('excluir')
        try {
            const res = await deleteCourtAction(arenaId, court.id)
            if (!res.success) throw new Error(res.error)
            onDeleted(court.id)
            toast.success(`"${court.name}" foi excluído.`)
            onClose()
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Erro ao excluir o espaço.')
        } finally {
            setAcao(null)
        }
    }

    const ocupado = acao !== null

    return (
        <Dialog open={open} onOpenChange={(next) => !next && !ocupado && onClose()}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="text-arena-navy-800">
                        {court?.name ?? 'Espaço'}
                    </DialogTitle>
                </DialogHeader>

                {carregando ? (
                    <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Verificando o que está vinculado a este espaço…
                    </p>
                ) : impacto ? (
                    <div className="space-y-4">
                        {/* O que existe hoje */}
                        <div className="rounded-xl border border-border bg-muted/30 p-3.5">
                            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                O que está vinculado
                            </p>
                            <dl className="grid gap-1.5 text-sm">
                                <Linha rotulo="Reservas no histórico" valor={impacto.reservas} />
                                <Linha rotulo="Reservas futuras" valor={impacto.reservasFuturas} />
                                <Linha rotulo="Recorrências de mensalista" valor={impacto.planosMensalistas} />
                                <Linha rotulo="Solicitações do app" valor={impacto.solicitacoesApp} />
                                <Linha rotulo="Tabelas de preço" valor={impacto.tabelasPreco} />
                            </dl>
                        </div>

                        {impacto.podeExcluir ? (
                            <div className="rounded-xl border border-red-200 bg-red-50 p-3.5">
                                <p className="flex items-start gap-2 text-[13px] leading-snug text-red-800">
                                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
                                    <span>
                                        Este espaço nunca foi usado, então pode ser excluído. Vão junto
                                        as <strong>{impacto.tabelasPreco} tabelas de preço</strong> e os
                                        esportes vinculados. <strong>A exclusão é permanente</strong> e
                                        não pode ser desfeita.
                                    </span>
                                </p>
                            </div>
                        ) : (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5">
                                <p className="flex items-start gap-2 text-[13px] leading-snug text-amber-800">
                                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
                                    <span>
                                        Este espaço <strong>não pode ser excluído</strong> porque tem{' '}
                                        {impacto.bloqueios.join(', ')}. Apagá-lo levaria junto esse
                                        histórico e os lançamentos de caixa perderiam a reserva que os
                                        originou.
                                        <br />
                                        <strong>Desative</strong> para tirá-lo de operação sem perder nada.
                                    </span>
                                </p>
                            </div>
                        )}

                        {/* O que desativar faz */}
                        <div className="rounded-xl border border-border p-3.5">
                            <p className="flex items-start gap-2 text-[13px] leading-snug text-muted-foreground">
                                <PowerOff className="mt-0.5 h-4 w-4 flex-none" />
                                <span>
                                    {inativo ? (
                                        <>
                                            Este espaço está <strong>desativado</strong>. Reativar faz ele
                                            voltar a aceitar reservas no backoffice e no app.
                                        </>
                                    ) : (
                                        <>
                                            <strong>Desativar</strong> impede novas reservas, novas
                                            recorrências e pedidos pelo app. As reservas já marcadas
                                            continuam valendo e o histórico fica intacto. Dá para reativar
                                            quando quiser.
                                        </>
                                    )}
                                </span>
                            </p>
                        </div>
                    </div>
                ) : (
                    <p className="py-6 text-sm text-muted-foreground">
                        Não foi possível carregar as informações do espaço.
                    </p>
                )}

                <DialogFooter className="gap-2 sm:gap-2">
                    <Button type="button" variant="outline" onClick={onClose} disabled={ocupado}>
                        Voltar
                    </Button>

                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleDesativar}
                        disabled={ocupado || !impacto}
                        className="gap-2"
                    >
                        {acao === 'desativar' ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <PowerOff className="h-4 w-4" />
                        )}
                        {inativo ? 'Reativar espaço' : 'Desativar espaço'}
                    </Button>

                    <Button
                        type="button"
                        onClick={handleExcluir}
                        disabled={ocupado || !impacto?.podeExcluir}
                        title={
                            impacto && !impacto.podeExcluir
                                ? 'Espaço com histórico não pode ser excluído — use Desativar'
                                : 'Exclui o espaço permanentemente'
                        }
                        className="gap-2 bg-red-500 text-white hover:bg-red-600 disabled:opacity-40"
                    >
                        {acao === 'excluir' ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Trash2 className="h-4 w-4" />
                        )}
                        Excluir permanentemente
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function Linha({ rotulo, valor }: { rotulo: string; valor: number }) {
    return (
        <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">{rotulo}</dt>
            <dd
                className={
                    valor > 0
                        ? 'font-bold tabular-nums text-arena-navy-800'
                        : 'tabular-nums text-muted-foreground/60'
                }
            >
                {valor}
            </dd>
        </div>
    )
}
